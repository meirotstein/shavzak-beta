import { parseSheetDate } from '../domain/dates';
import { normalizePresence } from '../domain/presence';
import {
  AppSettings,
  CategorySummary,
  CompanyData,
  PresenceValue,
  SoldierPresence,
  SoldierProfile,
  SpreadsheetMeta,
} from '../domain/types';

type SheetValue = string | number | boolean | null;

interface ValuesResponse {
  values?: SheetValue[][];
}

function columnToLetter(column: number): string {
  let temp: number;
  let letter = '';
  let current = column;

  while (current > 0) {
    temp = (current - 1) % 26;
    letter = String.fromCharCode(temp + 65) + letter;
    current = (current - temp - 1) / 26;
  }

  return letter;
}

function rangeFromGrid(row: number, col: number, rowCount = 1, colCount = 1): string {
  const start = `${columnToLetter(col)}${row}`;
  const end = `${columnToLetter(col + colCount - 1)}${row + rowCount - 1}`;
  return `${start}:${end}`;
}

function asNumber(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function rowValues(rows: SheetValue[][] | undefined, index: number): SheetValue[] {
  return rows?.[index] || [];
}

function text(value: unknown): string {
  return value == null ? '' : String(value);
}

export class SpreadsheetRepository {
  constructor(private readonly spreadsheetId: string) {}

  async loadCompanyData(): Promise<CompanyData> {
    const [spreadsheet, userEmail] = await Promise.all([this.getSpreadsheet(), this.getUserEmail()]);
    const settings = await this.loadSettings();
    const isReadOnly = !(await this.isEditAllowed(userEmail));

    const meta: SpreadsheetMeta = {
      spreadsheetId: this.spreadsheetId,
      title: spreadsheet.properties?.title || this.spreadsheetId,
      isReadOnly,
      userEmail,
    };

    const [period, presenceRows, categories, missionCounts, soldiers] = await Promise.all([
      this.getValues('נוכחות', `${settings.dateCol}${settings.dateStartRow}:${settings.dateCol}${settings.dateEndRow}`, 'FORMATTED_VALUE'),
      this.loadPresenceRows(settings),
      this.loadCategories(settings),
      this.loadMissionCounts(settings),
      this.loadSoldiers(settings),
    ]);

    const startDate = parseSheetDate(rowValues(period.values, 0)[0]);
    const endDate = parseSheetDate(rowValues(period.values, 1)[0]);

    return {
      settings,
      meta,
      startDate,
      endDate,
      soldiers,
      presenceRows,
      categories,
      missionCounts,
    };
  }

  async setPresence(settings: AppSettings, soldierRow: number, dayIndex: number, value: PresenceValue): Promise<void> {
    const col = settings.nameCol + dayIndex + 1;
    await this.updateValue('נוכחות', rangeFromGrid(soldierRow, col), value);
  }

  async setComment(profileRow: number, value: string): Promise<void> {
    await this.updateValue('חיילים', rangeFromGrid(profileRow, 6), value);
  }

  private async loadSettings(): Promise<AppSettings> {
    const response = await this.getValues('settings', 'A1:F40');
    const values = response.values || [];
    const presenceSettings: SheetValue[] = [];
    const missionSettings: SheetValue[] = [];
    const soldierSettings: SheetValue[] = [];

    values.forEach((row) => {
      if (row[1] !== undefined && row[1] !== '') presenceSettings.push(row[1]);
      if (row[3] !== undefined && row[3] !== '') missionSettings.push(row[3]);
      if (row[5] !== undefined && row[5] !== '') soldierSettings.push(row[5]);
    });

    return {
      nameCol: asNumber(presenceSettings[0]),
      nameRowStart: asNumber(presenceSettings[1]),
      nameRowCount: asNumber(presenceSettings[2]),
      categoryRowStart: asNumber(presenceSettings[3]),
      categoryRowCount: asNumber(presenceSettings[4]),
      dateCol: 'B',
      dateStartRow: 1,
      dateEndRow: 2,
      jobRowStart: 2,
      jobCol: 3,
      jobColCount: asNumber(missionSettings[0]),
      missionRowStart: asNumber(missionSettings[1]),
      missionCol: 3,
      soldierRowStart: 3,
      soldierRowCount: asNumber(soldierSettings[0]),
      soldierCol: 1,
      soldierColCount: 7,
    };
  }

  private async loadPresenceRows(settings: AppSettings): Promise<SoldierPresence[]> {
    const dayCount = await this.getDayCount(settings);
    const response = await this.getValues(
      'נוכחות',
      rangeFromGrid(settings.nameRowStart, settings.nameCol, settings.nameRowCount, dayCount + 1),
    );
    const values = response.values || [];

    if (!values.length) {
      throw new Error('no_names_error');
    }

    return values
      .map((row, idx) => ({
        row: settings.nameRowStart + idx,
        description: text(row[0]),
        presence: row.slice(1).map(normalizePresence),
      }))
      .filter((soldier) => soldier.description);
  }

  private async loadCategories(settings: AppSettings): Promise<CategorySummary[]> {
    const dayCount = await this.getDayCount(settings);
    const response = await this.getValues(
      'נוכחות',
      rangeFromGrid(settings.categoryRowStart, settings.nameCol, settings.categoryRowCount, dayCount + 1),
    );

    return (response.values || [])
      .map((row) => ({
        name: text(row[0]),
        sums: row.slice(1).map((value) => asNumber(value)),
      }))
      .filter((category) => category.name);
  }

  private async loadMissionCounts(settings: AppSettings): Promise<Record<string, number>> {
    const [jobs, counts] = await Promise.all([
      this.getValues('משימות', rangeFromGrid(settings.jobRowStart, settings.jobCol, 1, settings.jobColCount)),
      this.getValues('משימות', rangeFromGrid(settings.missionRowStart, settings.missionCol, 1, settings.jobColCount)),
    ]);

    const result: Record<string, number> = {};
    const jobRow = rowValues(jobs.values, 0);
    const countRow = rowValues(counts.values, 0);

    jobRow.forEach((job, idx) => {
      const key = text(job);
      if (key) result[key] = asNumber(countRow[idx]);
    });

    return result;
  }

  private async loadSoldiers(settings: AppSettings): Promise<SoldierProfile[]> {
    const response = await this.getValues(
      'חיילים',
      rangeFromGrid(settings.soldierRowStart, settings.soldierCol, settings.soldierRowCount, settings.soldierColCount),
    );

    return (response.values || []).map((row, idx) => ({
      row: settings.soldierRowStart + idx,
      id: text(row[0]),
      fullName: text(row[1]),
      platoon: text(row[2]),
      role: text(row[3]),
      description: text(row[4]),
      comment: text(row[5]),
    }));
  }

  private async getDayCount(settings: AppSettings): Promise<number> {
    const response = await this.getValues(
      'נוכחות',
      `${settings.dateCol}${settings.dateStartRow}:${settings.dateCol}${settings.dateEndRow}`,
      'FORMATTED_VALUE',
    );
    const startDate = parseSheetDate(rowValues(response.values, 0)[0]);
    const endDate = parseSheetDate(rowValues(response.values, 1)[0]);
    return Math.floor((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1;
  }

  private async getSpreadsheet() {
    const response = await gapi.client.sheets.spreadsheets.get({
      spreadsheetId: this.spreadsheetId,
    });
    return JSON.parse(response.body);
  }

  private async getUserEmail(): Promise<string> {
    try {
      const response = await gapi.client.drive.about.get({
        fields: 'user(emailAddress,displayName)',
      });
      return response.result?.user?.emailAddress || '';
    } catch {
      return '';
    }
  }

  private async isEditAllowed(userEmail: string): Promise<boolean> {
    try {
      const response = await gapi.client.drive.files.get({
        fileId: this.spreadsheetId,
        fields: 'id, name, permissions',
      });
      const permissions = response.result?.permissions || [];
      const permission = permissions.find((item: { emailAddress?: string }) => item.emailAddress === userEmail);
      return permission?.role === 'writer' || permission?.role === 'owner';
    } catch {
      return false;
    }
  }

  private async getValues(sheet: string, range: string, valueRenderOption = 'UNFORMATTED_VALUE'): Promise<ValuesResponse> {
    const response = await gapi.client.sheets.spreadsheets.values.get({
      spreadsheetId: this.spreadsheetId,
      valueRenderOption,
      range: `${sheet}!${range}`,
    });
    return JSON.parse(response.body);
  }

  private async updateValue(sheet: string, range: string, value: string): Promise<void> {
    await gapi.client.sheets.spreadsheets.values.update({
      spreadsheetId: this.spreadsheetId,
      range: `${sheet}!${range}`,
      valueInputOption: 'RAW',
      resource: { values: [[value]] },
    });
  }
}
