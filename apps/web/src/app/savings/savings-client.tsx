"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import {
  computePendingMonthCloseKeysFromMonthCloses,
  computeProjectProgress,
  computeSavingsMonthView,
  formatMinorToMoney,
  formatMoneyWithSymbol,
  getProjectColor,
  getProjectMonthlyFundingTargetMinor,
  getReserveContainerBalanceMinor,
  getMonthRangeFromKey,
  parseMoneyToMinor,
  toMonthKey,
  type MonthClose,
  type MonthCloseAllocation,
  type MonthlyProjectFundingPlan,
  type Project,
  type ReserveContainer,
  type ReserveTransfer,
} from "@poleursus/shared";
import { ArrowLeft, PiggyBank, RefreshCcw, Wallet } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useWebDataCache } from "@/cache/WebDataCacheProvider";
import { PageContainer } from "@/components/layout/page-container";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
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
  const [inputsByProject, setInputsByProject] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
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

      const nextProjects = (projectsResult.data ?? []) as Project[];
      const nextMonthState = monthStateResult;

      setProjects(nextProjects);
      setReserveContainers((reserveContainersResult.data ?? []) as ReserveContainer[]);
      setMonthCloses((monthClosesResult.data ?? []) as MonthClose[]);
      setMonthCloseAllocations((monthCloseAllocationsResult.data ?? []) as MonthCloseAllocation[]);
      setReserveTransfers((reserveTransfersResult.data ?? []) as ReserveTransfer[]);
      setTransactions((transactionsResult.data ?? []) as TransactionRow[]);
      setMonthState(nextMonthState);
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
    reserveTransfers.forEach((transfer) => {
      map.set(
        transfer.destination_project_id,
        (map.get(transfer.destination_project_id) ?? 0n) + toMinor(transfer.amount_base_minor)
      );
    });
    return map;
  }, [monthCloseAllocations, reserveTransfers]);

  const huchaBalanceMinor = useMemo(
    () =>
      getReserveContainerBalanceMinor({
        reserveContainerId: huchaReserve?.id,
        closeAllocations: monthCloseAllocations,
        reserveTransfers,
      }),
    [huchaReserve?.id, monthCloseAllocations, reserveTransfers]
  );

  const pendingMonthKeys = useMemo(
    () =>
      computePendingMonthCloseKeysFromMonthCloses({
        commitmentProjects: projects.map((project) => ({
          projectId: project.id,
          createdAt: project.created_at ?? null,
        })),
        closedMonths: monthCloses.map((monthClose) => ({ period: monthClose.period })),
        currentMonthKey,
      }),
    [currentMonthKey, monthCloses, projects]
  );

  const pendingCloseMonthKey = pendingMonthKeys[0] ?? null;

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

  const canSavePlan =
    canEdit &&
    !parsedPlans.hasErrors &&
    parsedPlans.totalMinor <= (savingsView.generatedSavedMinor > 0n ? savingsView.generatedSavedMinor : 0n) &&
    !savingsView.isClosed;

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
        {pendingCloseMonthKey ? (
          <Button asChild>
            <Link href={`/projects/month-close?month=${pendingCloseMonthKey}`}>
              {t("projects.monthClose.reviewCta")}
            </Link>
          </Button>
        ) : null}
      </div>

      <Card>
        <CardHeader className="space-y-2">
          <p className="text-sm text-muted-foreground">
            {locale === "en" ? "Savings of the month" : "Ahorro del mes"}
          </p>
          <h1 className="text-3xl font-semibold">
            {formatMoneyWithSymbol(
              savingsView.generatedSavedMinor,
              baseCurrency,
              currencySymbol
            )}
          </h1>
          <p className="text-sm text-muted-foreground">
            {locale === "en"
              ? "Whatever you do not assign will go to the piggy bank when you close the month."
              : "Lo que no asignes irá a la hucha al cerrar el mes."}
          </p>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-lg border p-4">
            <p className="text-xs text-muted-foreground">
              {locale === "en" ? "Planned to projects" : "Planificado a proyectos"}
            </p>
            <p className="text-xl font-semibold">
              {formatMoneyWithSymbol(
                savingsView.plannedToProjectsMinor,
                baseCurrency,
                currencySymbol
              )}
            </p>
          </div>
          <div className="rounded-lg border p-4">
            <p className="text-xs text-muted-foreground">
              {locale === "en" ? "Available to plan" : "Disponible para planificar"}
            </p>
            <p className="text-xl font-semibold">
              {formatMoneyWithSymbol(
                savingsView.availableToPlanMinor,
                baseCurrency,
                currencySymbol
              )}
            </p>
          </div>
          <div className="rounded-lg border p-4">
            <p className="text-xs text-muted-foreground">
              {locale === "en" ? "Piggy bank balance" : "Saldo de la hucha"}
            </p>
            <p className="text-xl font-semibold">
              {formatMoneyWithSymbol(huchaBalanceMinor, baseCurrency, currencySymbol)}
            </p>
          </div>
        </CardContent>
      </Card>

      {pendingCloseMonthKey ? (
        <Card>
          <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
            <div>
              <p className="text-sm font-medium">{t("projects.monthClose.pendingTitle")}</p>
              <p className="text-sm text-muted-foreground">
                {t("projects.monthClose.pendingDescription", {
                  month: pendingCloseMonthKey,
                })}
              </p>
            </div>
            <Button asChild variant="outline">
              <Link href={`/projects/month-close?month=${pendingCloseMonthKey}`}>
                <RefreshCcw className="mr-2 h-4 w-4" />
                {t("projects.monthClose.reviewCta")}
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : null}

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

      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold">
            {locale === "en" ? "Assign savings" : "Asignar ahorro"}
          </h2>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading ? (
            <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
          ) : projects.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {locale === "en"
                ? "Create at least one project to start assigning savings."
                : "Crea al menos un proyecto para empezar a asignar ahorro."}
            </p>
          ) : (
            projects.map((project) => {
              const progress = computeProjectProgress({
                project,
                fundedMinor: fundedByProject.get(project.id) ?? 0n,
                plannedThisMonthMinor:
                  parsedPlans.rows.find((row) => row.projectId === project.id)?.amountMinor ??
                  0n,
              });

              return (
                <div key={project.id} className="rounded-lg border p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-base font-semibold">
                        {project.emoji} {project.name}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {formatMoneyWithSymbol(progress.savedMinor, baseCurrency, currencySymbol)} /{" "}
                        {formatMoneyWithSymbol(progress.targetMinor, baseCurrency, currencySymbol)}
                      </p>
                    </div>
                    <p
                      className="text-sm font-semibold"
                      style={{ color: getProjectColor(project) }}
                    >
                      {Math.round(progress.progressRatio * 100)}%
                    </p>
                  </div>

                  <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_180px] sm:items-end">
                    <div>
                      <p className="text-xs text-muted-foreground">
                        {locale === "en" ? "Funding target" : "Objetivo mensual"}
                      </p>
                      <p className="text-sm font-medium">
                        {formatMoneyWithSymbol(
                          getProjectMonthlyFundingTargetMinor(project),
                          baseCurrency,
                          currencySymbol
                        )}
                      </p>
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground">
                        {locale === "en" ? "Planned this month" : "Planificado este mes"}
                      </label>
                      <Input
                        value={inputsByProject[project.id] ?? ""}
                        onChange={(event) =>
                          handleInputChange(project.id, event.target.value)
                        }
                        inputMode="decimal"
                        placeholder="0"
                        disabled={!canEdit || savingsView.isClosed}
                      />
                    </div>
                  </div>
                </div>
              );
            })
          )}

          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          {message ? <p className="text-sm text-emerald-600">{message}</p> : null}

          <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
            <div className="space-y-1 text-sm">
              <p className="flex items-center gap-2">
                <Wallet className="h-4 w-4 text-muted-foreground" />
                {locale === "en" ? "Planned total" : "Total planificado"}:{" "}
                <span className="font-semibold">
                  {formatMoneyWithSymbol(
                    parsedPlans.totalMinor,
                    baseCurrency,
                    currencySymbol
                  )}
                </span>
              </p>
              <p className="flex items-center gap-2 text-muted-foreground">
                <PiggyBank className="h-4 w-4" />
                {locale === "en" ? "Projected to piggy bank" : "Previsto para la hucha"}:{" "}
                {formatMoneyWithSymbol(
                  savingsView.generatedSavedMinor > parsedPlans.totalMinor
                    ? savingsView.generatedSavedMinor - parsedPlans.totalMinor
                    : 0n,
                  baseCurrency,
                  currencySymbol
                )}
              </p>
            </div>

            <Button onClick={handleSavePlan} disabled={!canSavePlan || isSavingPlan}>
              {isSavingPlan
                ? (locale === "en" ? "Saving..." : "Guardando...")
                : (locale === "en" ? "Save plan" : "Guardar plan")}
            </Button>
          </div>
        </CardContent>
      </Card>

      {huchaReserve ? (
        <Card>
          <CardContent className="flex items-center justify-between gap-3 p-4">
            <div>
              <p className="text-sm font-medium">
                {huchaReserve.emoji} {huchaReserve.name}
              </p>
              <p className="text-sm text-muted-foreground">
                {locale === "en"
                  ? "Generic reserve for whatever is left after the month close."
                  : "Reserva genérica para lo que quede tras el cierre mensual."}
              </p>
            </div>
            <Button asChild variant="outline">
              <Link href={`/reserves/${huchaReserve.id}`}>
                {locale === "en" ? "Open reserve" : "Abrir reserva"}
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : null}
    </PageContainer>
  );
}
