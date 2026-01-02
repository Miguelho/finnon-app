export type RecurringFrequency = "weekly" | "monthly" | "yearly";

export type RecurringItem = {
  id: string;
  account_id: string;
  type: "income" | "expense";
  amount_minor: bigint | number | string;
  currency: string;
  category_id?: string | null;
  merchant?: string | null;
  notes?: string | null;
  start_date: string; // ISO YYYY-MM-DD
  frequency: RecurringFrequency;
  interval: number;
  day_of_month?: number | null;
  end_date?: string | null;
  is_paused: boolean;
  created_by: string;
  created_at?: string | Date;
  updated_at?: string | Date;
};

export type RecurringOccurrence = {
  recurringItemId: string;
  date: string; // ISO YYYY-MM-DD
  key: string;
};

const MS_PER_DAY = 24 * 60 * 60 * 1000;

const toUtcDate = (isoDate: string): Date =>
  new Date(`${isoDate}T00:00:00Z`);

const toIsoDate = (date: Date): string => date.toISOString().slice(0, 10);

const daysInMonth = (year: number, monthIndex: number): number =>
  new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();

const addDays = (date: Date, days: number): Date =>
  new Date(date.getTime() + days * MS_PER_DAY);

const addMonths = (date: Date, months: number, dayOfMonth: number): Date => {
  const year = date.getUTCFullYear();
  const monthIndex = date.getUTCMonth();
  const targetMonth = monthIndex + months;
  const nextYear = year + Math.floor(targetMonth / 12);
  const nextMonthIndex = ((targetMonth % 12) + 12) % 12;
  const normalizedDay = Math.min(
    dayOfMonth,
    daysInMonth(nextYear, nextMonthIndex)
  );
  return new Date(Date.UTC(nextYear, nextMonthIndex, normalizedDay));
};

const addYears = (date: Date, years: number, monthIndex: number, day: number) => {
  const nextYear = date.getUTCFullYear() + years;
  const normalizedDay = Math.min(day, daysInMonth(nextYear, monthIndex));
  return new Date(Date.UTC(nextYear, monthIndex, normalizedDay));
};

const clampRangeEnd = (item: RecurringItem, to: Date): Date => {
  if (!item.end_date) return to;
  const endDate = toUtcDate(item.end_date);
  return endDate < to ? endDate : to;
};

const isOnOrAfter = (left: Date, right: Date) =>
  left.getTime() >= right.getTime();

const isOnOrBefore = (left: Date, right: Date) =>
  left.getTime() <= right.getTime();

export const getOccurrenceKey = (itemId: string, dateISO: string): string =>
  `${itemId}:${dateISO}`;

export const normalizeMonthlyDay = (
  item: RecurringItem,
  year: number,
  monthIndex: number
): number => {
  const targetDay = item.day_of_month ?? toUtcDate(item.start_date).getUTCDate();
  return Math.min(targetDay, daysInMonth(year, monthIndex));
};

export const getOccurrencesBetween = (
  item: RecurringItem,
  fromISO: string,
  toISO: string
): RecurringOccurrence[] => {
  if (item.is_paused) return [];

  const fromDate = toUtcDate(fromISO);
  const toDate = toUtcDate(toISO);
  if (!isOnOrBefore(fromDate, toDate)) return [];

  const startDate = toUtcDate(item.start_date);
  const rangeEnd = clampRangeEnd(item, toDate);
  if (!isOnOrAfter(rangeEnd, startDate)) return [];

  const occurrences: RecurringOccurrence[] = [];

  if (item.frequency === "weekly") {
    const intervalDays = Math.max(1, item.interval) * 7;
    let cursor = startDate;

    if (isOnOrAfter(fromDate, cursor)) {
      const diffDays = Math.floor(
        (fromDate.getTime() - cursor.getTime()) / MS_PER_DAY
      );
      const jump = Math.floor(diffDays / intervalDays);
      cursor = addDays(cursor, jump * intervalDays);
      while (cursor < fromDate) {
        cursor = addDays(cursor, intervalDays);
      }
    }

    while (cursor <= rangeEnd) {
      if (cursor >= fromDate) {
        const dateISO = toIsoDate(cursor);
        occurrences.push({
          recurringItemId: item.id,
          date: dateISO,
          key: getOccurrenceKey(item.id, dateISO),
        });
      }
      cursor = addDays(cursor, intervalDays);
    }

    return occurrences;
  }

  if (item.frequency === "monthly") {
    const interval = Math.max(1, item.interval);
    const targetDay = item.day_of_month ?? startDate.getUTCDate();
    let cursor = new Date(
      Date.UTC(
        startDate.getUTCFullYear(),
        startDate.getUTCMonth(),
        normalizeMonthlyDay(item, startDate.getUTCFullYear(), startDate.getUTCMonth())
      )
    );

    while (cursor < startDate) {
      cursor = addMonths(cursor, interval, targetDay);
    }

    if (cursor < fromDate) {
      const monthsDiff =
        (fromDate.getUTCFullYear() - cursor.getUTCFullYear()) * 12 +
        (fromDate.getUTCMonth() - cursor.getUTCMonth());
      const jump = Math.floor(monthsDiff / interval);
      cursor = addMonths(cursor, jump * interval, targetDay);
      while (cursor < fromDate) {
        cursor = addMonths(cursor, interval, targetDay);
      }
    }

    while (cursor <= rangeEnd) {
      const dateISO = toIsoDate(cursor);
      occurrences.push({
        recurringItemId: item.id,
        date: dateISO,
        key: getOccurrenceKey(item.id, dateISO),
      });
      cursor = addMonths(cursor, interval, targetDay);
    }

    return occurrences;
  }

  const interval = Math.max(1, item.interval);
  const monthIndex = startDate.getUTCMonth();
  const day = startDate.getUTCDate();
  let cursor = new Date(Date.UTC(startDate.getUTCFullYear(), monthIndex, day));

  while (cursor < startDate) {
    cursor = addYears(cursor, interval, monthIndex, day);
  }

  if (cursor < fromDate) {
    const yearsDiff = fromDate.getUTCFullYear() - cursor.getUTCFullYear();
    const jump = Math.floor(yearsDiff / interval);
    cursor = addYears(cursor, jump * interval, monthIndex, day);
    while (cursor < fromDate) {
      cursor = addYears(cursor, interval, monthIndex, day);
    }
  }

  while (cursor <= rangeEnd) {
    const dateISO = toIsoDate(cursor);
    occurrences.push({
      recurringItemId: item.id,
      date: dateISO,
      key: getOccurrenceKey(item.id, dateISO),
    });
    cursor = addYears(cursor, interval, monthIndex, day);
  }

  return occurrences;
};
