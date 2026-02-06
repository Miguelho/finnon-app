import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Redirect, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useIsFocused } from "@react-navigation/native";
import {
  CURRENCIES,
  getMinorUnits,
  type AccountSummaryData,
} from "@poleursus/shared";
import { useAuth } from "../../../../src/contexts/AuthContext";
import { useNetworkNotice } from "../../../../src/contexts/NetworkNoticeContext";
import { useCopy, t } from "../../../../src/lib/i18n";
import { supabase } from "../../../../src/lib/supabase";
import {
  AccountScreen,
} from "../../../../src/components/account-redesign/components/account";
import type {
  AccountScreenData,
  CategorySummary,
  MonthlyDataPoint,
  Period,
  Transaction,
} from "../../../../src/components/account-redesign/types/account";
import { colors, spacing, typography } from "../../../../src/components/account-redesign/theme/tokens";

const MONTH_LABELS: Record<string, string[]> = {
  es: ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"],
  en: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
};

const DAY_LABELS: Record<string, string[]> = {
  es: ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"],
  en: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
};

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

const formatDateISO = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const parseISODate = (value: string) => {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, (month ?? 1) - 1, day ?? 1);
};

const isWithinRange = (date: Date, range: { start: Date; end: Date }) =>
  date >= range.start && date <= range.end;

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

const getAmountMinor = (row: TransactionRow) => {
  const raw = row.amount_base_minor ?? row.amount_minor ?? 0;
  return Number(raw);
};

const getMonthLabel = (date: Date, locale: string) => {
  const labels = MONTH_LABELS[locale] ?? MONTH_LABELS.es;
  return labels[date.getMonth()] ?? labels[0];
};

const getCategoryColorKey = (name: string, iconId?: string | null) => {
  const normalized = name.toLowerCase();
  if (normalized.includes("casa") || iconId === "House") return "casa";
  if (normalized.includes("famil") || iconId === "UsersThree") return "familia";
  if (
    normalized.includes("ocio") ||
    ["GameController", "FilmSlate", "MusicNotes", "Basketball", "Barbell"].includes(
      iconId ?? ""
    )
  ) {
    return "ocio";
  }
  if (normalized.includes("restaur") || iconId === "ForkKnife") return "restaurantes";
  if (
    normalized.includes("inter") ||
    ["PiggyBank", "Bank", "Wallet", "Receipt", "CreditCard"].includes(iconId ?? "")
  ) {
    return "interests";
  }
  if (normalized.includes("loter") || iconId === "Ticket") return "lottery";
  return "default";
};

type DateRange = { start: Date; end: Date };
type Bucket = { label: string; start: Date; end: Date; isCurrent: boolean };

const getDaySpan = (range: DateRange) => {
  const start = startOfDay(range.start);
  const end = startOfDay(range.end);
  return Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
};

const getPeriodRange = (period: Period, now: Date): DateRange => {
  const todayStart = startOfDay(now);
  const todayEnd = endOfDay(now);

  switch (period) {
    case "week":
      return { start: addDays(todayStart, -6), end: todayEnd };
    case "month":
      return { start: startOfMonth(now), end: todayEnd };
    case "quarter": {
      const quarterStartMonth = Math.floor(now.getMonth() / 3) * 3;
      return { start: new Date(now.getFullYear(), quarterStartMonth, 1), end: todayEnd };
    }
    case "year":
    default:
      return { start: new Date(now.getFullYear(), 0, 1), end: todayEnd };
  }
};

const getPreviousPeriodRange = (period: Period, currentRange: DateRange): DateRange => {
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
  period: Period,
  range: DateRange,
  locale: string,
  now: Date
): Bucket[] => {
  const buckets: Bucket[] = [];
  const current = now;

  if (period === "week") {
    const labels = DAY_LABELS[locale] ?? DAY_LABELS.es;
    const span = getDaySpan(range);
    for (let i = 0; i < span; i += 1) {
      const day = addDays(range.start, i);
      const start = startOfDay(day);
      const end = endOfDay(day);
      buckets.push({
        label: labels[day.getDay()] ?? labels[0],
        start,
        end,
        isCurrent: isWithinRange(current, { start, end }),
      });
    }
    return buckets;
  }

  if (period === "month") {
    let cursor = startOfDay(range.start);
    let index = 0;
    while (cursor <= range.end) {
      const start = cursor;
      let end = endOfDay(addDays(cursor, 6));
      if (end > range.end) end = range.end;
      buckets.push({
        label: `S${index + 1}`,
        start,
        end,
        isCurrent: isWithinRange(current, { start, end }),
      });
      cursor = addDays(start, 7);
      index += 1;
    }
    return buckets;
  }

  let cursor = startOfMonth(range.start);
  while (cursor <= range.end) {
    const start = cursor;
    let end = endOfDay(endOfMonth(cursor));
    if (end > range.end) end = range.end;
    buckets.push({
      label: getMonthLabel(cursor, locale),
      start,
      end,
      isCurrent: isWithinRange(current, { start, end }),
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

function buildAccountScreenData(params: {
  summary: AccountSummaryData;
  transactions: TransactionRow[];
  period: Period;
  locale: string;
  accountLabel: string;
  uncategorizedLabel: string;
}): { data: AccountScreenData; currencyDecimals: number } {
  const {
    summary,
    transactions,
    period,
    locale,
    accountLabel,
    uncategorizedLabel,
  } = params;
  const currencyCode = summary.account.base_currency;
  const minorUnits = getMinorUnits(currencyCode);
  const divisor = Math.pow(10, minorUnits);

  const now = new Date();
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
  const monthlyHistory: MonthlyDataPoint[] = buckets.map((bucket) => {
    const bucketTotals = sumTotals(
      currentTransactions.filter((tx) =>
        isWithinRange(parseISODate(tx.date), { start: bucket.start, end: bucket.end })
      )
    );
    return {
      label: bucket.label,
      income: bucketTotals.income / divisor,
      expense: bucketTotals.expense / divisor,
      isCurrent: bucket.isCurrent,
    };
  });

  const categoryMap = new Map<string, {
    id: string;
    name: string;
    iconId?: string | null;
    amount: number;
    transactionCount: number;
    type: "income" | "expense";
  }>();

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

  const categories: CategorySummary[] = Array.from(categoryMap.values())
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

  const recent: Transaction[] = [...currentTransactions]
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
    data: {
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
    },
    currencyDecimals: minorUnits,
  };
}

export default function AccountTabScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const isFocused = useIsFocused();
  const { user, selectedAccountId, isInitialized } = useAuth();
  const { reportNetworkIssue } = useNetworkNotice();
  const { dictionary, locale } = useCopy();

  const [period, setPeriod] = useState<Period>("month");
  const [summaryData, setSummaryData] = useState<AccountSummaryData | null>(null);
  const [transactions, setTransactions] = useState<TransactionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const computed = useMemo(() => {
    if (!summaryData) return null;
    return buildAccountScreenData({
      summary: summaryData,
      transactions,
      period,
      locale,
      accountLabel: t(dictionary, "account.labelAccount"),
      uncategorizedLabel: t(dictionary, "transactions.uncategorized"),
    });
  }, [summaryData, transactions, period, locale, dictionary]);

  const screenData = computed?.data ?? null;
  const currencyDecimals = computed?.currencyDecimals ?? 2;

  const currencySymbol = useMemo(() => {
    const code = summaryData?.account.base_currency ?? "";
    return CURRENCIES.find((currency) => currency.code === code)?.symbol ?? code;
  }, [summaryData?.account.base_currency]);

  const loadData = useCallback(async () => {
    if (!selectedAccountId || !user) return;

    try {
      const { data: rpcData, error: rpcError } = await supabase.rpc(
        "get_account_summary",
        { p_account_id: selectedAccountId }
      );

      if (rpcError) throw rpcError;
      if (!rpcData) throw new Error(t(dictionary, "account.loadError"));

      const now = new Date();
      const queryStart = new Date(now.getFullYear() - 1, 0, 1);
      const startDate = formatDateISO(queryStart);
      const endDate = formatDateISO(now);

      const { data: rows, error: rowsError } = await supabase
        .from("transactions")
        .select(
          "id, type, amount_minor, amount_base_minor, date, merchant, category:categories(id, name, icon_id, type)"
        )
        .eq("account_id", selectedAccountId)
        .gte("date", startDate)
        .lte("date", endDate);

      if (rowsError) throw rowsError;

      setSummaryData(rpcData as AccountSummaryData);
      setTransactions((rows ?? []) as TransactionRow[]);
      setError(null);
    } catch (err: any) {
      console.error("[AccountTabScreen] Error:", err);
      setError(err?.message ?? t(dictionary, "account.loadError"));
      reportNetworkIssue({ onRetry: loadData });
    }
  }, [dictionary, reportNetworkIssue, selectedAccountId, user]);

  useEffect(() => {
    let cancelled = false;

    async function init() {
      setLoading(true);
      await loadData();
      if (!cancelled) setLoading(false);
    }

    if (isInitialized && selectedAccountId && isFocused) {
      init();
    }

    return () => {
      cancelled = true;
    };
  }, [isFocused, isInitialized, loadData, selectedAccountId]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, [loadData]);

  if (!isInitialized) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={colors.textSecondary} />
      </View>
    );
  }

  if (!selectedAccountId) {
    return <Redirect href="/(auth)/select-account" />;
  }

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={colors.textSecondary} />
      </View>
    );
  }

  if (error || !screenData) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorTitle}>{t(dictionary, "account.errorTitle")}</Text>
        <Text style={styles.errorText}>{error ?? t(dictionary, "account.loadError")}</Text>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: spacing["6xl"] + insets.bottom + 40 },
        ]}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
      >
        <AccountScreen
          data={screenData}
          period={period}
          onPeriodChange={setPeriod}
          currencySymbol={currencySymbol}
          currencyDecimals={currencyDecimals}
          onSettingsPress={() => router.push("/(auth)/settings/account")}
          onSearchPress={() => router.push("/(auth)/(tabs)/transactions")}
          onCategoryPress={(category) => {
            if (category.id === "uncategorized") return;
            router.push(`/(auth)/(tabs)/account/categories/${category.id}`);
          }}
          onViewAllCategoriesPress={() =>
            router.push("/(auth)/(tabs)/account/categories")
          }
          onViewAllTransactionsPress={() =>
            router.push("/(auth)/(tabs)/transactions")
          }
        />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  scrollView: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  scrollContent: {
    paddingTop: spacing["2xl"],
  },
  loading: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.bg,
  },
  errorContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing["4xl"],
    backgroundColor: colors.bg,
  },
  errorTitle: {
    fontFamily: typography.family.sansBold,
    fontSize: typography.size.xl,
    color: colors.textPrimary,
    marginBottom: spacing.md,
  },
  errorText: {
    fontFamily: typography.family.sans,
    fontSize: typography.size.md,
    color: colors.textSecondary,
    textAlign: "center",
  },
});
