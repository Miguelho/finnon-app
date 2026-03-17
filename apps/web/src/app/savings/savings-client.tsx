"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import {
  computeSavingsMonthFromTransactions,
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
  type RecurringItem,
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
import { useWebUserTheme } from "@/components/theme/web-user-theme-provider";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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

const SAVINGS_VALUE_COLOR = semanticColorTokens.savings.primary;

const HUCHA_ACCENT_COLOR = "#48D89F";
const PROJECTS_ACCENT_COLOR = SAVINGS_VALUE_COLOR;
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

export function SavingsClient({
  accountId,
  baseCurrency,
  currencySymbol,
  locale,
  canEdit,
}: SavingsClientProps) {
  const supabase = useMemo(() => createClient(), []);
  const { emitMutation } = useWebDataCache();
  const { tokens: themeTokens } = useWebUserTheme();
  const t = useTranslations();
  const ownFundsLabel = t("home.savings.hucha");
  const currentMonthKey = useMemo(() => toMonthKey(new Date()), []);
  const currentMonthStart = `${currentMonthKey}-01`;

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
        recurringItemsResult,
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
          .from("recurring_items")
          .select("*")
          .eq("account_id", accountId)
          .order("merchant", { ascending: true }),
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

      const nextProjects = (projectsResult.data ?? []) as Project[];
      const nextMonthState = monthStateResult;

      setProjects(nextProjects);
      setReserveContainers((reserveContainersResult.data ?? []) as ReserveContainer[]);
      setMonthCloses((monthClosesResult.data ?? []) as MonthClose[]);
      setMonthCloseAllocations((monthCloseAllocationsResult.data ?? []) as MonthCloseAllocation[]);
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
    parsedPlans.totalMinor <= positiveSavingsMinor &&
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
        <div className="mx-auto max-w-4xl">
          <div className="flex flex-col items-center px-2 pb-2 pt-4 text-center">
            <div
              className="flex items-center justify-center rounded-full"
              style={{
                width: 112,
                height: 112,
                background: `radial-gradient(circle at 50% 40%, ${withAlpha(
                  SUPPORT_ACCENT_COLOR,
                  0.16
                )}, transparent 72%)`,
              }}
            >
              <SavingsBucketHero
                valueMinor={positiveSavingsMinor}
                maxMinor={savingsHistory.maxMinor > 0n ? savingsHistory.maxMinor : positiveSavingsMinor}
                size={98}
              />
            </div>
            <h1
              className="mt-4 text-center text-[38px] font-bold tracking-[-0.05em] sm:text-[44px]"
              style={{ color: themeTokens.textPrimary }}
            >
              {formatMoneyWithSymbol(positiveSavingsMinor, baseCurrency, currencySymbol)}
            </h1>
            <p className="mt-1 text-[13px]" style={{ color: themeTokens.textSecondary }}>
              {locale === "en" ? `savings capacity · ${displayedMonthCloseLabel}` : `capacidad de ahorro · ${displayedMonthCloseLabel}`}
            </p>
          </div>

          <div className="mt-4 flex justify-center">
            <div
              className="inline-flex flex-wrap items-center justify-center gap-2 rounded-[12px] border px-4 py-3 text-center text-[13px] font-medium"
              style={{
                backgroundColor: themeTokens.surface,
                borderColor: themeTokens.border,
                color: themeTokens.textTertiary,
              }}
            >
              <span style={{ color: SUPPORT_ACCENT_COLOR }}>
                {formatMoneyWithSymbol(monthlyTotals.incomeMinor, baseCurrency, currencySymbol)}{" "}
                {locale === "en" ? "income" : "ingresos"}
              </span>
              <span aria-hidden="true">−</span>
              <span style={{ color: themeTokens.dangerText }}>
                {formatMoneyWithSymbol(monthlyTotals.expenseMinor, baseCurrency, currencySymbol)}{" "}
                {locale === "en" ? "fixed expenses" : "gastos fijos"}
              </span>
              <span aria-hidden="true">=</span>
              <span style={{ color: themeTokens.textPrimary }}>
                {formatMoneyWithSymbol(positiveSavingsMinor, baseCurrency, currencySymbol)}
              </span>
            </div>
          </div>

          <div className="mt-10">
            <div className="mb-4 flex items-center justify-between px-1">
              <h2
                className="text-[12px] font-semibold uppercase tracking-[0.12em]"
                style={{ color: themeTokens.textSecondary }}
              >
                {locale === "en" ? "Savings distribution" : "Distribucion del ahorro"}
              </h2>
            </div>

            <div className="px-1">
              <div
                className="h-7 overflow-hidden rounded-[10px]"
                style={{ backgroundColor: themeTokens.surfaceAlt }}
              >
                <div className="flex h-full w-full">
                  <div
                    className="h-full transition-all"
                    style={{
                      width: `${distribution.projectsPct}%`,
                      backgroundColor: PROJECTS_ACCENT_COLOR,
                    }}
                  />
                  <div
                    className="h-full transition-all"
                    style={{
                      width: `${distribution.huchaPct}%`,
                      backgroundColor: withAlpha(HUCHA_ACCENT_COLOR, 0.42),
                    }}
                  />
                </div>
              </div>

              <div
                className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-[12px]"
                style={{ color: themeTokens.textSecondary }}
              >
                <span className="inline-flex items-center gap-2">
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: PROJECTS_ACCENT_COLOR }}
                  />
                  {locale === "en" ? "Projects" : "Proyectos"} ·{" "}
                  {formatMoneyWithSymbol(parsedPlans.totalMinor, baseCurrency, currencySymbol)}
                </span>
                <span className="inline-flex items-center gap-2">
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: withAlpha(HUCHA_ACCENT_COLOR, 0.65) }}
                  />
                  {ownFundsLabel} ·{" "}
                  {formatMoneyWithSymbol(monthlyHuchaMinor, baseCurrency, currencySymbol)}
                </span>
              </div>
            </div>
          </div>

          <div className="mt-7">
            {savingsOverviewProjects.length > 0 ? (
              <div className="-mx-1 overflow-x-auto pb-2">
                <div className="flex min-w-max gap-3 px-1">
                  {savingsOverviewProjects.map(({ project, progress }) => {
                    const plannedMinor =
                      parsedPlans.rows.find((row) => row.projectId === project.id)?.amountMinor ?? 0n;
                    const commitmentMinor = getProjectMonthlyFundingTargetMinor(project);
                    const monthlyProgress =
                      commitmentMinor > 0n
                        ? Math.min(1, Number(plannedMinor) / Number(commitmentMinor))
                        : 0;

                    return (
                      <button
                        key={project.id}
                        type="button"
                        onClick={() => setSelectedOverviewProjectId(project.id)}
                        className="w-[216px] shrink-0 rounded-[18px] border p-4 text-left transition hover:-translate-y-0.5"
                        style={{
                          backgroundColor: themeTokens.surface,
                          borderColor: themeTokens.border,
                          boxShadow: "0 12px 32px rgba(17, 24, 39, 0.06)",
                        }}
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className="flex h-10 w-10 items-center justify-center rounded-[12px] text-[20px]"
                            style={{ backgroundColor: themeTokens.surfaceAlt }}
                          >
                            {project.emoji || "🎯"}
                          </div>
                          <div className="min-w-0">
                            <p
                              className="truncate text-[14px] font-semibold"
                              style={{ color: themeTokens.textPrimary }}
                            >
                              {project.name}
                            </p>
                            <p className="text-[12px]" style={{ color: themeTokens.textSecondary }}>
                              {formatMoneyWithSymbol(commitmentMinor, baseCurrency, currencySymbol)}/
                              {locale === "en" ? "month" : "mes"}
                            </p>
                          </div>
                        </div>

                        <div className="mt-4">
                          <div
                            className="mb-2 flex items-center justify-between text-[11px]"
                            style={{ color: themeTokens.textSecondary }}
                          >
                            <span>{locale === "en" ? "This month" : "Este mes"}</span>
                            <span style={{ color: PROJECTS_ACCENT_COLOR, fontWeight: 700 }}>
                              {formatMoneyWithSymbol(plannedMinor, baseCurrency, currencySymbol)} /{" "}
                              {formatMoneyWithSymbol(commitmentMinor, baseCurrency, currencySymbol)}
                            </span>
                          </div>
                          <div
                            className="h-1 rounded-full"
                            style={{ backgroundColor: themeTokens.surfaceAlt }}
                          >
                            <div
                              className="h-full rounded-full"
                              style={{
                                width: `${Math.max(0, Math.min(100, monthlyProgress * 100))}%`,
                                backgroundColor: PROJECTS_ACCENT_COLOR,
                              }}
                            />
                          </div>
                        </div>

                        <div
                          className="mt-4 flex items-center justify-between border-t pt-3 text-[11px]"
                          style={{ borderColor: themeTokens.border, color: themeTokens.textTertiary }}
                        >
                          <span>{locale === "en" ? "Total progress" : "Total acumulado"}</span>
                          <span style={{ color: SUPPORT_ACCENT_COLOR, fontWeight: 700, fontSize: 12 }}>
                            {Math.round(progress.progressRatio * 100)}%
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : (
              <Card
                className="rounded-[18px] shadow-none"
                style={{ backgroundColor: themeTokens.surface, borderColor: themeTokens.border }}
              >
                <CardContent className="p-5 text-sm" style={{ color: themeTokens.textSecondary }}>
                  {locale === "en"
                    ? "Create at least one project to start assigning savings."
                    : "Crea al menos un proyecto para empezar a asignar ahorro."}
                </CardContent>
              </Card>
            )}
          </div>

          <div className="mt-4 px-1">
            <Link
              href="/projects"
              className="text-[13px] font-medium"
              style={{ color: PROJECTS_ACCENT_COLOR }}
            >
              {locale === "en" ? "See all projects →" : "Ver todos los proyectos →"}
            </Link>
          </div>

          <div className="mt-4">
            {huchaReserve ? (
              <Link
                href={`/reserves/${huchaReserve.id}`}
                className="block rounded-[18px] border px-5 py-4 transition hover:-translate-y-0.5"
                style={{
                  backgroundColor: themeTokens.surface,
                  borderColor: themeTokens.border,
                  boxShadow: "0 12px 32px rgba(17, 24, 39, 0.05)",
                }}
              >
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div
                      className="relative h-11 w-11 overflow-hidden rounded-full"
                      style={{
                        backgroundColor: withAlpha(HUCHA_ACCENT_COLOR, 0.12),
                        boxShadow: "0 0 20px rgba(72,216,159,0.16)",
                      }}
                    >
                      <HuchaLiquidCanvas
                        valueMinor={monthlyHuchaMinor}
                        maxMinor={positiveSavingsMinor > 0n ? positiveSavingsMinor : monthlyHuchaMinor}
                        size={44}
                      />
                    </div>
                    <div>
                      <p
                        className="text-[11px] font-semibold uppercase tracking-[0.08em]"
                        style={{ color: withAlpha(HUCHA_ACCENT_COLOR, 0.8) }}
                      >
                        {ownFundsLabel}
                      </p>
                      <p className="text-[12px]" style={{ color: themeTokens.textTertiary }}>
                        {locale === "en" ? "month remainder" : "excedente del mes"}
                      </p>
                    </div>
                  </div>
                  <p
                    className="text-[24px] font-bold tracking-[-0.03em]"
                    style={{ color: HUCHA_ACCENT_COLOR }}
                  >
                    {formatMoneyWithSymbol(monthlyHuchaMinor, baseCurrency, currencySymbol)}
                  </p>
                </div>
              </Link>
            ) : null}
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Card
              className="rounded-[16px] shadow-none"
              style={{ backgroundColor: themeTokens.surface, borderColor: themeTokens.border }}
            >
              <CardContent className="p-5">
                <p
                  className="text-[11px] uppercase tracking-[0.06em]"
                  style={{ color: themeTokens.textTertiary }}
                >
                  {locale === "en" ? "Committed to projects" : "Comprometido a proyectos"}
                </p>
                <p
                  className="mt-2 text-[24px] font-bold tracking-[-0.04em]"
                  style={{ color: PROJECTS_ACCENT_COLOR }}
                >
                  {formatMoneyWithSymbol(parsedPlans.totalMinor, baseCurrency, currencySymbol)}
                  <span className="ml-1 text-[14px] font-normal" style={{ color: themeTokens.textTertiary }}>
                    /{locale === "en" ? "month" : "mes"}
                  </span>
                </p>
                <p className="mt-1 text-[11px]" style={{ color: themeTokens.textTertiary }}>
                  <span style={{ color: SUPPORT_ACCENT_COLOR, fontWeight: 700 }}>
                    {distribution.projectsShare.toFixed(1)}%
                  </span>{" "}
                  {locale === "en"
                    ? "of your monthly savings capacity"
                    : "de tu capacidad de ahorro"}
                </p>
              </CardContent>
            </Card>

            <Card
              className="rounded-[16px] shadow-none"
              style={{ backgroundColor: themeTokens.surface, borderColor: themeTokens.border }}
            >
              <CardContent className="p-5">
                <p
                  className="text-[11px] uppercase tracking-[0.06em]"
                  style={{ color: themeTokens.textTertiary }}
                >
                  {locale === "en" ? "Monthly commitment goal" : "Objetivo mensual total"}
                </p>
                <p
                  className="mt-2 text-[24px] font-bold tracking-[-0.04em]"
                  style={{ color: SUPPORT_ACCENT_COLOR }}
                >
                  {formatMoneyWithSymbol(monthlyCommitmentTotalMinor, baseCurrency, currencySymbol)}
                </p>
                <p className="mt-1 text-[11px]" style={{ color: themeTokens.textTertiary }}>
                  <span style={{ color: SUPPORT_ACCENT_COLOR, fontWeight: 700 }}>
                    {distribution.commitmentsCoverage.toFixed(1)}%
                  </span>{" "}
                  {locale === "en"
                    ? "covered by the current plan"
                    : "cubierto por el plan actual"}
                </p>
              </CardContent>
            </Card>
          </div>

          <div className="mt-4">
            <Link
              href="/transaction/recurrent"
              className="block rounded-[18px] border px-5 py-4 transition hover:-translate-y-0.5"
              style={{
                backgroundColor: themeTokens.surface,
                borderColor: themeTokens.border,
                boxShadow: "0 12px 32px rgba(17, 24, 39, 0.05)",
              }}
            >
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div
                    className="flex h-10 w-10 items-center justify-center rounded-[12px]"
                    style={{ backgroundColor: withAlpha(themeTokens.dangerText, 0.1) }}
                  >
                    <RefreshCcw
                      className="h-4 w-4"
                      style={{ color: themeTokens.dangerText }}
                    />
                  </div>
                  <div>
                    <p
                      className="text-[13px] font-semibold"
                      style={{ color: themeTokens.textPrimary }}
                    >
                      {locale === "en" ? "Fixed expenses" : "Gastos fijos"}
                    </p>
                    <p className="text-[12px]" style={{ color: themeTokens.textTertiary }}>
                      {locale === "en"
                        ? `${activeExpenseRecurringItems.length} active recurring items`
                        : `${activeExpenseRecurringItems.length} recurrentes activos`}
                    </p>
                  </div>
                </div>
                <p
                  className="text-right text-[22px] font-bold tracking-[-0.03em]"
                  style={{ color: themeTokens.dangerText }}
                >
                  {formatMoneyWithSymbol(recurringExpenseTotalMinor, baseCurrency, currencySymbol)}
                  <span className="text-[13px] font-normal" style={{ color: themeTokens.textTertiary }}>
                    /{locale === "en" ? "month" : "mes"}
                  </span>
                </p>
              </div>
            </Link>
          </div>

          {error ? <p className="mt-4 text-sm text-destructive">{error}</p> : null}
          {message ? <p className="mt-2 text-sm text-emerald-600">{message}</p> : null}

          <Card className="mt-5 rounded-[24px] border-primary/30 bg-transparent shadow-none">
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
        </div>
      </section>

      <Dialog
        open={selectedOverviewProject !== null}
        onOpenChange={(open) => {
          if (!open) setSelectedOverviewProjectId(null);
        }}
      >
        {selectedOverviewProject ? (
          <DialogContent
            className="max-w-[560px] rounded-[24px] border p-0"
            style={{ backgroundColor: themeTokens.surface, borderColor: themeTokens.border }}
          >
            <div className="p-6">
              <div className="mb-4 flex items-start justify-between gap-3">
                <DialogHeader className="space-y-2 text-left">
                  <p
                    className="text-[11px] font-semibold uppercase tracking-[0.12em]"
                    style={{ color: themeTokens.textSecondary }}
                  >
                    {locale === "en" ? "Projects" : "Proyectos"}
                  </p>
                  <DialogTitle style={{ color: themeTokens.textPrimary }}>
                    {selectedOverviewProject.project.emoji || "🎯"} {selectedOverviewProject.project.name}
                  </DialogTitle>
                  <DialogDescription style={{ color: themeTokens.textSecondary }}>
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
                  </DialogDescription>
                </DialogHeader>
                <div className="flex items-center gap-2">
                  <p
                    className="text-[14px] font-bold"
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
                    aria-label={locale === "en" ? "Close" : "Cerrar"}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div
                className="rounded-[20px] border p-4"
                style={{
                  backgroundColor: withAlpha(themeTokens.background, 0.55),
                  borderColor: themeTokens.border,
                }}
              >
                <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_180px_auto] sm:items-end">
                  <div>
                    <p className="text-[11px]" style={{ color: themeTokens.textSecondary }}>
                      {locale === "en" ? "Funding target" : "Objetivo mensual"}
                    </p>
                    <p className="mt-1 text-sm font-medium" style={{ color: themeTokens.textPrimary }}>
                      {formatMoneyWithSymbol(
                        getProjectMonthlyFundingTargetMinor(selectedOverviewProject.project),
                        baseCurrency,
                        currencySymbol
                      )}
                    </p>
                  </div>
                  <div>
                    <label className="text-[11px]" style={{ color: themeTokens.textSecondary }}>
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
                  <p className="mt-2 text-xs" style={{ color: themeTokens.textSecondary }}>
                    {editingBlockedReason}
                  </p>
                ) : null}

                <div
                  className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t pt-4 text-[12px]"
                  style={{ borderColor: themeTokens.border, color: themeTokens.textSecondary }}
                >
                  <p>
                    {locale === "en" ? "Planned total" : "Total planificado"}:{" "}
                    <span style={{ color: themeTokens.textPrimary, fontWeight: 700 }}>
                      {formatMoneyWithSymbol(parsedPlans.totalMinor, baseCurrency, currencySymbol)}
                    </span>
                  </p>
                  <p>
                    {locale === "en" ? "Projected to Own Funds" : "Previsto para Fondos Propios"}:{" "}
                    <span style={{ color: themeTokens.textPrimary, fontWeight: 700 }}>
                      {formatMoneyWithSymbol(monthlyHuchaMinor, baseCurrency, currencySymbol)}
                    </span>
                  </p>
                </div>
              </div>
            </div>
          </DialogContent>
        ) : null}
      </Dialog>

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
