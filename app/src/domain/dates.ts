export function parseSheetDate(value: unknown): number {
  if (typeof value === 'number') {
    const epoch = Date.UTC(1899, 11, 30);
    return epoch + value * 24 * 60 * 60 * 1000;
  }

  if (value instanceof Date) {
    return value.getTime();
  }

  if (typeof value === 'string') {
    const normalized = value.trim();
    const iso = normalized.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
    if (iso) {
      return new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3])).getTime();
    }

    const slash = normalized.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
    if (slash) {
      const rawYear = Number(slash[3]);
      const year = rawYear < 100 ? 2000 + rawYear : rawYear;
      return new Date(year, Number(slash[2]) - 1, Number(slash[1])).getTime();
    }

    const parsed = new Date(normalized);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.getTime();
    }
  }

  throw new Error('Invalid spreadsheet date');
}

export function buildDateRange(startTs: number, endTs: number): Date[] {
  const dates: Date[] = [];
  const current = new Date(startTs);
  current.setHours(0, 0, 0, 0);
  const end = new Date(endTs);
  end.setHours(0, 0, 0, 0);

  while (current <= end) {
    dates.push(new Date(current));
    current.setDate(current.getDate() + 1);
  }

  return dates;
}

export function getDaysBetween(startTs: number, endTs: number): number {
  const start = new Date(startTs);
  start.setHours(0, 0, 0, 0);
  const end = new Date(endTs);
  end.setHours(0, 0, 0, 0);
  return Math.floor((end.getTime() - start.getTime()) / (1000 * 3600 * 24));
}

export function formatShortDate(date: Date): string {
  return `${date.getDate()}/${date.getMonth() + 1}`;
}

export function isToday(date: Date): boolean {
  const today = new Date();
  return (
    today.getDate() === date.getDate() &&
    today.getMonth() === date.getMonth() &&
    today.getFullYear() === date.getFullYear()
  );
}

export function isSameMonth(date: Date, month: number, year: number): boolean {
  return date.getMonth() === month && date.getFullYear() === year;
}
