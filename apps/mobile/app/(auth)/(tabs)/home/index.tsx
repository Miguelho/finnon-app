import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import {
  CURRENCIES,
  buildCalendarDayData,
  buildHomeProjectPreviews,
  computeSavingsMonthFromTransactions,
  computeSavingsMonthView,
  formatMonthLabel,
  getMonthCalendarDisplayDays,
  getWeekCalendarDisplayDays,
  getWeekStartMonday,
  toDateKey,
  toMonthKey,
  type HomeProjectContributionRow,
  type MonthClose,
  type MonthlyProjectFundingPlan,
  type Obligation,
  type Project,
  type Transaction as SharedTransaction,
  type UserRole,
} from "@poleursus/shared";
import { supabase } from "../../../../src/lib/supabase";
import { useAuth } from "../../../../src/contexts/AuthContext";
import { useUserTheme } from "../../../../src/contexts/UserThemeContext";
import { useCopy, t } from "../../../../src/lib/i18n";
import { Calendar } from "../../../../src/components/home-redesign/Calendar";
import { MonthCard } from "../../../../src/components/home/MonthCard";
import { ProjectsGrid } from "../../../../src/components/home/ProjectsGrid";

type AccountMember = {
  account_id: string;
  user_id: string;
  role: UserRole;
};

type Account = {
  id: string;
  name: string;
  base_currency: string;
  account_members?: AccountMember[];
};

type Category = {
  id: string;
  name: string;
  icon_id: string;
  color?: string | null;
};

type Transaction = SharedTransaction & {
  category?: Category | null;
};

type SavingsTransaction = Pick<
  Transaction,
  "id" | "type" | "amount_minor" | "amount_base_minor" | "date"
>;

const normalizeCategory = <T extends { category?: unknown }>(row: T) => ({
  ...row,
  category: Array.isArray(row.category)
    ? (row.category[0] ?? null)
    : (row.category ?? null),
});

const TRANSACTIONS_SELECT_WITH_CATEGORY_COLOR =
  "id, account_id, type, amount_minor, amount_base_minor, currency, category_id, project_id, date, merchant, notes, created_by, created_at, category:categories(id, name, icon_id, color)";
const TRANSACTIONS_SELECT_LEGACY =
  "id, account_id, type, amount_minor, amount_base_minor, currency, category_id, project_id, date, merchant, notes, created_by, created_at, category:categories(id, name, icon_id)";

const isMissingCategoryColorError = (error: any) =>
  error?.code === "42703" &&
  typeof error?.message === "string" &&
  error.message.includes("categories") &&
  error.message.includes("color");

const WEEKDAY_LABELS = {
  es: ["L", "M", "X", "J", "V", "S", "D"],
  en: ["M", "T", "W", "T", "F", "S", "S"],
};

const MONTHS_SHORT = {
  es: ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"],
  en: ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"],
};

const MONTHS_LONG = {
  es: [
    "enero",
    "febrero",
    "marzo",
    "abril",
    "mayo",
    "junio",
    "julio",
    "agosto",
    "septiembre",
    "octubre",
    "noviembre",
    "diciembre",
  ],
  en: [
    "january",
    "february",
    "march",
    "april",
    "may",
    "june",
    "july",
    "august",
    "september",
    "october",
    "november",
    "december",
  ],
};

const plusDays = (date: Date, days: number) => {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
};

export default function HomeScreen() {
  const router = useRouter();
  const { user, session, selectedAccountId, setSelectedAccountId } = useAuth();
  const { tokens: userTokens } = useUserTheme();
  const { dictionary, locale } = useCopy();
  const localeKey = locale === "en" ? "en" : "es";
  const weekdayLabels = WEEKDAY_LABELS[localeKey];
  const monthsShort = MONTHS_SHORT[localeKey];
  const monthsLong = MONTHS_LONG[localeKey];
  const currentMonthKey = useMemo(() => toMonthKey(new Date()), []);
  const currentMonthStart = `${currentMonthKey}-01`;

  const [accounts, setAccounts] = useState<Account[] | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [obligations, setObligations] = useState<Obligation[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [fundingPlans, setFundingPlans] = useState<MonthlyProjectFundingPlan[]>([]);
  const [currentMonthClose, setCurrentMonthClose] = useState<MonthClose | null>(null);
  const [currentMonthTransactions, setCurrentMonthTransactions] = useState<SavingsTransaction[]>([]);
  const [projectContributionRows, setProjectContributionRows] = useState<HomeProjectContributionRow[]>([]);
  const [loadingAccounts, setLoadingAccounts] = useState(true);
  const [loadingCalendar, setLoadingCalendar] = useState(false);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [calendarView, setCalendarView] = useState<"week" | "month">("month");
  const [weekReference, setWeekReference] = useState<Date>(new Date());
  const [monthReference, setMonthReference] = useState<Date>(new Date());
  const [selectedDayKey, setSelectedDayKey] = useState<string>(toDateKey(new Date()));
  const [reloadSeed, setReloadSeed] = useState(0);

  const mainAccount = useMemo(() => {
    if (!accounts || accounts.length === 0) return null;
    if (selectedAccountId) {
      return accounts.find((account) => account.id === selectedAccountId) ?? accounts[0];
    }
    return accounts[0];
  }, [accounts, selectedAccountId]);

  useEffect(() => {
    let cancelled = false;
    const currentUserId = user?.id;

    if (!session || !currentUserId) {
      setLoadingAccounts(false);
      return;
    }

    const loadAccounts = async () => {
      setLoadingAccounts(true);
      setError(null);

      try {
        const { data, error: accountsError } = await supabase
          .from("accounts")
          .select("id, name, base_currency, account_members!inner(role, user_id)")
          .eq("account_members.user_id", currentUserId);

        if (accountsError) throw accountsError;

        if (!cancelled) {
          setAccounts((data as Account[]) ?? []);
        }
      } catch (loadError: any) {
        console.error("[Home] Error loading accounts:", loadError);
        if (!cancelled) {
          setError(loadError?.message ?? t(dictionary, "mobile.home.errorLoadAccounts"));
        }
      } finally {
        if (!cancelled) setLoadingAccounts(false);
      }
    };

    void loadAccounts();

    return () => {
      cancelled = true;
    };
  }, [session?.access_token, user?.id, dictionary, reloadSeed]);

  useEffect(() => {
    if (accounts && accounts.length > 0 && !selectedAccountId) {
      void setSelectedAccountId(accounts[0]?.id ?? null);
    }
  }, [accounts, selectedAccountId, setSelectedAccountId]);

  useEffect(() => {
    let cancelled = false;

    const loadCalendarData = async () => {
      if (!mainAccount) return;

      setLoadingCalendar(true);
      setError(null);

      const monthStart = new Date(monthReference.getFullYear(), monthReference.getMonth(), 1);
      const monthEnd = new Date(monthReference.getFullYear(), monthReference.getMonth() + 1, 0);
      const monthGridStart = getWeekStartMonday(monthStart);
      const monthGridEnd = plusDays(getWeekStartMonday(plusDays(monthEnd, 1)), 6);
      const weekStart = getWeekStartMonday(weekReference);
      const weekEnd = plusDays(weekStart, 6);

      const queryStart = monthGridStart < weekStart ? monthGridStart : weekStart;
      const queryEnd = monthGridEnd > weekEnd ? monthGridEnd : weekEnd;
      const startDate = toDateKey(queryStart);
      const endDate = toDateKey(queryEnd);

      try {
        const loadTransactions = async (selectClause: string) =>
          supabase
            .from("transactions")
            .select(selectClause)
            .eq("account_id", mainAccount.id)
            .gte("date", startDate)
            .lte("date", endDate)
            .order("date", { ascending: false })
            .order("created_at", { ascending: false });

        let { data: txRows, error: txError } = await loadTransactions(
          TRANSACTIONS_SELECT_WITH_CATEGORY_COLOR
        );

        if (isMissingCategoryColorError(txError)) {
          console.warn("[Home] categories.color missing, retrying transactions query without color.");
          ({ data: txRows, error: txError } = await loadTransactions(TRANSACTIONS_SELECT_LEGACY));
        }

        if (txError) throw txError;

        const { data: obligationRows, error: obligationsError } = await supabase
          .from("obligations")
          .select(
            "id, account_id, name, amount_minor, amount_base_minor, currency, due_date, status, paid_at"
          )
          .eq("account_id", mainAccount.id)
          .gte("due_date", startDate)
          .lte("due_date", endDate)
          .order("due_date", { ascending: true });

        if (obligationsError) throw obligationsError;

        if (!cancelled) {
          setTransactions(
            (((txRows ?? []) as unknown as Array<{ category?: unknown }>).map(normalizeCategory) as Transaction[]) ??
              []
          );
          setObligations((obligationRows as Obligation[]) ?? []);
        }
      } catch (loadError: any) {
        console.error("[Home] Error loading transactions and obligations:", loadError);
        if (!cancelled) {
          setError(loadError?.message ?? t(dictionary, "mobile.home.errorLoadTransactions"));
        }
      } finally {
        if (!cancelled) setLoadingCalendar(false);
      }
    };

    void loadCalendarData();

    return () => {
      cancelled = true;
    };
  }, [mainAccount?.id, monthReference, weekReference, dictionary, reloadSeed]);

  useEffect(() => {
    let cancelled = false;

    const loadSummaryData = async () => {
      if (!mainAccount) return;

      setLoadingSummary(true);

      try {
        const todayDateKey = toDateKey(new Date());
        const [projectsResult, fundingPlansResult, currentMonthCloseResult, currentMonthTransactionsResult] =
          await Promise.all([
            supabase
              .from("projects")
              .select("*")
              .eq("account_id", mainAccount.id)
              .not("target_amount_base_minor", "is", null)
              .in("status", ["active", "completed"])
              .order("priority", { ascending: true }),
            supabase
              .from("monthly_project_funding_plans")
              .select("*")
              .eq("account_id", mainAccount.id)
              .eq("period", currentMonthStart),
            supabase
              .from("month_closes")
              .select("*")
              .eq("account_id", mainAccount.id)
              .eq("period", currentMonthStart)
              .maybeSingle(),
            supabase
              .from("transactions")
              .select("id, type, amount_minor, amount_base_minor, date")
              .eq("account_id", mainAccount.id)
              .gte("date", currentMonthStart)
              .lte("date", todayDateKey)
              .order("date", { ascending: true }),
          ]);

        if (projectsResult.error) throw projectsResult.error;
        if (fundingPlansResult.error) throw fundingPlansResult.error;
        if (currentMonthCloseResult.error) throw currentMonthCloseResult.error;
        if (currentMonthTransactionsResult.error) throw currentMonthTransactionsResult.error;

        const nextProjects = (projectsResult.data as Project[]) ?? [];
        const projectIds = nextProjects.map((project) => project.id);
        const { data: contributionRows, error: contributionRowsError } =
          projectIds.length > 0
            ? await supabase
                .from("transactions")
                .select("project_id, amount_base_minor")
                .eq("account_id", mainAccount.id)
                .eq("type", "expense")
                .in("project_id", projectIds)
            : {
                data: [] as HomeProjectContributionRow[],
                error: null,
              };

        if (contributionRowsError) throw contributionRowsError;

        if (!cancelled) {
          setProjects(nextProjects);
          setFundingPlans((fundingPlansResult.data as MonthlyProjectFundingPlan[]) ?? []);
          setCurrentMonthClose((currentMonthCloseResult.data as MonthClose | null) ?? null);
          setCurrentMonthTransactions(
            (currentMonthTransactionsResult.data as SavingsTransaction[]) ?? []
          );
          setProjectContributionRows((contributionRows ?? []) as HomeProjectContributionRow[]);
        }
      } catch (loadError) {
        console.warn("[Home] Could not load summary data:", loadError);
        if (!cancelled) {
          setProjects([]);
          setFundingPlans([]);
          setCurrentMonthClose(null);
          setCurrentMonthTransactions([]);
          setProjectContributionRows([]);
        }
      } finally {
        if (!cancelled) setLoadingSummary(false);
      }
    };

    void loadSummaryData();

    return () => {
      cancelled = true;
    };
  }, [currentMonthStart, mainAccount?.id, reloadSeed]);

  const showLoading = !session || !user || loadingAccounts || loadingCalendar || loadingSummary;
  const showError = Boolean(error);
  const showAccountMissing = !accounts || accounts.length === 0 || !mainAccount;

  const baseCurrency = mainAccount?.base_currency ?? "EUR";
  const currencySymbol =
    CURRENCIES.find((currency) => currency.code === baseCurrency)?.symbol ?? baseCurrency;

  const monthTotals = useMemo(
    () => computeSavingsMonthFromTransactions(currentMonthTransactions),
    [currentMonthTransactions]
  );
  const savingsState = useMemo(
    () =>
      computeSavingsMonthView({
        period: currentMonthKey,
        transactions: currentMonthTransactions,
        fundingPlans,
        monthClose: currentMonthClose,
      }),
    [currentMonthClose, currentMonthKey, currentMonthTransactions, fundingPlans]
  );
  const currentMonthLabel = useMemo(() => {
    const label = formatMonthLabel(currentMonthKey, localeKey === "en" ? "en-US" : "es-ES");
    return label ? `${label.charAt(0).toUpperCase()}${label.slice(1)}` : "";
  }, [currentMonthKey, localeKey]);

  const topProjects = useMemo(
    () =>
      buildHomeProjectPreviews({
        projects,
        contributionRows: projectContributionRows,
        limit: 3,
        now: new Date(),
      }),
    [projectContributionRows, projects]
  );

  const today = new Date();
  const todayKey = toDateKey(today);
  const calendarMap = useMemo(() => {
    const entries = [
      ...transactions.map((tx) => ({
        date: tx.date as string,
        type: tx.type,
        amount_minor: tx.amount_minor,
        amount_base_minor: tx.amount_base_minor,
        category_id: tx.category?.id ?? tx.category_id ?? null,
        category_name: tx.category?.name ?? null,
        category_color: tx.category?.color ?? null,
      })),
      ...obligations
        .filter((obligation) => obligation.status !== "paid" && Boolean(obligation.due_date))
        .map((obligation) => ({
          date: obligation.due_date as string,
          type: "expense" as const,
          amount_minor: obligation.amount_minor,
          amount_base_minor: obligation.amount_base_minor,
          category_id: "obligation",
          category_name: localeKey === "en" ? "Scheduled" : "Programado",
          category_color: "#CB6E55",
        })),
    ];

    return buildCalendarDayData(entries);
  }, [transactions, obligations, localeKey]);

  const monthDays = useMemo(() => {
    return getMonthCalendarDisplayDays(
      calendarMap,
      monthReference.getFullYear(),
      monthReference.getMonth(),
      todayKey,
      weekdayLabels
    );
  }, [calendarMap, monthReference, todayKey, weekdayLabels]);

  const weekDays = useMemo(() => {
    return getWeekCalendarDisplayDays(calendarMap, weekReference, todayKey, weekdayLabels);
  }, [calendarMap, weekReference, todayKey, weekdayLabels]);

  const weekPeriodLabel = useMemo(() => {
    const monday = getWeekStartMonday(weekReference);
    const sunday = plusDays(monday, 6);
    const startMonth = monthsShort[monday.getMonth()] ?? "";
    const endMonth = monthsShort[sunday.getMonth()] ?? "";
    if (monday.getMonth() === sunday.getMonth()) {
      return `${monday.getDate()}–${sunday.getDate()} ${endMonth}`;
    }
    return `${monday.getDate()} ${startMonth} – ${sunday.getDate()} ${endMonth}`;
  }, [weekReference, monthsShort]);

  const monthPeriodLabel = useMemo(() => {
    const monthName = monthsLong[monthReference.getMonth()] ?? "";
    return `${monthName.charAt(0).toUpperCase()}${monthName.slice(1)} ${monthReference.getFullYear()}`;
  }, [monthReference, monthsLong]);

  if (showError) {
    return (
      <View style={[styles.loading, { backgroundColor: userTokens.background }]}>
        <Text style={[styles.errorTitle, { color: userTokens.textPrimary }]}>
          {t(dictionary, "common.errorTitle")}
        </Text>
        <Text style={[styles.errorText, { color: userTokens.textSecondary }]}>{error}</Text>
        <Pressable
          style={[
            styles.retryButton,
            { backgroundColor: userTokens.surfaceAlt, borderColor: userTokens.border },
          ]}
          onPress={() => {
            setError(null);
            setReloadSeed((seed) => seed + 1);
          }}
        >
          <Text style={[styles.retryText, { color: userTokens.textPrimary }]}>
            {t(dictionary, "common.retry")}
          </Text>
        </Pressable>
      </View>
    );
  }

  if (showLoading || showAccountMissing) {
    return (
      <View style={[styles.loading, { backgroundColor: userTokens.background }]}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <View style={[styles.root, { backgroundColor: userTokens.background }]}>
      <ScrollView contentContainerStyle={styles.content}>
        <MonthCard
          currentMonth={currentMonthLabel}
          savingsMinor={savingsState.generatedSavedMinor}
          incomeMinor={monthTotals.incomeMinor}
          expenseMinor={monthTotals.expenseMinor}
          availableMinor={savingsState.availableToPlanMinor}
        />

        <ProjectsGrid
          projects={topProjects}
          onViewAll={() => router.push("/(auth)/(tabs)/projects")}
          onProjectPress={(projectId) => router.push(`/(auth)/(tabs)/projects/${projectId}`)}
        />

        <Calendar
          view={calendarView}
          onViewChange={setCalendarView}
          periodLabel={calendarView === "week" ? weekPeriodLabel : monthPeriodLabel}
          monthDays={monthDays}
          weekDays={weekDays}
          selectedDayKey={selectedDayKey}
          onSelectDay={setSelectedDayKey}
          onPrevPeriod={handlePrevPeriod}
          onNextPeriod={handleNextPeriod}
          currencySymbol={currencySymbol}
        />
      </ScrollView>
    </View>
  );

  function handlePrevPeriod() {
    if (calendarView === "week") {
      const next = new Date(weekReference);
      next.setDate(next.getDate() - 7);
      setWeekReference(next);
      setSelectedDayKey((current) => {
        const currentDate = new Date(current);
        if (Number.isNaN(currentDate.getTime())) return toDateKey(next);
        currentDate.setDate(currentDate.getDate() - 7);
        return toDateKey(currentDate);
      });
      return;
    }

    const next = new Date(monthReference);
    next.setMonth(next.getMonth() - 1);
    setMonthReference(next);
  }

  function handleNextPeriod() {
    if (calendarView === "week") {
      const next = new Date(weekReference);
      next.setDate(next.getDate() + 7);
      setWeekReference(next);
      setSelectedDayKey((current) => {
        const currentDate = new Date(current);
        if (Number.isNaN(currentDate.getTime())) return toDateKey(next);
        currentDate.setDate(currentDate.getDate() + 7);
        return toDateKey(currentDate);
      });
      return;
    }

    const next = new Date(monthReference);
    next.setMonth(next.getMonth() + 1);
    setMonthReference(next);
  }
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  content: {
    paddingTop: 18,
    paddingHorizontal: 16,
    paddingBottom: 120,
    gap: 12,
  },
  loading: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 22,
    gap: 10,
  },
  errorTitle: {
    fontSize: 17,
    fontFamily: "DMSans-SemiBold",
  },
  errorText: {
    fontSize: 13,
    fontFamily: "DMSans",
    textAlign: "center",
  },
  retryButton: {
    marginTop: 8,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  retryText: {
    fontSize: 13,
    fontFamily: "DMSans-SemiBold",
  },
});
