import type { Obligation, Transaction } from "../domain/types";

export type DateRange = {
  start: Date;
  end: Date;
};

export type MonthlySummary = {
  committedMinor: bigint;
  pendingMinor: bigint;
  paidMinor: bigint;
  registeredMinor: bigint;
  obligationsCount: number;
  activityCount: number;
};

export type RealPendingSummary = {
  incomeRealMinor: bigint;
  incomePendingMinor: bigint;
  expenseRealMinor: bigint;
  expensePendingMinor: bigint;
  balanceTodayMinor: bigint;
  balanceEomMinor: bigint;
};

export type UpcomingItem = {
  id: string;
  name: string;
  dueDate: Date;
  amountMinor: bigint;
  currency: string;
  status?: "pending" | "paid";
};

export type RecentActivityItem = {
  id: string;
  title: string;
  date: Date;
  amountMinor: bigint;
  currency: string;
  type: "income" | "expense";
  iconId?: string | null;
  notes?: string | null;
  categoryName?: string | null;
};

export type AccountGlobalState = {
  incomeMinor: bigint;
  expenseMinor: bigint;
  balanceMinor: bigint;
};

export type CashflowItem = {
  id: string;
  title: string;
  date: Date;
  amountMinor: bigint;
  currency: string;
  type: "income" | "expense";
  source: "transaction" | "obligation";
};

export type CashflowWindow = {
  incomeMinor: bigint;
  expenseMinor: bigint;
  items: CashflowItem[];
};

export type CalendarEventType =
  | "one_off_income"
  | "one_off_expense"
  | "recurring_income"
  | "recurring_expense"
  | "obligation_paid"
  | "obligation_pending";

export type CalendarEvent = {
  id: string;
  date: Date;
  dayKey: string;
  type: CalendarEventType;
  title: string;
  amountMinor: bigint;
  currency: string;
  source: "transaction" | "obligation";
};

export type DayObligation = {
  id: string;
  title: string;
  amountMinor: bigint;
  currency: string;
  status: "pending" | "paid";
};

export type DayTransaction = {
  id: string;
  title: string;
  amountMinor: bigint;
  currency: string;
  type: "income" | "expense";
  isRecurring: boolean;
  notes?: string | null;
  categoryName?: string | null;
};

export type DaySummary = {
  date: Date;
  incomeMinor: bigint;
  expenseMinor: bigint;
  netMinor: bigint;
  obligations: DayObligation[];
  recurring: DayTransaction[];
  transactions: DayTransaction[];
  hasActivity: boolean;
};

const toDate = (value: string | Date | null | undefined): Date | null => {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const toMinor = (value: bigint | number | string | null | undefined): bigint => {
  if (value === null || value === undefined) return 0n;
  if (typeof value === "bigint") return value;
  if (typeof value === "number") return BigInt(Math.round(value));
  if (typeof value === "string") {
    try {
      return BigInt(value);
    } catch (error) {
      return 0n;
    }
  }
  return 0n;
};

const isWithinRange = (date: Date, range: DateRange) =>
  date >= range.start && date <= range.end;

const startOfDay = (date: Date) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate());

const toDayKey = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const isSameDay = (left: Date, right: Date) =>
  left.getFullYear() === right.getFullYear() &&
  left.getMonth() === right.getMonth() &&
  left.getDate() === right.getDate();

export const getMonthKey = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
};

export const getMonthRange = (date: Date): DateRange => {
  const start = new Date(date.getFullYear(), date.getMonth(), 1, 0, 0, 0, 0);
  const end = new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);
  return { start, end };
};

/**
 * Returns a date range that covers the calendar grid for a given month.
 * This includes days from the previous month (if the month starts mid-week)
 * and days from the next month (if the month ends mid-week).
 * Weeks start on Monday.
 */
export const getExpandedMonthRange = (date: Date): DateRange => {
  const monthStart = new Date(date.getFullYear(), date.getMonth(), 1, 0, 0, 0, 0);
  const monthEnd = new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);

  // Get the day of week (0 = Sunday, 1 = Monday, ..., 6 = Saturday)
  // Convert to Monday-based index (0 = Monday, ..., 6 = Sunday)
  const toMondayIndex = (weekday: number) => (weekday + 6) % 7;

  // Start: Go back to the Monday of the week containing the 1st
  const startWeekday = toMondayIndex(monthStart.getDay());
  const start = new Date(monthStart);
  start.setDate(start.getDate() - startWeekday);

  // End: Go forward to the Sunday of the week containing the last day
  const endWeekday = toMondayIndex(monthEnd.getDay());
  const daysToSunday = endWeekday === 6 ? 0 : 6 - endWeekday;
  const end = new Date(monthEnd);
  end.setDate(end.getDate() + daysToSunday);
  end.setHours(23, 59, 59, 999);

  return { start, end };
};

export function computeMonthlySummary(
  obligations: Obligation[],
  transactions: Transaction[],
  monthRange: DateRange
): MonthlySummary {
  let committedMinor = 0n;
  let paidMinor = 0n;
  let pendingMinor = 0n;
  let registeredMinor = 0n;
  let obligationsCount = 0;
  let activityCount = 0;

  obligations.forEach((obligation) => {
    const dueDate = toDate(obligation.due_date);
    if (!dueDate || !isWithinRange(dueDate, monthRange)) return;

    obligationsCount += 1;
    const amount = toMinor(obligation.amount_base_minor ?? obligation.amount_minor);
    committedMinor += amount;

    if (obligation.status === "paid") {
      paidMinor += amount;
    } else {
      pendingMinor += amount;
    }
  });

  transactions.forEach((transaction) => {
    const date = toDate(transaction.date);
    if (!date || !isWithinRange(date, monthRange)) return;

    activityCount += 1;
    const amount = toMinor(
      transaction.amount_base_minor ?? transaction.amount_minor
    );

    if (transaction.type === "expense") {
      registeredMinor += amount;
    }
  });

  return {
    committedMinor,
    pendingMinor,
    paidMinor,
    registeredMinor,
    obligationsCount,
    activityCount,
  };
}

export function computeScheduledExpenseMinor(
  obligations: Obligation[],
  monthRange: DateRange,
  today: Date
): bigint {
  let scheduledMinor = 0n;
  const todayStart = startOfDay(today).getTime();

  obligations.forEach((obligation) => {
    if (obligation.status === "paid") return;
    const dueDate = toDate(obligation.due_date);
    if (!dueDate || !isWithinRange(dueDate, monthRange)) return;
    if (startOfDay(dueDate).getTime() <= todayStart) return;
    const amount = toMinor(obligation.amount_base_minor ?? obligation.amount_minor);
    scheduledMinor += amount;
  });

  return scheduledMinor;
}

export function computeRealPendingSummary(
  transactions: Transaction[],
  monthRange: DateRange,
  today: Date
): RealPendingSummary {
  let incomeRealMinor = 0n;
  let incomePendingMinor = 0n;
  let expenseRealMinor = 0n;
  let expensePendingMinor = 0n;

  const todayStart = startOfDay(today).getTime();

  transactions.forEach((transaction) => {
    const date = toDate(transaction.date);
    if (!date || !isWithinRange(date, monthRange)) return;

    const amount = toMinor(
      transaction.amount_base_minor ?? transaction.amount_minor
    );
    const isReal = startOfDay(date).getTime() <= todayStart;

    if (transaction.type === "income") {
      if (isReal) {
        incomeRealMinor += amount;
      } else {
        incomePendingMinor += amount;
      }
      return;
    }

    if (isReal) {
      expenseRealMinor += amount;
    } else {
      expensePendingMinor += amount;
    }
  });

  const balanceTodayMinor = incomeRealMinor - expenseRealMinor;
  const balanceEomMinor =
    incomeRealMinor +
    incomePendingMinor -
    (expenseRealMinor + expensePendingMinor);

  return {
    incomeRealMinor,
    incomePendingMinor,
    expenseRealMinor,
    expensePendingMinor,
    balanceTodayMinor,
    balanceEomMinor,
  };
}

export function getUpcomingItems(
  obligations: Obligation[],
  range: DateRange
): UpcomingItem[] {
  return obligations
    .map((obligation) => {
      const dueDate = toDate(obligation.due_date);
      if (!dueDate || !isWithinRange(dueDate, range)) return null;

      return {
        id: obligation.id,
        name: obligation.name,
        dueDate,
        amountMinor: toMinor(obligation.amount_base_minor ?? obligation.amount_minor),
        currency: obligation.currency,
        status: obligation.status ?? "pending",
      };
    })
    .filter((item): item is UpcomingItem => Boolean(item))
    .sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());
}

export function getRecentActivity(
  transactions: Transaction[],
  limit: number,
  baseCurrency: string | undefined,
  fallbackTitle: string
): RecentActivityItem[] {
  const sorted = [...transactions].sort((a, b) => {
    const dateA = toDate(a.date)?.getTime() ?? 0;
    const dateB = toDate(b.date)?.getTime() ?? 0;

    if (dateA !== dateB) return dateB - dateA;

    const createdA = toDate(a.created_at)?.getTime() ?? 0;
    const createdB = toDate(b.created_at)?.getTime() ?? 0;

    return createdB - createdA;
  });

  return sorted.slice(0, limit).map((transaction) => {
    const date = toDate(transaction.date) ?? new Date();
    const amountMinor = toMinor(
      transaction.amount_base_minor ?? transaction.amount_minor
    );
    const categoryName = transaction.category?.name ?? null;

    return {
      id: transaction.id,
      title: transaction.merchant || categoryName || fallbackTitle,
      date,
      amountMinor,
      currency: baseCurrency || transaction.currency,
      type: transaction.type,
      iconId: transaction.category?.icon_id ?? null,
      notes: transaction.notes ?? null,
      categoryName,
    };
  });
}

export function getAccountGlobalState(
  transactions: Transaction[]
): AccountGlobalState {
  let incomeMinor = 0n;
  let expenseMinor = 0n;

  transactions.forEach((transaction) => {
    const amount = toMinor(
      transaction.amount_base_minor ?? transaction.amount_minor
    );

    if (transaction.type === "income") {
      incomeMinor += amount;
    } else {
      expenseMinor += amount;
    }
  });

  return {
    incomeMinor,
    expenseMinor,
    balanceMinor: incomeMinor - expenseMinor,
  };
}

export function getUpcomingCashflowWindow(
  obligations: Obligation[],
  transactions: Transaction[],
  range: DateRange,
  baseCurrency: string | undefined,
  fallbackTitle: string
): CashflowWindow {
  let incomeMinor = 0n;
  let expenseMinor = 0n;
  const items: CashflowItem[] = [];

  obligations.forEach((obligation) => {
    if (obligation.status === "paid") return;
    const dueDate = toDate(obligation.due_date);
    if (!dueDate || !isWithinRange(dueDate, range)) return;

    const amount = toMinor(obligation.amount_base_minor ?? obligation.amount_minor);
    expenseMinor += amount;
    items.push({
      id: obligation.id,
      title: obligation.name,
      date: dueDate,
      amountMinor: amount,
      currency: baseCurrency || obligation.currency,
      type: "expense",
      source: "obligation",
    });
  });

  transactions.forEach((transaction) => {
    const date = toDate(transaction.date);
    if (!date || !isWithinRange(date, range)) return;

    const amount = toMinor(
      transaction.amount_base_minor ?? transaction.amount_minor
    );
    const categoryName = transaction.category?.name ?? null;
    const title = transaction.merchant || categoryName || fallbackTitle;

    if (transaction.type === "income") {
      incomeMinor += amount;
    } else {
      expenseMinor += amount;
    }

    items.push({
      id: transaction.id,
      title,
      date,
      amountMinor: amount,
      currency: baseCurrency || transaction.currency,
      type: transaction.type,
      source: "transaction",
    });
  });

  items.sort((a, b) => a.date.getTime() - b.date.getTime());

  return {
    incomeMinor,
    expenseMinor,
    items,
  };
}

export function getFlowForRange(
  obligations: Obligation[],
  transactions: Transaction[],
  rangeDays: number,
  baseCurrency: string | undefined,
  fallbackTitle: string,
  now?: Date
): CashflowWindow {
  const reference = now ?? new Date();
  const start = startOfDay(reference);
  const end = new Date(start);
  end.setDate(end.getDate() + rangeDays);
  return getUpcomingCashflowWindow(
    obligations,
    transactions,
    { start, end },
    baseCurrency,
    fallbackTitle
  );
}

export function getEventsForMonth(
  month: Date,
  obligations: Obligation[],
  transactions: Transaction[],
  baseCurrency: string | undefined,
  fallbackTitle: string,
  eventRange?: DateRange
): CalendarEvent[] {
  const filterRange = eventRange ?? getMonthRange(month);
  const events: CalendarEvent[] = [];

  obligations.forEach((obligation) => {
    const dueDate = toDate(obligation.due_date);
    if (!dueDate || !isWithinRange(dueDate, filterRange)) return;
    const amount = toMinor(obligation.amount_base_minor ?? obligation.amount_minor);
    const status = obligation.status === "paid" ? "paid" : "pending";

    events.push({
      id: obligation.id,
      date: dueDate,
      dayKey: toDayKey(dueDate),
      type: status === "paid" ? "obligation_paid" : "obligation_pending",
      title: obligation.name,
      amountMinor: amount,
      currency: baseCurrency || obligation.currency,
      source: "obligation",
    });
  });

  transactions.forEach((transaction) => {
    const date = toDate(transaction.date);
    if (!date || !isWithinRange(date, filterRange)) return;

    const amount = toMinor(
      transaction.amount_base_minor ?? transaction.amount_minor
    );
    const categoryName = transaction.category?.name ?? null;
    const title = transaction.merchant || categoryName || fallbackTitle;
    const isRecurring =
      Boolean(transaction.recurring_item_id) ||
      Boolean(transaction.recurring_occurrence_date);
    const typeBase = transaction.type === "income" ? "income" : "expense";
    const type: CalendarEventType = isRecurring
      ? (`recurring_${typeBase}` as const)
      : (`one_off_${typeBase}` as const);

    events.push({
      id: transaction.id,
      date,
      dayKey: toDayKey(date),
      type,
      title,
      amountMinor: amount,
      currency: baseCurrency || transaction.currency,
      source: "transaction",
    });
  });

  events.sort((a, b) => a.date.getTime() - b.date.getTime());
  return events;
}

export function getSummaryForDay(
  date: Date,
  obligations: Obligation[],
  transactions: Transaction[],
  baseCurrency: string | undefined,
  fallbackTitle: string
): DaySummary {
  const dayKey = toDayKey(date);
  let incomeMinor = 0n;
  let expenseMinor = 0n;
  const dayObligations: DayObligation[] = [];
  const recurring: DayTransaction[] = [];
  const oneOff: DayTransaction[] = [];

  obligations.forEach((obligation) => {
    const dueDate = toDate(obligation.due_date);
    if (!dueDate || toDayKey(dueDate) !== dayKey) return;

    const amount = toMinor(obligation.amount_base_minor ?? obligation.amount_minor);
    expenseMinor += amount;

    dayObligations.push({
      id: obligation.id,
      title: obligation.name,
      amountMinor: amount,
      currency: baseCurrency || obligation.currency,
      status: obligation.status === "paid" ? "paid" : "pending",
    });
  });

  transactions.forEach((transaction) => {
    const txDate = toDate(transaction.date);
    if (!txDate || !isSameDay(txDate, date)) return;

    const amount = toMinor(
      transaction.amount_base_minor ?? transaction.amount_minor
    );
    const categoryName = transaction.category?.name ?? null;
    const title = transaction.merchant || categoryName || fallbackTitle;
    const isRecurring =
      Boolean(transaction.recurring_item_id) ||
      Boolean(transaction.recurring_occurrence_date);

    if (transaction.type === "income") {
      incomeMinor += amount;
    } else {
      expenseMinor += amount;
    }

    const entry: DayTransaction = {
      id: transaction.id,
      title,
      amountMinor: amount,
      currency: baseCurrency || transaction.currency,
      type: transaction.type,
      isRecurring,
      notes: transaction.notes ?? null,
      categoryName,
    };

    if (isRecurring) {
      recurring.push(entry);
    } else {
      oneOff.push(entry);
    }
  });

  return {
    date,
    incomeMinor,
    expenseMinor,
    netMinor: incomeMinor - expenseMinor,
    obligations: dayObligations,
    recurring,
    transactions: oneOff,
    hasActivity:
      dayObligations.length > 0 || recurring.length > 0 || oneOff.length > 0,
  };
}
