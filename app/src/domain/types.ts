export type PresenceValue = '' | '0' | '1' | '2' | '3';

export interface AppSettings {
  nameCol: number;
  nameRowStart: number;
  nameRowCount: number;
  categoryRowStart: number;
  categoryRowCount: number;
  dateCol: string;
  dateStartRow: number;
  dateEndRow: number;
  jobRowStart: number;
  jobCol: number;
  jobColCount: number;
  missionRowStart: number;
  missionCol: number;
  soldierRowStart: number;
  soldierRowCount: number;
  soldierCol: number;
  soldierColCount: number;
}

export interface SoldierPresence {
  row: number;
  description: string;
  presence: PresenceValue[];
}

export interface SoldierProfile {
  row: number;
  id: string;
  fullName: string;
  platoon: string;
  role: string;
  description: string;
  comment: string;
}

export interface CategorySummary {
  name: string;
  sums: number[];
}

export interface SpreadsheetMeta {
  spreadsheetId: string;
  title: string;
  isReadOnly: boolean;
  userEmail: string;
}

export interface CompanyData {
  settings: AppSettings;
  meta: SpreadsheetMeta;
  startDate: number;
  endDate: number;
  soldiers: SoldierProfile[];
  presenceRows: SoldierPresence[];
  categories: CategorySummary[];
  missionCounts: Record<string, number>;
}

export interface SelectedSoldier extends SoldierPresence {
  profile?: SoldierProfile;
}

export interface DailyPresenceGroup {
  presence: string[];
  home: string[];
  sick: string[];
  arrangement: string[];
}

export interface DailyPresence {
  totalPresence: number;
  totalHome: number;
  totalSick: number;
  totalArrangement: number;
  platoons: string[];
  groups: Record<string, DailyPresenceGroup>;
}
