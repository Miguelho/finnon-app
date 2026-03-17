import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Stack, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  computeSavingsMonthFromTransactions,
  computeProjectProgress,
  computeSavingsMonthView,
  CURRENCIES,
  formatMinorToMoney,
  formatMoneyWithSymbol,
  formatMonthLabel,
  getProjectColor,
  getProjectMonthlyFundingTargetMinor,
  getProjectReserveTransferTotalsMap,
  getMonthRangeFromKey,
  parseMoneyToMinor,
  semanticColorTokens,
  themeTokens,
  toMonthKey,
  withAlpha,
  type MonthClose,
  type MonthCloseAllocation,
  type MonthlyProjectFundingPlan,
  type Project,
  type RecurringItem,
  type ReserveContainer,
  type ReserveTransfer,
  type UserRole,
} from "@poleursus/shared";
import { useAuth } from "../../../../src/contexts/AuthContext";
import { useUserTheme } from "../../../../src/contexts/UserThemeContext";
import { useCopy, t } from "../../../../src/lib/i18n";
import { supabase } from "../../../../src/lib/supabase";
import { Button } from "../../../../src/components/Button";
import { Card } from "../../../../src/components/Card";
import { HuchaLiquidCanvas } from "../../../../src/components/HuchaLiquidCanvas";
import { Input } from "../../../../src/components/Input";
import { ProjectProgressRing } from "../../../../src/components/projects/ProjectProgressRing";
import { SavingsBucketHero } from "../../../../src/components/SavingsBucketHero";

const tokens = themeTokens.light;
const SAVINGS_VALUE_COLOR = semanticColorTokens.savings.primary;

type AccountRow = {
  id: string;
  base_currency: string;
  account_members?: Array<{ role: UserRole; user_id: string }>;
};

type TransactionRow = {
  id: string;
  type: "income" | "expense";
  amount_minor: string | number | null;
  amount_base_minor: string | number | null;
  date: string;
};

type SavingsMonthStateRow = {
  period: string;
  generated_saved_base_minor: string | number;
  planned_to_projects_base_minor: string | number;
  available_to_plan_minor: string | number;
  needs_rebalance: boolean;
  is_closed: boolean;
  closed_at: string | null;
  allocated_to_projects_base_minor: string | number | null;
  allocated_to_reserves_base_minor: string | number | null;
  plans: Array<{
    project_id: string;
    planned_amount_base_minor: string | number;
  }>;
};

type ProfileRow = {
  user_id: string;
  email: string | null;
  display_name: string | null;
};

const toMinor = (value: bigint | number | string | null | undefined): bigint => {
  if (value === null || value === undefined) return 0n;
  if (typeof value === "bigint") return value;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return 0n;
    return BigInt(Math.round(value));
  }
  try {
    return BigInt(value);
  } catch {
    return 0n;
  }
};

const sanitizeNumericInput = (value: string) => value.replace(/[^0-9.,]/g, "");

const formatClosedAt = (value: string | Date | null | undefined, locale: "es" | "en") => {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  return new Intl.DateTimeFormat(locale === "en" ? "en-US" : "es-ES", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(date);
};

const HUCHA_ACCENT_COLOR = "#48D89F";
const SUPPORT_ACCENT_COLOR = "#4FD1C5";

const roundedDivision = (numerator: bigint, denominator: bigint) => {
  if (denominator <= 0n) return 0n;
  return (numerator + denominator / 2n) / denominator;
};

const estimateRecurringMonthlyMinor = (item: RecurringItem) => {
  const amountMinor = toMinor(item.amount_minor);
  const interval = BigInt(Math.max(1, item.interval || 1));

  if (item.frequency === "weekly") {
    return roundedDivision(amountMinor * 52n, 12n * interval);
  }

  if (item.frequency === "yearly") {
    return roundedDivision(amountMinor, 12n * interval);
  }

  return roundedDivision(amountMinor, interval);
};

export default function SavingsDetailScreen() {
  const router = useRouter();
  const { user, selectedAccountId } = useAuth();
  const { dictionary, locale } = useCopy();
  const { tokens: userTokens, primaryActionColor } = useUserTheme();
  const insets = useSafeAreaInsets();
  const localeCode: "es" | "en" = locale === "en" ? "en" : "es";
  const currentMonthKey = useMemo(() => toMonthKey(new Date()), []);
  const currentMonthStart = `${currentMonthKey}-01`;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isSavingPlan, setIsSavingPlan] = useState(false);
  const [role, setRole] = useState<UserRole>("viewer");
  const [baseCurrency, setBaseCurrency] = useState("EUR");
  const [currencySymbol, setCurrencySymbol] = useState("€");
  const [projects, setProjects] = useState<Project[]>([]);
  const [reserveContainers, setReserveContainers] = useState<ReserveContainer[]>([]);
  const [monthCloses, setMonthCloses] = useState<MonthClose[]>([]);
  const [monthCloseAllocations, setMonthCloseAllocations] = useState<MonthCloseAllocation[]>([]);
  const [reserveTransfers, setReserveTransfers] = useState<ReserveTransfer[]>([]);
  const [recurringItems, setRecurringItems] = useState<RecurringItem[]>([]);
  const [transactions, setTransactions] = useState<TransactionRow[]>([]);
  const [monthState, setMonthState] = useState<SavingsMonthStateRow | null>(null);
  const [profilesByUserId, setProfilesByUserId] = useState<Record<string, ProfileRow>>({});
  const [inputsByProject, setInputsByProject] = useState<Record<string, string>>({});
  const [selectedOverviewProjectId, setSelectedOverviewProjectId] = useState<string | null>(null);

  const loadMonthState = useCallback(async () => {
    if (!selectedAccountId) return null;
    const { data, error: rpcError } = await supabase.rpc("get_savings_month_state", {
      p_account_id: selectedAccountId,
      p_period: currentMonthStart,
    });
    if (rpcError) throw rpcError;
    return (data ?? null) as SavingsMonthStateRow | null;
  }, [currentMonthStart, selectedAccountId]);

  const loadData = useCallback(async () => {
    if (!user || !selectedAccountId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const monthRange = getMonthRangeFromKey(currentMonthKey);

      const [
        accountResult,
        projectsResult,
        reserveContainersResult,
        monthClosesResult,
        monthCloseAllocationsResult,
        reserveTransfersResult,
        recurringItemsResult,
        transactionsResult,
        monthStateResult,
      ] = await Promise.all([
        supabase
          .from("accounts")
          .select("id, base_currency, account_members!inner(role, user_id)")
          .eq("id", selectedAccountId)
          .eq("account_members.user_id", user.id)
          .maybeSingle(),
        supabase
          .from("projects")
          .select("*")
          .eq("account_id", selectedAccountId)
          .not("target_amount_base_minor", "is", null)
          .eq("status", "active")
          .order("priority", { ascending: true })
          .order("created_at", { ascending: true }),
        supabase
          .from("reserve_containers")
          .select("*")
          .eq("account_id", selectedAccountId)
          .eq("status", "active")
          .order("created_at", { ascending: true }),
        supabase
          .from("month_closes")
          .select("*")
          .eq("account_id", selectedAccountId)
          .order("period", { ascending: false }),
        supabase
          .from("month_close_allocations")
          .select("*")
          .eq("account_id", selectedAccountId),
        supabase
          .from("reserve_transfers")
          .select("*")
          .eq("account_id", selectedAccountId)
          .order("created_at", { ascending: false }),
        supabase
          .from("recurring_items")
          .select("*")
          .eq("account_id", selectedAccountId)
          .order("merchant", { ascending: true }),
        supabase
          .from("transactions")
          .select("id, type, amount_minor, amount_base_minor, date")
          .eq("account_id", selectedAccountId)
          .gte("date", monthRange.start)
          .lte("date", monthRange.end)
          .order("date", { ascending: true }),
        loadMonthState(),
      ]);

      if (accountResult.error || !accountResult.data) {
        throw accountResult.error ?? new Error("account-not-found");
      }
      if (projectsResult.error) throw projectsResult.error;
      if (reserveContainersResult.error) throw reserveContainersResult.error;
      if (monthClosesResult.error) throw monthClosesResult.error;
      if (monthCloseAllocationsResult.error) throw monthCloseAllocationsResult.error;
      if (reserveTransfersResult.error) throw reserveTransfersResult.error;
      if (recurringItemsResult.error) throw recurringItemsResult.error;
      if (transactionsResult.error) throw transactionsResult.error;

      const closedByIds = Array.from(
        new Set(
          ((monthClosesResult.data ?? []) as MonthClose[])
            .map((monthClose) => monthClose.closed_by)
            .filter((value): value is string => typeof value === "string" && value.length > 0)
        )
      );

      const profilesResult =
        closedByIds.length > 0
          ? await supabase
              .from("profiles")
              .select("user_id, email, display_name")
              .in("user_id", closedByIds)
          : { data: [] as ProfileRow[], error: null };
      const profiles = profilesResult.error ? [] : ((profilesResult.data ?? []) as ProfileRow[]);

      const account = accountResult.data as AccountRow;
      const accountCurrency = account.base_currency;
      const symbol =
        CURRENCIES.find((item) => item.code === accountCurrency)?.symbol ??
        accountCurrency;

      const nextProjects = (projectsResult.data ?? []) as Project[];
      const nextMonthState = monthStateResult;

      setRole(account.account_members?.[0]?.role ?? "viewer");
      setBaseCurrency(accountCurrency);
      setCurrencySymbol(symbol);
      setProjects(nextProjects);
      setReserveContainers((reserveContainersResult.data ?? []) as ReserveContainer[]);
      setMonthCloses((monthClosesResult.data ?? []) as MonthClose[]);
      setMonthCloseAllocations(
        (monthCloseAllocationsResult.data ?? []) as MonthCloseAllocation[]
      );
      setReserveTransfers((reserveTransfersResult.data ?? []) as ReserveTransfer[]);
      setRecurringItems((recurringItemsResult.data ?? []) as RecurringItem[]);
      setTransactions((transactionsResult.data ?? []) as TransactionRow[]);
      setMonthState(nextMonthState);
      setProfilesByUserId(
        Object.fromEntries(
          profiles.map((profile) => [profile.user_id, profile])
        )
      );
      setInputsByProject(() => {
        const next: Record<string, string> = {};
        nextProjects.forEach((project) => {
          const plan = nextMonthState?.plans.find((row) => row.project_id === project.id);
          next[project.id] = formatMinorToMoney(
            toMinor(plan?.planned_amount_base_minor ?? 0),
            accountCurrency
          );
        });
        return next;
      });
    } catch (loadError) {
      console.error("[Savings][mobile] load error", loadError);
      setError(t(dictionary, "home.savings.loadError"));
    } finally {
      setLoading(false);
    }
  }, [currentMonthKey, currentMonthStart, dictionary, loadMonthState, selectedAccountId, user]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const canEdit = role !== "viewer";
  const huchaReserve = useMemo(
    () => reserveContainers.find((reserveContainer) => reserveContainer.kind === "hucha") ?? null,
    [reserveContainers]
  );

  const savingsView = useMemo(
    () =>
      computeSavingsMonthView({
        period: currentMonthKey,
        transactions,
        fundingPlans:
          (monthState?.plans ?? []).map((plan) => ({
            id: `${currentMonthKey}:${plan.project_id}`,
            account_id: selectedAccountId ?? "",
            period: currentMonthStart,
            project_id: plan.project_id,
            planned_amount_base_minor: plan.planned_amount_base_minor,
          })) as MonthlyProjectFundingPlan[],
        monthClose:
          monthCloses.find((monthClose) => String(monthClose.period).slice(0, 7) === currentMonthKey) ??
          null,
      }),
    [currentMonthKey, currentMonthStart, monthCloses, monthState?.plans, selectedAccountId, transactions]
  );

  const monthlyTotals = useMemo(
    () => computeSavingsMonthFromTransactions(transactions),
    [transactions]
  );

  const positiveSavingsMinor = savingsView.generatedSavedMinor > 0n ? savingsView.generatedSavedMinor : 0n;

  const fundedByProject = useMemo(() => {
    const map = new Map<string, bigint>();
    monthCloseAllocations.forEach((allocation) => {
      if (!allocation.project_id) return;
      map.set(
        allocation.project_id,
        (map.get(allocation.project_id) ?? 0n) + toMinor(allocation.amount_base_minor)
      );
    });
    const reserveTransferTotals = getProjectReserveTransferTotalsMap(reserveTransfers);
    reserveTransferTotals.forEach((amountMinor, projectId) => {
      map.set(projectId, (map.get(projectId) ?? 0n) + amountMinor);
    });
    return map;
  }, [monthCloseAllocations, reserveTransfers]);

  const displayedMonthCloseKey = currentMonthKey;
  const displayedMonthClose = useMemo(
    () =>
      monthCloses.find(
        (monthClose) => String(monthClose.period).slice(0, 7) === displayedMonthCloseKey
      ) ?? null,
    [displayedMonthCloseKey, monthCloses]
  );
  const displayedMonthCloseLabel = formatMonthLabel(displayedMonthCloseKey, localeCode);
  const displayedMonthCloseDate = formatClosedAt(displayedMonthClose?.closed_at, localeCode);
  const displayedMonthCloseAuthor =
    (displayedMonthClose?.closed_by
      ? profilesByUserId[displayedMonthClose.closed_by]?.display_name?.trim() ||
        profilesByUserId[displayedMonthClose.closed_by]?.email?.trim() ||
        null
      : null) ?? (localeCode === "en" ? "A team member" : "un miembro del equipo");
  const monthCloseActionMonthKey = displayedMonthClose ? null : currentMonthKey;

  const parsedPlans = useMemo(() => {
    const rows = projects.map((project) => {
      const raw = (inputsByProject[project.id] ?? "").trim();
      if (!raw) {
        return { projectId: project.id, amountMinor: 0n, error: null as string | null };
      }

      const parsed = parseMoneyToMinor(raw, baseCurrency);
      if (typeof parsed === "object" && "error" in parsed) {
        return {
          projectId: project.id,
          amountMinor: 0n,
          error: localeCode === "en" ? "Review this amount." : "Revisa este importe.",
        };
      }

      return { projectId: project.id, amountMinor: parsed, error: null as string | null };
    });

    return {
      rows,
      totalMinor: rows.reduce((total, row) => total + row.amountMinor, 0n),
      hasErrors: rows.some((row) => row.error !== null),
    };
  }, [baseCurrency, inputsByProject, localeCode, projects]);

  const monthlyHuchaMinor = useMemo(() => {
    const remainder = positiveSavingsMinor - parsedPlans.totalMinor;
    return remainder > 0n ? remainder : 0n;
  }, [parsedPlans.totalMinor, positiveSavingsMinor]);

  const savingsOverviewProjects = useMemo(() => {
    const rows = projects.map((project) => {
      const plannedMinor =
        parsedPlans.rows.find((row) => row.projectId === project.id)?.amountMinor ?? 0n;
      const displayMinor =
        plannedMinor > 0n ? plannedMinor : getProjectMonthlyFundingTargetMinor(project);
      const progress = computeProjectProgress({
        project,
        fundedMinor: fundedByProject.get(project.id) ?? 0n,
        plannedThisMonthMinor: plannedMinor,
      });

      return {
        project,
        progress,
        displayMinor,
      };
    });

    const prioritized = rows.filter((row) => row.displayMinor > 0n);
    return prioritized.length > 0 ? prioritized : rows;
  }, [fundedByProject, parsedPlans.rows, projects]);

  useEffect(() => {
    if (savingsOverviewProjects.length === 0) {
      setSelectedOverviewProjectId(null);
      return;
    }

    setSelectedOverviewProjectId((current) =>
      current && savingsOverviewProjects.some(({ project }) => project.id === current)
        ? current
        : null
    );
  }, [savingsOverviewProjects]);

  const selectedOverviewProject = useMemo(
    () =>
      savingsOverviewProjects.find(({ project }) => project.id === selectedOverviewProjectId) ??
      null,
    [savingsOverviewProjects, selectedOverviewProjectId]
  );

  const savingsHistory = useMemo(() => {
    const byPeriod = new Map<string, bigint>();

    monthCloses.forEach((monthClose) => {
      byPeriod.set(String(monthClose.period).slice(0, 7), toMinor(monthClose.actual_saved_base_minor));
    });
    byPeriod.set(currentMonthKey, positiveSavingsMinor);

    const allValues = Array.from(byPeriod.values());
    const maxMinor = allValues.reduce(
      (current, amountMinor) => (amountMinor > current ? amountMinor : current),
      0n
    );

    return {
      maxMinor,
    };
  }, [currentMonthKey, monthCloses, positiveSavingsMinor]);

  const monthlyCommitmentTotalMinor = useMemo(
    () =>
      savingsOverviewProjects.reduce(
        (total, row) => total + getProjectMonthlyFundingTargetMinor(row.project),
        0n
      ),
    [savingsOverviewProjects]
  );

  const activeExpenseRecurringItems = useMemo(
    () =>
      recurringItems.filter(
        (item) =>
          item.type === "expense" &&
          !item.is_paused &&
          item.start_date <= `${currentMonthKey}-31` &&
          (!item.end_date || item.end_date >= currentMonthStart)
      ),
    [currentMonthKey, currentMonthStart, recurringItems]
  );

  const recurringExpenseTotalMinor = useMemo(
    () =>
      activeExpenseRecurringItems.reduce(
        (total, item) => total + estimateRecurringMonthlyMinor(item),
        0n
      ),
    [activeExpenseRecurringItems]
  );

  const distribution = useMemo(() => {
    const baseMinor = positiveSavingsMinor > 0n ? positiveSavingsMinor : 1n;
    const projectsWidth = Number((parsedPlans.totalMinor * 10000n) / baseMinor) / 100;
    const huchaWidth = Number((monthlyHuchaMinor * 10000n) / baseMinor) / 100;

    return {
      projectsPct: positiveSavingsMinor > 0n ? Math.max(0, Math.min(100, projectsWidth)) : 0,
      huchaPct:
        positiveSavingsMinor > 0n
          ? Math.max(0, Math.min(100, huchaWidth || 100 - projectsWidth))
          : 0,
      projectsShare:
        positiveSavingsMinor > 0n
          ? Math.round((Number(parsedPlans.totalMinor) / Number(positiveSavingsMinor)) * 1000) / 10
          : 0,
      commitmentsCoverage:
        monthlyCommitmentTotalMinor > 0n
          ? Math.round((Number(parsedPlans.totalMinor) / Number(monthlyCommitmentTotalMinor)) * 1000) / 10
          : 0,
    };
  }, [monthlyCommitmentTotalMinor, monthlyHuchaMinor, parsedPlans.totalMinor, positiveSavingsMinor]);

  const canSavePlan =
    canEdit &&
    !parsedPlans.hasErrors &&
    parsedPlans.totalMinor <=
      positiveSavingsMinor &&
    !savingsView.isClosed;

  const editingBlockedReason = !canEdit
    ? locale === "en"
      ? "Read only. Your account role can't edit monthly allocations."
      : "Solo lectura. Tu rol en la cuenta no puede editar asignaciones mensuales."
    : savingsView.isClosed
      ? locale === "en"
        ? "This month is already closed. Reopen or edit another month to change the allocation."
        : "Este mes ya está cerrado. Reabre o edita otro mes para cambiar la asignación."
      : null;

  const selectedOverviewPlan = selectedOverviewProject
    ? parsedPlans.rows.find((row) => row.projectId === selectedOverviewProject.project.id) ?? null
    : null;

  const handleInputChange = (projectId: string, value: string) => {
    setInputsByProject((previous) => ({
      ...previous,
      [projectId]: sanitizeNumericInput(value),
    }));
    setError(null);
    setMessage(null);
  };

  const handleSavePlan = async () => {
    if (!selectedAccountId || !canSavePlan || isSavingPlan) return;

    setIsSavingPlan(true);
    setError(null);
    setMessage(null);

    try {
      const payload = parsedPlans.rows.map((row) => ({
        project_id: row.projectId,
        planned_amount_base_minor: row.amountMinor.toString(),
      }));

      const { error: rpcError } = await supabase.rpc("replace_monthly_project_funding_plans", {
        p_account_id: selectedAccountId,
        p_period: currentMonthStart,
        p_plans: payload,
      });

      if (rpcError) throw rpcError;

      setMessage(locale === "en" ? "Monthly plan updated." : "Plan mensual actualizado.");
      await loadData();
    } catch (saveError) {
      console.error("[Savings][mobile] save plan error", saveError);
      setError(
        locale === "en"
          ? "Couldn't save the monthly plan."
          : "No se pudo guardar el plan mensual."
      );
    } finally {
      setIsSavingPlan(false);
    }
  };

  if (loading) {
    return (
      <>
        <Stack.Screen options={{ title: t(dictionary, "home.savings.title") }} />
        <View style={[styles.loading, { backgroundColor: userTokens.background }]}>
          <ActivityIndicator size="large" color={primaryActionColor} />
        </View>
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: t(dictionary, "home.savings.title") }} />
      <View style={[styles.screen, { backgroundColor: userTokens.background }]}>
        <ScrollView
          contentContainerStyle={[
            styles.container,
            { paddingBottom: tokens.spacing.xxl + insets.bottom + 64 },
          ]}
        >
          {error ? (
            <Card>
              <Text style={[styles.errorText, { color: userTokens.textPrimary }]}>{error}</Text>
            </Card>
          ) : null}

          <View style={styles.overviewShell}>
            <View style={styles.heroWrap}>
              <View
                style={[
                  styles.heroBucketGlow,
                  {
                    backgroundColor: withAlpha(SUPPORT_ACCENT_COLOR, 0.12),
                  },
                ]}
              >
                <SavingsBucketHero
                  valueMinor={positiveSavingsMinor}
                  maxMinor={savingsHistory.maxMinor > 0n ? savingsHistory.maxMinor : positiveSavingsMinor}
                  size={98}
                />
              </View>
              <Text style={[styles.heroAmount, { color: userTokens.textPrimary }]}>
                {formatMoneyWithSymbol(positiveSavingsMinor, baseCurrency, currencySymbol)}
              </Text>
              <Text style={[styles.heroLabel, { color: userTokens.textSecondary }]}>
                {locale === "en"
                  ? `savings capacity · ${displayedMonthCloseLabel}`
                  : `capacidad de ahorro · ${displayedMonthCloseLabel}`}
              </Text>
            </View>

            <View
              style={[
                styles.contextBar,
                {
                  backgroundColor: userTokens.surface,
                  borderColor: userTokens.border,
                },
              ]}
            >
              <Text style={[styles.contextBarText, { color: SUPPORT_ACCENT_COLOR }]}>
                {formatMoneyWithSymbol(monthlyTotals.incomeMinor, baseCurrency, currencySymbol)}{" "}
                {locale === "en" ? "income" : "ingresos"}
              </Text>
              <Text style={[styles.contextBarText, { color: userTokens.textTertiary }]}>−</Text>
              <Text style={[styles.contextBarText, { color: userTokens.dangerText }]}>
                {formatMoneyWithSymbol(monthlyTotals.expenseMinor, baseCurrency, currencySymbol)}{" "}
                {locale === "en" ? "fixed expenses" : "gastos fijos"}
              </Text>
              <Text style={[styles.contextBarText, { color: userTokens.textTertiary }]}>=</Text>
              <Text style={[styles.contextBarText, { color: userTokens.textPrimary }]}>
                {formatMoneyWithSymbol(positiveSavingsMinor, baseCurrency, currencySymbol)}
              </Text>
            </View>

            <View style={styles.distributionSection}>
              <Text style={[styles.sectionEyebrow, { color: userTokens.textSecondary }]}>
                {locale === "en" ? "Savings distribution" : "Distribucion del ahorro"}
              </Text>

              <View
                style={[
                  styles.stackedBarTrack,
                  { backgroundColor: userTokens.surfaceAlt },
                ]}
              >
                <View
                  style={[
                    styles.stackedBarProjects,
                    { width: `${distribution.projectsPct}%`, backgroundColor: SAVINGS_VALUE_COLOR },
                  ]}
                />
                <View
                  style={[
                    styles.stackedBarHucha,
                    {
                      width: `${distribution.huchaPct}%`,
                      backgroundColor: withAlpha(HUCHA_ACCENT_COLOR, 0.42),
                    },
                  ]}
                />
              </View>

              <View style={styles.legendRow}>
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: SAVINGS_VALUE_COLOR }]} />
                  <Text style={[styles.legendText, { color: userTokens.textSecondary }]}>
                    {locale === "en" ? "Projects" : "Proyectos"} ·{" "}
                    {formatMoneyWithSymbol(parsedPlans.totalMinor, baseCurrency, currencySymbol)}
                  </Text>
                </View>
                <View style={styles.legendItem}>
                  <View
                    style={[styles.legendDot, { backgroundColor: withAlpha(HUCHA_ACCENT_COLOR, 0.65) }]}
                  />
                  <Text style={[styles.legendText, { color: userTokens.textSecondary }]}>
                    {t(dictionary, "home.savings.hucha")} ·{" "}
                    {formatMoneyWithSymbol(monthlyHuchaMinor, baseCurrency, currencySymbol)}
                  </Text>
                </View>
              </View>
            </View>

            {savingsOverviewProjects.length > 0 ? (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.projectCardsRow}
              >
                {savingsOverviewProjects.map(({ project, progress }) => {
                  const plannedMinor =
                    parsedPlans.rows.find((row) => row.projectId === project.id)?.amountMinor ?? 0n;
                  const commitmentMinor = getProjectMonthlyFundingTargetMinor(project);
                  const monthlyProgress =
                    commitmentMinor > 0n
                      ? Math.min(1, Number(plannedMinor) / Number(commitmentMinor))
                      : 0;

                  return (
                    <TouchableOpacity
                      key={project.id}
                      activeOpacity={0.9}
                      onPress={() => setSelectedOverviewProjectId(project.id)}
                      style={[
                        styles.projectWireCard,
                        {
                          backgroundColor: userTokens.surface,
                          borderColor: userTokens.border,
                        },
                      ]}
                    >
                      <View style={styles.projectWireTop}>
                        <View
                          style={[
                            styles.projectWireEmojiWrap,
                            { backgroundColor: userTokens.surfaceAlt },
                          ]}
                        >
                          <Text style={styles.projectWireEmoji}>{project.emoji || "🎯"}</Text>
                        </View>
                        <View style={styles.projectWireMeta}>
                          <Text
                            numberOfLines={1}
                            style={[styles.projectWireName, { color: userTokens.textPrimary }]}
                          >
                            {project.name}
                          </Text>
                          <Text style={[styles.projectWireCommitment, { color: userTokens.textSecondary }]}>
                            {formatMoneyWithSymbol(commitmentMinor, baseCurrency, currencySymbol)}/
                            {locale === "en" ? "month" : "mes"}
                          </Text>
                        </View>
                      </View>

                      <View style={styles.projectMonthBlock}>
                        <View style={styles.projectMonthHeader}>
                          <Text style={[styles.projectMonthLabel, { color: userTokens.textSecondary }]}>
                            {locale === "en" ? "This month" : "Este mes"}
                          </Text>
                          <Text style={[styles.projectMonthValue, { color: SAVINGS_VALUE_COLOR }]}>
                            {formatMoneyWithSymbol(plannedMinor, baseCurrency, currencySymbol)} /{" "}
                            {formatMoneyWithSymbol(commitmentMinor, baseCurrency, currencySymbol)}
                          </Text>
                        </View>
                        <View
                          style={[
                            styles.projectMonthTrack,
                            { backgroundColor: userTokens.surfaceAlt },
                          ]}
                        >
                          <View
                            style={[
                              styles.projectMonthFill,
                              {
                                width: `${Math.max(0, Math.min(100, monthlyProgress * 100))}%`,
                                backgroundColor: SAVINGS_VALUE_COLOR,
                              },
                            ]}
                          />
                        </View>
                      </View>

                      <View
                        style={[
                          styles.projectWireFooter,
                          { borderTopColor: userTokens.border },
                        ]}
                      >
                        <Text style={[styles.projectWireFooterLabel, { color: userTokens.textTertiary }]}>
                          {locale === "en" ? "Total progress" : "Total acumulado"}
                        </Text>
                        <Text style={[styles.projectWireFooterValue, { color: SUPPORT_ACCENT_COLOR }]}>
                          {Math.round(progress.progressRatio * 100)}%
                        </Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            ) : (
              <Card style={{ marginTop: 12 }}>
                <Text style={[styles.helper, { color: userTokens.textSecondary, marginTop: 0 }]}>
                  {locale === "en"
                    ? "Create at least one financial project to start assigning savings."
                    : "Crea al menos un proyecto financiero para empezar a asignar ahorro."}
                </Text>
              </Card>
            )}

            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => router.push("/(auth)/(tabs)/projects")}
              style={styles.projectsLinkRow}
            >
              <Text style={[styles.projectsLinkText, { color: primaryActionColor }]}>
                {locale === "en" ? "See all projects →" : "Ver todos los proyectos →"}
              </Text>
            </TouchableOpacity>

            {huchaReserve ? (
              <TouchableOpacity
                activeOpacity={0.88}
                onPress={() =>
                  router.push(`/(auth)/(tabs)/projects/reserves/${huchaReserve.id}`)
                }
                style={[
                  styles.infoStrip,
                  {
                    backgroundColor: userTokens.surface,
                    borderColor: userTokens.border,
                  },
                ]}
              >
                <View style={styles.infoStripLeft}>
                  <View
                    style={[
                      styles.huchaStripIcon,
                      { backgroundColor: withAlpha(HUCHA_ACCENT_COLOR, 0.12) },
                    ]}
                  >
                    <HuchaLiquidCanvas
                      valueMinor={monthlyHuchaMinor}
                      maxMinor={positiveSavingsMinor > 0n ? positiveSavingsMinor : monthlyHuchaMinor}
                      size={42}
                    />
                  </View>
                  <View>
                    <Text style={[styles.infoStripEyebrow, { color: HUCHA_ACCENT_COLOR }]}>
                      {t(dictionary, "home.savings.hucha")}
                    </Text>
                    <Text style={[styles.infoStripSub, { color: userTokens.textTertiary }]}>
                      {locale === "en" ? "month remainder" : "excedente del mes"}
                    </Text>
                  </View>
                </View>
                <Text style={[styles.huchaStripAmount, { color: HUCHA_ACCENT_COLOR }]}>
                  {formatMoneyWithSymbol(monthlyHuchaMinor, baseCurrency, currencySymbol)}
                </Text>
              </TouchableOpacity>
            ) : null}

            <View style={styles.summaryRow}>
              <View
                style={[
                  styles.summaryCard,
                  {
                    backgroundColor: userTokens.surface,
                    borderColor: userTokens.border,
                  },
                ]}
              >
                <Text style={[styles.summaryLabel, { color: userTokens.textTertiary }]}>
                  {locale === "en" ? "Committed to projects" : "Comprometido a proyectos"}
                </Text>
                <Text style={[styles.summaryValue, { color: SAVINGS_VALUE_COLOR }]}>
                  {formatMoneyWithSymbol(parsedPlans.totalMinor, baseCurrency, currencySymbol)}
                  <Text style={[styles.summarySuffix, { color: userTokens.textTertiary }]}>
                    /{locale === "en" ? "month" : "mes"}
                  </Text>
                </Text>
                <Text style={[styles.summarySub, { color: userTokens.textTertiary }]}>
                  <Text style={[styles.summaryPct, { color: SUPPORT_ACCENT_COLOR }]}>
                    {distribution.projectsShare.toFixed(1)}%
                  </Text>{" "}
                  {locale === "en"
                    ? "of your monthly savings capacity"
                    : "de tu capacidad de ahorro"}
                </Text>
              </View>

              <View
                style={[
                  styles.summaryCard,
                  {
                    backgroundColor: userTokens.surface,
                    borderColor: userTokens.border,
                  },
                ]}
              >
                <Text style={[styles.summaryLabel, { color: userTokens.textTertiary }]}>
                  {locale === "en" ? "Monthly commitment goal" : "Objetivo mensual total"}
                </Text>
                <Text style={[styles.summaryValue, { color: SUPPORT_ACCENT_COLOR }]}>
                  {formatMoneyWithSymbol(monthlyCommitmentTotalMinor, baseCurrency, currencySymbol)}
                </Text>
                <Text style={[styles.summarySub, { color: userTokens.textTertiary }]}>
                  <Text style={[styles.summaryPct, { color: SUPPORT_ACCENT_COLOR }]}>
                    {distribution.commitmentsCoverage.toFixed(1)}%
                  </Text>{" "}
                  {locale === "en"
                    ? "covered by the current plan"
                    : "cubierto por el plan actual"}
                </Text>
              </View>
            </View>

            <TouchableOpacity
              activeOpacity={0.88}
              onPress={() => router.push("/(auth)/transaction/recurrent")}
              style={[
                styles.infoStrip,
                {
                  backgroundColor: userTokens.surface,
                  borderColor: userTokens.border,
                },
              ]}
            >
              <View style={styles.infoStripLeft}>
                <View
                  style={[
                    styles.recurringStripIcon,
                    { backgroundColor: withAlpha(userTokens.dangerText, 0.1) },
                  ]}
                >
                  <Text style={[styles.recurringStripSymbol, { color: userTokens.dangerText }]}>
                    ↻
                  </Text>
                </View>
                <View>
                  <Text style={[styles.recurringStripLabel, { color: userTokens.textPrimary }]}>
                    {locale === "en" ? "Fixed expenses" : "Gastos fijos"}
                  </Text>
                  <Text style={[styles.infoStripSub, { color: userTokens.textTertiary }]}>
                    {locale === "en"
                      ? `${activeExpenseRecurringItems.length} active recurring items`
                      : `${activeExpenseRecurringItems.length} recurrentes activos`}
                  </Text>
                </View>
              </View>
              <Text style={[styles.recurringStripAmount, { color: userTokens.dangerText }]}>
                {formatMoneyWithSymbol(recurringExpenseTotalMinor, baseCurrency, currencySymbol)}
                <Text style={[styles.summarySuffix, { color: userTokens.textTertiary }]}>
                  /{locale === "en" ? "month" : "mes"}
                </Text>
              </Text>
            </TouchableOpacity>

            <View
              style={[
                styles.monthCloseStatusCard,
                styles.monthCloseSectionCard,
                {
                  borderColor: withAlpha(userTokens.primary, 0.28),
                  backgroundColor: "transparent",
                },
              ]}
            >
              <Text style={[styles.monthCloseStatusEyebrow, { color: primaryActionColor }]}>
                {locale === "en" ? "Month close" : "Cierre mensual"}
              </Text>
              <Text style={[styles.monthCloseStatusMonth, { color: userTokens.textPrimary }]}>
                {displayedMonthCloseLabel}
              </Text>

              {monthCloseActionMonthKey ? (
                <>
                  <Text style={[styles.helper, { color: userTokens.textSecondary }]}>
                    {locale === "en"
                      ? "This month is ready to review and confirm."
                      : "Este mes ya esta listo para revisar y confirmar."}
                  </Text>
                  <View style={styles.monthCloseStatusAction}>
                    <Button
                      variant="secondary"
                      title={locale === "en" ? "Review close" : "Revisar cierre"}
                      onPress={() =>
                        router.push(
                          `/(auth)/(tabs)/projects/month-close?month=${monthCloseActionMonthKey}`
                        )
                      }
                    />
                  </View>
                </>
              ) : (
                <View style={styles.monthCloseStatusInfo}>
                  <Text style={[styles.monthCloseStatusTitle, { color: userTokens.textPrimary }]}>
                    {locale === "en" ? "Month already closed" : "Mes ya cerrado"}
                  </Text>
                  {displayedMonthCloseDate ? (
                    <Text style={[styles.helper, { color: userTokens.textSecondary }]}>
                      {locale === "en"
                        ? `Closed on ${displayedMonthCloseDate}.`
                        : `Cerrado el ${displayedMonthCloseDate}.`}
                    </Text>
                  ) : null}
                  <Text style={[styles.helper, { color: userTokens.textSecondary }]}>
                    {locale === "en"
                      ? `Closed by ${displayedMonthCloseAuthor}.`
                      : `Cerrado por ${displayedMonthCloseAuthor}.`}
                  </Text>
                </View>
              )}
            </View>

            <Modal
              transparent
              visible={selectedOverviewProject !== null}
              animationType="slide"
              onRequestClose={() => setSelectedOverviewProjectId(null)}
            >
              <View style={styles.assignmentModalOverlay}>
                <Pressable
                  style={styles.assignmentModalBackdrop}
                  onPress={() => setSelectedOverviewProjectId(null)}
                />
                {selectedOverviewProject ? (
                  <View
                    style={[
                      styles.assignmentModalSheet,
                      {
                        backgroundColor: userTokens.surface,
                        borderColor: userTokens.border,
                        paddingBottom: tokens.spacing.lg + insets.bottom,
                      },
                    ]}
                  >
                    <View
                      style={[
                        styles.assignmentModalHandle,
                        { backgroundColor: userTokens.border },
                      ]}
                    />
                    <View style={styles.projectEditorTop}>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.overviewCardHeader, { color: userTokens.textSecondary }]}>
                          {locale === "en" ? "Projects" : "Proyectos"}
                        </Text>
                        <Text
                          style={[styles.assignmentModalTitle, { color: userTokens.textPrimary }]}
                        >
                          {selectedOverviewProject.project.emoji || "🎯"}{" "}
                          {selectedOverviewProject.project.name}
                        </Text>
                        <Text
                          style={[
                            styles.helper,
                            styles.projectInlineMeta,
                            { color: userTokens.textSecondary },
                          ]}
                        >
                          {formatMoneyWithSymbol(
                            selectedOverviewProject.progress.savedMinor,
                            baseCurrency,
                            currencySymbol
                          )}{" "}
                          /{" "}
                          {formatMoneyWithSymbol(
                            selectedOverviewProject.progress.targetMinor,
                            baseCurrency,
                            currencySymbol
                          )}
                        </Text>
                      </View>
                      <View style={styles.projectEditorActionsTop}>
                        <Text
                          style={[
                            styles.projectInlinePercent,
                            { color: getProjectColor(selectedOverviewProject.project) },
                          ]}
                        >
                          {Math.round(selectedOverviewProject.progress.progressRatio * 100)}%
                        </Text>
                        <TouchableOpacity
                          onPress={() => setSelectedOverviewProjectId(null)}
                          style={[
                            styles.projectInlineClose,
                            {
                              borderColor: userTokens.border,
                              backgroundColor: withAlpha(userTokens.surfaceAlt, 0.7),
                            },
                          ]}
                          accessibilityRole="button"
                          accessibilityLabel={
                            locale === "en" ? "Close assignment modal" : "Cerrar modal de asignacion"
                          }
                        >
                          <Text style={[styles.projectInlineCloseText, { color: userTokens.textPrimary }]}>
                            ×
                          </Text>
                        </TouchableOpacity>
                      </View>
                    </View>

                    <ScrollView
                      showsVerticalScrollIndicator={false}
                      contentContainerStyle={styles.assignmentModalContent}
                    >
                      <View
                        style={[
                          styles.projectInlineEditor,
                          {
                            backgroundColor: withAlpha(userTokens.background, 0.72),
                            borderColor: userTokens.border,
                          },
                        ]}
                      >
                        <Text style={[styles.projectInlineLabel, { color: userTokens.textSecondary }]}>
                          {locale === "en" ? "Funding target" : "Objetivo mensual"}:{" "}
                          {formatMoneyWithSymbol(
                            getProjectMonthlyFundingTargetMinor(selectedOverviewProject.project),
                            baseCurrency,
                            currencySymbol
                          )}
                        </Text>

                        <Input
                          label={locale === "en" ? "Planned this month" : "Planificado este mes"}
                          value={inputsByProject[selectedOverviewProject.project.id] ?? ""}
                          onChangeText={(value) =>
                            handleInputChange(selectedOverviewProject.project.id, value)
                          }
                          keyboardType="numeric"
                          placeholder="0"
                          readOnly={Boolean(editingBlockedReason)}
                          error={selectedOverviewPlan?.error ?? undefined}
                          helperText={
                            selectedOverviewPlan?.error ? undefined : editingBlockedReason ?? undefined
                          }
                        />

                        {message ? <Text style={styles.successText}>{message}</Text> : null}

                        <View style={styles.projectInlineSummary}>
                          <Text
                            style={[
                              styles.helper,
                              styles.projectInlineSummaryText,
                              { color: userTokens.textSecondary },
                            ]}
                          >
                            {locale === "en" ? "Planned total" : "Total planificado"}:{" "}
                            {formatMoneyWithSymbol(parsedPlans.totalMinor, baseCurrency, currencySymbol)}
                          </Text>
                          <Text
                            style={[
                              styles.helper,
                              styles.projectInlineSummaryText,
                              { color: userTokens.textSecondary },
                            ]}
                          >
                            {locale === "en"
                              ? "Projected to Own Funds"
                              : "Previsto para Fondos Propios"}:{" "}
                            {formatMoneyWithSymbol(monthlyHuchaMinor, baseCurrency, currencySymbol)}
                          </Text>
                        </View>

                        <View style={styles.projectInlineActions}>
                          <Button
                            title={
                              isSavingPlan
                                ? locale === "en"
                                  ? "Saving..."
                                  : "Guardando..."
                                : locale === "en"
                                  ? "Save plan"
                                  : "Guardar plan"
                            }
                            onPress={() => void handleSavePlan()}
                            disabled={!canSavePlan || isSavingPlan}
                            loading={isSavingPlan}
                          />
                        </View>
                      </View>
                    </ScrollView>
                  </View>
                ) : null}
              </View>
            </Modal>

            {message ? <Text style={styles.successText}>{message}</Text> : null}

          </View>

          {savingsView.needsRebalance ? (
            <Card>
              <Text style={[styles.warningTitle, { color: "#C2410C" }]}>
                {locale === "en" ? "Rebalance required" : "Necesita ajuste"}
              </Text>
              <Text style={[styles.helper, { color: userTokens.textSecondary }]}>
                {locale === "en"
                  ? "Recent spending reduced the available savings. Lower the monthly plan before closing."
                  : "Nuevos gastos han reducido el ahorro disponible. Baja el plan mensual antes de cerrar."}
              </Text>
            </Card>
          ) : null}

        </ScrollView>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  loading: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  container: {
    padding: tokens.spacing.lg,
    gap: tokens.spacing.md,
  },
  overviewShell: {
    paddingHorizontal: 2,
    paddingTop: 10,
    paddingBottom: 24,
  },
  heroSection: {
    flexDirection: "column",
    alignItems: "stretch",
    gap: 12,
  },
  heroWrap: {
    alignItems: "center",
    paddingTop: 8,
  },
  heroBucketGlow: {
    width: 112,
    height: 112,
    borderRadius: 56,
    alignItems: "center",
    justifyContent: "center",
  },
  heroAmount: {
    marginTop: 12,
    fontSize: 42,
    lineHeight: 44,
    letterSpacing: -2.4,
    fontFamily: "DMSans",
    color: SAVINGS_VALUE_COLOR,
  },
  heroLabel: {
    marginTop: 10,
    fontSize: 13,
    fontFamily: "DMSans-Regular",
  },
  contextBar: {
    marginTop: 18,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    flexWrap: "wrap",
    gap: 6,
  },
  contextBarText: {
    fontSize: 13,
    fontFamily: "DMSans-Medium",
  },
  distributionSection: {
    marginTop: 28,
  },
  sectionEyebrow: {
    marginBottom: 12,
    fontSize: 11,
    fontFamily: "DMSans-Bold",
    textTransform: "uppercase",
    letterSpacing: 1.1,
  },
  stackedBarTrack: {
    height: 28,
    borderRadius: 10,
    overflow: "hidden",
    flexDirection: "row",
  },
  stackedBarProjects: {
    height: "100%",
  },
  stackedBarHucha: {
    height: "100%",
  },
  legendRow: {
    marginTop: 10,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 14,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    fontSize: 12,
    fontFamily: "DMSans-Regular",
  },
  projectCardsRow: {
    gap: 12,
    paddingTop: 18,
    paddingBottom: 4,
  },
  projectWireCard: {
    width: 220,
    borderRadius: 18,
    borderWidth: 1,
    padding: 16,
  },
  projectWireTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  projectWireEmojiWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  projectWireEmoji: {
    fontSize: 20,
  },
  projectWireMeta: {
    flex: 1,
  },
  projectWireName: {
    fontSize: 14,
    fontFamily: "DMSans-Bold",
  },
  projectWireCommitment: {
    marginTop: 2,
    fontSize: 12,
    fontFamily: "DMSans-Regular",
  },
  projectMonthBlock: {
    marginTop: 16,
  },
  projectMonthHeader: {
    marginBottom: 8,
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 8,
  },
  projectMonthLabel: {
    fontSize: 11,
    fontFamily: "DMSans-Regular",
  },
  projectMonthValue: {
    fontSize: 11,
    fontFamily: "DMSans-Bold",
    textAlign: "right",
  },
  projectMonthTrack: {
    height: 4,
    borderRadius: 999,
    overflow: "hidden",
  },
  projectMonthFill: {
    height: "100%",
    borderRadius: 999,
  },
  projectWireFooter: {
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  projectWireFooterLabel: {
    fontSize: 11,
    fontFamily: "DMSans-Regular",
  },
  projectWireFooterValue: {
    fontSize: 12,
    fontFamily: "DMSans-Bold",
  },
  projectsLinkRow: {
    marginTop: 14,
  },
  projectsLinkText: {
    fontSize: 13,
    fontFamily: "DMSans-Medium",
  },
  infoStrip: {
    marginTop: 12,
    borderRadius: 18,
    borderWidth: 1,
    paddingHorizontal: 18,
    paddingVertical: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 14,
  },
  infoStripLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    flex: 1,
  },
  huchaStripIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  infoStripEyebrow: {
    fontSize: 11,
    fontFamily: "DMSans-Bold",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  infoStripSub: {
    marginTop: 2,
    fontSize: 12,
    fontFamily: "DMSans-Regular",
  },
  huchaStripAmount: {
    fontSize: 24,
    fontFamily: "DMSans-Bold",
    letterSpacing: -0.6,
  },
  summaryRow: {
    marginTop: 12,
    gap: 12,
  },
  summaryCard: {
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  summaryLabel: {
    fontSize: 11,
    fontFamily: "DMSans-Bold",
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  summaryValue: {
    marginTop: 10,
    fontSize: 24,
    lineHeight: 28,
    fontFamily: "DMSans-Bold",
    letterSpacing: -0.6,
  },
  summarySuffix: {
    fontSize: 14,
    fontFamily: "DMSans-Regular",
  },
  summarySub: {
    marginTop: 4,
    fontSize: 11,
    fontFamily: "DMSans-Regular",
  },
  summaryPct: {
    fontFamily: "DMSans-Bold",
  },
  recurringStripIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  recurringStripSymbol: {
    fontSize: 17,
    fontFamily: "DMSans-Bold",
  },
  recurringStripLabel: {
    fontSize: 13,
    fontFamily: "DMSans-Bold",
  },
  recurringStripAmount: {
    fontSize: 22,
    fontFamily: "DMSans-Bold",
    letterSpacing: -0.5,
  },
  pipesWrap: {
    alignItems: "center",
    marginTop: 4,
  },
  pipeHintRow: {
    marginTop: 2,
    flexDirection: "row",
    justifyContent: "center",
    flexWrap: "wrap",
    gap: 14,
  },
  pipeHintItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  pipeHintDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  pipeHintText: {
    fontSize: 11,
    fontFamily: "DMSans-Regular",
    color: "#A3A9B4",
  },
  overviewGrid: {
    flexDirection: "row",
    gap: 12,
    marginTop: 12,
  },
  projectsOverviewCard: {
    flex: 1,
    height: 360,
    overflow: "hidden",
    borderRadius: 24,
    padding: 16,
    borderWidth: 1,
    shadowColor: "#1C1E21",
    shadowOpacity: 0.07,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 2,
  },
  overviewCardHeader: {
    marginBottom: 14,
    fontSize: 11,
    fontFamily: "DMSans-Bold",
    textTransform: "uppercase",
    letterSpacing: 1.2,
  },
  projectsOverviewScroller: {
    gap: 10,
    paddingBottom: 2,
  },
  projectOverviewItem: {
    borderWidth: 1,
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 14,
    width: 142,
    minHeight: 178,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#1C1E21",
    shadowOpacity: 0.04,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 1,
  },
  projectOverviewEmoji: {
    fontSize: 18,
  },
  projectOverviewName: {
    marginTop: 12,
    fontSize: 15,
    fontFamily: "DMSans-Medium",
    minHeight: 36,
    textAlign: "center",
  },
  projectOverviewAmount: {
    marginTop: 1,
    fontSize: 12,
    fontFamily: "DMSans-Regular",
    textAlign: "center",
  },
  projectOverviewPercent: {
    marginTop: 8,
    fontSize: 13,
    fontFamily: "DMSans-Bold",
  },
  projectInlineEditor: {
    borderWidth: 1,
    borderRadius: 20,
    padding: 14,
    gap: 12,
  },
  projectEditorTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 10,
  },
  projectEditorActionsTop: {
    alignItems: "flex-end",
    gap: 8,
  },
  projectInlineHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  projectInlineTitle: {
    fontSize: 15,
    fontFamily: "DMSans-Bold",
  },
  projectInlineMeta: {
    marginTop: 2,
    marginBottom: 0,
  },
  projectInlinePercent: {
    fontSize: 14,
    fontFamily: "DMSans-Bold",
  },
  projectInlineLabel: {
    fontSize: 12,
    fontFamily: "DMSans-Regular",
  },
  projectInlineSummary: {
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "rgba(0,0,0,0.08)",
    gap: 2,
  },
  projectInlineSummaryText: {
    marginTop: 0,
  },
  projectInlineActions: {
    marginTop: 2,
  },
  projectInlineClose: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  projectInlineCloseText: {
    fontSize: 20,
    lineHeight: 22,
    fontFamily: "DMSans-Bold",
  },
  assignmentModalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
  },
  assignmentModalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(15, 23, 42, 0.42)",
  },
  assignmentModalSheet: {
    maxHeight: "88%",
    borderTopLeftRadius: tokens.radii.lg,
    borderTopRightRadius: tokens.radii.lg,
    borderWidth: 1,
    borderBottomWidth: 0,
    paddingHorizontal: tokens.spacing.lg,
    paddingTop: tokens.spacing.lg,
  },
  assignmentModalHandle: {
    alignSelf: "center",
    width: 48,
    height: 5,
    borderRadius: 999,
    marginBottom: tokens.spacing.md,
  },
  assignmentModalTitle: {
    fontSize: 18,
    fontFamily: "DMSans-Bold",
  },
  assignmentModalContent: {
    paddingTop: 14,
    paddingBottom: 8,
  },
  projectsOverviewTotal: {
    marginTop: 14,
    paddingTop: 10,
    borderTopWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  projectsOverviewTotalLabel: {
    flex: 1,
    fontSize: 11,
    lineHeight: 14,
    fontFamily: "DMSans-Medium",
  },
  projectsOverviewTotalValue: {
    fontSize: 13,
    fontFamily: "DMSans-Bold",
    color: SAVINGS_VALUE_COLOR,
  },
  monthCloseStatusCard: {
    borderRadius: 24,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 16,
  },
  monthCloseSectionCard: {
    marginTop: 12,
  },
  monthCloseStatusEyebrow: {
    fontSize: 11,
    fontFamily: "DMSans-Bold",
    textTransform: "uppercase",
    letterSpacing: 1.1,
  },
  monthCloseStatusMonth: {
    marginTop: 8,
    fontSize: 15,
    lineHeight: 18,
    fontFamily: "DMSans-Bold",
  },
  monthCloseStatusAction: {
    marginTop: tokens.spacing.md,
  },
  monthCloseStatusInfo: {
    marginTop: 10,
    gap: 2,
  },
  monthCloseStatusTitle: {
    fontSize: 13,
    fontFamily: "DMSans-Bold",
  },
  huchaOverviewCard: {
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 18,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  huchaOverviewCircle: {
    position: "relative",
    width: 72,
    height: 72,
  },
  huchaOverviewAmount: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
  },
  huchaOverviewAmountText: {
    color: "#fff",
    fontSize: 12,
    fontFamily: "DMSans-Bold",
    fontVariant: ["tabular-nums"],
  },
  huchaOverviewLabel: {
    marginTop: 12,
    fontSize: 11,
    fontFamily: "DMSans-Bold",
    textTransform: "uppercase",
    letterSpacing: 1.1,
  },
  huchaOverviewSubLabel: {
    marginTop: 4,
    textAlign: "center",
    fontSize: 12,
    fontFamily: "DMSans-Regular",
  },
  cardTitle: {
    fontSize: tokens.typography.size.lg,
    fontFamily: "DMSans-Bold",
    marginBottom: tokens.spacing.xs,
  },
  helper: {
    marginTop: tokens.spacing.xs,
    fontSize: tokens.typography.size.sm,
    lineHeight: 20,
    fontFamily: "DMSans-Regular",
  },
  cardActions: {
    marginTop: tokens.spacing.md,
  },
  warningTitle: {
    fontSize: tokens.typography.size.md,
    fontFamily: "DMSans-Bold",
    marginBottom: 4,
  },
  errorText: {
    fontSize: tokens.typography.size.sm,
    fontFamily: "DMSans-Medium",
  },
  successText: {
    marginTop: tokens.spacing.sm,
    color: "#15803D",
    fontSize: tokens.typography.size.sm,
    fontFamily: "DMSans-Medium",
  },
});
