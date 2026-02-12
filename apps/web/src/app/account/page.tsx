import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { DM_Sans, JetBrains_Mono } from "next/font/google";
import {
  formatDateISO,
  getDictionary,
  getMinorUnits,
  getPeriodRange,
  t,
  type AccountSummaryData,
  type DateRange,
} from "@poleursus/shared";
import { TopNav } from "@/components/navigation/top-nav";
import { BottomNavWrapper } from "@/components/navigation/bottom-nav-wrapper";
import { PageContainer } from "@/components/layout/page-container";
import { AccountRedesignClient } from "@/components/account/account-redesign-client";
import type {
  AccountRedesignData,
  AccountRedesignPeriod,
} from "@/components/account/account-redesign-types";
import { getCategoryColorKey } from "@/components/account/account-redesign-utils";
import { cn } from "@/lib/utils";
import { JSX } from "react";

type TransactionRow = {
  id: string;
  type: "income" | "expense";
  amount_minor: number;
  amount_base_minor?: number | null;
  date: string;
  merchant: string | null;
  category: {
    id: string;
    name: string;
    icon_id: string | null;
    type?: "income" | "expense" | null;
  } | null;
};

const normalizeTransactionCategory = (
  category: TransactionRow["category"] | NonNullable<TransactionRow["category"]>[]
): TransactionRow["category"] => {
  if (Array.isArray(category)) {
    return category[0] ?? null;
  }
  return category ?? null;
};

const dmSans = DM_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-dm-sans",
});

const jetbrains = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-jetbrains-mono",
});

const addMonths = (date: Date, delta: number) =>
  new Date(date.getFullYear(), date.getMonth() + delta, 1);

const addDays = (date: Date, delta: number) => {
  const next = new Date(date);
  next.setDate(next.getDate() + delta);
  return next;
};

const startOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());
const endOfDay = (date: Date) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);

const startOfMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth(), 1);
const endOfMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth() + 1, 0);


const parseISODate = (value: string) => {
  const [yearPart, monthPart, dayPart] = value.split("-");
  const year = Number(yearPart);
  const month = Number(monthPart);
  const day = Number(dayPart);

  return new Date(
    Number.isFinite(year) ? year : 1970,
    (Number.isFinite(month) ? month : 1) - 1,
    Number.isFinite(day) ? day : 1
  );
};

const isWithinRange = (date: Date, range: { start: Date; end: Date }) =>
  date >= range.start && date <= range.end;

const getAmountMinor = (row: TransactionRow) => {
  const raw = row.amount_base_minor ?? row.amount_minor ?? 0;
  return Number(raw);
};

type Bucket = { label: string; start: Date; end: Date; isCurrent: boolean };

const getDaySpan = (range: DateRange) => {
  const start = startOfDay(range.start);
  const end = startOfDay(range.end);
  return Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
};


const getPreviousPeriodRange = (
  period: AccountRedesignPeriod,
  currentRange: DateRange
): DateRange => {
  const span = getDaySpan(currentRange);
  switch (period) {
    case "week": {
      const end = endOfDay(addDays(currentRange.start, -1));
      const start = startOfDay(addDays(end, -(span - 1)));
      return { start, end };
    }
    case "month": {
      const prevStart = new Date(
        currentRange.start.getFullYear(),
        currentRange.start.getMonth() - 1,
        1
      );
      const prevEndLimit = endOfDay(endOfMonth(prevStart));
      let end = addDays(prevStart, span - 1);
      if (end > prevEndLimit) end = prevEndLimit;
      return { start: prevStart, end: endOfDay(end) };
    }
    case "quarter": {
      const prevStart = addMonths(currentRange.start, -3);
      const prevEndLimit = endOfDay(new Date(prevStart.getFullYear(), prevStart.getMonth() + 3, 0));
      let end = addDays(prevStart, span - 1);
      if (end > prevEndLimit) end = prevEndLimit;
      return { start: prevStart, end: endOfDay(end) };
    }
    case "year":
    default: {
      const prevStart = new Date(currentRange.start.getFullYear() - 1, 0, 1);
      const prevEndLimit = endOfDay(new Date(prevStart.getFullYear(), 12, 0));
      let end = addDays(prevStart, span - 1);
      if (end > prevEndLimit) end = prevEndLimit;
      return { start: prevStart, end: endOfDay(end) };
    }
  }
};

const buildBuckets = (
  period: AccountRedesignPeriod,
  range: DateRange,
  locale: string,
  now: Date
): Bucket[] => {
  const buckets: Bucket[] = [];
  if (period === "week") {
    const weekdayFormatter = new Intl.DateTimeFormat(locale, { weekday: "short" });
    const span = getDaySpan(range);
    for (let i = 0; i < span; i += 1) {
      const day = addDays(range.start, i);
      const start = startOfDay(day);
      const end = endOfDay(day);
      buckets.push({
        label: weekdayFormatter.format(day).replace(".", ""),
        start,
        end,
        isCurrent: isWithinRange(now, { start, end }),
      });
    }
    return buckets;
  }

  if (period === "month") {
    let cursor = startOfDay(range.start);
    let index = 0;
    const weekPrefix = locale.startsWith("en") ? "W" : "S";
    while (cursor <= range.end) {
      const start = cursor;
      let end = endOfDay(addDays(cursor, 6));
      if (end > range.end) end = range.end;
      buckets.push({
        label: `${weekPrefix}${index + 1}`,
        start,
        end,
        isCurrent: isWithinRange(now, { start, end }),
      });
      cursor = addDays(start, 7);
      index += 1;
    }
    return buckets;
  }

  let cursor = startOfMonth(range.start);
  const monthFormatter = new Intl.DateTimeFormat(locale, { month: "short" });
  while (cursor <= range.end) {
    const start = cursor;
    let end = endOfDay(endOfMonth(cursor));
    if (end > range.end) end = range.end;
    buckets.push({
      label: monthFormatter.format(cursor).replace(".", ""),
      start,
      end,
      isCurrent: isWithinRange(now, { start, end }),
    });
    cursor = addMonths(cursor, 1);
  }

  return buckets;
};

const sumTotals = (rows: TransactionRow[]) => {
  let income = 0;
  let expense = 0;
  rows.forEach((tx) => {
    const amountMinor = getAmountMinor(tx);
    if (tx.type === "income") income += amountMinor;
    else expense += amountMinor;
  });
  return { income, expense };
};

function buildAccountRedesignData(params: {
  summary: AccountSummaryData;
  transactions: TransactionRow[];
  period: AccountRedesignPeriod;
  now: Date;
  locale: string;
  uncategorizedLabel: string;
  accountLabel: string;
}): AccountRedesignData {
  const {
    summary,
    transactions,
    period,
    now,
    locale,
    uncategorizedLabel,
    accountLabel,
  } = params;
  const currencyCode = summary.account.base_currency;
  const minorUnits = getMinorUnits(currencyCode);
  const divisor = Math.pow(10, minorUnits);

  const currentRange = getPeriodRange(period, now);
  const previousRange = getPreviousPeriodRange(period, currentRange);
  const currentTransactions = transactions.filter((tx) =>
    isWithinRange(parseISODate(tx.date), currentRange)
  );
  const previousTransactions = transactions.filter((tx) =>
    isWithinRange(parseISODate(tx.date), previousRange)
  );

  const currentTotals = sumTotals(currentTransactions);
  const previousTotals = sumTotals(previousTransactions);

  const incomeDelta =
    previousTotals.income > 0
      ? ((currentTotals.income - previousTotals.income) / previousTotals.income) * 100
      : null;
  const expenseDelta =
    previousTotals.expense > 0
      ? ((currentTotals.expense - previousTotals.expense) / previousTotals.expense) * 100
      : null;

  const buckets = buildBuckets(period, currentRange, locale, now);
  const monthlyHistory = buckets.map((bucket) => {
    const totals = sumTotals(
      currentTransactions.filter((tx) =>
        isWithinRange(parseISODate(tx.date), { start: bucket.start, end: bucket.end })
      )
    );
    return {
      label: bucket.label,
      income: totals.income / divisor,
      expense: totals.expense / divisor,
      isCurrent: bucket.isCurrent,
    };
  });

  const categoryMap = new Map<
    string,
    {
      id: string;
      name: string;
      iconId?: string | null;
      amount: number;
      transactionCount: number;
      type: "income" | "expense";
    }
  >();

  currentTransactions.forEach((tx) => {
    if (tx.type !== "expense") return;
    const amountMinor = getAmountMinor(tx);
    const category = tx.category;
    const categoryId = category?.id ?? "uncategorized";
    const categoryName = category?.name ?? uncategorizedLabel;
    const existing = categoryMap.get(categoryId);
    if (existing) {
      existing.amount += amountMinor;
      existing.transactionCount += 1;
    } else {
      categoryMap.set(categoryId, {
        id: categoryId,
        name: categoryName,
        iconId: category?.icon_id ?? null,
        amount: amountMinor,
        transactionCount: 1,
        type: "expense",
      });
    }
  });

  const categories = Array.from(categoryMap.values())
    .sort((a, b) => b.amount - a.amount)
    .map((cat) => ({
      id: cat.id,
      name: cat.name,
      iconId: cat.iconId,
      colorKey: getCategoryColorKey(cat.name, cat.iconId),
      amount: cat.amount / divisor,
      transactionCount: cat.transactionCount,
      type: cat.type,
    }));

  const recent = [...currentTransactions]
    .sort((a, b) => parseISODate(b.date).getTime() - parseISODate(a.date).getTime())
    .slice(0, 4)
    .map((tx) => {
      const amountMinor = getAmountMinor(tx);
      const isIncome = tx.type === "income";
      const categoryName = tx.category?.name ?? uncategorizedLabel;
      return {
        id: tx.id,
        description: tx.merchant ?? categoryName,
        categoryName,
        categoryIconId: tx.category?.icon_id ?? null,
        amount: (amountMinor / divisor) * (isIncome ? 1 : -1),
        date: tx.date,
      };
    });

  const accountIcon = summary.account.name.slice(0, 1).toUpperCase();

  return {
    account: {
      id: summary.account.id,
      name: summary.account.name,
      icon: accountIcon,
      type: accountLabel,
      currency: summary.account.base_currency,
      balance: summary.totals.balance_total / divisor,
    },
    flow: {
      totalIncome: currentTotals.income / divisor,
      totalExpense: currentTotals.expense / divisor,
      incomeDelta,
      expenseDelta,
    },
    categories,
    recentTransactions: recent,
    monthlyHistory,
  };
}

export default async function AccountPage(): Promise<JSX.Element> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const cookieStore = await cookies();
  const activeAccountId = cookieStore.get("finnon:activeAccountId")?.value ?? "";
  const locale = cookieStore.get("NEXT_LOCALE")?.value === "en" ? "en" : "es";
  const dictionary = getDictionary(locale);
  if (!activeAccountId) {
    redirect("/select-account");
  }

  // Fetch account summary via RPC
  const { data: summaryData, error: rpcError } = await supabase.rpc(
    "get_account_summary",
    { p_account_id: activeAccountId }
  );

  if (rpcError || !summaryData) {
    console.error("[AccountPage] RPC error:", rpcError);
    redirect("/select-account");
  }

  const now = new Date();
  const queryStart = new Date(now.getFullYear() - 1, 0, 1);
  const startDate = formatDateISO(queryStart);
  const endDate = formatDateISO(now);

  const { data: rows, error: rowsError } = await supabase
    .from("transactions")
    .select(
      "id, type, amount_minor, amount_base_minor, date, merchant, category:categories(id, name, icon_id, type)"
    )
    .eq("account_id", activeAccountId)
    .gte("date", startDate)
    .lte("date", endDate);

  if (rowsError) {
    console.error("[AccountPage] Transactions query error:", rowsError);
  }
  const transactions: TransactionRow[] = (rows ?? []).map((row) => ({
    ...row,
    category: normalizeTransactionCategory(row.category),
  }));
  const dataByPeriod: Record<AccountRedesignPeriod, AccountRedesignData> = {
    week: buildAccountRedesignData({
      summary: summaryData as AccountSummaryData,
      transactions,
      period: "week",
      now,
      locale,
      uncategorizedLabel: t(dictionary, "transactions.uncategorized"),
      accountLabel: t(dictionary, "account.labelAccount"),
    }),
    month: buildAccountRedesignData({
      summary: summaryData as AccountSummaryData,
      transactions,
      period: "month",
      now,
      locale,
      uncategorizedLabel: t(dictionary, "transactions.uncategorized"),
      accountLabel: t(dictionary, "account.labelAccount"),
    }),
    quarter: buildAccountRedesignData({
      summary: summaryData as AccountSummaryData,
      transactions,
      period: "quarter",
      now,
      locale,
      uncategorizedLabel: t(dictionary, "transactions.uncategorized"),
      accountLabel: t(dictionary, "account.labelAccount"),
    }),
    year: buildAccountRedesignData({
      summary: summaryData as AccountSummaryData,
      transactions,
      period: "year",
      now,
      locale,
      uncategorizedLabel: t(dictionary, "transactions.uncategorized"),
      accountLabel: t(dictionary, "account.labelAccount"),
    }),
  };

  return (
    <div className={cn("min-h-screen bg-background", dmSans.variable, jetbrains.variable)}>
      <TopNav />
      <PageContainer className="space-y-6">
        <AccountRedesignClient dataByPeriod={dataByPeriod} />
      </PageContainer>
      {/* Bottom padding for mobile nav */}
      <div className="h-16 sm:hidden" />
      <BottomNavWrapper />
    </div>
  );
}
