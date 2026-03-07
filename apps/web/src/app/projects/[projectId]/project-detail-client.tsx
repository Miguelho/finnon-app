"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import {
  buildProjectColorMap,
  computeProjectProgress,
  formatMoneyWithSymbol,
  getMinorUnits,
  getProjectColor,
  getProjectMonthlyFundingTargetMinor,
  PROJECT_PALETTE,
  type MonthClose,
  type MonthCloseAllocation,
  type MonthlyProjectFundingPlan,
  type Project,
  type ReserveTransfer,
  type UserRole,
} from "@poleursus/shared";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useWebDataCache } from "@/cache/WebDataCacheProvider";
import { PageContainer } from "@/components/layout/page-container";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { ProjectProgressRing } from "@/components/projects/project-progress-ring";

type RecurringExpense = {
  id: string;
  merchant: string | null;
  notes: string | null;
  amount_minor: string | number | bigint;
  currency: string;
  is_paused: boolean;
  type: "expense" | "income";
};

type ExtraContributionTransaction = {
  id: string;
  date: string;
  merchant: string | null;
  notes: string | null;
  amount_base_minor: string | number | bigint | null;
};

type ProjectDetailClientProps = {
  accountId: string;
  role: UserRole;
  baseCurrency: string;
  currencySymbol: string;
  initialProject: Project;
  accountProjectsForColor: Array<{
    id: string;
    color?: string | null;
    created_at?: string | Date | null;
  }>;
  monthCloses: MonthClose[];
  monthCloseAllocations: MonthCloseAllocation[];
  reserveTransfers: ReserveTransfer[];
  fundingPlans: MonthlyProjectFundingPlan[];
  initialExtraContributions: ExtraContributionTransaction[];
  recurringExpenses: RecurringExpense[];
  userLabels: Record<string, string>;
};

type TranslateFn = (
  key: any,
  values?: Record<string, string | number | Date>
) => string;

const toMinor = (value: bigint | number | string | null | undefined) => {
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

const formatDuration = (months: number, t: TranslateFn) => {
  if (months <= 0) return t("simulator.reached");
  const years = Math.floor(months / 12);
  const remainingMonths = months % 12;

  if (years > 0 && remainingMonths > 0) {
    return t("simulator.durationYearMonth", {
      years,
      months: remainingMonths,
    });
  }

  if (years > 0) {
    return t("simulator.durationYears", { years });
  }

  return t("simulator.durationMonths", { months: remainingMonths });
};

const formatMonthLabel = (period: string, locale: string) => {
  const date = new Date(`${period}T00:00:00`);
  if (Number.isNaN(date.getTime())) return period;
  return new Intl.DateTimeFormat(locale === "en" ? "en-US" : "es-ES", {
    month: "long",
    year: "numeric",
  }).format(date);
};

const formatDateLabel = (value: string | null | undefined, locale: string) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat(locale === "en" ? "en-US" : "es-ES", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
};

export function ProjectDetailClient({
  accountId,
  role,
  baseCurrency,
  currencySymbol,
  initialProject,
  accountProjectsForColor,
  monthCloses,
  monthCloseAllocations,
  reserveTransfers,
  fundingPlans,
  initialExtraContributions,
  recurringExpenses,
  userLabels,
}: ProjectDetailClientProps) {
  const locale = useLocale();
  const tProjects = useTranslations("projects");
  const tGlobal = useTranslations();
  const supabase = useMemo(() => createClient(), []);
  const { emitMutation } = useWebDataCache();

  const canEdit = role !== "viewer";
  const minorUnits = getMinorUnits(baseCurrency);
  const minorFactor = 10 ** minorUnits;
  const sliderStep = Math.max(1, 25 * minorFactor);

  const [project, setProject] = useState<Project>(initialProject);
  const [extraContributions] = useState<ExtraContributionTransaction[]>(
    initialExtraContributions
  );
  const [activeTab, setActiveTab] = useState<"simulator" | "history">("simulator");
  const [isExpensesOpen, setIsExpensesOpen] = useState(false);
  const [isSpendingOpen, setIsSpendingOpen] = useState(false);
  const [disabledRecurringIds, setDisabledRecurringIds] = useState<Set<string>>(new Set());
  const [sliderMinor, setSliderMinor] = useState<number>(() => {
    const initial = Number(toMinor(initialProject.monthly_commitment_base_minor ?? 0));
    return Number.isFinite(initial) && initial > 0 ? Math.round(initial) : 0;
  });
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isSavingColor, setIsSavingColor] = useState(false);

  const projectColorMap = useMemo(() => {
    const hasCurrentProject = accountProjectsForColor.some((entry) => entry.id === project.id);
    const projectsForColor = hasCurrentProject
      ? accountProjectsForColor.map((entry) =>
          entry.id === project.id ? { ...entry, color: project.color } : entry
        )
      : [...accountProjectsForColor, { id: project.id, color: project.color, created_at: project.created_at }];

    return buildProjectColorMap(projectsForColor);
  }, [accountProjectsForColor, project]);

  const resolvedProjectColor = useMemo(
    () => getProjectColor(project, projectColorMap),
    [project, projectColorMap]
  );

  const monthClosesById = useMemo(
    () => new Map<string, MonthClose>(monthCloses.map((monthClose) => [monthClose.id, monthClose])),
    [monthCloses]
  );

  const fundingFromMonthClosesMinor = useMemo(
    () =>
      monthCloseAllocations.reduce(
        (total, entry) => total + toMinor(entry.amount_base_minor),
        0n
      ),
    [monthCloseAllocations]
  );

  const fundingFromReservesMinor = useMemo(
    () =>
      reserveTransfers.reduce(
        (total, entry) => total + toMinor(entry.amount_base_minor),
        0n
      ),
    [reserveTransfers]
  );

  const plannedThisMonthMinor = useMemo(
    () =>
      fundingPlans.reduce(
        (total, entry) => total + toMinor(entry.planned_amount_base_minor),
        0n
      ),
    [fundingPlans]
  );

  const spentMinor = useMemo(
    () =>
      extraContributions.reduce(
        (total, entry) => total + toMinor(entry.amount_base_minor),
        0n
      ),
    [extraContributions]
  );

  const totalFundedMinor = useMemo(
    () => fundingFromMonthClosesMinor + fundingFromReservesMinor,
    [fundingFromMonthClosesMinor, fundingFromReservesMinor]
  );

  const heroProgress = useMemo(
    () =>
      computeProjectProgress({
        project,
        fundedMinor: totalFundedMinor,
        reserveTransferredMinor: fundingFromReservesMinor,
        plannedThisMonthMinor,
        spentMinor,
      }),
    [fundingFromReservesMinor, plannedThisMonthMinor, project, spentMinor, totalFundedMinor]
  );

  const sortedRecurringExpenses = useMemo(
    () =>
      [...recurringExpenses]
        .filter((item) => item.type === "expense" && !item.is_paused)
        .sort((a, b) => Number(toMinor(b.amount_minor) - toMinor(a.amount_minor))),
    [recurringExpenses]
  );

  const releasedFromRecurringMinor = useMemo(() => {
    let total = 0n;
    sortedRecurringExpenses.forEach((expense) => {
      if (disabledRecurringIds.has(expense.id)) {
        total += toMinor(expense.amount_minor);
      }
    });
    return total;
  }, [disabledRecurringIds, sortedRecurringExpenses]);

  const effectiveMonthlyMinor = useMemo(
    () => BigInt(Math.max(sliderMinor, 0)) + releasedFromRecurringMinor,
    [sliderMinor, releasedFromRecurringMinor]
  );

  const simulatorProgress = useMemo(
    () =>
      computeProjectProgress({
        project: {
          ...project,
          monthly_commitment_base_minor: effectiveMonthlyMinor,
        },
        fundedMinor: totalFundedMinor,
        reserveTransferredMinor: fundingFromReservesMinor,
        plannedThisMonthMinor,
        spentMinor,
      }),
    [
      effectiveMonthlyMinor,
      fundingFromReservesMinor,
      plannedThisMonthMinor,
      project,
      spentMinor,
      totalFundedMinor,
    ]
  );

  const sliderMax = useMemo(() => {
    const targetMinor = Number(toMinor(project.target_amount_base_minor));
    const currentMinor = Number(toMinor(project.monthly_commitment_base_minor ?? 0));
    const base = 1500 * minorFactor;
    return Math.max(base, targetMinor, currentMinor + 500 * minorFactor, sliderStep);
  }, [minorFactor, project, sliderStep]);

  const historyRows = useMemo(() => {
    const grouped = new Map<
      string,
      {
        periodKey: string;
        actualMinor: bigint;
        confirmedAt: string | null;
        userId: string | null;
      }
    >();

    monthCloseAllocations.forEach((entry) => {
      const monthClose = monthClosesById.get(entry.month_close_id);
      const periodKey = String(monthClose?.period ?? entry.created_at ?? "").slice(0, 10);
      if (!periodKey) return;

      const current =
        grouped.get(periodKey) ??
        ({
          periodKey,
          actualMinor: 0n,
          confirmedAt: null,
          userId: null,
        } as const);

      grouped.set(periodKey, {
        periodKey,
        actualMinor: current.actualMinor + toMinor(entry.amount_base_minor),
        confirmedAt:
          (typeof monthClose?.closed_at === "string" ? monthClose.closed_at : null) ??
          (typeof entry.created_at === "string" ? entry.created_at : null) ??
          current.confirmedAt,
        userId: monthClose?.closed_by ?? current.userId,
      });
    });

    const chronological = Array.from(grouped.values()).sort((a, b) =>
      a.periodKey < b.periodKey ? -1 : a.periodKey > b.periodKey ? 1 : 0
    );

    let cumulativeMinor = 0n;
    return chronological
      .map((row) => {
        cumulativeMinor += row.actualMinor;
        return {
          ...row,
          cumulativeMinor,
        };
      })
      .reverse();
  }, [monthCloseAllocations, monthClosesById]);

  const createdAtLabel = useMemo(() => {
    const raw = project.created_at;
    if (!raw) return null;
    const date = raw instanceof Date ? raw : new Date(raw);
    if (Number.isNaN(date.getTime())) return null;
    return new Intl.DateTimeFormat(locale === "en" ? "en-US" : "es-ES", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    }).format(date);
  }, [project.created_at, locale]);

  const toggleRecurringExpense = (id: string) => {
    setDisabledRecurringIds((previous) => {
      const next = new Set(previous);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleSetCommitment = async () => {
    if (!canEdit || isSaving) return;

    if (effectiveMonthlyMinor <= 0n) {
      setSaveError(tProjects("validation.commitmentRequired"));
      setSaveMessage(null);
      return;
    }

    setIsSaving(true);
    setSaveError(null);
    setSaveMessage(null);

    try {
      const { data, error } = await supabase
        .from("projects")
        .update({
          monthly_commitment_base_minor: String(effectiveMonthlyMinor),
          updated_at: new Date().toISOString(),
        })
        .eq("id", project.id)
        .eq("account_id", accountId)
        .select("*")
        .single();

      if (error) throw error;

      setProject(data as Project);
      setSliderMinor(Number(effectiveMonthlyMinor));
      setDisabledRecurringIds(new Set());
      await emitMutation("projects", "update");
      setSaveMessage(
        tProjects("simulator.saved", {
          amount: formatMoneyWithSymbol(effectiveMonthlyMinor, baseCurrency, currencySymbol),
        })
      );
    } catch (error) {
      console.error("[Projects] Commitment update error", error);
      setSaveError(tGlobal("errors.internalServer"));
    } finally {
      setIsSaving(false);
    }
  };

  const handleSetColor = async (color: string) => {
    if (!canEdit || isSavingColor) return;
    if (resolvedProjectColor === color && project.color) return;

    setIsSavingColor(true);
    setSaveError(null);
    setSaveMessage(null);

    try {
      const { data, error } = await supabase
        .from("projects")
        .update({
          color,
          updated_at: new Date().toISOString(),
        })
        .eq("id", project.id)
        .eq("account_id", accountId)
        .select("*")
        .single();

      if (error) throw error;

      setProject(data as Project);
      await emitMutation("projects", "update");
      setSaveMessage(tProjects("colorSaved"));
    } catch (error) {
      console.error("[Projects] Color update error", error);
      setSaveError(tGlobal("errors.internalServer"));
    } finally {
      setIsSavingColor(false);
    }
  };

  return (
    <PageContainer className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <Link
          href="/projects"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          {tProjects("backToList")}
        </Link>
      </div>

      <Card>
        <CardHeader className="space-y-3">
          <div className="flex items-start justify-between gap-4">
            <div className="flex min-w-0 items-center gap-3">
              <span className="text-4xl">{project.emoji || "\u{1F3AF}"}</span>
              <div className="min-w-0">
                <h1 className="truncate text-2xl font-semibold">{project.name}</h1>
                {createdAtLabel ? (
                  <p className="text-sm text-muted-foreground">
                    {tProjects("createdAt", { date: createdAtLabel })}
                  </p>
                ) : null}
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm text-muted-foreground">{tProjects("priority")}</p>
              <p className="text-lg font-semibold">#{project.priority}</p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-[160px_1fr]">
            <div className="flex items-center justify-center">
              <ProjectProgressRing
                progress={heroProgress.progressRatio}
                size={148}
                strokeWidth={10}
                progressColor={resolvedProjectColor}
                center={
                  <div className="text-center">
                    <p className="text-xl font-semibold" style={{ color: resolvedProjectColor }}>
                      {Math.round(heroProgress.progressRatio * 100)}%
                    </p>
                  </div>
                }
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-4">
              <div>
                <p className="text-sm text-muted-foreground">{tProjects("target")}</p>
                <p className="text-xl font-semibold">
                  {formatMoneyWithSymbol(heroProgress.targetMinor, baseCurrency, currencySymbol)}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">
                  {locale === "en" ? "Funded" : "Financiado"}
                </p>
                <p className="text-xl font-semibold">
                  {formatMoneyWithSymbol(heroProgress.fundedReservedMinor, baseCurrency, currencySymbol)}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">
                  {locale === "en" ? "Planned this month" : "Planificado este mes"}
                </p>
                <p className="text-xl font-semibold">
                  {formatMoneyWithSymbol(heroProgress.plannedThisMonthMinor, baseCurrency, currencySymbol)}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">
                  {locale === "en" ? "Spent" : "Gastado"}
                </p>
                <p className="text-xl font-semibold">
                  {formatMoneyWithSymbol(heroProgress.spentMinor, baseCurrency, currencySymbol)}
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-3 rounded-lg border bg-muted/30 p-4">
            <div className="grid gap-2 text-sm sm:grid-cols-[1fr_auto]">
              <p className="text-muted-foreground">{locale === "en" ? "From month closes" : "Desde cierres"}</p>
              <p className="font-semibold">
                {formatMoneyWithSymbol(
                  fundingFromMonthClosesMinor,
                  baseCurrency,
                  currencySymbol
                )}
              </p>
              <p className="text-muted-foreground">{locale === "en" ? "From piggy bank transfers" : "Desde transferencias de hucha"}</p>
              <p className="font-semibold">
                {formatMoneyWithSymbol(
                  fundingFromReservesMinor,
                  baseCurrency,
                  currencySymbol
                )}
              </p>
              <p className="text-muted-foreground">{tProjects("remaining")}</p>
              <p className="font-semibold">
                {formatMoneyWithSymbol(
                  heroProgress.remainingMinor,
                  baseCurrency,
                  currencySymbol
                )}
              </p>
            </div>
            <div className="h-px bg-border" />
            <div className="grid gap-2 text-sm sm:grid-cols-[1fr_auto]">
              <p className="text-muted-foreground">{locale === "en" ? "Current monthly target" : "Objetivo mensual actual"}</p>
              <p className="font-semibold">
                {getProjectMonthlyFundingTargetMinor(project) > 0n
                  ? `${formatMoneyWithSymbol(getProjectMonthlyFundingTargetMinor(project), baseCurrency, currencySymbol)} ${tProjects("perMonth")}`
                  : tProjects("noPlan")}
              </p>
              <p className="text-muted-foreground">{locale === "en" ? "Estimated finish" : "Fin estimado"}</p>
              <p className="font-semibold">
                {heroProgress.monthsLeft === null || !heroProgress.estimatedCompletionDate
                  ? tProjects("noPlan")
                  : tProjects("simulator.estimatedDate", {
                      duration: formatDuration(heroProgress.monthsLeft, tProjects),
                      date: new Intl.DateTimeFormat(locale === "en" ? "en-US" : "es-ES", {
                        month: "long",
                        year: "numeric",
                      }).format(heroProgress.estimatedCompletionDate),
                    })}
              </p>
            </div>
          </div>

          <div className="space-y-3 rounded-lg border p-4">
            <button
              type="button"
              className="flex w-full items-center justify-between text-left"
              onClick={() => setIsSpendingOpen((previous) => !previous)}
            >
              <span className="font-medium">
                {locale === "en" ? "Associated spending" : "Gasto asociado"}
              </span>
              <span className="text-sm text-muted-foreground">
                {isSpendingOpen
                  ? tProjects("simulator.collapse")
                  : tProjects("simulator.expand")}
              </span>
            </button>

            {isSpendingOpen ? (
              extraContributions.length > 0 ? (
                <div className="space-y-2">
                  {extraContributions.map((entry) => {
                    const label =
                      entry.merchant?.trim() ||
                      entry.notes?.trim() ||
                      (locale === "en" ? "Expense" : "Gasto");
                    const dateLabel =
                      formatDateLabel(entry.date, locale) ?? entry.date;
                    return (
                      <div
                        key={entry.id}
                        className="flex items-center justify-between gap-3 rounded-md border px-3 py-2"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">{label}</p>
                          <p className="text-xs text-muted-foreground">{dateLabel}</p>
                        </div>
                        <p className="text-sm font-semibold">
                          {formatMoneyWithSymbol(
                            toMinor(entry.amount_base_minor),
                            baseCurrency,
                            currencySymbol
                          )}
                        </p>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  {locale === "en"
                    ? "There is no associated spending yet."
                    : "Todavía no hay gasto asociado."}
                </p>
              )
            ) : null}
          </div>

          {canEdit ? (
            <div className="space-y-2 rounded-lg border p-3">
              <p className="text-sm text-muted-foreground">{tProjects("colorLabel")}</p>
              <div className="flex flex-wrap gap-2">
                {PROJECT_PALETTE.map((color) => {
                  const isSelected = resolvedProjectColor === color;
                  return (
                    <button
                      key={color}
                      type="button"
                      onClick={() => void handleSetColor(color)}
                      disabled={isSavingColor}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-full transition-transform hover:scale-[1.05] disabled:cursor-not-allowed disabled:opacity-60"
                      style={{
                        backgroundColor: color,
                        border: isSelected
                          ? "2px solid rgba(255, 255, 255, 0.5)"
                          : "1px solid hsl(var(--border))",
                      }}
                      aria-label={`${tProjects("colorLabel")} ${color}`}
                    >
                      {isSelected ? (
                        <span className="h-3 w-3 rounded-full border border-white/85" />
                      ) : null}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <div className="inline-flex rounded-lg border p-1">
        <button
          type="button"
          className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === "simulator"
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground"
          }`}
          onClick={() => setActiveTab("simulator")}
        >
          {tProjects("simulator.tab")}
        </button>
        <button
          type="button"
          className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === "history"
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground"
          }`}
          onClick={() => setActiveTab("history")}
        >
          {tProjects("history.tab")}
        </button>
      </div>

      {activeTab === "simulator" ? (
        <Card>
          <CardContent className="space-y-5 p-6">
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm text-muted-foreground">
                  {tProjects("simulator.sliderLabel")}
                </p>
                <p className="text-lg font-semibold">
                  {formatMoneyWithSymbol(BigInt(sliderMinor), baseCurrency, currencySymbol)}
                  <span className="ml-1 text-sm font-medium text-muted-foreground">
                    {tProjects("perMonth")}
                  </span>
                </p>
              </div>
              <input
                type="range"
                min={0}
                max={sliderMax}
                step={sliderStep}
                value={sliderMinor}
                onChange={(event) => setSliderMinor(Number(event.target.value))}
                className="w-full"
              />
              <p className="text-xs text-muted-foreground">{tProjects("simulator.sliderHint")}</p>
            </div>

            <div className="rounded-lg border bg-muted/30 p-4">
              <p className="text-sm text-muted-foreground">{tProjects("simulator.effectiveSaving")}</p>
              <p className="text-2xl font-semibold">
                {formatMoneyWithSymbol(effectiveMonthlyMinor, baseCurrency, currencySymbol)}
                <span className="ml-1 text-base font-medium text-muted-foreground">
                  {tProjects("perMonth")}
                </span>
              </p>
              {simulatorProgress.monthsLeft !== null &&
              simulatorProgress.estimatedCompletionDate ? (
                <p className="mt-1 text-sm text-muted-foreground">
                  {tProjects("simulator.estimatedDate", {
                    duration: formatDuration(simulatorProgress.monthsLeft, tProjects),
                    date: new Intl.DateTimeFormat(locale === "en" ? "en-US" : "es-ES", {
                      month: "long",
                      year: "numeric",
                    }).format(simulatorProgress.estimatedCompletionDate),
                  })}
                </p>
              ) : (
                <p className="mt-1 text-sm text-muted-foreground">{tProjects("noPlan")}</p>
              )}
            </div>

            <div className="space-y-3 rounded-lg border p-4">
              <button
                type="button"
                className="flex w-full items-center justify-between text-left"
                onClick={() => setIsExpensesOpen((previous) => !previous)}
              >
                <span className="font-medium">{tProjects("simulator.cutExpensesTitle")}</span>
                <span className="text-sm text-muted-foreground">
                  {isExpensesOpen
                    ? tProjects("simulator.collapse")
                    : tProjects("simulator.expand")}
                </span>
              </button>

              {isExpensesOpen ? (
                sortedRecurringExpenses.length > 0 ? (
                  <div className="space-y-3">
                    {sortedRecurringExpenses.map((expense) => {
                      const disabled = disabledRecurringIds.has(expense.id);
                      const label =
                        expense.merchant?.trim() ||
                        expense.notes?.trim() ||
                        tProjects("simulator.unnamedExpense");

                      return (
                        <div
                          key={expense.id}
                          className="flex items-center justify-between gap-3 border-b pb-3 last:border-b-0"
                        >
                          <div>
                            <p className="text-sm font-medium">{label}</p>
                            <p className="text-xs text-muted-foreground">
                              {formatMoneyWithSymbol(
                                toMinor(expense.amount_minor),
                                baseCurrency,
                                currencySymbol
                              )}{" "}
                              {tProjects("perMonth")}
                            </p>
                          </div>
                          <Switch
                            checked={disabled}
                            onCheckedChange={() => toggleRecurringExpense(expense.id)}
                          />
                        </div>
                      );
                    })}

                    <div className="rounded-md bg-muted/50 px-3 py-2 text-sm">
                      <span className="text-muted-foreground">
                        {tProjects("simulator.releasedFromExpenses")}
                      </span>{" "}
                      <span className="font-semibold">
                        {formatMoneyWithSymbol(
                          releasedFromRecurringMinor,
                          baseCurrency,
                          currencySymbol
                        )}
                      </span>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    {tProjects("simulator.noRecurringExpenses")}
                  </p>
                )
              ) : null}
            </div>

            {saveError ? <p className="text-sm text-destructive">{saveError}</p> : null}
            {saveMessage ? <p className="text-sm text-emerald-600">{saveMessage}</p> : null}

            <Button
              onClick={handleSetCommitment}
              disabled={!canEdit || isSaving || effectiveMonthlyMinor <= 0n}
            >
              {isSaving
                ? tProjects("simulator.saving")
                : tProjects("simulator.setCommitment", {
                    amount: formatMoneyWithSymbol(
                      effectiveMonthlyMinor,
                      baseCurrency,
                      currencySymbol
                    ),
                  })}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="space-y-3 p-6">
            {historyRows.length === 0 ? (
              <p className="text-sm text-muted-foreground">{tProjects("history.empty")}</p>
            ) : (
              historyRows.map((entry) => {
                const contributorLabel = entry.userId
                  ? userLabels[entry.userId] ?? entry.userId.slice(0, 8)
                  : tProjects("history.unknownUser");
                const confirmedDateLabel = formatDateLabel(entry.confirmedAt, locale);

                return (
                  <div key={entry.periodKey} className="rounded-lg border p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-sm text-muted-foreground">
                          {formatMonthLabel(entry.periodKey, locale)}
                        </p>
                        <p className="text-base font-semibold">
                          {locale === "en" ? "Month close" : "Cierre mensual"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {tProjects("history.contributor", { name: contributorLabel })}
                        </p>
                        {confirmedDateLabel ? (
                          <p className="text-xs text-muted-foreground">
                            {tProjects("history.confirmedAt", { date: confirmedDateLabel })}
                          </p>
                        ) : null}
                      </div>
                      <div className="text-right">
                        <p className="text-sm">
                          {locale === "en" ? "Funded" : "Financiado"}:{" "}
                          <span className="font-semibold">
                            {formatMoneyWithSymbol(entry.actualMinor, baseCurrency, currencySymbol)}
                          </span>
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {tProjects("history.cumulative")}:{" "}
                          {formatMoneyWithSymbol(
                            entry.cumulativeMinor,
                            baseCurrency,
                            currencySymbol
                          )}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>
      )}
    </PageContainer>
  );
}
