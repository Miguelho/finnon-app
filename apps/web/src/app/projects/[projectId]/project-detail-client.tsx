"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import {
  buildProjectColorMap,
  computeProjectProgress,
  formatMoneyWithSymbol,
  getProjectColor,
  getProjectMonthlyFundingTargetMinor,
  getProjectReserveTransferDeltaMinor,
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
import { ProjectProgressRing } from "@/components/projects/project-progress-ring";

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
  userLabels,
}: ProjectDetailClientProps) {
  const locale = useLocale();
  const tProjects = useTranslations("projects");
  const supabase = useMemo(() => createClient(), []);
  const { emitMutation } = useWebDataCache();

  const canEdit = role !== "viewer";
  const [project, setProject] = useState<Project>(initialProject);
  const [extraContributions] = useState<ExtraContributionTransaction[]>(
    initialExtraContributions ?? []
  );
  const [isSpendingOpen, setIsSpendingOpen] = useState(true);
  const [isColorPickerOpen, setIsColorPickerOpen] = useState(false);
  const [colorFeedback, setColorFeedback] = useState<string | null>(null);
  const [colorError, setColorError] = useState<string | null>(null);
  const [isSavingColor, setIsSavingColor] = useState(false);
  const colorPickerRef = useRef<HTMLDivElement | null>(null);

  const projectColorMap = useMemo(() => {
    const hasCurrentProject = accountProjectsForColor.some((entry) => entry.id === project.id);
    const projectsForColor = hasCurrentProject
      ? accountProjectsForColor.map((entry) =>
          entry.id === project.id ? { ...entry, color: project.color } : entry
        )
      : [
          ...accountProjectsForColor,
          { id: project.id, color: project.color, created_at: project.created_at },
        ];

    return buildProjectColorMap(projectsForColor);
  }, [accountProjectsForColor, project]);

  const resolvedProjectColor = useMemo(
    () => getProjectColor(project, projectColorMap),
    [project, projectColorMap]
  );

  useEffect(() => {
    if (!isColorPickerOpen) return;

    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (colorPickerRef.current?.contains(target)) return;
      setIsColorPickerOpen(false);
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("touchstart", handlePointerDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("touchstart", handlePointerDown);
    };
  }, [isColorPickerOpen]);

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
        (total, entry) => total + getProjectReserveTransferDeltaMinor(entry),
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

  const estimatedFinishLabel = useMemo(() => {
    if (heroProgress.monthsLeft === null || !heroProgress.estimatedCompletionDate) {
      return tProjects("noPlan");
    }

    return tProjects("simulator.estimatedDate", {
      duration: formatDuration(heroProgress.monthsLeft, tProjects),
      date: new Intl.DateTimeFormat(locale === "en" ? "en-US" : "es-ES", {
        month: "long",
        year: "numeric",
      }).format(heroProgress.estimatedCompletionDate),
    });
  }, [heroProgress.estimatedCompletionDate, heroProgress.monthsLeft, locale, tProjects]);

  const handleSetColor = async (color: string) => {
    if (!canEdit || isSavingColor) return;
    if (resolvedProjectColor === color && project.color) {
      setIsColorPickerOpen(false);
      return;
    }

    setIsSavingColor(true);
    setColorError(null);
    setColorFeedback(null);

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
      setIsColorPickerOpen(false);
      setColorFeedback(tProjects("colorSaved"));
      await emitMutation("projects", "update");
    } catch (error) {
      console.error("[Projects] Color update error", error);
      setColorError(locale === "en" ? "Couldn't save the color." : "No se pudo guardar el color.");
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

      <div className="space-y-6">
          <div className="flex flex-col items-center gap-4 text-center">
            <div ref={colorPickerRef} className="flex flex-col items-center gap-4">
              <div className="relative">
                <ProjectProgressRing
                  progress={heroProgress.progressRatio}
                  size={212}
                  strokeWidth={12}
                  progressColor={resolvedProjectColor}
                  center={
                    <div className="space-y-1 text-center">
                      <p className="text-4xl">{project.emoji || "\u{1F3AF}"}</p>
                      <p className="text-2xl font-semibold" style={{ color: resolvedProjectColor }}>
                        {Math.round(heroProgress.progressRatio * 100)}%
                      </p>
                      {canEdit ? (
                        <div className="flex justify-center pt-1">
                          <button
                            type="button"
                            onClick={() => setIsColorPickerOpen((previous) => !previous)}
                            disabled={isSavingColor}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-full border-2 border-background shadow-sm transition-transform hover:scale-[1.04] disabled:cursor-not-allowed disabled:opacity-60"
                            style={{ backgroundColor: resolvedProjectColor }}
                            aria-label={tProjects("colorLabel")}
                          >
                            <span className="h-2.5 w-2.5 rounded-full border border-white/85 bg-transparent" />
                          </button>
                        </div>
                      ) : null}
                    </div>
                  }
                />
              </div>

              {canEdit && isColorPickerOpen ? (
                <div className="flex max-w-[280px] flex-wrap justify-center gap-2 rounded-2xl border bg-background/95 p-3 shadow-sm">
                  {PROJECT_PALETTE.map((color) => {
                    const isSelected = resolvedProjectColor === color;
                    return (
                      <button
                        key={color}
                        type="button"
                        onClick={() => void handleSetColor(color)}
                        disabled={isSavingColor}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-full border transition-transform hover:scale-[1.05] disabled:cursor-not-allowed disabled:opacity-60"
                        style={{
                          backgroundColor: color,
                          borderColor: isSelected ? "rgba(255,255,255,0.75)" : "hsl(var(--border))",
                          borderWidth: isSelected ? 2 : 1,
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
              ) : null}
            </div>

            <div className="space-y-1">
              <h1 className="text-3xl font-semibold tracking-tight">{project.name}</h1>
              {createdAtLabel ? (
                <p className="text-sm text-muted-foreground">
                  {tProjects("createdAt", { date: createdAtLabel })}
                </p>
              ) : null}
              <p className="text-xs font-medium uppercase tracking-[0.24em] text-muted-foreground">
                {tProjects("priority")} #{project.priority}
              </p>
            </div>
          </div>

          {colorError ? <p className="text-center text-sm text-destructive">{colorError}</p> : null}
          {colorFeedback ? (
            <p className="text-center text-sm" style={{ color: resolvedProjectColor }}>
              {colorFeedback}
            </p>
          ) : null}

          <div className="grid gap-3 sm:grid-cols-4">
            <div className="rounded-2xl border bg-muted/20 p-4">
              <p className="text-sm text-muted-foreground">{tProjects("target")}</p>
              <p className="mt-1 text-xl font-semibold">
                {formatMoneyWithSymbol(heroProgress.targetMinor, baseCurrency, currencySymbol)}
              </p>
            </div>
            <div className="rounded-2xl border bg-muted/20 p-4">
              <p className="text-sm text-muted-foreground">
                {locale === "en" ? "Funded" : "Financiado"}
              </p>
              <p className="mt-1 text-xl font-semibold">
                {formatMoneyWithSymbol(heroProgress.fundedReservedMinor, baseCurrency, currencySymbol)}
              </p>
            </div>
            <div className="rounded-2xl border bg-muted/20 p-4">
              <p className="text-sm text-muted-foreground">
                {locale === "en" ? "Planned this month" : "Planificado este mes"}
              </p>
              <p className="mt-1 text-xl font-semibold">
                {formatMoneyWithSymbol(heroProgress.plannedThisMonthMinor, baseCurrency, currencySymbol)}
              </p>
            </div>
            <div className="rounded-2xl border bg-muted/20 p-4">
              <p className="text-sm text-muted-foreground">
                {locale === "en" ? "Spent" : "Gastado"}
              </p>
              <p className="mt-1 text-xl font-semibold">
                {formatMoneyWithSymbol(heroProgress.spentMinor, baseCurrency, currencySymbol)}
              </p>
            </div>
          </div>

          <div className="space-y-3 rounded-2xl border bg-muted/30 p-4">
            <div className="grid gap-2 text-sm sm:grid-cols-[1fr_auto]">
              <p className="text-muted-foreground">
                {locale === "en" ? "From month closes" : "Desde cierres"}
              </p>
              <p className="font-semibold">
                {formatMoneyWithSymbol(
                  fundingFromMonthClosesMinor,
                  baseCurrency,
                  currencySymbol
                )}
              </p>
              <p className="text-muted-foreground">
                {locale === "en" ? "From piggy bank transfers" : "Desde transferencias de hucha"}
              </p>
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
              <p className="text-muted-foreground">
                {locale === "en" ? "Current monthly target" : "Objetivo mensual actual"}
              </p>
              <p className="font-semibold">
                {getProjectMonthlyFundingTargetMinor(project) > 0n
                  ? `${formatMoneyWithSymbol(getProjectMonthlyFundingTargetMinor(project), baseCurrency, currencySymbol)} ${tProjects("perMonth")}`
                  : tProjects("noPlan")}
              </p>
              <p className="text-muted-foreground">
                {locale === "en" ? "Estimated finish" : "Fin estimado"}
              </p>
              <p className="font-semibold">{estimatedFinishLabel}</p>
            </div>
          </div>

          <div className="space-y-3 rounded-2xl border p-4">
            <button
              type="button"
              className="flex w-full items-center justify-between text-left"
              onClick={() => setIsSpendingOpen((previous) => !previous)}
            >
              <span className="font-medium">
                {locale === "en" ? "Associated spending" : "Gasto asociado"}
              </span>
              <span className="text-sm text-muted-foreground">
                {isSpendingOpen ? tProjects("simulator.collapse") : tProjects("simulator.expand")}
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
                    const dateLabel = formatDateLabel(entry.date, locale) ?? entry.date;

                    return (
                      <div
                        key={entry.id}
                        className="flex items-center justify-between gap-3 rounded-xl border px-3 py-2"
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
      </div>

      <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm text-muted-foreground">{tProjects("history.tab")}</p>
              <h2 className="text-xl font-semibold">
                {locale === "en" ? "Funding history" : "Historial de financiación"}
              </h2>
            </div>
          </div>

          {historyRows.length === 0 ? (
            <p className="text-sm text-muted-foreground">{tProjects("history.empty")}</p>
          ) : (
            historyRows.map((entry) => {
              const contributorLabel = entry.userId
                ? userLabels[entry.userId] ?? entry.userId.slice(0, 8)
                : tProjects("history.unknownUser");
              const confirmedDateLabel = formatDateLabel(entry.confirmedAt, locale);

              return (
                <div key={entry.periodKey} className="rounded-2xl border p-4">
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
                        {formatMoneyWithSymbol(entry.cumulativeMinor, baseCurrency, currencySymbol)}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })
          )}
      </div>
    </PageContainer>
  );
}
