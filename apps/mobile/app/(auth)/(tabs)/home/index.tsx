import { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  TouchableOpacity,
  Alert,
} from "react-native";
import { useIsFocused } from "@react-navigation/native";
import { useRouter } from "expo-router";
import {
  CURRENCIES,
  computeGoalProgress,
  computeProjectProgress,
  getExpandedMonthRange,
  getGoalTotalsFromTransactions,
  getProjectWidgetState,
  getWeekStrip,
  themeTokens,
  toMonthKey,
  type Obligation,
  type Project,
  type ProjectContribution,
  type UserRole,
  type Transaction as SharedTransaction,
} from "@poleursus/shared";
import { supabase } from "../../../../src/lib/supabase";
import { useAuth } from "../../../../src/contexts/AuthContext";
import { useUserTheme } from "../../../../src/contexts/UserThemeContext";
import { useCopy, t } from "../../../../src/lib/i18n";
import { BalanceHeader } from "../../../../src/components/home-redesign/BalanceHeader";
import {
  Calendar,
  type DayDetailData,
  type DayMovement,
  type NextProgrammedItem,
} from "../../../../src/components/home-redesign/Calendar";
import { ProjectObjectiveWidget } from "../../../../src/components/home-redesign/ProjectObjectiveWidget";
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
  category?: Category | null;
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
  const [obligations, setObligations] = useState<Obligation[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectContributions, setProjectContributions] = useState<ProjectContribution[]>([]);
  const [goalHistory, setGoalHistory] = useState<Array<{ completed: boolean | null }>>([]);
  const [goalTargetMinor, setGoalTargetMinor] = useState<string | null>(null);
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

  const activeRole = useMemo<UserRole>(() => {
    if (!mainAccount || !user) return "viewer";
    return (
      mainAccount.account_members?.find((member) => member.user_id === user.id)?.role ??
      "viewer"
    );
  }, [mainAccount, user]);

  const canEdit = activeRole !== "viewer";

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

        if (!cancelled) {
          const normalizedMonthly = (monthData ?? []).map(normalizeCategory);
          const normalizedUpcoming = (upcomingData ?? []).map(normalizeCategory);
          setMonthlyTransactions(normalizedMonthly as unknown as Transaction[]);
          setUpcomingTransactions(normalizedUpcoming as unknown as Transaction[]);
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

    async function loadGoal() {
      if (!mainAccount || !isFocused) return;

      try {
        const monthKey = toMonthKey(new Date());
        const { data: goalRow, error: goalError } = await supabase
          .from("financial_goals")
          .select("id, month, type, target_amount_base_minor")
          .eq("account_id", mainAccount.id)
          .eq("month", monthKey)
          .eq("type", "save")
          .maybeSingle();

        if (goalError) throw goalError;

        const { data: historyData, error: historyError } = await supabase.rpc(
          "get_goal_history",
          {
            p_account_id: mainAccount.id,
            p_limit: 5,
          }
        );

        if (historyError) throw historyError;

        if (!cancelled) {
          setGoalTargetMinor(goalRow?.target_amount_base_minor ?? null);
          setGoalHistory((historyData as Array<{ completed: boolean | null }>) ?? []);
        }
      } catch {
        if (!cancelled) {
          setGoalTargetMinor(null);
          setGoalHistory([]);
        }
      }
    }

    loadGoal();
    return () => {
      cancelled = true;
    };
  }, [mainAccount?.id, isFocused]);

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
        const projectIds = projectList.map((project) => project.id);

        const { data: contributionsData, error: contributionsError } =
          projectIds.length > 0
            ? await supabase
                .from("project_contributions")
                .select("id, project_id, actual_amount_base_minor, confirmed")
                .in("project_id", projectIds)
            : { data: [], error: null };

        if (!cancelled) {
          setProjects(projectList);
          setProjectContributions(
            contributionsError ? [] : ((contributionsData ?? []) as ProjectContribution[])
          );
        }
      } catch (loadError) {
        console.warn("[Home] Could not load projects for home widget:", loadError);
        if (!cancelled) {
          setProjects([]);
          setProjectContributions([]);
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

  const progress =
    goalTargetMinor && mainAccount && user
      ? computeGoalProgress({
          goal: {
            id: "local",
            account_id: mainAccount.id,
            month: toMonthKey(today),
            type: "save",
            target_amount_base_minor: goalTargetMinor,
            created_by: user.id,
          },
          totals: goalTotals,
          now: today,
        })
      : null;

  const objective = progress
    ? (() => {
        const targetMinor = progress.targetMinor;
        const currentMinor = progress.savedMinor;
        const progressPercent =
          targetMinor > 0n
            ? Math.min(
                100,
                Math.max(
                  0,
                  (Number(currentMinor) / Number(targetMinor)) * 100
                )
              )
            : 0;
        const expectedPercent =
          targetMinor > 0n
            ? Math.min(
                100,
                Math.max(
                  0,
                  (Number(progress.expectedSavedMinor) / Number(targetMinor)) *
                    100
                )
              )
            : 0;

        let status: "on-track" | "at-risk" | "off-track" = "at-risk";
        if (currentMinor >= targetMinor) {
          status = "on-track";
        } else if (progress.forecastEndMinor < targetMinor) {
          status = "off-track";
        } else if (currentMinor >= progress.expectedSavedMinor) {
          status = "on-track";
        }

        const statusLabel =
          status === "on-track"
            ? t(dictionary, "mobile.home.objectiveStatusOnTrack")
            : status === "off-track"
            ? t(dictionary, "mobile.home.objectiveStatusOffTrack")
            : t(dictionary, "mobile.home.objectiveStatusAtRisk");

        const targetFormatted = formatCurrencyParts(targetMinor, currencySymbol).full;
        const forecastFormatted = formatCurrencyParts(
          progress.forecastEndMinor,
          currencySymbol
        ).full;
        const remainingFormatted = formatCurrencyParts(
          progress.remainingMinor,
          currencySymbol
        ).full;

        let message = t(dictionary, "mobile.home.objectiveForecastMessage", {
          month: monthLabel,
          amount: forecastFormatted,
        });
        if (progress.forecastEndMinor < targetMinor) {
          message += ` ${t(dictionary, "mobile.home.objectiveRemainingMessage", {
            amount: remainingFormatted,
          })}`;
        } else if (currentMinor < progress.expectedSavedMinor) {
          message += ` ${t(dictionary, "mobile.home.objectiveCatchUpMessage")}`;
        } else {
          message += ` ${t(dictionary, "mobile.home.objectiveKeepItUpMessage")}`;
        }

        return {
          status,
          statusLabel,
          description: t(dictionary, "mobile.home.objectiveDescription", {
            amount: targetFormatted,
            month: monthLabel,
          }),
          currentMinor: currentMinor.toString(),
          targetMinor: targetMinor.toString(),
          progressPercent,
          expectedPercent,
          messageHtml: message,
          streak: (goalHistory ?? []).map((entry) => ({
            hit: entry.completed === true,
          })),
        };
      })()
    : null;

  const contributionsByProject = useMemo(() => {
    const map = new Map<string, ProjectContribution[]>();
    projectContributions.forEach((contribution) => {
      const list = map.get(contribution.project_id) ?? [];
      list.push(contribution);
      map.set(contribution.project_id, list);
    });
    return map;
  }, [projectContributions]);

  const projectWidgetState = useMemo(() => getProjectWidgetState(projects), [projects]);

  const activeProject = useMemo(() => {
    if (projectWidgetState.state !== "active") return null;

    const project = projectWidgetState.project;
    const projectProgress = computeProjectProgress({
      project,
      contributions: contributionsByProject.get(project.id) ?? [],
    });

    let monthlyImpactPercent = 0;
    if (objective && projectProgress.targetMinor > 0n) {
      const ratio =
        Number(toMinor(objective.currentMinor)) / Number(projectProgress.targetMinor);
      if (Number.isFinite(ratio) && ratio > 0) {
        monthlyImpactPercent = Math.max(0, Math.round(ratio * 100));
      }
    }

    return {
      project,
      progress: projectProgress,
      monthlyImpactPercent,
    };
  }, [projectWidgetState, contributionsByProject, objective]);

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

    const addDot = (dateKey: string, type: "income" | "expense") => {
      const existing = dotsMap.get(dateKey) ?? [];
      existing.push({ type });
      dotsMap.set(dateKey, existing);
    };

    allTransactions.forEach((tx) => {
      const key = toDateKey(tx.date as string);
      if (!key) return;
      addDot(key, tx.type === "income" ? "income" : "expense");
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

    return {
      days,
      period: monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1),
    };
  }, [allTransactions, obligations, monthReference, todayKey, monthsLong]);

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
        badge: null,
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
        badge: t(dictionary, "mobile.home.programmedBadge"),
      });
    });

    return {
      dateKey: selectedDayKey,
      formattedLabel: formatFullDate(selectedDayKey, locale),
      movements,
    };
  }, [selectedDayKey, allTransactions, obligations, locale, dictionary]);

  const scheduledItems = useMemo(() => {
    const items: Array<NextProgrammedItem & { dateKey: string }> = [];

    upcomingTransactions.forEach((tx) => {
      const dateKey = toDateKey(tx.date as string);
      if (!dateKey) return;
      items.push({
        id: tx.id,
        name:
          tx.merchant ??
          tx.category?.name ??
          t(dictionary, "mobile.home.movementFallback"),
        amountMinor: toMinor(tx.amount_base_minor ?? tx.amount_minor),
        dateKey,
        type: tx.type,
        dateLabel: formatShortDate(dateKey, locale),
        category: tx.category?.name ?? null,
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
        dateKey,
        type: "expense",
        dateLabel: formatShortDate(dateKey, locale),
        category: t(dictionary, "mobile.home.programmedBadge"),
      });
    });

    return items.sort((a, b) => (a.dateKey > b.dateKey ? 1 : -1));
  }, [upcomingTransactions, obligations, locale, dictionary]);

  const nextProgrammed = useMemo(() => {
    const key = selectedDayKey || todayKey;
    return scheduledItems.find((item) => item.dateKey > key) ?? null;
  }, [scheduledItems, selectedDayKey, todayKey]);

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

  const handleCreateObjective = () => {
    router.push("/(auth)/(tabs)/goal");
  };

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

  return (
    <View style={[styles.root, { backgroundColor: userThemeTokens.background }]}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
      >
        <BalanceHeader
          amountMinor={monthlyBalanceMinor}
          monthLabel={monthLabelCapitalized}
          currencySymbol={currencySymbol}
        />

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
          nextProgrammed={nextProgrammed}
          onViewAllProgrammed={() =>
            router.push("/(auth)/(tabs)/transactions?filter=programmed")
          }
        />

        <ProjectObjectiveWidget
          widgetState={projectWidgetState}
          activeProject={activeProject}
          objective={objective}
          onViewProject={(projectId) => router.push(`/(auth)/(tabs)/projects/${projectId}`)}
          onCreateProject={() => {
            if (!canEdit) {
              Alert.alert(
                t(dictionary, "common.errorTitle"),
                t(dictionary, "home.guestBlurb")
              );
              return;
            }
            router.push("/(auth)/(tabs)/projects");
          }}
          onCreateGoal={handleCreateObjective}
          currencySymbol={currencySymbol}
          locale={locale}
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
