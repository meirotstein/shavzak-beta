import { CompanyData, DailyPresence, PresenceValue, SelectedSoldier } from './types';
import { getDaysBetween } from './dates';

export const DEFAULT_CATEGORY = 'סהכ';
export const HOME_CATEGORY = 'בחופש';

export function normalizePresence(value: unknown): PresenceValue {
  const text = value == null ? '' : String(value);
  return text === '0' || text === '1' || text === '2' || text === '3' ? text : '';
}

export function nextPresenceValue(current: PresenceValue): PresenceValue {
  if (current === '3') return '1';
  if (current === '1') return '0';
  if (current === '0') return '2';
  return '1';
}

export function getPresenceCategory(description: string): string | undefined {
  const match = /^.*\[(.*)\].*$/.exec(description);
  return match?.[1];
}

export function parseSoldierDescription(description: string): { name: string; platoon: string } {
  const match = description.match(/^(.*?)\s*\[.*?\]\s*(.*)$/);
  if (!match) {
    return { name: description, platoon: 'ללא מחלקה' };
  }

  return {
    name: match[1].trim() || description,
    platoon: match[2].trim() || 'ללא מחלקה',
  };
}

export function countDelta(oldValue: PresenceValue, newValue: PresenceValue): number {
  if (oldValue === '1' && newValue !== '1') return -1;
  if (oldValue !== '1' && newValue === '1') return 1;
  return 0;
}

export function homeDelta(oldValue: PresenceValue, newValue: PresenceValue): number {
  if (oldValue !== '0' && newValue === '0') return 1;
  if (oldValue === '0' && newValue !== '0') return -1;
  return 0;
}

export function createDailyPresence(data: CompanyData, date: Date): DailyPresence {
  const dayIdx = getDaysBetween(data.startDate, date.getTime());
  const result: DailyPresence = {
    totalPresence: 0,
    totalHome: 0,
    totalSick: 0,
    totalArrangement: 0,
    platoons: [],
    groups: {},
  };

  data.presenceRows.forEach((soldier) => {
    const { name, platoon } = parseSoldierDescription(soldier.description);
    if (!result.groups[platoon]) {
      result.groups[platoon] = { presence: [], home: [], sick: [], arrangement: [] };
      result.platoons.push(platoon);
    }

    const value = normalizePresence(soldier.presence[dayIdx]);
    if (value === '1') {
      result.groups[platoon].presence.push(name);
      result.totalPresence += 1;
    } else if (value === '0') {
      result.groups[platoon].home.push(name);
      result.totalHome += 1;
    } else if (value === '2') {
      result.groups[platoon].sick.push(name);
      result.totalSick += 1;
    } else if (value === '3') {
      result.groups[platoon].arrangement.push(name);
      result.totalArrangement += 1;
    }
  });

  return result;
}

export function profileForSoldier(data: CompanyData, soldier: SelectedSoldier) {
  return data.soldiers.find((profile) => profile.description === soldier.description);
}
