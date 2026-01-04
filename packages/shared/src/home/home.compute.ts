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
