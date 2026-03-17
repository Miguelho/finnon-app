import { getMonthRangeFromKey, toMonthKey } from "../date/month";
import { CATEGORY_PALETTE } from "../categories/palette";
import { getNextOccurrence, getOccurrencesBetween, type RecurringItem } from "./recurring";

type RecurringCategoryLike = {
  id?: string | null;
  name?: string | null;
  icon_id?: string | null;
  type?: "income" | "expense";
};

export type RecurringItemWithCategory = RecurringItem & {
  category?: RecurringCategoryLike | null;
};

export type RecurringLinkedTransaction = {
  recurring_item_id?: string | null;
  recurring_occurrence_date?: string | null;
  amount_minor: bigint | number | string;
  date?: string | Date | null;
};

export type RecurringCategoryInsight = {
  id: string | null;
  name: string | null;
  iconId: string | null;
  amountMinor: bigint;
  share: number;
  itemCount: number;
  color: string;
};

export type RecurringItemInsight = {
  recurringItem: RecurringItemWithCategory;
  amountMinor: bigint;
  projectedMinorThisMonth: bigint;
  occurrenceCountThisMonth: number;
  occurrencesThisMonth: string[];
  confirmedOccurrencesThisMonth: string[];
  confirmedCountThisMonth: number;
  nextOccurrence: string | null;
  referenceDate: string | null;
  status: "confirmed" | "upcoming" | "paused" | "inactive";
  deltaMinor: bigint | null;
  categoryColor: string | null;
};

export type RecurringSummaryInsight = {
  totalMinor: bigint;
  projectedCount: number;
  confirmedCount: number;
  items: RecurringItemInsight[];
};

export type RecurringMonthInsights = {
  monthKey: string;
  monthStart: string;
  monthEnd: string;
  todayISO: string;
  expense: RecurringSummaryInsight;
  income: RecurringSummaryInsight;
  expenseShareOfIncome: number | null;
  remainingBalanceMinor: bigint;
  categories: RecurringCategoryInsight[];
  allItems: RecurringItemInsight[];
};

const FALLBACK_CATEGORY_COLORS = [
  "#5B8DFF",
  "#F59E0B",
  "#6EE7B7",
  "#A78BFA",
  "#F472B6",
  "#6AADDB",
];

const CATEGORY_COLOR_POOL = [...CATEGORY_PALETTE, ...FALLBACK_CATEGORY_COLORS];

const toMinor = (value: bigint | number | string): bigint =>
  typeof value === "bigint" ? value : BigInt(value);

const normalizeDateKey = (value: string | Date | null | undefined): string => {
  if (!value) return "";
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return value.slice(0, 10);
};

const hashString = (value: string) => {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(index);
    hash |= 0;
  }
  return Math.abs(hash);
};

const getCategoryColor = (key: string | null | undefined) => {
  if (!key) return CATEGORY_COLOR_POOL[0]!;
  return CATEGORY_COLOR_POOL[hashString(key) % CATEGORY_COLOR_POOL.length]!;
};

const compareInsights = (left: RecurringItemInsight, right: RecurringItemInsight) => {
  const statusRank = {
    confirmed: 0,
    upcoming: 1,
    paused: 2,
    inactive: 3,
  } as const;

  if (left.status !== right.status) {
    return statusRank[left.status] - statusRank[right.status];
  }

  if (left.referenceDate && right.referenceDate && left.referenceDate !== right.referenceDate) {
    return left.referenceDate.localeCompare(right.referenceDate);
  }

  if (left.referenceDate && !right.referenceDate) return -1;
  if (!left.referenceDate && right.referenceDate) return 1;

  return (left.recurringItem.merchant ?? "").localeCompare(
    right.recurringItem.merchant ?? ""
  );
};

export function computeRecurringMonthInsights(params: {
  recurringItems: RecurringItemWithCategory[];
  transactions?: RecurringLinkedTransaction[];
  monthKey?: string;
  todayISO?: string;
}): RecurringMonthInsights {
  const {
    recurringItems,
    transactions = [],
    monthKey = toMonthKey(new Date()),
    todayISO = new Date().toISOString().slice(0, 10),
  } = params;
  const { start: monthStart, end: monthEnd } = getMonthRangeFromKey(monthKey);

  const transactionsByItem = new Map<string, RecurringLinkedTransaction[]>();
  for (const transaction of transactions) {
    const itemId = transaction.recurring_item_id ?? null;
    if (!itemId) continue;
    const current = transactionsByItem.get(itemId) ?? [];
    current.push(transaction);
    transactionsByItem.set(itemId, current);
  }

  for (const itemTransactions of transactionsByItem.values()) {
    itemTransactions.sort((left, right) => {
      const leftKey =
        normalizeDateKey(left.recurring_occurrence_date) ||
        normalizeDateKey(left.date);
      const rightKey =
        normalizeDateKey(right.recurring_occurrence_date) ||
        normalizeDateKey(right.date);
      return rightKey.localeCompare(leftKey);
    });
  }

  const expenseItems: RecurringItemInsight[] = [];
  const incomeItems: RecurringItemInsight[] = [];
  const categoryAccumulator = new Map<
    string,
    {
      id: string | null;
      name: string | null;
      iconId: string | null;
      amountMinor: bigint;
      itemCount: number;
      color: string;
    }
  >();

  for (const recurringItem of recurringItems) {
    const amountMinor = toMinor(recurringItem.amount_minor);
    const occurrencesThisMonth = getOccurrencesBetween(
      recurringItem,
      monthStart,
      monthEnd
    ).map((occurrence) => occurrence.date);

    const linkedTransactions = transactionsByItem.get(recurringItem.id) ?? [];
    const confirmedOccurrenceSet = new Set(
      linkedTransactions
        .map((transaction) => normalizeDateKey(transaction.recurring_occurrence_date))
        .filter(Boolean)
    );
    const confirmedOccurrencesThisMonth = occurrencesThisMonth.filter((date) =>
      confirmedOccurrenceSet.has(date)
    );
    const occurrenceCountThisMonth = occurrencesThisMonth.length;
    const projectedMinorThisMonth = amountMinor * BigInt(occurrenceCountThisMonth);
    const nextOccurrence = getNextOccurrence(recurringItem, todayISO);
    const referenceDate =
      confirmedOccurrencesThisMonth[confirmedOccurrencesThisMonth.length - 1] ??
      nextOccurrence;
    const latestLinkedTransaction = linkedTransactions[0];
    const deltaMinor = latestLinkedTransaction
      ? amountMinor - toMinor(latestLinkedTransaction.amount_minor)
      : null;
    const categoryKey =
      recurringItem.category?.id ??
      recurringItem.category?.name ??
      recurringItem.category_id ??
      null;
    const categoryColor = recurringItem.category
      ? getCategoryColor(categoryKey)
      : null;

    const insight: RecurringItemInsight = {
      recurringItem,
      amountMinor,
      projectedMinorThisMonth,
      occurrenceCountThisMonth,
      occurrencesThisMonth,
      confirmedOccurrencesThisMonth,
      confirmedCountThisMonth: confirmedOccurrencesThisMonth.length,
      nextOccurrence,
      referenceDate,
      status: recurringItem.is_paused
        ? "paused"
        : confirmedOccurrencesThisMonth.length > 0
          ? "confirmed"
          : nextOccurrence
            ? "upcoming"
            : "inactive",
      deltaMinor,
      categoryColor,
    };

    if (recurringItem.type === "expense") {
      expenseItems.push(insight);

      if (projectedMinorThisMonth > 0n) {
        const key = categoryKey ?? "__uncategorized__";
        const current = categoryAccumulator.get(key) ?? {
          id: recurringItem.category?.id ?? null,
          name: recurringItem.category?.name ?? null,
          iconId: recurringItem.category?.icon_id ?? null,
          amountMinor: 0n,
          itemCount: 0,
          color: getCategoryColor(categoryKey),
        };
        current.amountMinor += projectedMinorThisMonth;
        current.itemCount += 1;
        categoryAccumulator.set(key, current);
      }
    } else {
      incomeItems.push(insight);
    }
  }

  expenseItems.sort(compareInsights);
  incomeItems.sort(compareInsights);

  const expenseTotalMinor = expenseItems.reduce(
    (total, item) => total + item.projectedMinorThisMonth,
    0n
  );
  const incomeTotalMinor = incomeItems.reduce(
    (total, item) => total + item.projectedMinorThisMonth,
    0n
  );

  const categories = Array.from(categoryAccumulator.values())
    .sort((left, right) =>
      left.amountMinor === right.amountMinor
        ? (left.name ?? "").localeCompare(right.name ?? "")
        : left.amountMinor > right.amountMinor
          ? -1
          : 1
    )
    .map((category) => ({
      id: category.id,
      name: category.name,
      iconId: category.iconId,
      amountMinor: category.amountMinor,
      share:
        expenseTotalMinor > 0n
          ? Number(category.amountMinor) / Number(expenseTotalMinor)
          : 0,
      itemCount: category.itemCount,
      color: category.color,
    }));

  return {
    monthKey,
    monthStart,
    monthEnd,
    todayISO,
    expense: {
      totalMinor: expenseTotalMinor,
      projectedCount: expenseItems.filter((item) => item.occurrenceCountThisMonth > 0).length,
      confirmedCount: expenseItems.filter((item) => item.confirmedCountThisMonth > 0).length,
      items: expenseItems,
    },
    income: {
      totalMinor: incomeTotalMinor,
      projectedCount: incomeItems.filter((item) => item.occurrenceCountThisMonth > 0).length,
      confirmedCount: incomeItems.filter((item) => item.confirmedCountThisMonth > 0).length,
      items: incomeItems,
    },
    expenseShareOfIncome:
      incomeTotalMinor > 0n ? Number(expenseTotalMinor) / Number(incomeTotalMinor) : null,
    remainingBalanceMinor: incomeTotalMinor - expenseTotalMinor,
    categories,
    allItems: [...expenseItems, ...incomeItems],
  };
}
