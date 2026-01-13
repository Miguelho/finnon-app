import { endOfMonth } from "../date/month";
import type {
  FinancialGoal,
  GoalProgress,
  GoalTransaction,
  GoalTotals,
  InsightViewModel,
} from "./types";

const MS_PER_DAY = 1000 * 60 * 60 * 24;

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

const clampNumber = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

const ceilDiv = (numerator: bigint, denominator: bigint) => {
  if (denominator === 0n) return numerator;
  return (numerator + denominator - 1n) / denominator;
};

const getDaysLeftInMonth = (now: Date) => {
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const end = endOfMonth(now);
  const diffDays = Math.ceil((end.getTime() - startOfToday.getTime()) / MS_PER_DAY);
  return Math.max(diffDays, 0);
};

export const getGoalTotalsFromTransactions = (
  transactions: GoalTransaction[]
): GoalTotals => {
  let incomeTotalMinor = 0n;
  let expenseTotalMinor = 0n;

  transactions.forEach((transaction) => {
    const amount = toMinor(
      transaction.amount_base_minor ?? transaction.amount_minor
    );
    if (transaction.type === "income") {
      incomeTotalMinor += amount;
    } else {
      expenseTotalMinor += amount;
    }
  });

  return { incomeTotalMinor, expenseTotalMinor };
};

export type GoalProgressInput = {
  goal: FinancialGoal | null;
  totals: GoalTotals;
  now?: Date;
};

export const computeGoalProgress = ({
  goal,
  totals,
  now,
}: GoalProgressInput): GoalProgress | null => {
  if (!goal) return null;

  const targetMinor = toMinor(goal.target_amount_base_minor);
  const incomeMinor = totals.incomeTotalMinor;
  const expenseMinor = totals.expenseTotalMinor;
  const savedMinor = incomeMinor - expenseMinor;
  const remainingMinor = targetMinor > savedMinor ? targetMinor - savedMinor : 0n;

  const nowDate = now ?? new Date();
  const daysLeft = getDaysLeftInMonth(nowDate);
  const daysInMonth = endOfMonth(nowDate).getDate();
  const dayOfMonth = Math.max(nowDate.getDate(), 1);

  const expectedSavedMinor =
    daysInMonth > 0
      ? (targetMinor * BigInt(dayOfMonth)) / BigInt(daysInMonth)
      : 0n;

  const progressRatio =
    targetMinor > 0n
      ? clampNumber(Number(savedMinor) / Number(targetMinor), 0, 1)
      : 0;

  const ratePerDayMinor =
    daysLeft > 0 ? ceilDiv(remainingMinor, BigInt(daysLeft)) : remainingMinor;

  const daysRemaining = Math.max(daysInMonth - dayOfMonth, 0);
  const forecastEndMinor =
    dayOfMonth > 0
      ? savedMinor + (savedMinor * BigInt(daysRemaining)) / BigInt(dayOfMonth)
      : savedMinor;

  const hasActivity = incomeMinor !== 0n || expenseMinor !== 0n;
  const status: GoalProgress["status"] = !hasActivity
    ? "neutral"
    : savedMinor >= expectedSavedMinor
      ? "positive"
      : "negative";

  return {
    targetMinor,
    savedMinor,
    remainingMinor,
    progressRatio,
    daysLeft,
    ratePerDayMinor,
    forecastEndMinor,
    expectedSavedMinor,
    status,
  };
};

export type GoalInsightsInput = {
  progress: GoalProgress | null;
  totals: GoalTotals;
  transactions?: GoalTransaction[];
  previousExpenseTotalMinor?: bigint | null;
  uncategorizedLabel?: string;
  maxCategories?: number;
  maxInsights?: number;
  copy: {
    forecast: (amount: string) => string;
    expenseUp: (amount: string) => string;
    expenseDown: (amount: string) => string;
    expenseEven: string;
    topCategories: (categories: string) => string;
  };
  formatters: {
    formatSignedMoney: (value: bigint) => string;
    formatMoney: (value: bigint) => string;
  };
};

export const getTopExpenseCategories = (
  transactions: GoalTransaction[],
  options?: { maxCategories?: number; uncategorizedLabel?: string }
) => {
  const { maxCategories = 4, uncategorizedLabel = "" } = options ?? {};
  const totals = new Map<
    string,
    { categoryId: string; name: string; iconId?: string | null; totalMinor: bigint }
  >();

  const getFallbackLetter = (name: string) => {
    const trimmed = name.trim();
    return trimmed ? trimmed[0]?.toUpperCase() ?? "?" : "?";
  };

  transactions.forEach((transaction) => {
    if (transaction.type !== "expense") return;
    const amount = toMinor(
      transaction.amount_base_minor ?? transaction.amount_minor
    );
    if (amount <= 0n) return;

    const name = transaction.category?.name ?? uncategorizedLabel;
    const safeName = name?.trim() || uncategorizedLabel;
    if (!safeName) return;

    const categoryId = transaction.category?.id ?? safeName;
    const key = categoryId;
    const existing = totals.get(key);
    if (existing) {
      totals.set(key, { ...existing, totalMinor: existing.totalMinor + amount });
      return;
    }

    totals.set(key, {
      categoryId,
      name: safeName,
      iconId: transaction.category?.icon_id ?? null,
      totalMinor: amount,
    });
  });

  return Array.from(totals.values())
    .sort((a, b) => (a.totalMinor > b.totalMinor ? -1 : a.totalMinor < b.totalMinor ? 1 : 0))
    .slice(0, maxCategories)
    .map((item) => ({
      ...item,
      fallbackLetter: getFallbackLetter(item.name),
    }));
};

export const computeGoalInsights = ({
  progress,
  totals,
  transactions = [],
  previousExpenseTotalMinor,
  uncategorizedLabel,
  maxCategories = 4,
  maxInsights = 3,
  copy,
  formatters,
}: GoalInsightsInput): InsightViewModel[] => {
  const insights: InsightViewModel[] = [];

  if (progress) {
    const status =
      progress.targetMinor > 0n && progress.forecastEndMinor >= progress.targetMinor
        ? "positive"
        : progress.targetMinor > 0n
          ? "negative"
          : "neutral";
    insights.push({
      id: "forecast",
      iconKind: "svg",
      status,
      svgName: "delta",
      body: copy.forecast(formatters.formatSignedMoney(progress.forecastEndMinor)),
    });
  }

  if (previousExpenseTotalMinor !== null && previousExpenseTotalMinor !== undefined) {
    const delta = totals.expenseTotalMinor - previousExpenseTotalMinor;
    const status = delta > 0n ? "negative" : delta < 0n ? "positive" : "neutral";
    const body =
      delta === 0n
        ? copy.expenseEven
        : delta > 0n
          ? copy.expenseUp(formatters.formatMoney(delta))
          : copy.expenseDown(formatters.formatMoney(-delta));

    insights.push({
      id: "mom_expense",
      iconKind: "svg",
      status,
      svgName: "compare",
      body,
    });
  }

  const topCategories = getTopExpenseCategories(transactions, {
    maxCategories,
    uncategorizedLabel,
  });
  if (topCategories.length > 0) {
    const categoriesLabel = topCategories.map((item) => item.name).join(", ");
    insights.push({
      id: "top_categories",
      iconKind: "category-icons",
      status: "neutral",
      body: copy.topCategories(categoriesLabel),
      categories: topCategories.map((item) => ({
        categoryId: item.categoryId,
        iconName: item.iconId ?? null,
        fallbackLetter: item.fallbackLetter,
      })),
    });
  }

  return insights.slice(0, maxInsights);
};
