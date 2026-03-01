const DAY_MS = 24 * 60 * 60 * 1000;

const toMinor = (value: bigint | number | string | null | undefined): bigint => {
  if (value === null || value === undefined) return 0n;
  if (typeof value === "bigint") return value;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return 0n;
    return BigInt(Math.round(value));
  }
  try {
    return BigInt(value);
  } catch {
    return 0n;
  }
};

const toDate = (value: string | Date): Date => {
  if (value instanceof Date) return value;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const parts = value.split("-");
    const year = Number(parts[0]);
    const month = Number(parts[1]);
    const day = Number(parts[2]);
    if (
      Number.isFinite(year) &&
      Number.isFinite(month) &&
      Number.isFinite(day)
    ) {
      return new Date(year, month - 1, day);
    }
  }
  return new Date(value);
};

export const toDateKey = (value: string | Date): string => {
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const date = toDate(value);
  if (Number.isNaN(date.getTime())) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const startOfDay = (value: string | Date): Date => {
  const date = toDate(value);
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
};

const toMondayIndex = (weekday: number) => (weekday + 6) % 7;

export const getWeekStartMonday = (value: string | Date): Date => {
  const date = startOfDay(value);
  const offset = toMondayIndex(date.getDay());
  return new Date(date.getTime() - offset * DAY_MS);
};

export type CalendarTransactionInput = {
  date: string | Date;
  type: "income" | "expense";
  amount_minor?: bigint | number | string | null;
  amount_base_minor?: bigint | number | string | null;
  category_id?: string | null;
  category_name?: string | null;
  category_color?: string | null;
};

export type CalendarCategoryExpense = {
  categoryId: string;
  categoryName: string;
  categoryColor: string;
  amount: number;
};

export type CalendarDayData = {
  date: string;
  totalExpense: number;
  totalIncome: number;
  net: number;
  expensesByCategory: CalendarCategoryExpense[];
};

export type CalendarDisplayDayData = CalendarDayData & {
  dayNumber: number;
  isToday: boolean;
  isOtherMonth: boolean;
  dayLabel: string;
};

export const createEmptyCalendarDayData = (date: string): CalendarDayData => ({
  date,
  totalExpense: 0,
  totalIncome: 0,
  net: 0,
  expensesByCategory: [],
});

type MutableDay = {
  totalExpense: number;
  totalIncome: number;
  categoryTotals: Map<string, CalendarCategoryExpense>;
};

export function buildCalendarDayData(
  items: CalendarTransactionInput[]
): Map<string, CalendarDayData> {
  const days = new Map<string, MutableDay>();

  items.forEach((item) => {
    const dayKey = toDateKey(item.date);
    if (!dayKey) return;
    const amountMinor = toMinor(item.amount_base_minor ?? item.amount_minor);
    const amount = Number(amountMinor > 0n ? amountMinor : 0n);
    if (!Number.isFinite(amount) || amount <= 0) return;

    const current =
      days.get(dayKey) ??
      ({
        totalExpense: 0,
        totalIncome: 0,
        categoryTotals: new Map<string, CalendarCategoryExpense>(),
      } as MutableDay);

    if (item.type === "income") {
      current.totalIncome += amount;
    } else {
      current.totalExpense += amount;
      const categoryId = item.category_id ?? "uncategorized";
      const categoryName = item.category_name?.trim() || "Sin categoría";
      const categoryColor = item.category_color?.trim() || "#A0887A";
      const existing = current.categoryTotals.get(categoryId);
      if (existing) {
        existing.amount += amount;
      } else {
        current.categoryTotals.set(categoryId, {
          categoryId,
          categoryName,
          categoryColor,
          amount,
        });
      }
    }

    days.set(dayKey, current);
  });

  const finalized = new Map<string, CalendarDayData>();

  days.forEach((value, date) => {
    finalized.set(date, {
      date,
      totalExpense: value.totalExpense,
      totalIncome: value.totalIncome,
      net: value.totalIncome - value.totalExpense,
      expensesByCategory: Array.from(value.categoryTotals.values()).sort(
        (left, right) => right.amount - left.amount
      ),
    });
  });

  return finalized;
}

export function getMonthCalendarData(
  dayData: Map<string, CalendarDayData>,
  year: number,
  month: number
): CalendarDayData[] {
  const monthStart = new Date(year, month, 1);
  const monthEnd = new Date(year, month + 1, 0);
  const gridStart = new Date(monthStart);
  const startOffset = toMondayIndex(monthStart.getDay());
  gridStart.setDate(gridStart.getDate() - startOffset);
  const gridEnd = new Date(monthEnd);
  const endOffset = 6 - toMondayIndex(monthEnd.getDay());
  gridEnd.setDate(gridEnd.getDate() + endOffset);

  const rows: CalendarDayData[] = [];
  const cursor = new Date(gridStart);

  while (cursor <= gridEnd) {
    const key = toDateKey(cursor);
    rows.push(dayData.get(key) ?? createEmptyCalendarDayData(key));
    cursor.setDate(cursor.getDate() + 1);
  }

  return rows;
}

export function getWeekCalendarData(
  dayData: Map<string, CalendarDayData>,
  startDate: string | Date
): CalendarDayData[] {
  const monday = getWeekStartMonday(startDate);
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(monday.getTime() + index * DAY_MS);
    const key = toDateKey(date);
    return dayData.get(key) ?? createEmptyCalendarDayData(key);
  });
}

const parseDateKeyParts = (dateKey: string) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateKey);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
    return null;
  }
  return { year, month, day };
};

const getMondayWeekdayIndexFromDateKey = (dateKey: string) => {
  const parsed = parseDateKeyParts(dateKey);
  if (!parsed) return 0;
  const weekday = new Date(
    Date.UTC(parsed.year, parsed.month - 1, parsed.day)
  ).getUTCDay();
  return toMondayIndex(weekday);
};

const toDisplayDay = (
  day: CalendarDayData,
  todayKey: string,
  weekdayLabels: string[],
  visibleMonth: number | null
): CalendarDisplayDayData => {
  const parsed = parseDateKeyParts(day.date);
  const weekdayIndex = getMondayWeekdayIndexFromDateKey(day.date);

  return {
    ...day,
    dayNumber: parsed?.day ?? 1,
    isToday: day.date === todayKey,
    isOtherMonth:
      visibleMonth === null
        ? false
        : ((parsed?.month ?? visibleMonth + 1) - 1) !== visibleMonth,
    dayLabel: weekdayLabels[weekdayIndex] ?? "",
  };
};

export function getMonthCalendarDisplayDays(
  dayData: Map<string, CalendarDayData>,
  year: number,
  month: number,
  todayKey: string,
  weekdayLabels: string[]
): CalendarDisplayDayData[] {
  return getMonthCalendarData(dayData, year, month).map((day) =>
    toDisplayDay(day, todayKey, weekdayLabels, month)
  );
}

export function getWeekCalendarDisplayDays(
  dayData: Map<string, CalendarDayData>,
  startDate: string | Date,
  todayKey: string,
  weekdayLabels: string[]
): CalendarDisplayDayData[] {
  return getWeekCalendarData(dayData, startDate).map((day) =>
    toDisplayDay(day, todayKey, weekdayLabels, null)
  );
}

export function getHeatLevel(
  dayExpense: number,
  monthDays: CalendarDayData[]
): 0 | 1 | 2 | 3 | 4 | 5 {
  if (dayExpense === 0) return 0;

  const expenses = monthDays
    .filter((day) => day.totalExpense > 0)
    .map((day) => day.totalExpense);

  if (expenses.length === 0) return 0;

  const maxExpense = Math.max(...expenses);
  const ratio = dayExpense / maxExpense;

  if (ratio <= 0.15) return 1;
  if (ratio <= 0.3) return 2;
  if (ratio <= 0.5) return 3;
  if (ratio <= 0.75) return 4;
  return 5;
}
