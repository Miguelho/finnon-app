import { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  TouchableOpacity,
} from "react-native";
import { useIsFocused } from "@react-navigation/native";
import { useRouter } from "expo-router";
import {
  type AvatarColorToken,
  CURRENCIES,
  computeMovementBalanceSummary,
  computeSavingsDistribution,
  getExpandedMonthRange,
  getGoalTotalsFromTransactions,
  getWeekStrip,
  themeTokens,
  type Obligation,
  type Project,
  type UserRole,
  type UserAvatarColorId,
  type Transaction as SharedTransaction,
} from "@poleursus/shared";
import { supabase } from "../../../../src/lib/supabase";
import { useAuth } from "../../../../src/contexts/AuthContext";
import { useUserTheme } from "../../../../src/contexts/UserThemeContext";
import { useCopy, t } from "../../../../src/lib/i18n";
import { BalanceHeader } from "../../../../src/components/home-redesign/BalanceHeader";
import {
  Calendar,
  type ContextMovement,
  type DayDetailData,
  type DayMovement,
} from "../../../../src/components/home-redesign/Calendar";
import { SavingsMonthCard } from "../../../../src/components/home-redesign/SavingsMonthCard";
import {
  formatCurrencyParts,
  formatFullDate,
  formatShortDate,
  toDateKey,
  toMinor,
} from "../../../../src/components/home-redesign/utils";

const tokens = themeTokens.light;
const colors = tokens.colors;

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
};

type Transaction = SharedTransaction & {
  created_by?: string | null;
  category?: Category | null;
};

type ProfileRow = {
  user_id: string;
  email: string | null;
  display_name: string | null;
  avatar_path: string | null;
  avatar_fallback_text: string | null;
  avatar_fallback_bg_token: AvatarColorToken | null;
  avatar_color: UserAvatarColorId | null;
};

const normalizeCategory = <T extends { category?: unknown }>(row: T) => ({
  ...row,
  category: Array.isArray(row.category)
    ? (row.category[0] ?? null)
    : (row.category ?? null),
});

const WEEKDAY_LABELS = {
  es: ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"],
  en: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
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

export default function HomeScreen() {
  const router = useRouter();
  const { user, session, selectedAccountId, setSelectedAccountId } = useAuth();
  const { tokens: userThemeTokens } = useUserTheme();
  const { dictionary, locale } = useCopy();
  const isFocused = useIsFocused();
  const localeKey = locale === "en" ? "en" : "es";
  const weekdayLabels = WEEKDAY_LABELS[localeKey];
  const monthsShort = MONTHS_SHORT[localeKey];
  const monthsLong = MONTHS_LONG[localeKey];

  const [accounts, setAccounts] = useState<Account[] | null>(null);
  const [monthlyTransactions, setMonthlyTransactions] = useState<Transaction[]>([]);
  const [upcomingTransactions, setUpcomingTransactions] = useState<Transaction[]>([]);
  const [profilesByUserId, setProfilesByUserId] = useState<Record<string, ProfileRow>>({});
  const [obligations, setObligations] = useState<Obligation[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loadingAccounts, setLoadingAccounts] = useState(true);
  const [loadingData, setLoadingData] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [calendarView, setCalendarView] = useState<"week" | "month">("week");
  const [weekReference, setWeekReference] = useState<Date>(new Date());
  const [monthReference, setMonthReference] = useState<Date>(new Date());
  const [selectedDayKey, setSelectedDayKey] = useState<string>(toDateKey(new Date()));

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
      setAccounts(null);
      setLoadingAccounts(false);
      return;
    }

    async function loadAccounts() {
      if (!isFocused) {
        setLoadingAccounts(false);
        return;
      }

      setLoadingAccounts(true);
      setError(null);

      try {
        const { data, error: accountsError } = await supabase
          .from("accounts")
          .select("id, name, base_currency, account_members!inner(role, user_id)")
          .eq("account_members.user_id", currentUserId);

        if (accountsError) throw accountsError;

        const accountsList = (data as Account[]) ?? [];

        if (!cancelled) {
          setAccounts(accountsList);
        }
      } catch (e: any) {
        console.error("[Home] Error loading accounts:", e);
        if (!cancelled) {
          setError(e?.message ?? t(dictionary, "mobile.home.errorLoadAccounts"));
        }
      } finally {
        if (!cancelled) setLoadingAccounts(false);
      }
    }

    loadAccounts();
    return () => {
      cancelled = true;
    };
  }, [session?.access_token, user?.id, isFocused]);

  useEffect(() => {
    if (accounts && accounts.length > 0 && !selectedAccountId) {
      setSelectedAccountId(accounts[0]?.id ?? null);
    }
  }, [accounts, selectedAccountId, setSelectedAccountId]);

  useEffect(() => {
    let cancelled = false;

    async function loadTransactions() {
      if (!mainAccount || !isFocused) return;

      setLoadingData(true);
      setError(null);

      const expandedRange = getExpandedMonthRange(monthReference);
      const startDate = expandedRange.start.toISOString().slice(0, 10);
      const endDate = expandedRange.end.toISOString().slice(0, 10);
      const today = new Date();
      const upcomingEnd = new Date(today);
      upcomingEnd.setDate(upcomingEnd.getDate() + 30);
      const obligationsEnd =
        upcomingEnd > expandedRange.end ? upcomingEnd : expandedRange.end;
      const obligationsEndDate = obligationsEnd.toISOString().slice(0, 10);
      const upcomingStartDate = today.toISOString().slice(0, 10);
      const upcomingEndDate = upcomingEnd.toISOString().slice(0, 10);

      try {
        const { data: monthData, error: monthError } = await supabase
          .from("transactions")
          .select(
            "id, account_id, type, amount_minor, amount_base_minor, currency, category_id, date, merchant, notes, created_by, created_at, category:categories(id, name, icon_id)"
          )
          .eq("account_id", mainAccount.id)
          .gte("date", startDate)
          .lte("date", endDate)
          .order("date", { ascending: false })
          .order("created_at", { ascending: false });

        if (monthError) throw monthError;

        const { data: upcomingData, error: upcomingError } = await supabase
          .from("transactions")
          .select(
            "id, account_id, type, amount_minor, amount_base_minor, currency, category_id, date, merchant, notes, created_by, created_at, category:categories(id, name, icon_id)"
          )
          .eq("account_id", mainAccount.id)
          .gte("date", upcomingStartDate)
          .lte("date", upcomingEndDate)
          .order("date", { ascending: true });

        if (upcomingError) throw upcomingError;

        const { data: obligationsRange, error: obligationsError } = await supabase
          .from("obligations")
          .select(
            "id, account_id, name, amount_minor, amount_base_minor, currency, due_date, status, paid_at"
          )
          .eq("account_id", mainAccount.id)
          .gte("due_date", startDate)
          .lte("due_date", obligationsEndDate)
          .order("due_date", { ascending: true });

        if (obligationsError) throw obligationsError;

        const { data: obligationsNoDate, error: noDateError } = await supabase
          .from("obligations")
          .select(
            "id, account_id, name, amount_minor, amount_base_minor, currency, due_date, status, paid_at"
          )
          .eq("account_id", mainAccount.id)
          .is("due_date", null);

        if (noDateError) throw noDateError;

        const normalizedMonthly = (monthData ?? []).map(normalizeCategory);
        const normalizedUpcoming = (upcomingData ?? []).map(normalizeCategory);
        const creatorIds = Array.from(
          new Set(
            [...normalizedMonthly, ...normalizedUpcoming]
              .map((tx) => tx.created_by)
              .filter((id): id is string => Boolean(id))
          )
        );
        let nextProfilesByUserId: Record<string, ProfileRow> = {};
        if (creatorIds.length > 0) {
          const { data: profileRows, error: profilesError } = await supabase
            .from("profiles")
            .select(
              "user_id, email, display_name, avatar_path, avatar_fallback_text, avatar_fallback_bg_token, avatar_color"
            )
            .in("user_id", creatorIds);

          if (profilesError) {
            console.warn("[Home] Profiles query error:", profilesError);
          } else {
            nextProfilesByUserId = ((profileRows as ProfileRow[]) ?? []).reduce<
              Record<string, ProfileRow>
            >((acc, profile) => {
              acc[profile.user_id] = profile;
              return acc;
            }, {});
          }
        }

        if (!cancelled) {
          setMonthlyTransactions(normalizedMonthly as unknown as Transaction[]);
          setUpcomingTransactions(normalizedUpcoming as unknown as Transaction[]);
          setProfilesByUserId(nextProfilesByUserId);
          const combinedObligations = [
            ...((obligationsRange as Obligation[]) ?? []),
            ...((obligationsNoDate as Obligation[]) ?? []),
          ];
          setObligations(combinedObligations);
        }
      } catch (e: any) {
        console.error("[Home] Error loading data:", e);
        if (!cancelled) {
          setError(e?.message ?? t(dictionary, "mobile.home.errorLoadTransactions"));
        }
      } finally {
        if (!cancelled) setLoadingData(false);
      }
    }

    loadTransactions();
    return () => {
      cancelled = true;
    };
  }, [mainAccount?.id, isFocused, monthReference]);

  useEffect(() => {
    let cancelled = false;

    async function loadProjects() {
      if (!mainAccount || !isFocused) return;

      try {
        const { data: projectRows, error: projectsError } = await supabase
          .from("projects")
          .select("*")
          .eq("account_id", mainAccount.id)
          .in("status", ["active", "completed"])
          .order("priority", { ascending: true });

        if (projectsError) throw projectsError;

        const projectList = (projectRows as Project[]) ?? [];

        if (!cancelled) {
          setProjects(projectList);
        }
      } catch (loadError) {
        console.warn("[Home] Could not load projects for home widget:", loadError);
        if (!cancelled) {
          setProjects([]);
        }
      }
    }

    loadProjects();
    return () => {
      cancelled = true;
    };
  }, [mainAccount?.id, isFocused]);

  const allTransactions = useMemo(() => {
    const map = new Map<string, Transaction>();
    [...monthlyTransactions, ...upcomingTransactions].forEach((item) => {
      map.set(item.id, item);
    });
    return Array.from(map.values());
  }, [monthlyTransactions, upcomingTransactions]);
  const resolveMovementCreator = useCallback(
    (createdBy?: string | null) => {
      if (!createdBy) return undefined;
      const profile = profilesByUserId[createdBy];
      const fallbackName =
        profile?.display_name?.trim() ||
        profile?.email?.trim() ||
        createdBy.slice(0, 6);
      return {
        userId: createdBy,
        email: profile?.email ?? null,
        displayName: profile?.display_name ?? fallbackName,
        avatarPath: profile?.avatar_path ?? null,
        fallbackText: profile?.avatar_fallback_text ?? null,
        fallbackBgToken: profile?.avatar_fallback_bg_token ?? null,
        avatarColor: profile?.avatar_color ?? null,
        label: fallbackName,
      };
    },
    [profilesByUserId]
  );
  const selectedMonthReference = calendarView === "month" ? monthReference : weekReference;
  const selectedMonthKey = useMemo(() => {
    const year = selectedMonthReference.getFullYear();
    const month = String(selectedMonthReference.getMonth() + 1).padStart(2, "0");
    return `${year}-${month}`;
  }, [selectedMonthReference]);
  const selectedMonthBalanceMinor = useMemo(() => {
    const selectedMonthTransactions = allTransactions.filter((tx) => {
      const dateKey = toDateKey(tx.date as string);
      return Boolean(dateKey) && dateKey.startsWith(selectedMonthKey);
    });
    return computeMovementBalanceSummary(selectedMonthTransactions).totalBalanceMinor;
  }, [allTransactions, selectedMonthKey]);

  const baseCurrency = mainAccount?.base_currency ?? "EUR";
  const currencySymbol =
    CURRENCIES.find((c) => c.code === baseCurrency)?.symbol || baseCurrency;

  const today = new Date();
  const todayKey = toDateKey(today);
  const monthLabel = `${monthsLong[today.getMonth()] ?? ""} ${today.getFullYear()}`;
  const monthLabelCapitalized =
    monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1);

  const monthPrefix = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
  const monthTransactionsToDate = monthlyTransactions.filter((tx) => {
    const dateKey = toDateKey(tx.date as string);
    return Boolean(dateKey) && dateKey.startsWith(monthPrefix) && dateKey <= todayKey;
  });

  const goalTotals = getGoalTotalsFromTransactions(
    monthTransactionsToDate.map((tx) => ({
      type: tx.type,
      amount_minor: tx.amount_minor,
      amount_base_minor: tx.amount_base_minor,
    }))
  );

  const monthlyBalanceMinor =
    goalTotals.incomeTotalMinor - goalTotals.expenseTotalMinor;
  const savingsDistribution = useMemo(
    () =>
      computeSavingsDistribution({
        projects,
        savingsMinor: monthlyBalanceMinor,
      }),
    [monthlyBalanceMinor, projects]
  );

  const weekStrip = useMemo(() => {
    const weekObligations = obligations.filter((item) => item.status !== "paid");
    return getWeekStrip(
      weekObligations as Obligation[],
      allTransactions as SharedTransaction[],
      today,
      weekReference
    );
  }, [obligations, allTransactions, today, weekReference]);

  const weekTotals = useMemo(() => {
    let income = 0n;
    let expense = 0n;
    const startKey = toDateKey(weekStrip.weekRange.start);
    const endKey = toDateKey(weekStrip.weekRange.end);

    allTransactions.forEach((tx) => {
      const dateKey = toDateKey(tx.date as string);
      if (!dateKey || dateKey < startKey || dateKey > endKey) return;
      const amount = toMinor(tx.amount_base_minor ?? tx.amount_minor);
      if (tx.type === "income") income += amount;
      if (tx.type === "expense") expense += amount;
    });

    return { income, expense, net: income - expense };
  }, [allTransactions, weekStrip.weekRange]);

  const weekPeriodLabel = useMemo(() => {
    const start = weekStrip.weekRange.start;
    const end = weekStrip.weekRange.end;
    const startMonth = monthsShort[start.getMonth()] ?? "";
    const endMonth = monthsShort[end.getMonth()] ?? "";
    if (start.getMonth() === end.getMonth()) {
      return `${start.getDate()} – ${end.getDate()} ${endMonth}`;
    }
    return `${start.getDate()} ${startMonth} – ${end.getDate()} ${endMonth}`;
  }, [weekStrip.weekRange, monthsShort]);

  const weekData = useMemo(() => {
    const netIncome = formatCurrencyParts(weekTotals.income, currencySymbol).full;
    const netExpense = formatCurrencyParts(weekTotals.expense, currencySymbol).full;
    const net = formatCurrencyParts(weekTotals.net, currencySymbol).full;

    return {
      days: weekStrip.days.map((day) => ({
        date: day.dayKey,
        dayLabel: weekdayLabels[day.dayOfWeek] ?? "",
        dayNumber: day.dayOfMonth,
        isToday: day.isToday,
        dots: day.dots.map((dot): { type: "income" | "expense" } => ({
          type: dot.type === "income" ? "income" : "expense",
        })),
      })),
      period: weekPeriodLabel,
      netIncome,
      netExpense,
      net,
    };
  }, [weekStrip.days, weekTotals, currencySymbol, weekPeriodLabel, weekdayLabels]);

  const monthData = useMemo(() => {
    const monthRange = getExpandedMonthRange(monthReference);
    const dotsMap = new Map<string, Array<{ type: "income" | "expense" }>>();
    const monthKey = `${monthReference.getFullYear()}-${String(
      monthReference.getMonth() + 1
    ).padStart(2, "0")}`;
    let monthIncome = 0n;
    let monthExpense = 0n;

    const addDot = (dateKey: string, type: "income" | "expense") => {
      const existing = dotsMap.get(dateKey) ?? [];
      existing.push({ type });
      dotsMap.set(dateKey, existing);
    };

    allTransactions.forEach((tx) => {
      const key = toDateKey(tx.date as string);
      if (!key) return;
      addDot(key, tx.type === "income" ? "income" : "expense");
      if (!key.startsWith(monthKey)) return;
      const amount = toMinor(tx.amount_base_minor ?? tx.amount_minor);
      if (tx.type === "income") {
        monthIncome += amount;
      } else {
        monthExpense += amount;
      }
    });

    obligations.forEach((obligation) => {
      if (!obligation.due_date || obligation.status === "paid") return;
      const key = toDateKey(obligation.due_date as string);
      if (!key) return;
      addDot(key, "expense");
    });

    const days = [] as {
      date: string;
      dayNumber: number;
      isToday: boolean;
      isOtherMonth: boolean;
      dots: Array<{ type: "income" | "expense" }>;
    }[];

    const cursor = new Date(monthRange.start);
    while (cursor <= monthRange.end) {
      const key = toDateKey(cursor);
      const isOtherMonth = cursor.getMonth() !== monthReference.getMonth();
      days.push({
        date: key,
        dayNumber: cursor.getDate(),
        isToday: toDateKey(cursor) === todayKey,
        isOtherMonth,
        dots: dotsMap.get(key) ?? [],
      });
      cursor.setDate(cursor.getDate() + 1);
    }

    const monthLabel = `${monthsLong[monthReference.getMonth()] ?? ""} ${
      monthReference.getFullYear()
    }`;
    const netIncome = formatCurrencyParts(monthIncome, currencySymbol).full;
    const netExpense = formatCurrencyParts(monthExpense, currencySymbol).full;
    const net = formatCurrencyParts(monthIncome - monthExpense, currencySymbol).full;

    return {
      days,
      period: monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1),
      netIncome,
      netExpense,
      net,
    };
  }, [allTransactions, obligations, monthReference, todayKey, monthsLong, currencySymbol]);

  const selectedDay = useMemo<DayDetailData | null>(() => {
    if (!selectedDayKey) return null;
    const movements: DayMovement[] = [];

    allTransactions.forEach((tx) => {
      if (toDateKey(tx.date as string) !== selectedDayKey) return;
      movements.push({
        id: tx.id,
        name:
          tx.merchant ??
          tx.category?.name ??
          t(dictionary, "mobile.home.movementFallback"),
        amountMinor: toMinor(tx.amount_base_minor ?? tx.amount_minor),
        type: tx.type,
        category: tx.category?.name ?? null,
        categoryIconId: tx.category?.icon_id ?? null,
        badge: null,
        createdBy: resolveMovementCreator(tx.created_by),
      });
    });

    obligations.forEach((obligation) => {
      if (!obligation.due_date || obligation.status === "paid") return;
      if (toDateKey(obligation.due_date as string) !== selectedDayKey) return;
      movements.push({
        id: `obligation-${obligation.id}`,
        name: obligation.name,
        amountMinor: toMinor(
          obligation.amount_base_minor ?? obligation.amount_minor
        ),
        type: "expense",
        category: t(dictionary, "mobile.home.programmedBadge"),
        categoryIconId: null,
        badge: t(dictionary, "mobile.home.programmedBadge"),
      });
    });

    return {
      dateKey: selectedDayKey,
      formattedLabel: formatFullDate(selectedDayKey, locale),
      movements,
    };
  }, [
    selectedDayKey,
    allTransactions,
    obligations,
    locale,
    dictionary,
    resolveMovementCreator,
  ]);

  const contextMovements = useMemo(() => {
    const items: Array<ContextMovement & { dateKey: string; sortKey: string }> = [];

    allTransactions.forEach((tx) => {
      const dateKey = toDateKey(tx.date as string);
      if (!dateKey) return;
      items.push({
        id: tx.id,
        name:
          tx.merchant ??
          tx.category?.name ??
          t(dictionary, "mobile.home.movementFallback"),
        amountMinor: toMinor(tx.amount_base_minor ?? tx.amount_minor),
        type: tx.type,
        dateLabel: formatShortDate(dateKey, locale),
        category: tx.category?.name ?? null,
        categoryIconId: tx.category?.icon_id ?? null,
        badge: null,
        createdBy: resolveMovementCreator(tx.created_by),
        dateKey,
        sortKey:
          typeof tx.created_at === "string"
            ? tx.created_at
            : tx.created_at?.toISOString?.() ?? "",
      });
    });

    obligations.forEach((obligation) => {
      if (!obligation.due_date || obligation.status === "paid") return;
      const dateKey = toDateKey(obligation.due_date as string);
      if (!dateKey) return;
      items.push({
        id: `obligation-${obligation.id}`,
        name: obligation.name,
        amountMinor: toMinor(obligation.amount_base_minor ?? obligation.amount_minor),
        type: "expense",
        dateLabel: formatShortDate(dateKey, locale),
        category: t(dictionary, "mobile.home.programmedBadge"),
        categoryIconId: null,
        badge: t(dictionary, "mobile.home.programmedBadge"),
        dateKey,
        sortKey: "",
      });
    });

    return items;
  }, [allTransactions, obligations, locale, dictionary, resolveMovementCreator]);

  const selectedReferenceDayKey = selectedDayKey || todayKey;

  const contextUpcomingMovements = useMemo(() => {
    return contextMovements
      .filter((movement) => movement.dateKey > selectedReferenceDayKey)
      .sort((left, right) => {
        if (left.dateKey !== right.dateKey) return left.dateKey > right.dateKey ? 1 : -1;
        if (left.sortKey === right.sortKey) return 0;
        return left.sortKey > right.sortKey ? 1 : -1;
      })
      .slice(0, 3)
      .map(({ dateKey: _dateKey, sortKey: _sortKey, ...movement }) => movement);
  }, [contextMovements, selectedReferenceDayKey]);

  const contextPastMovements = useMemo(() => {
    return contextMovements
      .filter((movement) => movement.dateKey < selectedReferenceDayKey)
      .sort((left, right) => {
        if (left.dateKey !== right.dateKey) return left.dateKey > right.dateKey ? -1 : 1;
        if (left.sortKey === right.sortKey) return 0;
        return left.sortKey > right.sortKey ? -1 : 1;
      })
      .slice(0, 3)
      .map(({ dateKey: _dateKey, sortKey: _sortKey, ...movement }) => movement);
  }, [contextMovements, selectedReferenceDayKey]);

  const showLoading = !session || !user || loadingAccounts || loadingData;
  const showError = Boolean(error);
  const showAccountMissing = !accounts || accounts.length === 0 || !mainAccount;

  if (showError) {
    return (
      <View style={[styles.container, { backgroundColor: userThemeTokens.background }]}>
        <View style={styles.errorCard}>
          <Text style={styles.errorTitle}>{t(dictionary, "common.errorTitle")}</Text>
          <Text style={styles.errorText}>{error}</Text>
          <View style={{ height: tokens.spacing.md }} />
          <TouchableOpacity
            style={styles.retryButton}
            onPress={() => {
              setError(null);
              router.replace("/(auth)/(tabs)/home");
            }}
          >
            <Text style={styles.retryText}>{t(dictionary, "mobile.home.retry")}</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (showLoading || showAccountMissing) {
    return (
      <View style={[styles.loading, { backgroundColor: userThemeTokens.background }]}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  const handlePrevPeriod = () => {
    if (calendarView === "week") {
      const next = new Date(weekReference);
      next.setDate(next.getDate() - 7);
      setWeekReference(next);
    } else {
      const next = new Date(monthReference);
      next.setMonth(next.getMonth() - 1);
      setMonthReference(next);
    }
  };

  const handleNextPeriod = () => {
    if (calendarView === "week") {
      const next = new Date(weekReference);
      next.setDate(next.getDate() + 7);
      setWeekReference(next);
    } else {
      const next = new Date(monthReference);
      next.setMonth(next.getMonth() + 1);
      setMonthReference(next);
    }
  };

  const savingsSection = (
    <SavingsMonthCard
      title={t(dictionary, "home.savings.title")}
      monthLabel={monthLabelCapitalized}
      baseCurrency={baseCurrency}
      currencySymbol={currencySymbol}
      objectiveMinor={savingsDistribution.objectiveMinor}
      savingsMinor={savingsDistribution.savingsMinor}
      projectsMinor={savingsDistribution.projectCoveredMinor}
      huchaMinor={savingsDistribution.huchaMinor}
      onPress={() => router.push("/(auth)/(tabs)/home/savings")}
      projectsLabel={t(dictionary, "home.savings.projects")}
      huchaLabel={t(dictionary, "home.savings.hucha")}
      totalLabel={t(dictionary, "home.savings.total")}
    />
  );

  return (
    <View style={[styles.root, { backgroundColor: userThemeTokens.background }]}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
      >
        <View style={styles.summaryRow}>
          <TouchableOpacity
            style={styles.summaryBalance}
            activeOpacity={0.86}
            onPress={() => router.push("/(auth)/(tabs)/transactions")}
          >
            <BalanceHeader
              amountMinor={selectedMonthBalanceMinor}
              monthLabel={monthLabelCapitalized}
              currencySymbol={currencySymbol}
            />
          </TouchableOpacity>
          <View style={styles.summarySavings}>{savingsSection}</View>
        </View>

        <Calendar
          view={calendarView}
          onViewChange={setCalendarView}
          weekData={weekData}
          monthData={monthData}
          selectedDay={selectedDay}
          onSelectDay={setSelectedDayKey}
          onPrevPeriod={handlePrevPeriod}
          onNextPeriod={handleNextPeriod}
          currencySymbol={currencySymbol}
          upcomingMovements={contextUpcomingMovements}
          pastMovements={contextPastMovements}
          onViewAllMovements={() => router.push("/(auth)/(tabs)/transactions")}
          onCreateMovement={() => router.push("/(auth)/(tabs)/transactions/create")}
        />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  loading: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  container: {
    flex: 1,
    padding: tokens.spacing.lg,
    justifyContent: "center",
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: tokens.spacing.lg,
    paddingHorizontal: tokens.spacing.lg,
    paddingBottom: 120,
    gap: tokens.spacing.lg,
  },
  summaryRow: {
    flexDirection: "row",
    alignItems: "stretch",
    gap: tokens.spacing.md,
  },
  summaryBalance: {
    flex: 1.15,
    alignItems: "stretch",
  },
  summarySavings: {
    flex: 1.85,
  },
  errorCard: {
    borderRadius: tokens.radii.lg,
    borderWidth: 1,
    borderColor: colors.state.neutral,
    padding: tokens.spacing.lg,
    backgroundColor: colors.bg.surface,
  },
  errorTitle: {
    fontSize: tokens.typography.size.lg,
    fontWeight: tokens.typography.weight.semibold,
    color: colors.text.primary,
    fontFamily: "DMSans-SemiBold",
  },
  errorText: {
    marginTop: tokens.spacing.sm,
    fontSize: tokens.typography.size.sm,
    color: colors.text.secondary,
    fontFamily: "DMSans",
  },
  retryButton: {
    marginTop: tokens.spacing.md,
    alignSelf: "flex-start",
    borderRadius: tokens.radii.md,
    backgroundColor: colors.action.primary,
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: tokens.spacing.sm,
  },
  retryText: {
    color: colors.bg.primary,
    fontFamily: "DMSans-SemiBold",
    fontSize: tokens.typography.size.sm,
  },
});
