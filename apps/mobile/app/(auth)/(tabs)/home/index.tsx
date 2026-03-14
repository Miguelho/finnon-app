import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import {
  CATEGORY_PALETTE,
  CURRENCIES,
  type AvatarColorToken,
  buildCalendarDayData,
  buildProjectColorMap,
  computeSavingsMonthView,
  computeProjectProgress,
  getProjectColor,
  getProjectReserveTransferTotalsMap,
  getMonthCalendarDisplayDays,
  getReserveContainerBalanceMinor,
  getWeekCalendarDisplayDays,
  getWeekStartMonday,
  themeTokens,
  toDateKey,
  toMonthKey,
  type MonthClose,
  type MonthCloseAllocation,
  type MonthlyProjectFundingPlan,
  type Obligation,
  type Project,
  type ReserveContainer,
  type ReserveTransfer,
  type Transaction as SharedTransaction,
  type UserAvatarColorId,
  type UserRole,
} from "@poleursus/shared";
import { supabase } from "../../../../src/lib/supabase";
import { useAuth } from "../../../../src/contexts/AuthContext";
import { useUserTheme } from "../../../../src/contexts/UserThemeContext";
import { useCopy, t } from "../../../../src/lib/i18n";
import { UserAvatar } from "../../../../src/components/UserAvatar";
import { CategoryIcon } from "../../../../src/components/CategoryIcon";
import { BalanceRow } from "../../../../src/components/home-redesign/BalanceHeader";
import { Calendar } from "../../../../src/components/home-redesign/Calendar";
import { ProjectsRow } from "../../../../src/components/home-redesign/SavingsMonthCard";
import { formatCurrencyParts, formatFullDate, toMinor } from "../../../../src/components/home-redesign/utils";

const tokens = themeTokens.light;

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
  created_by?: string | null;
  category?: Category | null;
};

type HomeMovement = {
  id: string;
  name: string;
  categoryId: string | null;
  iconId: string | null;
  categoryName: string | null;
  createdByUserId?: string | null;
  type: "income" | "expense";
  amountMinor: bigint;
  isProgrammed?: boolean;
};

type HomeMovementGroup = {
  id: string;
  name: string;
  iconId: string | null;
  totalMinor: bigint;
  items: HomeMovement[];
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

type RpcSummary = {
  totals?: {
    balance_total?: string | number | bigint | null;
  } | null;
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
  "id, account_id, type, amount_minor, amount_base_minor, currency, category_id, date, merchant, notes, created_by, created_at, category:categories(id, name, icon_id, color)";
const TRANSACTIONS_SELECT_LEGACY =
  "id, account_id, type, amount_minor, amount_base_minor, currency, category_id, date, merchant, notes, created_by, created_at, category:categories(id, name, icon_id)";

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

const absMinor = (value: bigint) => (value < 0n ? -value : value);

const toSignedMinor = (amountMinor: bigint, type: "income" | "expense") => {
  const absoluteAmount = absMinor(amountMinor);
  return type === "income" ? absoluteAmount : -absoluteAmount;
};

export default function HomeScreen() {
  const router = useRouter();
  const { user, session, selectedAccountId, setSelectedAccountId } = useAuth();
  const { tokens: userTokens } = useUserTheme();
  const { dictionary, locale } = useCopy();
  const localeKey = locale === "en" ? "en" : "es";
  const programmedBadgeLabel = localeKey === "en" ? "Scheduled" : "Programado";
  const weekdayLabels = WEEKDAY_LABELS[localeKey];
  const monthsShort = MONTHS_SHORT[localeKey];
  const monthsLong = MONTHS_LONG[localeKey];
  const currentMonthKey = useMemo(() => toMonthKey(new Date()), []);
  const currentMonthStart = `${currentMonthKey}-01`;

  const [accounts, setAccounts] = useState<Account[] | null>(null);
  const [accountBalances, setAccountBalances] = useState<Record<string, bigint>>({});
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [profiles, setProfiles] = useState<ProfileRow[]>([]);
  const [obligations, setObligations] = useState<Obligation[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [reserveContainers, setReserveContainers] = useState<ReserveContainer[]>([]);
  const [fundingPlans, setFundingPlans] = useState<MonthlyProjectFundingPlan[]>([]);
  const [monthCloses, setMonthCloses] = useState<MonthClose[]>([]);
  const [monthCloseAllocations, setMonthCloseAllocations] = useState<MonthCloseAllocation[]>([]);
  const [reserveTransfers, setReserveTransfers] = useState<ReserveTransfer[]>([]);
  const [currentMonthTransactions, setCurrentMonthTransactions] = useState<SavingsTransaction[]>([]);
  const [loadingAccounts, setLoadingAccounts] = useState(true);
  const [loadingData, setLoadingData] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [calendarView, setCalendarView] = useState<"week" | "month">("week");
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
        if (!cancelled) setError(loadError?.message ?? t(dictionary, "mobile.home.errorLoadAccounts"));
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

    const loadBalances = async () => {
      if (!accounts || accounts.length === 0) return;

      const pairs = await Promise.all(
        accounts.map(async (account) => {
          try {
            const { data, error: rpcError } = await supabase.rpc("get_account_summary", {
              p_account_id: account.id,
            });

            if (rpcError) throw rpcError;
            const summary = data as RpcSummary | null;
            const balance = toMinor(summary?.totals?.balance_total ?? 0);
            return [account.id, balance] as const;
          } catch (rpcError) {
            console.warn("[Home] Could not load account balance:", account.id, rpcError);
            return [account.id, 0n] as const;
          }
        })
      );

      if (!cancelled) {
        setAccountBalances(
          pairs.reduce<Record<string, bigint>>((acc, [accountId, value]) => {
            acc[accountId] = value;
            return acc;
          }, {})
        );
      }
    };

    void loadBalances();

    return () => {
      cancelled = true;
    };
  }, [accounts, reloadSeed]);

  useEffect(() => {
    let cancelled = false;

    const loadMainData = async () => {
      if (!mainAccount) return;

      setLoadingData(true);
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

        const creatorUserIds = Array.from(
          new Set(
            ((txRows ?? []) as Array<{ created_by?: string | null }>)
              .map((tx) => tx.created_by)
              .filter((value): value is string => Boolean(value))
          )
        );
        const { data: profileRows, error: profilesError } =
          creatorUserIds.length > 0
            ? await supabase
                .from("profiles")
                .select(
                  "user_id, email, display_name, avatar_path, avatar_fallback_text, avatar_fallback_bg_token, avatar_color"
                )
                .in("user_id", creatorUserIds)
            : { data: [], error: null };
        if (profilesError) {
          console.warn("[Home] Could not load creator profiles:", profilesError);
        }

        if (!cancelled) {
          setTransactions(
            (((txRows ?? []) as unknown as Array<{ category?: unknown }>).map(normalizeCategory) as Transaction[]) ??
              []
          );
          setProfiles((profileRows ?? []) as ProfileRow[]);
          setObligations((obligationRows as Obligation[]) ?? []);
        }
      } catch (loadError: any) {
        console.error("[Home] Error loading transactions and obligations:", loadError);
        if (!cancelled) {
          setError(loadError?.message ?? t(dictionary, "mobile.home.errorLoadTransactions"));
        }
      } finally {
        if (!cancelled) setLoadingData(false);
      }
    };

    void loadMainData();

    return () => {
      cancelled = true;
    };
  }, [mainAccount?.id, monthReference, weekReference, dictionary, reloadSeed]);

  useEffect(() => {
    let cancelled = false;

    const loadSavingsData = async () => {
      if (!mainAccount) return;

      try {
        const todayDateKey = toDateKey(new Date());
        const [
          projectsResult,
          reserveContainersResult,
          fundingPlansResult,
          monthClosesResult,
          monthCloseAllocationsResult,
          reserveTransfersResult,
          currentMonthTransactionsResult,
        ] = await Promise.all([
          supabase
            .from("projects")
            .select("*")
            .eq("account_id", mainAccount.id)
            .not("target_amount_base_minor", "is", null)
            .in("status", ["active", "completed"])
            .order("priority", { ascending: true }),
          supabase
            .from("reserve_containers")
            .select("*")
            .eq("account_id", mainAccount.id)
            .eq("status", "active")
            .order("created_at", { ascending: true }),
          supabase
            .from("monthly_project_funding_plans")
            .select("*")
            .eq("account_id", mainAccount.id)
            .eq("period", currentMonthStart),
          supabase
            .from("month_closes")
            .select("*")
            .eq("account_id", mainAccount.id)
            .order("period", { ascending: false }),
          supabase
            .from("month_close_allocations")
            .select("*")
            .eq("account_id", mainAccount.id),
          supabase
            .from("reserve_transfers")
            .select("*")
            .eq("account_id", mainAccount.id)
            .order("created_at", { ascending: false }),
          supabase
            .from("transactions")
            .select("id, type, amount_minor, amount_base_minor, date")
            .eq("account_id", mainAccount.id)
            .gte("date", currentMonthStart)
            .lte("date", todayDateKey)
            .order("date", { ascending: true }),
        ]);

        if (projectsResult.error) throw projectsResult.error;
        if (reserveContainersResult.error) throw reserveContainersResult.error;
        if (fundingPlansResult.error) throw fundingPlansResult.error;
        if (monthClosesResult.error) throw monthClosesResult.error;
        if (monthCloseAllocationsResult.error) throw monthCloseAllocationsResult.error;
        if (reserveTransfersResult.error) throw reserveTransfersResult.error;
        if (currentMonthTransactionsResult.error) throw currentMonthTransactionsResult.error;

        if (!cancelled) {
          setProjects((projectsResult.data as Project[]) ?? []);
          setReserveContainers((reserveContainersResult.data as ReserveContainer[]) ?? []);
          setFundingPlans((fundingPlansResult.data as MonthlyProjectFundingPlan[]) ?? []);
          setMonthCloses((monthClosesResult.data as MonthClose[]) ?? []);
          setMonthCloseAllocations(
            (monthCloseAllocationsResult.data as MonthCloseAllocation[]) ?? []
          );
          setReserveTransfers((reserveTransfersResult.data as ReserveTransfer[]) ?? []);
          setCurrentMonthTransactions(
            (currentMonthTransactionsResult.data as SavingsTransaction[]) ?? []
          );
        }
      } catch (loadError) {
        console.warn("[Home] Could not load savings data:", loadError);
        if (!cancelled) {
          setProjects([]);
          setReserveContainers([]);
          setFundingPlans([]);
          setMonthCloses([]);
          setMonthCloseAllocations([]);
          setReserveTransfers([]);
          setCurrentMonthTransactions([]);
        }
      }
    };

    void loadSavingsData();

    return () => {
      cancelled = true;
    };
  }, [currentMonthStart, mainAccount?.id, reloadSeed]);

  const showLoading = !session || !user || loadingAccounts || loadingData;
  const showError = Boolean(error);
  const showAccountMissing = !accounts || accounts.length === 0 || !mainAccount;

  const baseCurrency = mainAccount?.base_currency ?? "EUR";
  const currencySymbol =
    CURRENCIES.find((currency) => currency.code === baseCurrency)?.symbol ?? baseCurrency;

  const today = new Date();
  const todayKey = toDateKey(today);
  const currentMonthClose = useMemo(
    () =>
      monthCloses.find((monthClose) => String(monthClose.period).slice(0, 7) === currentMonthKey) ??
      null,
    [currentMonthKey, monthCloses]
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
          category_name: programmedBadgeLabel,
          category_color: "#CB6E55",
        })),
    ];

    return buildCalendarDayData(entries);
  }, [transactions, obligations, programmedBadgeLabel]);

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
    return getWeekCalendarDisplayDays(
      calendarMap,
      weekReference,
      todayKey,
      weekdayLabels
    );
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

  const selectedDayMovementGroups = useMemo<HomeMovementGroup[]>(() => {
    const dayTx = transactions
      .filter((tx) => toDateKey(tx.date as string) === selectedDayKey)
      .map((tx) => ({
        id: tx.id,
        name: tx.merchant?.trim() || tx.category?.name || t(dictionary, "mobile.home.movementFallback"),
        categoryId: tx.category?.id ?? null,
        iconId: tx.category?.icon_id ?? null,
        categoryName: tx.category?.name ?? null,
        createdByUserId: tx.created_by ?? null,
        type: tx.type,
        amountMinor: absMinor(toMinor(tx.amount_base_minor ?? tx.amount_minor)),
      }));

    const dayObligations = obligations
      .filter((obligation) => obligation.status !== "paid")
      .filter((obligation) => toDateKey(obligation.due_date as string) === selectedDayKey)
      .map((obligation) => ({
        id: `obligation-${obligation.id}`,
        name: obligation.name,
        categoryId: "obligation",
        iconId: null,
        categoryName: programmedBadgeLabel,
        createdByUserId: null,
        type: "expense" as const,
        amountMinor: absMinor(toMinor(obligation.amount_base_minor ?? obligation.amount_minor)),
        isProgrammed: true,
      }));

    const grouped = new Map<string, HomeMovementGroup>();
    [...dayTx, ...dayObligations].forEach((movement) => {
      const groupKey = movement.categoryId ?? "uncategorized";
      const groupName =
        movement.categoryName ??
        (localeKey === "en" ? "Uncategorized" : "Sin categoría");
      const existing = grouped.get(groupKey);
      if (!existing) {
        grouped.set(groupKey, {
          id: groupKey,
          name: groupName,
          iconId: movement.iconId,
          totalMinor: toSignedMinor(movement.amountMinor, movement.type),
          items: [movement],
        });
        return;
      }
      existing.items.push(movement);
      existing.totalMinor += toSignedMinor(movement.amountMinor, movement.type);
      if (!existing.iconId && movement.iconId) {
        existing.iconId = movement.iconId;
      }
    });

    return Array.from(grouped.values());
  }, [transactions, obligations, selectedDayKey, programmedBadgeLabel, localeKey, dictionary]);

  const selectedDayLabel = useMemo(
    () => formatFullDate(selectedDayKey, locale),
    [selectedDayKey, locale]
  );
  const profileByUserId = useMemo(
    () => new Map(profiles.map((profile) => [profile.user_id, profile])),
    [profiles]
  );

  const fundedByProject = useMemo(() => {
    const byProject = new Map<string, bigint>();
    monthCloseAllocations.forEach((allocation) => {
      if (!allocation.project_id) return;
      byProject.set(
        allocation.project_id,
        (byProject.get(allocation.project_id) ?? 0n) + toMinor(allocation.amount_base_minor)
      );
    });
    const reserveTransferTotals = getProjectReserveTransferTotalsMap(reserveTransfers);
    reserveTransferTotals.forEach((amountMinor, projectId) => {
      byProject.set(projectId, (byProject.get(projectId) ?? 0n) + amountMinor);
    });
    return byProject;
  }, [monthCloseAllocations, reserveTransfers]);
  const plannedByProject = useMemo(() => {
    const byProject = new Map<string, bigint>();
    fundingPlans.forEach((plan) => {
      byProject.set(
        plan.project_id,
        (byProject.get(plan.project_id) ?? 0n) + toMinor(plan.planned_amount_base_minor)
      );
    });
    return byProject;
  }, [fundingPlans]);

  const activeProjects = useMemo(() => projects, [projects]);
  const projectColorMap = useMemo(() => buildProjectColorMap(projects), [projects]);

  const projectsRowData = useMemo(
    () =>
      activeProjects.map((project) => {
        const progress = computeProjectProgress({
          project,
          fundedMinor: fundedByProject.get(project.id) ?? 0n,
          plannedThisMonthMinor: plannedByProject.get(project.id) ?? 0n,
        });

        return {
          id: project.id,
          name: project.name,
          emoji: project.emoji || "🎯",
          currentAmountMinor: progress.savedMinor,
          goalAmountMinor: progress.targetMinor > 0n ? progress.targetMinor : 1n,
          color: getProjectColor(project, projectColorMap),
        };
      }),
    [activeProjects, fundedByProject, plannedByProject, projectColorMap]
  );

  const huchaReserve = useMemo(
    () => reserveContainers.find((reserveContainer) => reserveContainer.kind === "hucha") ?? null,
    [reserveContainers]
  );

  const huchaAmountMinor = useMemo(() => {
    return getReserveContainerBalanceMinor({
      reserveContainerId: huchaReserve?.id,
      closeAllocations: monthCloseAllocations,
      reserveTransfers,
    });
  }, [huchaReserve?.id, monthCloseAllocations, reserveTransfers]);

  const accountItems = useMemo(
    () =>
      (accounts ?? []).map((account, index) => ({
        id: account.id,
        name: account.name,
        balanceMinor: accountBalances[account.id] ?? 0n,
        color: CATEGORY_PALETTE[index % CATEGORY_PALETTE.length]!,
      })),
    [accounts, accountBalances]
  );

  const selectedBalanceMinor =
    mainAccount ? accountBalances[mainAccount.id] ?? 0n : 0n;

  const handlePrevPeriod = () => {
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
  };

  const handleNextPeriod = () => {
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
  };

  if (showError) {
    return (
      <View style={[styles.loading, { backgroundColor: userTokens.background }]}>
        <Text style={[styles.errorTitle, { color: userTokens.textPrimary }]}>
          {t(dictionary, "common.errorTitle")}
        </Text>
        <Text style={[styles.errorText, { color: userTokens.textSecondary }]}>{error}</Text>
        <Pressable
          style={[styles.retryButton, { backgroundColor: userTokens.surfaceAlt, borderColor: userTokens.border }]}
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
        <BalanceRow
          totalBalanceMinor={selectedBalanceMinor}
          currencySymbol={currencySymbol}
          accounts={accountItems}
          onPress={() => router.push("/(auth)/(tabs)/account")}
        />

        <ProjectsRow
          projects={projectsRowData}
          huchaAmountMinor={huchaAmountMinor}
          totalSavingsMinor={savingsState.generatedSavedMinor}
          plannedMinor={savingsState.plannedToProjectsMinor}
          availableMinor={savingsState.availableToPlanMinor}
          needsRebalance={savingsState.needsRebalance}
          currentMonth={monthPeriodLabel}
          currencySymbol={currencySymbol}
          locale={localeKey}
          onPress={() => router.push("/(auth)/(tabs)/projects/savings")}
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

        <View
          style={[
            styles.dayCard,
            { backgroundColor: userTokens.surface, borderColor: userTokens.border },
          ]}
        >
          <View style={styles.dayCardHeader}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.dayTitle, { color: userTokens.textPrimary }]}>
                {t(dictionary, "mobile.home.calendarTitle")}
              </Text>
              <Text style={[styles.daySubtitle, { color: userTokens.textSecondary }]}>
                {selectedDayLabel}
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => router.push(`/(auth)/transactions/create?date=${selectedDayKey}`)}
              style={styles.addPill}
            >
              <Text style={[styles.addPillText, { color: userTokens.textSecondary }]}>
                {t(dictionary, "home.calendar.addCta")}
              </Text>
            </TouchableOpacity>
          </View>

          {selectedDayMovementGroups.length === 0 ? (
            <Text style={[styles.emptyDay, { color: userTokens.textTertiary }]}>
              {t(dictionary, "mobile.home.calendarEmptyDay")}
            </Text>
          ) : (
            <View style={styles.dayRows}>
              {selectedDayMovementGroups.map((group) => {
                const isGroupIncome = group.totalMinor > 0n;
                const isGroupExpense = group.totalMinor < 0n;
                const groupParts = formatCurrencyParts(absMinor(group.totalMinor), currencySymbol);
                return (
                  <View key={group.id} style={[styles.dayGroup, { borderBottomColor: userTokens.border }]}>
                    <View style={styles.dayRow}>
                      <View style={styles.dayLeading}>
                        <View style={[styles.iconWrap, { backgroundColor: userTokens.surfaceAlt }]}>
                          <CategoryIcon iconKey={group.iconId ?? "Tag"} size={16} tone="muted" />
                        </View>
                        <Text style={[styles.dayGroupName, { color: userTokens.textPrimary }]} numberOfLines={1}>
                          {group.name}
                        </Text>
                      </View>
                      <Text
                        style={[
                          styles.dayAmount,
                          {
                            color: isGroupIncome
                              ? "#6DC9A0"
                              : isGroupExpense
                                ? "#E0956A"
                                : userTokens.textSecondary,
                          },
                        ]}
                      >
                        {isGroupIncome ? "+" : isGroupExpense ? "−" : ""}
                        {groupParts.full}
                      </Text>
                    </View>

                    <View style={styles.dayChildren}>
                      {group.items.map((movement) => {
                        const parts = formatCurrencyParts(movement.amountMinor, currencySymbol);
                        const authorProfile = movement.createdByUserId
                          ? profileByUserId.get(movement.createdByUserId) ?? null
                          : null;
                        const authorName =
                          authorProfile?.display_name?.trim() ||
                          authorProfile?.avatar_fallback_text?.trim() ||
                          authorProfile?.email?.trim() ||
                          (movement.isProgrammed
                            ? programmedBadgeLabel
                            : localeKey === "en"
                              ? "Unknown"
                              : "Desconocido");
                        return (
                          <View key={movement.id} style={styles.dayChildRow}>
                            <View style={styles.dayChildLeading}>
                              <Text
                                style={[styles.dayRowName, { color: userTokens.textPrimary }]}
                                numberOfLines={1}
                              >
                                {movement.name}
                              </Text>
                              <View style={styles.dayAuthorRow}>
                                {authorProfile ? (
                                  <UserAvatar
                                    userId={authorProfile.user_id}
                                    email={authorProfile.email ?? null}
                                    displayName={authorProfile.display_name ?? null}
                                    avatarPath={authorProfile.avatar_path ?? null}
                                    fallbackText={authorProfile.avatar_fallback_text ?? null}
                                    fallbackBgToken={authorProfile.avatar_fallback_bg_token ?? null}
                                    avatarColor={authorProfile.avatar_color ?? null}
                                    size={16}
                                  />
                                ) : null}
                                <Text style={[styles.dayAuthorName, { color: userTokens.textSecondary }]} numberOfLines={1}>
                                  {authorName}
                                </Text>
                              </View>
                            </View>
                            <Text
                              style={[
                                styles.dayChildAmount,
                                { color: movement.type === "income" ? "#6DC9A0" : "#E0956A" },
                              ]}
                            >
                              {movement.type === "income" ? "+" : "−"}
                              {parts.full}
                            </Text>
                          </View>
                        );
                      })}
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
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
  dayCard: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
  },
  dayCardHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 8,
  },
  addPill: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  addPillText: {
    fontSize: 11,
    fontFamily: "DMSans-SemiBold",
  },
  dayTitle: {
    fontSize: 13,
    fontFamily: "DMSans-SemiBold",
  },
  daySubtitle: {
    marginTop: 2,
    fontSize: 11,
    fontFamily: "DMSans",
  },
  emptyDay: {
    marginTop: 10,
    fontSize: 12,
    fontFamily: "DMSans",
  },
  dayRows: {
    marginTop: 8,
  },
  dayGroup: {
    paddingVertical: 8,
    borderBottomWidth: 1,
    gap: 6,
  },
  dayRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  dayLeading: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
    minWidth: 0,
  },
  iconWrap: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  dayGroupName: {
    flex: 1,
    minWidth: 0,
    fontSize: 13,
    fontFamily: "DMSans-Medium",
  },
  dayChildren: {
    marginLeft: 38,
    gap: 6,
  },
  dayChildRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  dayChildLeading: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  dayRowName: {
    fontSize: 12,
    fontFamily: "DMSans-Medium",
  },
  dayAuthorRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  dayAuthorName: {
    flex: 1,
    minWidth: 0,
    fontSize: 10,
    fontFamily: "DMSans",
  },
  dayAmount: {
    fontSize: 12,
    fontFamily: "DMSans-SemiBold",
  },
  dayChildAmount: {
    fontSize: 11,
    fontFamily: "DMSans-SemiBold",
  },
});
