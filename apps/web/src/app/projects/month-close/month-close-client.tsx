"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  addMonths,
  formatMinorToMoney,
  formatMoneyWithSymbol,
  formatMonthLabel,
  getLatestClosableMonthKey,
  getProjectMonthlyFundingTargetMinor,
  parseMoneyToMinor,
  type MonthClose,
  type MonthCloseAllocation,
  type Project,
  type ReserveContainer,
  type UserRole,
} from "@poleursus/shared";
import { ArrowLeft, ChevronLeft, ChevronRight } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useWebDataCache } from "@/cache/WebDataCacheProvider";
import { PageContainer } from "@/components/layout/page-container";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

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

type MonthCloseClientProps = {
  accountId: string;
  role: UserRole;
  locale: "es" | "en";
  monthKey: string;
  pendingMonthKeys: string[];
  baseCurrency: string;
  currencySymbol: string;
  projects: Project[];
  reserveContainers: ReserveContainer[];
  monthState: SavingsMonthStateRow | null;
  monthClose: MonthClose | null;
  monthCloseAllocations: MonthCloseAllocation[];
};

type ParsedPlanRow = {
  projectId: string;
  amountMinor: bigint;
  error: string | null;
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

const formatClosedAt = (value: string | null, locale: "es" | "en") => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat(locale === "en" ? "en-US" : "es-ES", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(date);
};

export function MonthCloseClient({
  accountId,
  role,
  locale,
  monthKey,
  pendingMonthKeys,
  baseCurrency,
  currencySymbol,
  projects,
  reserveContainers,
  monthState,
  monthClose,
  monthCloseAllocations,
}: MonthCloseClientProps) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const { emitMutation } = useWebDataCache();
  const latestClosableMonthKey = getLatestClosableMonthKey();
  const canEdit = role !== "viewer";
  const isClosed = monthState?.is_closed ?? Boolean(monthClose?.id);
  const isClosableMonth = monthKey <= latestClosableMonthKey;
  const actualSavedMinor = toMinor(monthState?.generated_saved_base_minor ?? 0);
  const positiveSavedMinor = actualSavedMinor > 0n ? actualSavedMinor : 0n;
  const huchaReserve =
    reserveContainers.find((reserveContainer) => reserveContainer.kind === "hucha") ?? null;

  const initialInputs = useMemo(() => {
    const next: Record<string, string> = {};
    projects.forEach((project) => {
      const plan = monthState?.plans.find((entry) => entry.project_id === project.id);
      next[project.id] = formatMinorToMoney(
        toMinor(plan?.planned_amount_base_minor ?? 0),
        baseCurrency
      );
    });
    return next;
  }, [baseCurrency, monthState?.plans, projects]);

  const [inputsByProject, setInputsByProject] = useState<Record<string, string>>(initialInputs);
  const [isSavingPlan, setIsSavingPlan] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const parsedPlans = useMemo(() => {
    const rows: ParsedPlanRow[] = projects.map((project) => {
      const raw = (inputsByProject[project.id] ?? "").trim();
      if (!raw) {
        return { projectId: project.id, amountMinor: 0n, error: null };
      }

      const parsed = parseMoneyToMinor(raw, baseCurrency);
      if (typeof parsed === "object" && "error" in parsed) {
        return {
          projectId: project.id,
          amountMinor: 0n,
          error: locale === "en" ? "Review this amount." : "Revisa este importe.",
        };
      }

      return {
        projectId: project.id,
        amountMinor: parsed,
        error: null,
      };
    });

    const totalMinor = rows.reduce((total, row) => total + row.amountMinor, 0n);
    return {
      rows,
      totalMinor,
      hasErrors: rows.some((row) => row.error !== null),
    };
  }, [baseCurrency, inputsByProject, locale, projects]);

  const needsRebalance = parsedPlans.totalMinor > positiveSavedMinor;
  const projectedReserveMinor =
    positiveSavedMinor > parsedPlans.totalMinor ? positiveSavedMinor - parsedPlans.totalMinor : 0n;
  const canPersistPlan =
    canEdit && isClosableMonth && !isClosed && !parsedPlans.hasErrors && !needsRebalance;
  const canConfirmClose = canPersistPlan && !isClosing;

  const allocationLabels = useMemo(() => {
    const projectsById = new Map(projects.map((project) => [project.id, project]));
    const reservesById = new Map(
      reserveContainers.map((reserveContainer) => [reserveContainer.id, reserveContainer])
    );

    return monthCloseAllocations.map((allocation) => {
      if (allocation.project_id) {
        const project = projectsById.get(allocation.project_id);
        return {
          id: allocation.id,
          label: project
            ? `${project.emoji || "\u{1F3AF}"} ${project.name}`
            : locale === "en"
              ? "Project"
              : "Proyecto",
          amountMinor: toMinor(allocation.amount_base_minor),
        };
      }

      const reserve = allocation.reserve_container_id
        ? reservesById.get(allocation.reserve_container_id)
        : null;
      return {
        id: allocation.id,
        label: reserve
          ? `${reserve.emoji || "\u{1F437}"} ${reserve.name}`
          : locale === "en"
            ? "Reserve"
            : "Reserva",
        amountMinor: toMinor(allocation.amount_base_minor),
      };
    });
  }, [locale, monthCloseAllocations, projects, reserveContainers]);

  const closedAtLabel = formatClosedAt(
    monthState?.closed_at ??
      (typeof monthClose?.closed_at === "string" ? monthClose.closed_at : null),
    locale
  );

  const handleInputChange = (projectId: string, value: string) => {
    setInputsByProject((previous) => ({
      ...previous,
      [projectId]: sanitizeNumericInput(value),
    }));
    setErrorMessage(null);
    setSuccessMessage(null);
  };

  const persistPlans = async () => {
    const payload = parsedPlans.rows.map((row) => ({
      project_id: row.projectId,
      planned_amount_base_minor: row.amountMinor.toString(),
    }));

    const { error } = await supabase.rpc("replace_monthly_project_funding_plans", {
      p_account_id: accountId,
      p_period: `${monthKey}-01`,
      p_plans: payload,
    });

    if (error) throw error;

    await emitMutation("monthly_project_funding_plans", "upsert");
  };

  const handleSavePlan = async () => {
    if (!canPersistPlan || isSavingPlan) return;

    setIsSavingPlan(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      await persistPlans();
      setSuccessMessage(
        locale === "en" ? "Monthly plan updated." : "Plan mensual actualizado."
      );
      router.refresh();
    } catch (error) {
      console.error("[MonthClose][web] save plan error", error);
      setErrorMessage(
        locale === "en"
          ? "Couldn't save the monthly plan."
          : "No se pudo guardar el plan mensual."
      );
    } finally {
      setIsSavingPlan(false);
    }
  };

  const handleConfirmClose = async () => {
    if (!canConfirmClose) return;

    setIsClosing(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      await persistPlans();

      const { error } = await supabase.rpc("close_savings_month", {
        p_account_id: accountId,
        p_period: `${monthKey}-01`,
      });

      if (error) throw error;

      await emitMutation("month_closes", "insert");
      await emitMutation("month_close_allocations", "insert");
      setSuccessMessage(
        locale === "en"
          ? "Month close confirmed."
          : "Cierre mensual confirmado."
      );
      router.refresh();
    } catch (error) {
      console.error("[MonthClose][web] close error", error);
      setErrorMessage(
        locale === "en"
          ? "Couldn't close the month."
          : "No se pudo cerrar el mes."
      );
    } finally {
      setIsClosing(false);
    }
  };

  const previousMonth = addMonths(monthKey, -1);
  const nextMonth = addMonths(monthKey, 1);
  const canNavigateNext = nextMonth <= latestClosableMonthKey;

  return (
    <PageContainer className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <Link
          href="/projects"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          {locale === "en" ? "Back to projects" : "Volver a proyectos"}
        </Link>
      </div>

      <Card>
        <CardContent className="space-y-3 p-4">
          <p className="text-sm font-medium">
            {locale === "en" ? "Select month to close" : "Seleccionar mes a cerrar"}
          </p>
          <div className="flex items-center justify-center gap-3">
            <Button asChild size="icon" variant="outline" className="h-8 w-8">
              <Link href={`/projects/month-close?month=${previousMonth}`}>
                <ChevronLeft className="h-4 w-4" />
              </Link>
            </Button>
            <div className="px-2 text-center">
              <p className="text-base font-semibold sm:text-lg">
                {formatMonthLabel(monthKey, locale)}
              </p>
              <p className="text-xs text-muted-foreground">
                {pendingMonthKeys.includes(monthKey)
                  ? locale === "en"
                    ? "Pending month"
                    : "Mes pendiente"
                  : locale === "en"
                    ? "Month overview"
                    : "Resumen del mes"}
              </p>
            </div>
            {canNavigateNext ? (
              <Button asChild size="icon" variant="outline" className="h-8 w-8">
                <Link href={`/projects/month-close?month=${nextMonth}`}>
                  <ChevronRight className="h-4 w-4" />
                </Link>
              </Button>
            ) : (
              <Button size="icon" variant="outline" className="h-8 w-8" disabled>
                <ChevronRight className="h-4 w-4" />
              </Button>
            )}
          </div>

          {pendingMonthKeys.length > 0 ? (
            <div className="border-t pt-3">
              <p className="mb-2 text-xs text-muted-foreground">
                {locale === "en" ? "Pending closes" : "Cierres pendientes"}
              </p>
              <div className="flex flex-wrap gap-2">
                {pendingMonthKeys.map((pendingKey) => (
                  <Button
                    key={pendingKey}
                    asChild
                    size="sm"
                    variant={pendingKey === monthKey ? "default" : "outline"}
                  >
                    <Link href={`/projects/month-close?month=${pendingKey}`}>
                      {formatMonthLabel(pendingKey, locale)}
                    </Link>
                  </Button>
                ))}
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="space-y-2">
          <h1 className="text-2xl font-semibold">
            {locale === "en" ? "End-of-month ritual" : "Ritual de fin de mes"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {locale === "en"
              ? "Confirm how the real savings of the month are consolidated."
              : "Confirma cómo se consolida el ahorro real del mes."}
          </p>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-lg border p-3">
            <p className="text-sm text-muted-foreground">
              {locale === "en" ? "Generated savings" : "Ahorro generado"}
            </p>
            <p className="text-xl font-semibold">
              {formatMoneyWithSymbol(actualSavedMinor, baseCurrency, currencySymbol)}
            </p>
          </div>
          <div className="rounded-lg border p-3">
            <p className="text-sm text-muted-foreground">
              {locale === "en" ? "Planned to projects" : "Planificado a proyectos"}
            </p>
            <p className="text-xl font-semibold">
              {formatMoneyWithSymbol(parsedPlans.totalMinor, baseCurrency, currencySymbol)}
            </p>
          </div>
          <div className="rounded-lg border p-3">
            <p className="text-sm text-muted-foreground">
              {locale === "en" ? "Will go to piggy bank" : "Irá a la hucha"}
            </p>
            <p className="text-xl font-semibold">
              {formatMoneyWithSymbol(projectedReserveMinor, baseCurrency, currencySymbol)}
            </p>
          </div>
        </CardContent>
      </Card>

      {isClosed ? (
        <Card className="border-emerald-300/60 bg-emerald-50/40">
          <CardContent className="space-y-1 p-4 text-sm text-emerald-900">
            <p className="font-medium">
              {locale === "en" ? "Month already closed" : "Mes ya cerrado"}
            </p>
            {closedAtLabel ? (
              <p>
                {locale === "en"
                  ? `Closed on ${closedAtLabel}.`
                  : `Cerrado el ${closedAtLabel}.`}
              </p>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      {!isClosed && needsRebalance ? (
        <Card className="border-orange-300/60 bg-orange-50/50">
          <CardContent className="space-y-1 p-4 text-sm text-orange-900">
            <p className="font-medium">
              {locale === "en" ? "Rebalance required" : "Necesita ajuste"}
            </p>
            <p>
              {locale === "en"
                ? "The plan exceeds the currently positive savings. Lower the planned amounts before closing."
                : "El plan supera el ahorro positivo disponible. Baja los importes planificados antes de cerrar."}
            </p>
          </CardContent>
        </Card>
      ) : null}

      {!isClosed && actualSavedMinor <= 0n ? (
        <Card className="border-slate-300/60 bg-slate-50/50">
          <CardContent className="space-y-1 p-4 text-sm text-slate-800">
            <p className="font-medium">
              {locale === "en" ? "No positive savings this month" : "No hay ahorro positivo este mes"}
            </p>
            <p>
              {locale === "en"
                ? "Closing the month will not allocate funds to projects or to the piggy bank."
                : "Al cerrar el mes no se asignará financiación ni a proyectos ni a la hucha."}
            </p>
          </CardContent>
        </Card>
      ) : null}

      {projects.length === 0 ? (
        <Card>
          <CardContent className="space-y-2 p-6 text-sm text-muted-foreground">
            <p>
              {locale === "en"
                ? "There are no active financial projects. You can still close the month and send any positive remainder to the piggy bank."
                : "No hay proyectos financieros activos. Aun así puedes cerrar el mes y mandar el sobrante positivo a la hucha."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="space-y-4 p-6">
            {projects.map((project) => {
              const parsedRow =
                parsedPlans.rows.find((row) => row.projectId === project.id) ?? null;

              return (
                <div key={project.id} className="rounded-lg border p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-base font-semibold">
                        {project.emoji || "\u{1F3AF}"} {project.name}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {locale === "en" ? "Monthly funding target" : "Objetivo mensual"}:{" "}
                        {formatMoneyWithSymbol(
                          getProjectMonthlyFundingTargetMinor(project),
                          baseCurrency,
                          currencySymbol
                        )}
                      </p>
                    </div>
                    <div className="w-full sm:w-44">
                      <label className="text-xs text-muted-foreground">
                        {locale === "en" ? "Final amount for the month" : "Importe final del mes"}
                      </label>
                      <Input
                        value={inputsByProject[project.id] ?? ""}
                        onChange={(event) =>
                          handleInputChange(project.id, event.target.value)
                        }
                        inputMode="decimal"
                        placeholder="0"
                        disabled={!canEdit || isClosed}
                      />
                      {parsedRow?.error ? (
                        <p className="mt-1 text-xs text-destructive">{parsedRow.error}</p>
                      ) : null}
                    </div>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="space-y-2 p-4 text-sm">
          <p className="text-muted-foreground">
            {locale === "en"
              ? `Any unassigned amount will go to ${huchaReserve?.name ?? "the piggy bank"}.`
              : `Lo no asignado irá a ${huchaReserve?.name ?? "la hucha"}.`}
          </p>
          {errorMessage ? <p className="text-destructive">{errorMessage}</p> : null}
          {successMessage ? <p className="text-emerald-600">{successMessage}</p> : null}
        </CardContent>
      </Card>

      {isClosed && allocationLabels.length > 0 ? (
        <Card>
          <CardHeader>
            <h2 className="text-lg font-semibold">
              {locale === "en" ? "Confirmed allocations" : "Asignaciones confirmadas"}
            </h2>
          </CardHeader>
          <CardContent className="space-y-3">
            {allocationLabels.map((row) => (
              <div
                key={row.id}
                className="flex items-center justify-between gap-3 rounded-lg border p-3"
              >
                <p className="text-sm font-medium">{row.label}</p>
                <p className="text-sm font-semibold">
                  {formatMoneyWithSymbol(row.amountMinor, baseCurrency, currencySymbol)}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}

      {!isClosed ? (
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Button
            variant="outline"
            onClick={handleSavePlan}
            disabled={!canPersistPlan || isSavingPlan}
          >
            {isSavingPlan
              ? locale === "en"
                ? "Saving..."
                : "Guardando..."
              : locale === "en"
                ? "Save plan"
                : "Guardar plan"}
          </Button>
          <Button onClick={handleConfirmClose} disabled={!canConfirmClose}>
            {isClosing
              ? locale === "en"
                ? "Closing..."
                : "Cerrando..."
              : locale === "en"
                ? "Confirm month close"
                : "Confirmar cierre mensual"}
          </Button>
        </div>
      ) : null}
    </PageContainer>
  );
}
