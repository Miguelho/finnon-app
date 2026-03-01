"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import {
  addMonths,
  buildProjectColorMap,
  computeProjectProgress,
  computeSavingsDistribution,
  computeSavingsHistoryStats,
  computeSavingsMonthFromTransactions,
  ConfirmationModal,
  formatMoneyWithSymbol,
  formatMonthLabel,
  getProjectColor,
  getMonthRangeFromKey,
  HUCHA_PROJECT_COLOR,
  toMonthKey,
  type Project,
  type ProjectContribution,
} from "@poleursus/shared";
import { ArrowLeft, ChevronLeft, ChevronRight, Info } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { PageContainer } from "@/components/layout/page-container";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const toMinor = (value: bigint | number | string | null | undefined): bigint => {
  if (value === null || value === undefined) return 0n;
  if (typeof value === "bigint") return value;
  if (typeof value === "number") return BigInt(Math.round(value));
  try {
    return BigInt(value);
  } catch {
    return 0n;
  }
};

type SavingsClientProps = {
  accountId: string;
  baseCurrency: string;
  currencySymbol: string;
  locale: "es" | "en";
};

type TxRow = {
  type: "income" | "expense";
  amount_minor: bigint | number | string | null;
  amount_base_minor: bigint | number | string | null;
  date: string;
};

const toPeriodKey = (value: string | Date | null | undefined) => {
  if (!value) return null;
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}`;
  }
  if (typeof value !== "string") return null;
  if (/^\d{4}-\d{2}$/.test(value)) return value;
  if (/^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 7);
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, "0")}`;
};

const buildMonthKeysEndingAt = (endMonthKey: string, count: number) =>
  Array.from({ length: count }, (_, index) => addMonths(endMonthKey, -(count - 1 - index)));

const formatSignedMoney = (value: bigint, baseCurrency: string, currencySymbol: string) => {
  const abs = value < 0n ? -value : value;
  const formatted = formatMoneyWithSymbol(abs, baseCurrency, currencySymbol);
  if (value === 0n) return formatted;
  return value > 0n ? `+${formatted}` : `-${formatted}`;
};

export function SavingsClient({
  accountId,
  baseCurrency,
  currencySymbol,
  locale,
}: SavingsClientProps) {
  const supabase = useMemo(() => createClient(), []);
  const t = useTranslations();
  const [monthKey, setMonthKey] = useState(toMonthKey(new Date()));
  const [projects, setProjects] = useState<Project[]>([]);
  const [periodContributions, setPeriodContributions] = useState<ProjectContribution[]>([]);
  const [historyContributions, setHistoryContributions] = useState<ProjectContribution[]>([]);
  const [historyTransactions, setHistoryTransactions] = useState<TxRow[]>([]);
  const [savingsMinor, setSavingsMinor] = useState(0n);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSpeedTooltipOpen, setIsSpeedTooltipOpen] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const range = getMonthRangeFromKey(monthKey);
      const txHistoryStart = getMonthRangeFromKey(addMonths(monthKey, -11));

      const { data: txRows, error: txError } = await supabase
        .from("transactions")
        .select("type, amount_minor, amount_base_minor, date")
        .eq("account_id", accountId)
        .gte("date", txHistoryStart.start)
        .lte("date", range.end);
      if (txError) throw txError;

      const selectedMonthTxRows = ((txRows ?? []) as TxRow[]).filter((tx) => {
        return toPeriodKey(tx.date) === monthKey;
      });

      const monthSavings = computeSavingsMonthFromTransactions(
        (selectedMonthTxRows as Array<{
          type: "income" | "expense";
          amount_minor: bigint | number | string | null;
          amount_base_minor: bigint | number | string | null;
        }>) ?? []
      );

      const { data: projectRows, error: projectsError } = await supabase
        .from("projects")
        .select("*")
        .eq("account_id", accountId)
        .eq("status", "active")
        .order("priority", { ascending: true });
      if (projectsError) throw projectsError;

      const { data: periodRows, error: periodError } = await supabase
        .from("project_contributions")
        .select("*")
        .eq("account_id", accountId)
        .eq("period", range.start)
        .eq("confirmed", true);
      if (periodError) throw periodError;

      const { data: historyRows, error: historyError } = await supabase
        .from("project_contributions")
        .select("*")
        .eq("account_id", accountId)
        .eq("confirmed", true)
        .order("period", { ascending: false })
        .limit(72);
      if (historyError) throw historyError;

      setSavingsMinor(monthSavings.savingsMinor);
      setProjects((projectRows ?? []) as Project[]);
      setPeriodContributions((periodRows ?? []) as ProjectContribution[]);
      setHistoryContributions((historyRows ?? []) as ProjectContribution[]);
      setHistoryTransactions((txRows ?? []) as TxRow[]);
    } catch (loadError) {
      console.error("[Savings][web] load error", loadError);
      setError(t("home.savings.loadError"));
    } finally {
      setLoading(false);
    }
  }, [accountId, monthKey, supabase, t]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const distribution = useMemo(
    () =>
      computeSavingsDistribution({
        projects,
        savingsMinor,
      }),
    [projects, savingsMinor]
  );

  const actualByProject = useMemo(() => {
    const map = new Map<string, bigint>();
    periodContributions.forEach((entry) => {
      map.set(entry.project_id, (map.get(entry.project_id) ?? 0n) + toMinor(entry.actual_amount_base_minor));
    });
    return map;
  }, [periodContributions]);

  const historyStats = useMemo(
    () =>
      computeSavingsHistoryStats({
        projects,
        contributions: historyContributions,
      }),
    [historyContributions, projects]
  );
  const projectColorMap = useMemo(() => buildProjectColorMap(projects), [projects]);

  const progressByProject = useMemo(() => {
    const byProject = new Map<string, ReturnType<typeof computeProjectProgress>>();
    const contributionsMap = new Map<string, ProjectContribution[]>();
    historyContributions.forEach((entry) => {
      const list = contributionsMap.get(entry.project_id) ?? [];
      list.push(entry);
      contributionsMap.set(entry.project_id, list);
    });

    projects.forEach((project) => {
      if (project.is_hucha) return;
      byProject.set(
        project.id,
        computeProjectProgress({
          project,
          contributions: contributionsMap.get(project.id) ?? [],
        })
      );
    });
    return byProject;
  }, [historyContributions, projects]);

  const monthlySavings = useMemo(() => {
    const map = new Map<string, bigint>();
    historyTransactions.forEach((tx) => {
      const period = toPeriodKey(tx.date);
      if (!period) return;
      const amount = toMinor(tx.amount_base_minor ?? tx.amount_minor);
      const signedAmount = tx.type === "income" ? amount : -amount;
      map.set(period, (map.get(period) ?? 0n) + signedAmount);
    });
    return map;
  }, [historyTransactions]);

  const chartPeriods = useMemo(() => buildMonthKeysEndingAt(monthKey, 6), [monthKey]);

  const evolutionRows = useMemo(() => {
    const achievedByPeriod = new Map(
      historyStats.periods.map((row) => [row.period, row.achieved] as const)
    );
    return chartPeriods.map((period) => ({
      period,
      amountMinor: monthlySavings.get(period) ?? 0n,
      achieved: achievedByPeriod.get(period) ?? false,
      isCurrent: period === monthKey,
    }));
  }, [chartPeriods, historyStats.periods, monthlySavings, monthKey]);

  const chartSegmentsByPeriod = useMemo(() => {
    const byPeriod = new Map<string, Map<string, bigint>>();
    historyContributions.forEach((entry) => {
      const period = toPeriodKey(entry.period);
      if (!period) return;
      const projectMap = byPeriod.get(period) ?? new Map<string, bigint>();
      const current = projectMap.get(entry.project_id) ?? 0n;
      projectMap.set(entry.project_id, current + toMinor(entry.actual_amount_base_minor));
      byPeriod.set(period, projectMap);
    });
    return byPeriod;
  }, [historyContributions]);

  const chartScaleMinor = useMemo(() => {
    let maxMinor = distribution.objectiveMinor > 0n ? distribution.objectiveMinor : 1n;
    evolutionRows.forEach((row) => {
      if (row.amountMinor > maxMinor) maxMinor = row.amountMinor;
    });
    return maxMinor > 0n ? maxMinor : 1n;
  }, [distribution.objectiveMinor, evolutionRows]);

  const goalLinePercent = useMemo(() => {
    if (distribution.objectiveMinor <= 0n) return 0;
    return Math.min(100, (Number(distribution.objectiveMinor) / Number(chartScaleMinor)) * 100);
  }, [chartScaleMinor, distribution.objectiveMinor]);
  const chartBarMaxHeightPx = 120;
  const chartBarMinHeightPx = 8;

  const reachedDayByPeriod = useMemo(() => {
    const objectiveMinor = distribution.objectiveMinor;
    const byPeriod = new Map<string, TxRow[]>();
    historyTransactions.forEach((tx) => {
      const period = toPeriodKey(tx.date);
      if (!period) return;
      const list = byPeriod.get(period) ?? [];
      list.push(tx);
      byPeriod.set(period, list);
    });

    const reached = new Map<string, number | null>();
    byPeriod.forEach((rows, period) => {
      if (objectiveMinor <= 0n) {
        reached.set(period, null);
        return;
      }
      const sorted = [...rows].sort((a, b) => a.date.localeCompare(b.date));
      let cumulative = 0n;
      let dayReached: number | null = null;
      for (const row of sorted) {
        const amount = toMinor(row.amount_base_minor ?? row.amount_minor);
        cumulative += row.type === "income" ? amount : -amount;
        if (cumulative >= objectiveMinor) {
          const parsedDate = new Date(`${row.date}T00:00:00`);
          dayReached = Number.isNaN(parsedDate.getTime()) ? null : parsedDate.getDate();
          break;
        }
      }
      reached.set(period, dayReached);
    });

    return reached;
  }, [distribution.objectiveMinor, historyTransactions]);

  const comparison = useMemo<{
    averageMinor: bigint;
    savingsDiffMinor: bigint;
    velocityLabel: string;
    velocityPositive: boolean;
    bestMonth: { period: string; amountMinor: bigint } | null;
  }>(() => {
    const previousRows = evolutionRows.filter((row) => row.period !== monthKey);
    const averageMinor =
      previousRows.length > 0
        ? previousRows.reduce((total, row) => total + row.amountMinor, 0n) /
          BigInt(previousRows.length)
        : 0n;

    const savingsDiffMinor = savingsMinor - averageMinor;
    const currentDay = reachedDayByPeriod.get(monthKey) ?? null;
    const previousDays = previousRows
      .map((row) => reachedDayByPeriod.get(row.period) ?? null)
      .filter((day): day is number => day !== null);
    const averageReachedDay =
      previousDays.length > 0
        ? Math.round(previousDays.reduce((sum, day) => sum + day, 0) / previousDays.length)
        : null;

    let velocityLabel = t("home.savings.velocityPending");
    let velocityPositive = false;
    if (currentDay !== null && averageReachedDay !== null) {
      const delta = currentDay - averageReachedDay;
      if (delta === 0) {
        velocityLabel = t("home.savings.velocityAverage");
      } else if (delta < 0) {
        velocityPositive = true;
        velocityLabel = t("home.savings.velocityEarlier", {
          days: Math.abs(delta),
        });
      } else {
        velocityLabel = t("home.savings.velocityLater", { days: delta });
      }
    } else if (currentDay !== null && averageReachedDay === null) {
      velocityLabel = t("home.savings.velocityDay", { day: currentDay });
    }

    let bestMonth: { period: string; amountMinor: bigint } | null = null;
    monthlySavings.forEach((amountMinor, period) => {
      if (bestMonth === null || amountMinor > bestMonth.amountMinor) {
        bestMonth = { period, amountMinor };
      }
    });

    return {
      averageMinor,
      savingsDiffMinor,
      velocityLabel,
      velocityPositive,
      bestMonth,
    };
  }, [evolutionRows, monthKey, monthlySavings, reachedDayByPeriod, savingsMinor, t]);

  const monthDate = new Date(`${monthKey}-01T00:00:00`);
  const monthLabel = new Intl.DateTimeFormat(locale === "en" ? "en-US" : "es-ES", {
    month: "long",
    year: "numeric",
  }).format(monthDate);
  const monthLabelCapitalized = monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1);
  const positiveSavings = savingsMinor > 0n ? savingsMinor : 0n;
  const progressScaleMinor =
    positiveSavings > distribution.objectiveMinor
      ? positiveSavings
      : distribution.objectiveMinor > 0n
      ? distribution.objectiveMinor
      : 1n;
  const projectsPercent =
    progressScaleMinor > 0n
      ? (Number(distribution.projectCoveredMinor) / Number(progressScaleMinor)) * 100
      : 0;
  const huchaPercent =
    progressScaleMinor > 0n
      ? (Number(distribution.huchaMinor) / Number(progressScaleMinor)) * 100
      : 0;

  return (
    <PageContainer className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <Link
          href="/projects"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          {t("navigation.projects")}
        </Link>
        <div className="inline-flex items-center gap-2 rounded-lg border p-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              const date = new Date(`${monthKey}-01T00:00:00`);
              date.setMonth(date.getMonth() - 1);
              setMonthKey(toMonthKey(date));
            }}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="min-w-40 text-center text-sm">{monthLabelCapitalized}</span>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              const date = new Date(`${monthKey}-01T00:00:00`);
              date.setMonth(date.getMonth() + 1);
              setMonthKey(toMonthKey(date));
            }}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {loading ? (
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">
            {t("common.loading")}
          </CardContent>
        </Card>
      ) : null}
      {error ? (
        <Card>
          <CardContent className="p-6 text-sm text-destructive">{error}</CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <h1 className="text-4xl font-semibold">
            {formatMoneyWithSymbol(savingsMinor, baseCurrency, currencySymbol)}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t("home.savings.savedThisMonth")}
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="relative h-9 overflow-hidden rounded-lg bg-secondary">
            {positiveSavings > 0n ? (
              <>
                {(() => {
                  let cumulativePercent = 0;
                  const segments = distribution.allocations.map((row) => {
                    const actualMinor = actualByProject.get(row.project.id) ?? row.allocatedMinor;
                    const segmentPercent = progressScaleMinor > 0n
                      ? (Number(actualMinor) / Number(progressScaleMinor)) * 100
                      : 0;
                    const projectColor = getProjectColor(row.project, projectColorMap);
                    const leftPercent = cumulativePercent;
                    cumulativePercent += segmentPercent;
                    return {
                      leftPercent,
                      widthPercent: segmentPercent,
                      color: projectColor,
                      amount: actualMinor,
                    };
                  });

                  return (
                    <>
                      {segments.map((segment, index) => (
                        <div
                          key={index}
                          className="absolute inset-y-0 flex items-center px-2 text-[11px] font-semibold text-black"
                          style={{
                            left: `${Math.max(0, Math.min(100, segment.leftPercent))}%`,
                            width: `${Math.max(0, Math.min(100, segment.widthPercent))}%`,
                            backgroundColor: segment.color,
                          }}
                        />
                      ))}
                    </>
                  );
                })()}
                <div
                  className="absolute inset-y-0 flex items-center justify-end bg-[#fb923c]/85 px-2 text-[11px] font-semibold text-black"
                  style={{
                    width: `${Math.max(0, Math.min(100, huchaPercent))}%`,
                    left: `${Math.max(0, Math.min(100, projectsPercent))}%`,
                    backgroundColor: "rgba(109, 201, 160, 0.85)",
                  }}
                >
                  {huchaPercent > 14
                    ? formatMoneyWithSymbol(distribution.huchaMinor, baseCurrency, currencySymbol)
                    : null}
                </div>
                <div
                  className="absolute -top-1 h-11 w-[2px] bg-white"
                  style={{
                    left: `${Math.max(
                      0,
                      Math.min(
                        100,
                        (Number(distribution.objectiveMinor) / Number(progressScaleMinor)) * 100
                      )
                    )}%`,
                  }}
                />
              </>
            ) : null}
          </div>
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <p>
              {distribution.projectCoveredMinor >= distribution.objectiveMinor &&
              distribution.objectiveMinor > 0n
                  ? t("home.savings.statusCovered")
                : t("home.savings.statusPending")}
            </p>
            <p>
              {t("home.savings.total")}:{" "}
              {formatMoneyWithSymbol(savingsMinor, baseCurrency, currencySymbol)}
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold">
            {t("home.savings.distributionTitle")}
          </h2>
        </CardHeader>
        <CardContent className="space-y-2">
          {distribution.allocations.map((row) => {
            const actualMinor = actualByProject.get(row.project.id) ?? row.allocatedMinor;
            const progress = progressByProject.get(row.project.id);
            const progressPct = Math.round((progress?.progressRatio ?? 0) * 100);
            const projectColor = getProjectColor(row.project, projectColorMap);
            return (
              <div
                key={row.project.id}
                className="flex items-center justify-between gap-3 border-b pb-3 last:border-b-0"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <div
                    className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg text-sm"
                    style={{ backgroundColor: `${projectColor}26` }}
                  >
                    {row.project.emoji}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{row.project.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {t("home.savings.commitmentProgress", {
                        commitment: formatMoneyWithSymbol(
                          row.commitmentMinor,
                          baseCurrency,
                          currencySymbol
                        ),
                        progress: progressPct,
                      })}
                    </p>
                  </div>
                </div>
                <p className="text-sm font-semibold" style={{ color: projectColor }}>
                  {formatMoneyWithSymbol(actualMinor, baseCurrency, currencySymbol)}
                </p>
              </div>
            );
          })}
          <div className="flex items-center justify-between gap-3 pt-2">
            <div className="flex items-center gap-3">
              <div
                className="flex h-9 w-9 items-center justify-center rounded-lg text-sm"
                style={{ backgroundColor: `${HUCHA_PROJECT_COLOR}26` }}
              >
                🐷
              </div>
              <div>
                <p className="text-sm font-medium">{t("home.savings.hucha")}</p>
                <p className="text-xs text-muted-foreground">
                  {t("home.savings.monthlySurplus")}
                </p>
              </div>
            </div>
            <p className="text-sm font-semibold" style={{ color: HUCHA_PROJECT_COLOR }}>
              {formatMoneyWithSymbol(distribution.huchaMinor, baseCurrency, currencySymbol)}
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold">
            {t("home.savings.progressTitle")}
          </h2>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-lg border bg-card p-4">
            <p className="text-xs text-muted-foreground">
              {t("home.savings.monthsCompletedLabel")}
            </p>
            <p className="text-2xl font-semibold text-emerald-500">
              {t("home.savings.monthsCompletedValue", {
                completed: historyStats.achievedMonths,
                total: historyStats.totalMonths,
              })}
            </p>
          </div>
          <div className="rounded-lg border bg-card p-4">
            <p className="text-xs text-muted-foreground">
              {t("home.savings.currentStreakLabel")}
            </p>
            <p className="text-2xl font-semibold">
              {t("home.savings.currentStreakValue", {
                count: historyStats.currentStreak,
              })}
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold">
            {t("home.savings.evolutionTitle")}
          </h2>
        </CardHeader>
        <CardContent>
          <div className="relative h-36">
            {distribution.objectiveMinor > 0n ? (
              <div
                className="pointer-events-none absolute left-0 right-0 border-t-2 border-dashed border-muted-foreground/70"
                style={{ bottom: `${goalLinePercent}%` }}
              >
                <span className="absolute right-0 -translate-y-4 text-[10px] text-muted-foreground">
                  {t("home.savings.goalLabel")}{" "}
                  {formatMoneyWithSymbol(distribution.objectiveMinor, baseCurrency, currencySymbol)}
                </span>
              </div>
            ) : null}
            <div className="absolute inset-0 flex items-end gap-2">
              {evolutionRows.map((row) => {
                const positiveAmount = row.amountMinor > 0n ? row.amountMinor : 0n;
                const heightPx = Math.max(
                  positiveAmount > 0n ? 10 : chartBarMinHeightPx,
                  (Number(positiveAmount) / Number(chartScaleMinor)) * chartBarMaxHeightPx
                );
                const periodContribs = chartSegmentsByPeriod.get(row.period);
                const segments: Array<{ color: string; ratio: number }> = [];
                if (periodContribs && positiveAmount > 0n) {
                  projects.forEach((project) => {
                    const amount = periodContribs.get(project.id) ?? 0n;
                    if (amount <= 0n) return;
                    segments.push({
                      color: project.is_hucha
                        ? HUCHA_PROJECT_COLOR
                        : getProjectColor(project, projectColorMap),
                      ratio: Number(amount) / Number(positiveAmount),
                    });
                  });
                }
                const hasSegments = segments.length > 0;
                return (
                  <div key={row.period} className="flex flex-1 flex-col items-center gap-2">
                    <div
                      className={`flex w-full max-w-8 flex-col-reverse overflow-hidden rounded-t-sm ${
                        row.isCurrent ? "shadow-[0_0_14px_rgba(74,222,128,0.35)]" : ""
                      }`}
                      style={{ height: `${Math.min(chartBarMaxHeightPx, heightPx)}px` }}
                    >
                      {hasSegments
                        ? segments.map((seg, index) => (
                            <div
                              key={index}
                              style={{
                                backgroundColor: seg.color,
                                flex: seg.ratio,
                              }}
                            />
                          ))
                        : (
                            <div
                              className="h-full w-full"
                              style={{ backgroundColor: HUCHA_PROJECT_COLOR }}
                            />
                          )}
                    </div>
                    <span className="text-[10px] text-muted-foreground">
                      {new Intl.DateTimeFormat(locale === "en" ? "en-US" : "es-ES", {
                        month: "short",
                      })
                        .format(new Date(`${row.period}-01T00:00:00`))
                        .replace(".", "")}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold">
            {t("home.savings.comparisonTitle")}
          </h2>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="flex items-center justify-between border-b pb-2">
            <span className="text-muted-foreground">{t("home.savings.comparisonSavings")}</span>
            <span className={comparison.savingsDiffMinor >= 0n ? "text-emerald-500" : "text-orange-400"}>
              {formatSignedMoney(comparison.savingsDiffMinor, baseCurrency, currencySymbol)}
            </span>
          </div>
          <div className="flex items-center justify-between border-b pb-2">
            <span className="flex items-center gap-1.5 text-muted-foreground">
              {t("home.savings.comparisonSpeed")}
              <button
                type="button"
                onClick={() => setIsSpeedTooltipOpen(true)}
                className="inline-flex items-center justify-center rounded-sm p-0.5 text-muted-foreground/60 transition-colors hover:bg-muted hover:text-muted-foreground"
                aria-label={t("home.savings.comparisonSpeedTooltip")}
              >
                <Info className="h-3.5 w-3.5" />
              </button>
            </span>
            <span className={comparison.velocityPositive ? "text-emerald-500" : "text-orange-400"}>
              {comparison.velocityLabel}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">{t("home.savings.comparisonBestMonth")}</span>
            <span>
              {comparison.bestMonth
                ? `${formatMonthLabel(comparison.bestMonth.period, locale === "en" ? "en-US" : "es-ES")} · ${formatMoneyWithSymbol(
                    comparison.bestMonth.amountMinor,
                    baseCurrency,
                    currencySymbol
                  )}`
                : t("home.savings.noData")}
            </span>
          </div>
        </CardContent>
      </Card>

      <ConfirmationModal
        open={isSpeedTooltipOpen}
        title={t("home.savings.comparisonSpeed")}
        description={t("home.savings.comparisonSpeedTooltip")}
        confirmLabel={t("common.ok")}
        onConfirm={() => setIsSpeedTooltipOpen(false)}
        onCancel={() => setIsSpeedTooltipOpen(false)}
      />
    </PageContainer>
  );
}
