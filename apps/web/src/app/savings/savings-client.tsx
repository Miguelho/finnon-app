"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import {
  computeProjectProgress,
  computeSavingsMonthView,
  formatMinorToMoney,
  formatMoneyWithSymbol,
  formatMonthLabel,
  getProjectColor,
  getProjectMonthlyFundingTargetMinor,
  getProjectReserveTransferTotalsMap,
  getMonthRangeFromKey,
  parseMoneyToMinor,
  semanticColorTokens,
  toMonthKey,
  withAlpha,
  type MonthClose,
  type MonthCloseAllocation,
  type MonthlyProjectFundingPlan,
  type Project,
  type ReserveContainer,
  type ReserveTransfer,
} from "@poleursus/shared";
import { ArrowLeft, RefreshCcw, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useWebDataCache } from "@/cache/WebDataCacheProvider";
import { HuchaLiquidCanvas } from "@/components/hucha/hucha-liquid-canvas";
import { SavingsBucketHero } from "@/components/hucha/savings-bucket-hero";
import { PageContainer } from "@/components/layout/page-container";
import { ProjectProgressRing } from "@/components/projects/project-progress-ring";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

type SavingsClientProps = {
  accountId: string;
  baseCurrency: string;
  currencySymbol: string;
  locale: "es" | "en";
  canEdit: boolean;
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
const SAVINGS_VALUE_COLOR = semanticColorTokens.savings.primary;

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
    if (typeof window === "undefined") return;

    let rafId = 0;
    const loop = (now: number) => {
      setTime(now / 1000);
      rafId = window.requestAnimationFrame(loop);
    };

    rafId = window.requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafId);
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
    <svg width="320" height="88" viewBox="0 0 320 88" className="max-w-full overflow-visible">
      <path d="M160 4 L160 43" stroke="#4ECDC4" strokeWidth={PIPE_STROKE_WIDTH} strokeLinecap="round" />
      <path
        d="M160 43 C124 49 82 57 29 80"
        fill="none"
        stroke={SAVINGS_VALUE_COLOR}
        strokeWidth={PIPE_STROKE_WIDTH}
        strokeLinecap="round"
      />
      <path
        d="M160 43 C208 49 248 57 291 80"
        fill="none"
        stroke="#72C4E6"
        strokeWidth={PIPE_STROKE_WIDTH}
        strokeLinecap="round"
      />

      {particles.map((particle, index) => {
        const progress = (time * particle.speed + particle.offset) % 1;
        const branch = particle.branchSeed < splitRatio ? "left" : "right";
        const point = getParticlePosition(progress, branch);
        return (
          <circle
            key={index}
            cx={point.x}
            cy={point.y}
            r={particle.size}
            fill={
              branch === "left"
                ? withAlpha(SAVINGS_VALUE_COLOR, particle.opacity)
                : `rgba(114,196,230,${particle.opacity})`
            }
          />
        );
      })}
    </svg>
  );
}

export function SavingsClient({
  accountId,
  baseCurrency,
  currencySymbol,
  locale,
  canEdit,
}: SavingsClientProps) {
  const supabase = useMemo(() => createClient(), []);
  const { emitMutation } = useWebDataCache();
  const t = useTranslations();
  const ownFundsLabel = t("home.savings.hucha");
  const currentMonthKey = useMemo(() => toMonthKey(new Date()), []);
  const previousMonthKey = useMemo(() => {
    const date = new Date(`${currentMonthKey}-01T00:00:00`);
    date.setMonth(date.getMonth() - 1);
    return toMonthKey(date);
  }, [currentMonthKey]);
  const currentMonthStart = `${currentMonthKey}-01`;

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
  const [, setLoading] = useState(true);
  const [isSavingPlan, setIsSavingPlan] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const loadMonthState = useCallback(async () => {
    const { data, error: rpcError } = await supabase.rpc("get_savings_month_state", {
      p_account_id: accountId,
      p_period: currentMonthStart,
    });

    if (rpcError) throw rpcError;
    return data as SavingsMonthStateRow | null;
  }, [accountId, currentMonthStart, supabase]);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const monthRange = getMonthRangeFromKey(currentMonthKey);

      const [
        projectsResult,
        reserveContainersResult,
        monthClosesResult,
        monthCloseAllocationsResult,
        reserveTransfersResult,
        transactionsResult,
        monthStateResult,
      ] = await Promise.all([
        supabase
          .from("projects")
          .select("*")
          .eq("account_id", accountId)
          .not("target_amount_base_minor", "is", null)
          .eq("status", "active")
          .order("priority", { ascending: true })
          .order("created_at", { ascending: true }),
        supabase
          .from("reserve_containers")
          .select("*")
          .eq("account_id", accountId)
          .eq("status", "active")
          .order("created_at", { ascending: true }),
        supabase
          .from("month_closes")
          .select("*")
          .eq("account_id", accountId)
          .order("period", { ascending: false }),
        supabase
          .from("month_close_allocations")
          .select("*")
          .eq("account_id", accountId),
        supabase
          .from("reserve_transfers")
          .select("*")
          .eq("account_id", accountId)
          .order("created_at", { ascending: false }),
        supabase
          .from("transactions")
          .select("id, type, amount_minor, amount_base_minor, date")
          .eq("account_id", accountId)
          .gte("date", monthRange.start)
          .lte("date", monthRange.end)
          .order("date", { ascending: true }),
        loadMonthState(),
      ]);

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

      const nextProjects = (projectsResult.data ?? []) as Project[];
      const nextMonthState = monthStateResult;

      setProjects(nextProjects);
      setReserveContainers((reserveContainersResult.data ?? []) as ReserveContainer[]);
      setMonthCloses((monthClosesResult.data ?? []) as MonthClose[]);
      setMonthCloseAllocations((monthCloseAllocationsResult.data ?? []) as MonthCloseAllocation[]);
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
            baseCurrency
          );
        });
        return next;
      });
    } catch (loadError) {
      console.error("[Savings][web] load error", loadError);
      setError(t("home.savings.loadError"));
    } finally {
      setLoading(false);
    }
  }, [accountId, baseCurrency, currentMonthKey, loadMonthState, supabase, t]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

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
            account_id: accountId,
            period: currentMonthStart,
            project_id: plan.project_id,
            planned_amount_base_minor: plan.planned_amount_base_minor,
          })) as MonthlyProjectFundingPlan[],
        monthClose:
          monthCloses.find((monthClose) => String(monthClose.period).slice(0, 7) === currentMonthKey) ??
          null,
      }),
    [accountId, currentMonthKey, currentMonthStart, monthCloses, monthState?.plans, transactions]
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
  const displayedMonthCloseLabel = formatMonthLabel(displayedMonthCloseKey, locale);
  const displayedMonthCloseDate = formatClosedAt(displayedMonthClose?.closed_at, locale);
  const displayedMonthCloseAuthor =
    (displayedMonthClose?.closed_by
      ? profilesByUserId[displayedMonthClose.closed_by]?.display_name?.trim() ||
        profilesByUserId[displayedMonthClose.closed_by]?.email?.trim() ||
        null
      : null) ?? (locale === "en" ? "A team member" : "un miembro del equipo");
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
          error: t(parsed.error.key, parsed.error.params),
        };
      }

      return { projectId: project.id, amountMinor: parsed, error: null as string | null };
    });

    const totalMinor = rows.reduce((total, row) => total + row.amountMinor, 0n);
    return {
      rows,
      totalMinor,
      hasErrors: rows.some((row) => row.error !== null),
    };
  }, [baseCurrency, inputsByProject, projects, t]);

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
    const monthFormatter = new Intl.DateTimeFormat(locale === "en" ? "en-US" : "es-ES", {
      month: "short",
    });
    const valueFormatter = new Intl.NumberFormat(locale === "en" ? "en-US" : "es-ES", {
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
    const maxMinor = allValues.reduce((current, amountMinor) => (amountMinor > current ? amountMinor : current), 0n);

    const bars = Array.from({ length: 8 }, (_, index) => {
      const period = shiftMonthKey(currentMonthKey, index - 7);
      const amountMinor = byPeriod.get(period) ?? 0n;
      const date = new Date(`${period}-01T00:00:00`);
      const label = monthFormatter.format(date).replace(".", "").slice(0, 2);
      return {
        period,
        amountMinor,
        label,
      };
    });

    return {
      averageMinor,
      maxMinor,
      previousMinor: byPeriod.get(previousMonthKey) ?? 0n,
      currentLabel:
        locale === "en"
          ? `monthly savings · ${new Intl.DateTimeFormat("en-US", { month: "long" })
              .format(new Date(`${currentMonthKey}-01T00:00:00`))
              .toLowerCase()}`
          : `ahorro del mes · ${new Intl.DateTimeFormat("es-ES", { month: "long" })
              .format(new Date(`${currentMonthKey}-01T00:00:00`))
              .toLowerCase()}`,
      formatNumber: (amountMinor: bigint) => valueFormatter.format(Number(amountMinor) / 100),
      bars,
    };
  }, [currentMonthKey, locale, monthCloses, previousMonthKey, savingsView.generatedSavedMinor]);

  const projectSplitRatio = useMemo(() => {
    if (savingsView.generatedSavedMinor <= 0n) return 0.5;
    return Math.min(1, Math.max(0.14, Number(parsedPlans.totalMinor) / Number(savingsView.generatedSavedMinor)));
  }, [parsedPlans.totalMinor, savingsView.generatedSavedMinor]);

  const canSavePlan =
    canEdit &&
    !parsedPlans.hasErrors &&
    parsedPlans.totalMinor <= (savingsView.generatedSavedMinor > 0n ? savingsView.generatedSavedMinor : 0n) &&
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
    if (!canSavePlan || isSavingPlan) return;

    setIsSavingPlan(true);
    setError(null);
    setMessage(null);

    try {
      const payload = parsedPlans.rows.map((row) => ({
        project_id: row.projectId,
        planned_amount_base_minor: row.amountMinor.toString(),
      }));

      const { error: rpcError } = await supabase.rpc("replace_monthly_project_funding_plans", {
        p_account_id: accountId,
        p_period: currentMonthStart,
        p_plans: payload,
      });

      if (rpcError) throw rpcError;

      await emitMutation("monthly_project_funding_plans", "upsert");
      setMessage(
        locale === "en"
          ? "Monthly plan updated."
          : "Plan mensual actualizado."
      );
      await loadData();
    } catch (saveError) {
      console.error("[Savings][web] save plan error", saveError);
      setError(
        locale === "en"
          ? "Couldn't save the monthly plan."
          : "No se pudo guardar el plan mensual."
      );
    } finally {
      setIsSavingPlan(false);
    }
  };

  return (
    <PageContainer className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          {locale === "en" ? "Home" : "Inicio"}
        </Link>
      </div>

      <section className="px-1 pb-6 pt-2 sm:px-2">
        <div className="flex flex-col items-center pt-3">
            <div
              className="flex items-center justify-center rounded-full"
              style={{ width: 112, height: 112, boxShadow: "0 14px 42px rgba(78,205,196,0.28)" }}
            >
              <SavingsBucketHero
                valueMinor={savingsView.generatedSavedMinor > 0n ? savingsView.generatedSavedMinor : 0n}
                maxMinor={savingsHistory.maxMinor > 0n ? savingsHistory.maxMinor : savingsView.generatedSavedMinor}
                size={98}
              />
            </div>
            <h1
              className="mt-3 text-center text-[40px] font-light tracking-[-0.04em]"
              style={{ color: SAVINGS_VALUE_COLOR }}
            >
              {formatMoneyWithSymbol(savingsView.generatedSavedMinor, baseCurrency, currencySymbol)}
            </h1>
            <p className="mt-2 text-center text-[13px] text-muted-foreground">
              {savingsHistory.currentLabel}
            </p>

            <div className="mt-3 flex flex-col items-center">
              <SavingsPipes splitRatio={projectSplitRatio} />
              <div className="mt-1 flex flex-wrap items-center justify-center gap-4 text-[11px] text-muted-foreground">
                <span className="inline-flex items-center gap-1.5">
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: SAVINGS_VALUE_COLOR }}
                  />
                  {locale === "en" ? "funds projects" : "financia proyectos"}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-[#72C4E6]" />
                  {locale === "en" ? "Own Funds reserve" : "reserva de Fondos Propios"}
                </span>
              </div>
            </div>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <Card className="h-[360px] rounded-[24px] border-border bg-card shadow-[0_12px_34px_rgba(28,30,33,0.08)]">
            <CardContent className="flex h-full flex-col overflow-hidden p-4">
              {selectedOverviewProject ? (
                <div className="flex h-full min-h-0 flex-col">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                        {locale === "en" ? "Projects" : "Proyectos"}
                      </p>
                      <p className="mt-3 text-[15px] font-semibold text-foreground">
                        {selectedOverviewProject.project.emoji || "🎯"}{" "}
                        {selectedOverviewProject.project.name}
                      </p>
                      <p className="mt-1 text-[12px] text-muted-foreground">
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
                      </p>
                    </div>
                    <div className="flex items-start gap-2">
                      <p
                        className="pt-2 text-[14px] font-bold"
                        style={{ color: getProjectColor(selectedOverviewProject.project) }}
                      >
                        {Math.round(selectedOverviewProject.progress.progressRatio * 100)}%
                      </p>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => setSelectedOverviewProjectId(null)}
                        aria-label={
                          locale === "en" ? "Back to projects" : "Volver a proyectos"
                        }
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  <div className="mt-6 flex-1 min-h-0 overflow-y-auto pr-1">
                    <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_180px_auto] sm:items-end">
                      <div>
                        <p className="text-[11px] text-muted-foreground">
                          {locale === "en" ? "Funding target" : "Objetivo mensual"}
                        </p>
                        <p className="mt-1 text-sm font-medium text-foreground">
                          {formatMoneyWithSymbol(
                            getProjectMonthlyFundingTargetMinor(selectedOverviewProject.project),
                            baseCurrency,
                            currencySymbol
                          )}
                        </p>
                      </div>
                      <div>
                        <label className="text-[11px] text-muted-foreground">
                          {locale === "en" ? "Planned this month" : "Planificado este mes"}
                        </label>
                        <Input
                          value={inputsByProject[selectedOverviewProject.project.id] ?? ""}
                          onChange={(event) =>
                            handleInputChange(selectedOverviewProject.project.id, event.target.value)
                          }
                          inputMode="decimal"
                          placeholder="0"
                          readOnly={Boolean(editingBlockedReason)}
                          aria-readonly={Boolean(editingBlockedReason)}
                        />
                      </div>
                      <Button
                        onClick={handleSavePlan}
                        disabled={!canSavePlan || isSavingPlan}
                        className="sm:min-w-[132px]"
                      >
                        {isSavingPlan
                          ? locale === "en"
                            ? "Saving..."
                            : "Guardando..."
                          : locale === "en"
                            ? "Save plan"
                            : "Guardar plan"}
                      </Button>
                    </div>

                    {selectedOverviewPlan?.error ? (
                      <p className="mt-2 text-sm text-destructive">{selectedOverviewPlan.error}</p>
                    ) : null}
                    {!selectedOverviewPlan?.error && editingBlockedReason ? (
                      <p className="mt-2 text-xs text-muted-foreground">{editingBlockedReason}</p>
                    ) : null}
                    {error ? <p className="mt-3 text-sm text-destructive">{error}</p> : null}
                    {message ? <p className="mt-3 text-sm text-emerald-600">{message}</p> : null}
                  </div>

                  <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4 text-[12px]">
                    <p className="text-muted-foreground">
                      {locale === "en" ? "Planned total" : "Total planificado"}:{" "}
                      <span className="font-semibold text-foreground">
                        {formatMoneyWithSymbol(parsedPlans.totalMinor, baseCurrency, currencySymbol)}
                      </span>
                    </p>
                    <p className="text-muted-foreground">
                      {locale === "en" ? "Projected to Own Funds" : "Previsto para Fondos Propios"}:{" "}
                      <span className="font-semibold text-foreground">
                        {formatMoneyWithSymbol(monthlyHuchaMinor, baseCurrency, currencySymbol)}
                      </span>
                    </p>
                  </div>
                </div>
              ) : (
                <>
                  <p className="mb-4 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                    {locale === "en" ? "Projects" : "Proyectos"}
                  </p>
                  {savingsOverviewProjects.length > 0 ? (
                    <div className="-mx-1 overflow-x-auto pb-1">
                      <div className="flex min-w-max gap-3 px-1">
                        {savingsOverviewProjects.map(({ project, progress, displayMinor }) => (
                          <button
                            key={project.id}
                            type="button"
                            onClick={() => setSelectedOverviewProjectId(project.id)}
                            className="flex min-h-[178px] w-[142px] shrink-0 flex-col items-center rounded-[18px] border px-3 py-4 text-center shadow-[0_8px_20px_rgba(28,30,33,0.05)] transition"
                            style={{
                              backgroundColor: "hsl(var(--secondary) / 0.5)",
                              boxShadow: "0 8px 20px rgba(28,30,33,0.05)",
                            }}
                          >
                            <ProjectProgressRing
                              size={58}
                              progress={progress.progressRatio}
                              progressColor={getProjectColor(project)}
                              strokeWidth={4}
                              center={<span className="text-[18px]">{project.emoji || "🎯"}</span>}
                            />
                            <p className="mt-3 line-clamp-2 min-h-[36px] text-[14px] font-semibold leading-[1.2] text-foreground">
                              {project.name}
                            </p>
                            <p className="mt-1 text-[12px] text-muted-foreground">
                              {formatMoneyWithSymbol(displayMinor, baseCurrency, currencySymbol)}/mes
                            </p>
                            <p
                              className="mt-2 text-[14px] font-bold"
                              style={{ color: getProjectColor(project) }}
                            >
                              {Math.round(progress.progressRatio * 100)}%
                            </p>
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      {locale === "en"
                        ? "Create at least one project to start assigning savings."
                        : "Crea al menos un proyecto para empezar a asignar ahorro."}
                    </p>
                  )}

                  {error ? <p className="mt-3 text-sm text-destructive">{error}</p> : null}
                  {message ? <p className="mt-3 text-sm text-emerald-600">{message}</p> : null}

                  <div className="mt-4 flex items-center justify-between border-t border-border px-1 pt-3">
                    <span className="max-w-[110px] text-[11px] font-medium text-muted-foreground">
                      {locale === "en" ? "Planned to projects" : "Planificado a proyectos"}{" "}
                      {/* TODO: i18n */}
                    </span>
                    <span
                      className="text-[13px] font-bold tabular-nums"
                      style={{ color: SAVINGS_VALUE_COLOR }}
                    >
                      {formatMoneyWithSymbol(parsedPlans.totalMinor, baseCurrency, currencySymbol)}/mes
                    </span>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          <Card className="h-[360px] rounded-[24px] border-border bg-secondary shadow-[0_12px_34px_rgba(28,30,33,0.06)]">
            <CardContent className="flex h-full min-h-[240px] flex-col items-center justify-center p-4">
              {huchaReserve ? (
                <Link
                  href={`/reserves/${huchaReserve.id}`}
                  className="relative block transition-transform hover:scale-[1.02]"
                  style={{ width: 72, height: 72 }}
                  aria-label={
                    locale === "en" ? "Open Own Funds reserve" : "Abrir Fondos Propios"
                  }
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
                  <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                    <span
                      className="text-[12px] font-bold leading-none tabular-nums text-foreground"
                    >
                      {formatMoneyWithSymbol(monthlyHuchaMinor, baseCurrency, currencySymbol)}
                    </span>
                  </div>
                </Link>
              ) : (
                <div className="relative" style={{ width: 72, height: 72 }}>
                  <HuchaLiquidCanvas
                    valueMinor={monthlyHuchaMinor}
                    maxMinor={
                      savingsView.generatedSavedMinor > 0n
                        ? savingsView.generatedSavedMinor
                        : monthlyHuchaMinor
                    }
                    size={72}
                  />
                  <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                    <span
                      className="text-[12px] font-bold leading-none tabular-nums text-foreground"
                    >
                      {formatMoneyWithSymbol(monthlyHuchaMinor, baseCurrency, currencySymbol)}
                    </span>
                  </div>
                </div>
              )}
              <p className="mt-4 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                {ownFundsLabel}
              </p>
              <p className="mt-1 text-center text-[12px] text-muted-foreground">
                {locale === "en" ? "month remainder" : "remanente del mes"}
              </p>
            </CardContent>
          </Card>
        </div>

        <Card className="mt-4 rounded-[24px] border-primary/30 bg-transparent shadow-none">
          <CardContent className="p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-primary">
              {locale === "en" ? "Month close" : "Cierre mensual"}
            </p>
            <p className="mt-2 text-[18px] font-semibold text-foreground">
              {displayedMonthCloseLabel}
            </p>

            {monthCloseActionMonthKey ? (
              <>
                <p className="mt-3 text-[13px] leading-5 text-muted-foreground">
                  {locale === "en"
                    ? "This month is ready to review and confirm."
                    : "Este mes ya está listo para revisar y confirmar."}
                </p>
                <Button
                  asChild
                  variant="outline"
                  className="mt-4 border-primary/30 bg-transparent"
                >
                  <Link href={`/projects/month-close?month=${monthCloseActionMonthKey}`}>
                    <RefreshCcw className="mr-2 h-4 w-4" />
                    {t("projects.monthClose.reviewCta")}
                  </Link>
                </Button>
              </>
            ) : (
              <div className="mt-3 space-y-2 text-[13px] leading-5 text-muted-foreground">
                <p className="font-medium text-foreground">
                  {locale === "en" ? "Month already closed" : "Mes ya cerrado"}
                </p>
                {displayedMonthCloseDate ? (
                  <p>
                    {locale === "en"
                      ? `Closed on ${displayedMonthCloseDate}.`
                      : `Cerrado el ${displayedMonthCloseDate}.`}
                  </p>
                ) : null}
                <p>
                  {locale === "en"
                    ? `Closed by ${displayedMonthCloseAuthor}.`
                    : `Cerrado por ${displayedMonthCloseAuthor}.`}
                </p>
              </div>
            )}
          </CardContent>
        </Card>

      </section>

      {savingsView.needsRebalance ? (
        <Card className="border-orange-300/60 bg-orange-50/50">
          <CardContent className="space-y-1 p-4 text-sm text-orange-900">
            <p className="font-medium">
              {locale === "en" ? "Rebalance required" : "Necesita ajuste"}
            </p>
            <p>
              {locale === "en"
                ? "Recent spending reduced the available savings. Lower the monthly plan before closing."
                : "Nuevos gastos han reducido el ahorro disponible. Baja el plan mensual antes de cerrar."}
            </p>
          </CardContent>
        </Card>
      ) : null}

    </PageContainer>
  );
}
