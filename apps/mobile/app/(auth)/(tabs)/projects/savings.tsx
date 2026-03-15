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
import Svg, { Circle, Path } from "react-native-svg";
import {
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
  themeTokens,
  toMonthKey,
  withAlpha,
  type MonthClose,
  type MonthCloseAllocation,
  type MonthlyProjectFundingPlan,
  type Project,
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

const shiftMonthKey = (monthKey: string, delta: number) => {
  const date = new Date(`${monthKey}-01T00:00:00`);
  date.setMonth(date.getMonth() + delta);
  return toMonthKey(date);
};

type PipeBranch = "left" | "right";

const PIPE_STROKE_WIDTH = 5;
const PIPE_PARTICLE_COUNT = 18;

const getPipeBezierPoint = (
  startX: number,
  startY: number,
  controlX: number,
  controlY: number,
  endX: number,
  endY: number,
  t: number
) => ({
  x: (1 - t) * (1 - t) * startX + 2 * (1 - t) * t * controlX + t * t * endX,
  y: (1 - t) * (1 - t) * startY + 2 * (1 - t) * t * controlY + t * t * endY,
});

function SavingsPipes({ splitRatio }: { splitRatio: number }) {
  const [time, setTime] = useState(0);
  const particles = useMemo(
    () =>
      Array.from({ length: PIPE_PARTICLE_COUNT }, (_, index) => ({
        offset: index / PIPE_PARTICLE_COUNT,
        speed: 0.12 + (index % 5) * 0.018,
        size: 2 + (index % 3) * 0.45,
        opacity: 0.58 + (index % 4) * 0.08,
        branchSeed: ((index * 37) % 100) / 100,
      })),
    []
  );

  useEffect(() => {
    let frame = 0;
    const loop = (now: number) => {
      setTime(now / 1000);
      frame = requestAnimationFrame(loop);
    };

    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  }, []);

  const getParticlePosition = (progress: number, branch: PipeBranch) => {
    if (progress < 0.42) {
      const stemProgress = progress / 0.42;
      return { x: 160, y: 4 + (43 - 4) * stemProgress };
    }

    const branchProgress = (progress - 0.42) / 0.58;
    return branch === "left"
      ? getPipeBezierPoint(160, 43, 124, 49, 29, 80, branchProgress)
      : getPipeBezierPoint(160, 43, 208, 49, 291, 80, branchProgress);
  };

  return (
    <Svg width="100%" height="88" viewBox="0 0 320 88">
      <Path
        d="M160 4 L160 43"
        stroke="#4ECDC4"
        strokeWidth={PIPE_STROKE_WIDTH}
        strokeLinecap="round"
      />
      <Path
        d="M160 43 C124 49 82 57 29 80"
        stroke="#5B8DFF"
        strokeWidth={PIPE_STROKE_WIDTH}
        strokeLinecap="round"
        fill="none"
      />
      <Path
        d="M160 43 C208 49 248 57 291 80"
        stroke="#72C4E6"
        strokeWidth={PIPE_STROKE_WIDTH}
        strokeLinecap="round"
        fill="none"
      />

      {particles.map((particle, index) => {
        const progress = (time * particle.speed + particle.offset) % 1;
        const branch = particle.branchSeed < splitRatio ? "left" : "right";
        const point = getParticlePosition(progress, branch);

        return (
          <Circle
            key={index}
            cx={point.x}
            cy={point.y}
            r={particle.size}
            fill={
              branch === "left"
                ? `rgba(91,141,255,${particle.opacity})`
                : `rgba(114,196,230,${particle.opacity})`
            }
          />
        );
      })}
    </Svg>
  );
}

export default function SavingsDetailScreen() {
  const router = useRouter();
  const { user, selectedAccountId } = useAuth();
  const { dictionary, locale } = useCopy();
  const { tokens: userTokens, primaryActionColor } = useUserTheme();
  const insets = useSafeAreaInsets();
  const localeCode: "es" | "en" = locale === "en" ? "en" : "es";
  const currentMonthKey = useMemo(() => toMonthKey(new Date()), []);
  const previousMonthKey = useMemo(() => shiftMonthKey(currentMonthKey, -1), [currentMonthKey]);
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
    const remainder = savingsView.generatedSavedMinor - parsedPlans.totalMinor;
    return remainder > 0n ? remainder : 0n;
  }, [parsedPlans.totalMinor, savingsView.generatedSavedMinor]);

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
    const monthFormatter = new Intl.DateTimeFormat(localeCode === "en" ? "en-US" : "es-ES", {
      month: "short",
    });
    const valueFormatter = new Intl.NumberFormat(localeCode === "en" ? "en-US" : "es-ES", {
      maximumFractionDigits: 0,
    });
    const byPeriod = new Map<string, bigint>();

    monthCloses.forEach((monthClose) => {
      byPeriod.set(String(monthClose.period).slice(0, 7), toMinor(monthClose.actual_saved_base_minor));
    });
    byPeriod.set(currentMonthKey, savingsView.generatedSavedMinor);

    const allValues = Array.from(byPeriod.values());
    const averageMinor =
      allValues.length > 0
        ? allValues.reduce((total, amountMinor) => total + amountMinor, 0n) / BigInt(allValues.length)
        : 0n;
    const maxMinor = allValues.reduce(
      (current, amountMinor) => (amountMinor > current ? amountMinor : current),
      0n
    );

    const bars = Array.from({ length: 8 }, (_, index) => {
      const period = shiftMonthKey(currentMonthKey, index - 7);
      const amountMinor = byPeriod.get(period) ?? 0n;
      const date = new Date(`${period}-01T00:00:00`);
      return {
        period,
        amountMinor,
        label: monthFormatter.format(date).replace(".", "").slice(0, 2),
      };
    });

    return {
      averageMinor,
      maxMinor,
      previousMinor: byPeriod.get(previousMonthKey) ?? 0n,
      currentLabel:
        localeCode === "en"
          ? `monthly savings · ${new Intl.DateTimeFormat("en-US", { month: "long" })
              .format(new Date(`${currentMonthKey}-01T00:00:00`))
              .toLowerCase()}`
          : `ahorro del mes · ${new Intl.DateTimeFormat("es-ES", { month: "long" })
              .format(new Date(`${currentMonthKey}-01T00:00:00`))
              .toLowerCase()}`,
      formatNumber: (amountMinor: bigint) => valueFormatter.format(Number(amountMinor) / 100),
      bars,
    };
  }, [currentMonthKey, localeCode, monthCloses, previousMonthKey, savingsView.generatedSavedMinor]);

  const projectSplitRatio = useMemo(() => {
    if (savingsView.generatedSavedMinor <= 0n) return 0.5;
    return Math.min(1, Math.max(0.14, Number(parsedPlans.totalMinor) / Number(savingsView.generatedSavedMinor)));
  }, [parsedPlans.totalMinor, savingsView.generatedSavedMinor]);

  const canSavePlan =
    canEdit &&
    !parsedPlans.hasErrors &&
    parsedPlans.totalMinor <=
      (savingsView.generatedSavedMinor > 0n ? savingsView.generatedSavedMinor : 0n) &&
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
            <View style={styles.heroSection}>
              <View style={styles.heroWrap}>
                <View style={styles.heroBucketGlow}>
                  <SavingsBucketHero
                    valueMinor={savingsView.generatedSavedMinor > 0n ? savingsView.generatedSavedMinor : 0n}
                    maxMinor={
                      savingsHistory.maxMinor > 0n
                        ? savingsHistory.maxMinor
                        : savingsView.generatedSavedMinor
                    }
                    size={98}
                  />
                </View>
                <Text style={styles.heroAmount}>
                  {formatMoneyWithSymbol(
                    savingsView.generatedSavedMinor,
                    baseCurrency,
                    currencySymbol
                  )}
                </Text>
                <Text style={styles.heroLabel}>{savingsHistory.currentLabel}</Text>
              </View>
            </View>

            <View style={styles.pipesWrap}>
              <SavingsPipes splitRatio={projectSplitRatio} />
              <View style={styles.pipeHintRow}>
                <View style={styles.pipeHintItem}>
                  <View style={[styles.pipeHintDot, { backgroundColor: "#5B8DFF" }]} />
                  <Text style={styles.pipeHintText}>
                    {locale === "en" ? "funds projects" : "financia proyectos"}
                  </Text>
                </View>
                <View style={styles.pipeHintItem}>
                  <View style={[styles.pipeHintDot, { backgroundColor: "#72C4E6" }]} />
                  <Text style={styles.pipeHintText}>
                    {locale === "en" ? "piggy bank reserve" : "reserva hucha"}
                  </Text>
                </View>
              </View>
            </View>

            <View style={styles.overviewGrid}>
              <View
                style={[
                  styles.projectsOverviewCard,
                  {
                    backgroundColor: userTokens.surface,
                    borderColor: userTokens.border,
                  },
                ]}
              >
                <Text style={[styles.overviewCardHeader, { color: userTokens.textSecondary }]}>
                  {locale === "en" ? "Projects" : "Proyectos"}
                </Text>
                {savingsOverviewProjects.length > 0 ? (
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.projectsOverviewScroller}
                  >
                    {savingsOverviewProjects.map(({ project, progress, displayMinor }) => (
                      <TouchableOpacity
                        key={project.id}
                        activeOpacity={0.88}
                        onPress={() => setSelectedOverviewProjectId(project.id)}
                        style={[
                          styles.projectOverviewItem,
                          {
                            backgroundColor: withAlpha(userTokens.surfaceAlt, 0.6),
                            borderColor: userTokens.border,
                            shadowOpacity: 0.04,
                            shadowRadius: 10,
                            elevation: 1,
                          },
                        ]}
                      >
                        <ProjectProgressRing
                          size={58}
                          progress={progress.progressRatio}
                          progressColor={getProjectColor(project)}
                          trackColor={userTokens.surfaceAlt}
                          strokeWidth={4}
                          center={
                            <Text style={styles.projectOverviewEmoji}>
                              {project.emoji || "🎯"}
                            </Text>
                          }
                        />
                        <Text
                          numberOfLines={2}
                          style={[styles.projectOverviewName, { color: userTokens.textPrimary }]}
                        >
                          {project.name}
                        </Text>
                        <Text
                          style={[
                            styles.projectOverviewAmount,
                            { color: userTokens.textSecondary },
                          ]}
                        >
                          {formatMoneyWithSymbol(displayMinor, baseCurrency, currencySymbol)}/mes
                        </Text>
                        <Text
                          style={[
                            styles.projectOverviewPercent,
                            { color: getProjectColor(project) },
                          ]}
                        >
                          {Math.round(progress.progressRatio * 100)}%
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                ) : (
                  <Text style={[styles.helper, { color: userTokens.textSecondary, marginTop: 0 }]}>
                    {locale === "en"
                      ? "Create at least one financial project to start assigning savings."
                      : "Crea al menos un proyecto financiero para empezar a asignar ahorro."}
                  </Text>
                )}

                {message ? <Text style={styles.successText}>{message}</Text> : null}

                <View
                  style={[
                    styles.projectsOverviewTotal,
                    { borderTopColor: withAlpha(userTokens.textPrimary, 0.08) },
                  ]}
                >
                  <Text
                    style={[styles.projectsOverviewTotalLabel, { color: userTokens.textSecondary }]}
                  >
                    {locale === "en" ? "Planned to projects" : "Planificado a proyectos"}{" "}
                    {/* TODO: i18n */}
                  </Text>
                  <Text style={styles.projectsOverviewTotalValue}>
                    {formatMoneyWithSymbol(parsedPlans.totalMinor, baseCurrency, currencySymbol)}/mes
                  </Text>
                </View>
              </View>

              <View
                style={[
                  styles.huchaOverviewCard,
                  {
                    backgroundColor: userTokens.surfaceAlt,
                    borderColor: withAlpha(userTokens.primary, 0.2),
                  },
                ]}
              >
                {huchaReserve ? (
                  <TouchableOpacity
                    activeOpacity={0.86}
                    onPress={() =>
                      router.push(`/(auth)/(tabs)/projects/reserves/${huchaReserve.id}`)
                    }
                    style={styles.huchaOverviewCircle}
                  >
                    <HuchaLiquidCanvas
                      valueMinor={monthlyHuchaMinor}
                      maxMinor={
                        savingsView.generatedSavedMinor > 0n
                          ? savingsView.generatedSavedMinor
                          : monthlyHuchaMinor
                      }
                      size={72}
                    />
                    <View style={styles.huchaOverviewAmount} pointerEvents="none">
                      <Text style={styles.huchaOverviewAmountText}>
                        {formatMoneyWithSymbol(monthlyHuchaMinor, baseCurrency, currencySymbol)}
                      </Text>
                    </View>
                  </TouchableOpacity>
                ) : (
                  <View style={styles.huchaOverviewCircle}>
                    <HuchaLiquidCanvas
                      valueMinor={monthlyHuchaMinor}
                      maxMinor={
                        savingsView.generatedSavedMinor > 0n
                          ? savingsView.generatedSavedMinor
                          : monthlyHuchaMinor
                      }
                      size={72}
                    />
                    <View style={styles.huchaOverviewAmount} pointerEvents="none">
                      <Text style={styles.huchaOverviewAmountText}>
                        {formatMoneyWithSymbol(monthlyHuchaMinor, baseCurrency, currencySymbol)}
                      </Text>
                    </View>
                  </View>
                )}
                <Text style={[styles.huchaOverviewLabel, { color: userTokens.textSecondary }]}>
                  Hucha
                </Text>
                <Text style={[styles.huchaOverviewSubLabel, { color: userTokens.textSecondary }]}>
                  {locale === "en" ? "month remainder" : "remanente del mes"}
                </Text>
              </View>
            </View>

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
                      : "Este mes ya está listo para revisar y confirmar."}
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
                            {locale === "en" ? "Projected to piggy bank" : "Previsto para la hucha"}:{" "}
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

            <View
              style={[
                styles.historyCard,
                {
                  backgroundColor: userTokens.surface,
                  borderColor: userTokens.border,
                },
              ]}
            >
              <View style={styles.historyHeader}>
                <Text style={[styles.historyTitle, { color: userTokens.textPrimary }]}>
                  {locale === "en" ? "History" : "Historial"}
                </Text>
                <Text style={styles.historyIndicator}>
                  🪣 {locale === "en" ? "Monthly savings" : "Ahorro mensual"}
                </Text>
              </View>

              <View style={styles.historyStatsRow}>
                <View style={styles.historyStat}>
                  <Text style={[styles.historyStatValue, { color: userTokens.textPrimary }]}>
                    {savingsHistory.formatNumber(savingsView.generatedSavedMinor)}
                  </Text>
                  <Text style={[styles.historyStatLabel, { color: userTokens.textSecondary }]}>
                    {locale === "en" ? "balance" : "saldo"}
                  </Text>
                </View>
                <View style={styles.historyStat}>
                  <Text style={[styles.historyStatValue, { color: userTokens.textPrimary }]}>
                    {savingsHistory.formatNumber(savingsHistory.previousMinor)}
                  </Text>
                  <Text style={[styles.historyStatLabel, { color: userTokens.textSecondary }]}>
                    {locale === "en" ? "month" : "mes"}
                  </Text>
                </View>
                <View style={styles.historyStat}>
                  <Text style={[styles.historyStatValue, { color: userTokens.textPrimary }]}>
                    {savingsHistory.formatNumber(savingsHistory.averageMinor)}
                  </Text>
                  <Text style={[styles.historyStatLabel, { color: userTokens.textSecondary }]}>
                    {locale === "en" ? "average" : "media"}
                  </Text>
                </View>
                <View style={styles.historyStat}>
                  <Text style={[styles.historyStatValue, { color: userTokens.textPrimary }]}>
                    {savingsHistory.formatNumber(savingsHistory.maxMinor)}
                  </Text>
                  <Text style={[styles.historyStatLabel, { color: userTokens.textSecondary }]}>
                    {locale === "en" ? "max" : "máx"}
                  </Text>
                </View>
              </View>

              <View style={styles.historyBarsRow}>
                {savingsHistory.bars.map((bar, index) => {
                  const height =
                    savingsHistory.maxMinor > 0n
                      ? Math.max(8, (Number(bar.amountMinor) / Number(savingsHistory.maxMinor)) * 48)
                      : 8;

                  return (
                    <View key={bar.period} style={styles.historyBarItem}>
                      <View
                        style={[
                          styles.historyBar,
                          {
                            height,
                            backgroundColor:
                              index === savingsHistory.bars.length - 1 ? "#5B8DFF" : "#C8D2FA",
                          },
                        ]}
                      />
                      <Text style={[styles.historyBarLabel, { color: userTokens.textSecondary }]}>
                        {bar.label}
                      </Text>
                    </View>
                  );
                })}
              </View>
            </View>
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
    color: "#5D6575",
  },
  heroLabel: {
    marginTop: 10,
    fontSize: 13,
    fontFamily: "DMSans-Regular",
    color: "#A3A9B4",
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
    color: "#5B8DFF",
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
    textShadowColor: "rgba(0,0,0,0.25)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
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
  historyCard: {
    marginTop: 14,
    borderRadius: 24,
    padding: 16,
    borderWidth: 1,
    shadowColor: "#1C1E21",
    shadowOpacity: 0.07,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 2,
  },
  historyHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
  },
  historyTitle: {
    fontSize: 13,
    fontFamily: "DMSans-Bold",
  },
  historyIndicator: {
    fontSize: 11,
    fontFamily: "DMSans-Medium",
    color: "#5B8DFF",
  },
  historyStatsRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 14,
  },
  historyStat: {
    flex: 1,
    alignItems: "center",
  },
  historyStatValue: {
    fontSize: 16,
    fontFamily: "DMSans-Medium",
  },
  historyStatLabel: {
    marginTop: 2,
    fontSize: 10,
    fontFamily: "DMSans-Regular",
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  historyBarsRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 5,
    height: 60,
    marginTop: 14,
  },
  historyBarItem: {
    flex: 1,
    height: "100%",
    justifyContent: "flex-end",
    gap: 4,
  },
  historyBar: {
    borderRadius: 4,
  },
  historyBarLabel: {
    fontSize: 9,
    fontFamily: "DMSans-Regular",
    textAlign: "center",
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
