"use client";

import { useMemo, useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { ChevronLeft, ChevronRight, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
// InsightsCarousel removed - insights section no longer used
import { GoalSimulator } from "@/components/goal/goal-simulator";
import { GoalGamificationSection } from "@/components/goal/goal-gamification";
import { GoalHistoryHero } from "@/components/goal/goal-history-hero";
import {
  SlidePanel,
  SlidePanelBody,
  SlidePanelContent,
  SlidePanelDescription,
  SlidePanelFooter,
  SlidePanelHeader,
  SlidePanelTitle,
} from "@/components/ui/slide-panel";
import { createClient } from "@/lib/supabase/client";
import {
  computeGoalInsights,
  computeGoalProgress,
  computeGoalSummaryView,
  computeGoalSummaryViewV2,
  computeHeroDisplay,
  extractCandidatesFromSections,
  getDayFromDate,
  createTypographyStyles,
  formatMinorToMoney,
  formatMoneyWithSymbol,
  formatMonthLabel,
  getGoalTotalsFromTransactions,
  parseMoneyToMinor,
  parseSavingsCandidates,
  themeTokens,
  type FinancialGoal,
  type GoalTransaction,
  type HeroDisplayData,
  type SavingsCandidateTx,
  type SavingsSummary,
  type UserRole,
  upsertMonthlyGoal,
  getCurrentMonth,
  getPreviousMonth,
  getNextMonth,
  isCurrentMonth,
  parseGoalHistoryResponse,
  parseGoalGamificationResponse,
  computeGoalHistoryView,
  computeCurrentMonthComparison,
  shouldShowGamification,
  type GoalHistoryEntry,
  type GoalGamification as GoalGamificationData,
  type GoalHistoryView,
} from "@poleursus/shared";

const tokens = themeTokens.light;
const colors = tokens.colors;
const typography = createTypographyStyles(tokens);
const MS_PER_DAY = 1000 * 60 * 60 * 24;

const sanitizeNumericInput = (value: string) => value.replace(/[^0-9.,]/g, "");

const formatAbs = (value: bigint) => (value < 0n ? -value : value);

const formatSignedMoney = (
  value: bigint,
  currency: string,
  currencySymbol: string
) => {
  const formatted = formatMoneyWithSymbol(
    formatAbs(value),
    currency,
    currencySymbol
  );
  return value < 0n ? `-${formatted}` : formatted;
};

const formatSignedMoneyWithPlus = (
  value: bigint,
  currency: string,
  currencySymbol: string
) => {
  const formatted = formatMoneyWithSymbol(
    formatAbs(value),
    currency,
    currencySymbol
  );
  if (value === 0n) return formatted;
  return value < 0n ? `-${formatted}` : `+${formatted}`;
};

const getStatusColor = (status: "positive" | "negative" | "neutral") => {
  if (status === "positive") return colors.state.positive;
  if (status === "negative") return colors.state.negative;
  return colors.state.neutral;
};

type GoalRateTooltipProps = {
  label: string;
  body: string;
};

function GoalRateTooltip({ label, body }: GoalRateTooltipProps) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        popoverRef.current?.contains(target) ||
        triggerRef.current?.contains(target)
      ) {
        return;
      }
      setOpen(false);
    };
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [open]);

  return (
    <div className="relative inline-flex items-center">
      <button
        type="button"
        ref={triggerRef}
        aria-label={label}
        aria-expanded={open}
        onClick={() => setOpen((prev) => !prev)}
        className="flex h-6 w-6 items-center justify-center rounded-full text-muted-foreground transition hover:text-foreground"
      >
        <Info className="h-4 w-4" />
      </button>
      {open ? (
        <div
          ref={popoverRef}
          className="absolute left-0 top-full z-20 mt-2 w-64 whitespace-pre-line rounded-lg border px-3 py-2 text-xs shadow-sm"
          style={{
            backgroundColor: colors.bg.surface,
            borderColor: colors.state.neutral,
            color: colors.text.secondary,
          }}
        >
          {body}
        </div>
      ) : null}
    </div>
  );
}

type GoalHeroTooltipProps = {
  label: string;
  lines: string[];
  conclusion: string;
};

function GoalHeroTooltip({ label, lines, conclusion }: GoalHeroTooltipProps) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        popoverRef.current?.contains(target) ||
        triggerRef.current?.contains(target)
      ) {
        return;
      }
      setOpen(false);
    };
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [open]);

  return (
    <div className="relative inline-flex items-center">
      <button
        type="button"
        ref={triggerRef}
        aria-label={label}
        aria-expanded={open}
        onClick={() => setOpen((prev) => !prev)}
        className="flex h-6 w-6 items-center justify-center rounded-full text-muted-foreground transition hover:text-foreground"
      >
        <Info className="h-4 w-4" />
      </button>
      {open ? (
        <div
          ref={popoverRef}
          className="absolute left-0 top-full z-20 mt-2 w-72 rounded-lg border px-3 py-2 text-xs shadow-sm"
          style={{
            backgroundColor: colors.bg.surface,
            borderColor: colors.state.neutral,
            color: colors.text.secondary,
          }}
        >
          <div className="space-y-1">
            {lines.map((line, index) => (
              <p key={`${line}-${index}`}>{line}</p>
            ))}
          </div>
          <p
            className="mt-2 pt-2 font-medium"
            style={{ borderTop: `1px solid ${colors.state.neutral}` }}
          >
            {conclusion}
          </p>
        </div>
      ) : null}
    </div>
  );
}

type GoalClientProps = {
  accountId: string;
  baseCurrency: string;
  currencySymbol: string;
  monthKey: string;
  role: UserRole;
  currentUserId: string;
  initialGoal: FinancialGoal | null;
  initialTransactions: GoalTransaction[];
  initialPreviousExpenseTotalMinor: string | null;
};

export function GoalClient({
  accountId,
  baseCurrency,
  currencySymbol,
  monthKey,
  role,
  currentUserId,
  initialGoal,
  initialTransactions,
  initialPreviousExpenseTotalMinor,
}: GoalClientProps) {
  const locale = useLocale();
  const tGlobal = useTranslations();
  const tCommon = useTranslations("common");
  const tGoal = useTranslations("goal");
  const tTransactions = useTranslations("transactions");
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [goal, setGoal] = useState<FinancialGoal | null>(initialGoal);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [amountInput, setAmountInput] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [goalSummary, setGoalSummary] = useState<SavingsSummary | null>(null);
  const [savingsCandidates, setSavingsCandidates] = useState<SavingsCandidateTx[]>([]);

  // Month navigation and history
  const [selectedMonth, setSelectedMonth] = useState(monthKey);
  const [goalHistory, setGoalHistory] = useState<GoalHistoryEntry[]>([]);
  const [gamification, setGamification] = useState<GoalGamificationData | null>(null);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  const canEdit = role !== "viewer";
  const monthLabel = useMemo(
    () => formatMonthLabel(monthKey, locale),
    [locale, monthKey]
  );

  const previousExpenseTotalMinor = useMemo(() => {
    if (!initialPreviousExpenseTotalMinor) return null;
    try {
      return BigInt(initialPreviousExpenseTotalMinor);
    } catch {
      return null;
    }
  }, [initialPreviousExpenseTotalMinor]);

  const totals = useMemo(
    () => getGoalTotalsFromTransactions(initialTransactions),
    [initialTransactions]
  );

  const fetchGoalSummary = useCallback(async () => {
    try {
      const params = new URLSearchParams({
        accountId,
        month: monthKey,
        origin: "goal",
      });
      const response = await fetch(
        `/api/goal/savings-candidates?${params.toString()}`
      );
      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({}));
        const errorKey =
          typeof errorBody?.errorKey === "string"
            ? errorBody.errorKey
            : "errors.internalServer";
        throw new Error(tGlobal(errorKey));
      }
      const data = await response.json();
      const parsed = parseSavingsCandidates(data);
      setGoalSummary(parsed.summary);
      // Extract candidates for simulator
      const candidates = extractCandidatesFromSections(parsed.sections);
      setSavingsCandidates(candidates);
    } catch (error) {
      console.error("[Goal] Summary error", error);
    }
  }, [accountId, monthKey, tGlobal]);

  const fetchGoalHistory = useCallback(async () => {
    try {
      setIsLoadingHistory(true);
      const { data, error } = await supabase.rpc('get_goal_history', {
        p_account_id: accountId,
        p_limit: 12,
      });

      if (error) throw error;
      if (data) {
        const parsed = parseGoalHistoryResponse(data);
        setGoalHistory(parsed);
      }
    } catch (error) {
      console.error('[Goal] History fetch error', error);
    } finally {
      setIsLoadingHistory(false);
    }
  }, [accountId, supabase]);

  const fetchGamification = useCallback(async () => {
    try {
      const { data, error } = await supabase.rpc('get_goal_gamification', {
        p_account_id: accountId,
      });

      if (error) throw error;
      if (data && data.length > 0) {
        const parsed = parseGoalGamificationResponse(data[0]);
        setGamification(parsed);
      }
    } catch (error) {
      console.error('[Goal] Gamification fetch error', error);
    }
  }, [accountId, supabase]);

  useEffect(() => {
    fetchGoalSummary();
  }, [fetchGoalSummary]);

  useEffect(() => {
    if (goal) {
      fetchGoalHistory();
      fetchGamification();
    }
  }, [goal, fetchGoalHistory, fetchGamification]);

  const progress = useMemo(
    () => {
      if (goalSummary) {
        const summaryTotals = {
          incomeTotalMinor: goalSummary.incomeMinor,
          expenseTotalMinor: goalSummary.expenseMinor,
        };
        const summaryNow = goalSummary.today
          ? new Date(`${goalSummary.today}T00:00:00`)
          : undefined;
        return computeGoalProgress({
          goal,
          totals: summaryTotals,
          now: summaryNow,
        });
      }
      return computeGoalProgress({ goal, totals });
    },
    [goal, goalSummary, totals]
  );

  const summaryView = useMemo(
    () => computeGoalSummaryView(goalSummary),
    [goalSummary]
  );

  // V2: Métricas con fecha estimada de cumplimiento
  const summaryViewV2 = useMemo(
    () => computeGoalSummaryViewV2(goalSummary),
    [goalSummary]
  );

  // V3: Simplified hero display
  const heroDisplay = useMemo(
    () => computeHeroDisplay(goalSummary),
    [goalSummary]
  );

  const displayProgress = useMemo(() => {
    // V2: Usar métricas que incluyen pendientes cuando estén disponibles
    if (summaryViewV2) {
      return {
        targetMinor: summaryViewV2.targetMinor,
        savedMinor: summaryViewV2.savedTotalMinor, // Real + pendientes
        remainingMinor: summaryViewV2.remainingMinor,
        ratePerDayMinor: summaryView?.requiredDailyFromTodayMinor ?? 0n,
        progressRatio: summaryViewV2.progressRatio,
        status: summaryViewV2.status,
      };
    }
    if (summaryView) {
      return {
        targetMinor: summaryView.targetMinor,
        savedMinor: summaryView.savedMinor,
        remainingMinor: summaryView.remainingMinor,
        ratePerDayMinor: summaryView.requiredDailyFromTodayMinor,
        progressRatio: summaryView.progressRatio,
        status: summaryView.status,
      };
    }
    if (progress) {
      return {
        targetMinor: progress.targetMinor,
        savedMinor: progress.savedMinor,
        remainingMinor: progress.remainingMinor,
        ratePerDayMinor: progress.ratePerDayMinor,
        progressRatio: progress.progressRatio,
        status: progress.status,
      };
    }
    return null;
  }, [progress, summaryView, summaryViewV2]);

  const insightCopy = useMemo(
    () => ({
      forecast: (amount: string) => tGoal("insights.forecast", { amount }),
      expenseUp: (amount: string) => tGoal("insights.expenseUp", { amount }),
      expenseDown: (amount: string) => tGoal("insights.expenseDown", { amount }),
      expenseEven: tGoal("insights.expenseEven"),
      topCategories: (categories: string) =>
        tGoal("insights.topCategories", { categories }),
    }),
    [tGoal]
  );

  const insightFormatters = useMemo(
    () => ({
      formatSignedMoney: (value: bigint) =>
        formatSignedMoney(value, baseCurrency, currencySymbol),
      formatMoney: (value: bigint) =>
        formatMoneyWithSymbol(value, baseCurrency, currencySymbol),
    }),
    [baseCurrency, currencySymbol]
  );

  const simulatorCopy = useMemo(
    () => ({
      title: tGoal("simulator.title"),
      subtitle: {
        retrasado: tGoal("simulator.subtitle.retrasado"),
        enRiesgo: tGoal("simulator.subtitle.enRiesgo"),
        adelantado: tGoal("simulator.subtitle.adelantado"),
      },
      linkText: tGoal("simulator.linkText"),
      impact: {
        empty: tGoal("simulator.impact.empty"),
        emptyDetail: tGoal("simulator.impact.emptyDetail"),
        daysEarlier: (days: number) =>
          tGoal("simulator.impact.daysEarlier", { days }),
        reachGoal: tGoal("simulator.impact.reachGoal"),
        remaining: (amount: string) =>
          tGoal("simulator.impact.remaining", { amount }),
        savings: (amount: string) =>
          tGoal("simulator.impact.savings", { amount }),
      },
      itemImpact: (days: number) => tGoal("simulator.itemImpact", { days }),
      noItems: tGoal("simulator.noItems"),
    }),
    [tGoal]
  );

  const insights = useMemo(() => {
    const allInsights = computeGoalInsights({
      progress,
      totals,
      transactions: initialTransactions,
      previousExpenseTotalMinor,
      uncategorizedLabel: tTransactions("uncategorized"),
      copy: insightCopy,
      formatters: insightFormatters,
    });
    // V2: Filtrar insight de "forecast" cuando hay V2, ya que el Hero ya muestra
    // la fecha estimada de forma más precisa
    if (summaryViewV2) {
      return allInsights.filter((insight) => insight.id !== "forecast");
    }
    return allInsights;
  }, [
    initialTransactions,
    previousExpenseTotalMinor,
    progress,
    tTransactions,
    totals,
    insightCopy,
    insightFormatters,
    summaryViewV2,
  ]);

  const formattedTarget = displayProgress
    ? formatMoneyWithSymbol(
        displayProgress.targetMinor,
        baseCurrency,
        currencySymbol
      )
    : formatMoneyWithSymbol(0n, baseCurrency, currencySymbol);

  const formattedSaved = displayProgress
    ? formatSignedMoney(
        displayProgress.savedMinor,
        baseCurrency,
        currencySymbol
      )
    : formatMoneyWithSymbol(0n, baseCurrency, currencySymbol);

  const formattedRemaining = displayProgress
    ? formatMoneyWithSymbol(
        displayProgress.remainingMinor,
        baseCurrency,
        currencySymbol
      )
    : formatMoneyWithSymbol(0n, baseCurrency, currencySymbol);

  const formattedRate = displayProgress
    ? formatMoneyWithSymbol(
        displayProgress.ratePerDayMinor,
        baseCurrency,
        currencySymbol
      )
    : formatMoneyWithSymbol(0n, baseCurrency, currencySymbol);

  const daysLeft = useMemo(() => {
    if (goalSummary?.today && goalSummary.monthEnd) {
      const today = new Date(`${goalSummary.today}T00:00:00`);
      const monthEnd = new Date(`${goalSummary.monthEnd}T00:00:00`);
      const diffDays = Math.round((monthEnd.getTime() - today.getTime()) / MS_PER_DAY);
      return Math.max(diffDays, 0);
    }
    return progress?.daysLeft ?? null;
  }, [goalSummary, progress]);

  const rateHelperText = displayProgress
    ? tGoal("rateHelper", { amount: formattedRate })
    : null;

  const rateTooltipText =
    displayProgress && daysLeft !== null
      ? tGoal("rateTooltip", {
          gap: formattedRemaining,
          days: daysLeft,
          perDay: formattedRate,
        })
      : null;

  const progressTooltipText = useMemo(() => {
    if (!goalSummary) return null;

    const incomeRealMinor = goalSummary.incomeRealMinor ?? goalSummary.incomeMinor;
    const incomePendingMinor = goalSummary.incomePendingMinor ?? 0n;
    const expenseRealMinor = goalSummary.expenseRealMinor ?? goalSummary.expenseMinor;
    const expensePendingMinor = goalSummary.expensePendingMinor ?? 0n;
    const savedTotalMinor =
      (goalSummary.savedTotalMinor ?? goalSummary.savedMinor) ?? 0n;

    return [
      tGoal("progressTooltip.incomeReal", {
        amount: formatMoneyWithSymbol(incomeRealMinor, baseCurrency, currencySymbol),
      }),
      tGoal("progressTooltip.incomePending", {
        amount: formatMoneyWithSymbol(
          incomePendingMinor,
          baseCurrency,
          currencySymbol
        ),
      }),
      tGoal("progressTooltip.expenseReal", {
        amount: formatMoneyWithSymbol(
          expenseRealMinor,
          baseCurrency,
          currencySymbol
        ),
      }),
      tGoal("progressTooltip.expensePending", {
        amount: formatMoneyWithSymbol(
          expensePendingMinor,
          baseCurrency,
          currencySymbol
        ),
      }),
      tGoal("progressTooltip.savedTotal", {
        amount: formatSignedMoney(savedTotalMinor, baseCurrency, currencySymbol),
      }),
      tGoal("progressTooltip.formula"),
    ].join("\n");
  }, [baseCurrency, currencySymbol, goalSummary, tGoal]);

  const progressColor = getStatusColor(displayProgress?.status ?? "neutral");
  const progressWidth = displayProgress
    ? `${Math.round(displayProgress.progressRatio * 100)}%`
    : "0%";

  // V2: Hero dinámico basado en fecha estimada
  const heroV2Text = useMemo(() => {
    if (!summaryViewV2) return null;
    const { completionStatus, estimatedCompletionDate } = summaryViewV2;
    switch (completionStatus) {
      case "completed_today":
        return tGoal("hero.completed");
      case "completion_date": {
        const day = getDayFromDate(estimatedCompletionDate);
        return day !== null
          ? tGoal("hero.willComplete", { day })
          : tGoal("hero.notAchievable");
      }
      case "not_achievable":
      default:
        return tGoal("hero.notAchievable");
    }
  }, [summaryViewV2, tGoal]);

  const heroV2Color = useMemo(() => {
    if (!summaryViewV2) return colors.text.primary;
    const { completionStatus } = summaryViewV2;
    switch (completionStatus) {
      case "completed_today":
        return colors.state.positive;
      case "completion_date":
        return colors.text.primary;
      case "not_achievable":
        return colors.state.negative;
      default:
        return colors.text.primary;
    }
  }, [summaryViewV2]);

  const monthStatusText = useMemo(() => {
    if (!summaryViewV2?.monthStatus) return null;
    const { monthStatus } = summaryViewV2;
    switch (monthStatus) {
      case "adelantado":
        return tGoal("monthStatus.adelantado");
      case "en_riesgo":
        return tGoal("monthStatus.enRiesgo");
      case "retrasado":
        return tGoal("monthStatus.retrasado");
      default:
        return null;
    }
  }, [summaryViewV2, tGoal]);

  const monthStatusColor = useMemo(() => {
    if (!summaryViewV2?.monthStatus) return colors.text.secondary;
    const { monthStatus } = summaryViewV2;
    switch (monthStatus) {
      case "adelantado":
        return colors.state.positive;
      case "retrasado":
        return colors.state.negative;
      case "en_riesgo":
      default:
        return colors.text.secondary;
    }
  }, [summaryViewV2]);

  const heroTooltipData = useMemo(() => {
    if (!summaryViewV2 || !goalSummary) return null;

    const currentSavingMinor = goalSummary.savedRealMinor ?? goalSummary.savedMinor;
    const pendingNetMinor =
      (goalSummary.incomePendingMinor ?? 0n) -
      (goalSummary.expensePendingMinor ?? 0n);

    const lines = [
      tGoal("heroTooltip.currentSaving", {
        amount: formatMoneyWithSymbol(
          currentSavingMinor,
          baseCurrency,
          currencySymbol
        ),
      }),
      tGoal("heroTooltip.target", {
        amount: formatMoneyWithSymbol(
          summaryViewV2.targetMinor,
          baseCurrency,
          currencySymbol
        ),
      }),
    ];

    if (summaryViewV2.completionStatus !== "completed_today") {
      lines.push(
        tGoal("heroTooltip.pendingNet", {
          amount: formatSignedMoneyWithPlus(
            pendingNetMinor,
            baseCurrency,
            currencySymbol
          ),
        })
      );
    }

    if (summaryViewV2.completionStatus === "completed_today") {
      return {
        lines,
        conclusion: tGoal("heroTooltip.conclusionCompleted"),
      };
    }

    if (summaryViewV2.completionStatus === "completion_date") {
      const day = getDayFromDate(summaryViewV2.estimatedCompletionDate);
      return {
        lines,
        conclusion:
          day !== null
            ? tGoal("heroTooltip.conclusionWillComplete", { day })
            : tGoal("heroTooltip.conclusionNotAchievable"),
      };
    }

    return {
      lines,
      conclusion: tGoal("heroTooltip.conclusionNotAchievable"),
    };
  }, [baseCurrency, currencySymbol, goalSummary, summaryViewV2, tGoal]);

  // History and gamification computed values
  const isViewingCurrentMonth = useMemo(
    () => isCurrentMonth(selectedMonth),
    [selectedMonth]
  );

  const minMonth = useMemo(() => {
    if (goalHistory.length === 0) return undefined;
    return goalHistory[goalHistory.length - 1]?.month;
  }, [goalHistory]);

  const canGoBack = goal ? !minMonth || selectedMonth > minMonth : false;
  const canGoForward = goal ? !isCurrentMonth(selectedMonth) : false;

  const handlePreviousMonth = () => {
    if (canGoBack) {
      setSelectedMonth(getPreviousMonth(selectedMonth));
    }
  };

  const handleNextMonth = () => {
    if (canGoForward) {
      setSelectedMonth(getNextMonth(selectedMonth));
    }
  };

  const currentHistoryView = useMemo(() => {
    if (isViewingCurrentMonth || !gamification) return null;
    const entry = goalHistory.find((h) => h.month === selectedMonth);
    if (!entry) return null;
    return computeGoalHistoryView(entry, gamification);
  }, [selectedMonth, goalHistory, gamification, isViewingCurrentMonth]);

  const currentComparison = useMemo(() => {
    if (!isViewingCurrentMonth || !gamification || !summaryViewV2) return null;
    return computeCurrentMonthComparison(
      goalSummary?.savedRealMinor ?? 0n,
      summaryViewV2.estimatedCompletionDate
        ? parseInt(summaryViewV2.estimatedCompletionDate.split('-')[2], 10)
        : null,
      gamification
    );
  }, [isViewingCurrentMonth, gamification, summaryViewV2, goalSummary]);

  const gamificationCopy = useMemo(() => ({
    gamificationTitle: tGoal('history.gamificationTitle'),
    streakLabel: tGoal('history.streakLabel'),
    streak: (months: number) => tGoal('history.streak', { months }),
    historyLabel: tGoal('history.historyLabel'),
    history: (completed: number, total: number) =>
      tGoal('history.historyFormat', { completed, total }),
    comparisonTitle: tGoal('history.comparisonTitle'),
    comparisonSaved: tGoal('history.comparisonSaved'),
    comparisonVelocity: tGoal('history.comparisonVelocity'),
    savedPositive: (amount: string) => tGoal('history.savedPositive', { amount }),
    savedNegative: (amount: string) => tGoal('history.savedNegative', { amount }),
    velocityPositive: (days: number) => tGoal('history.velocityPositive', { days }),
    velocityNegative: (days: number) => tGoal('history.velocityNegative', { days }),
  }), [tGoal]);

  const historyHeroCopy = useMemo(() => ({
    completedLabel: tGoal('history.completedLabel'),
    failedLabel: tGoal('history.failedLabel'),
    completedOnDay: tGoal('history.completedOnDay', { day: 0 }),
    completedOnDayDelta: tGoal('history.completedOnDayDelta', { day: 0, delta: 0 }),
    completedOnDayDeltaLate: tGoal('history.completedOnDayDeltaLate', { day: 0, delta: 0 }),
    missedBy: tGoal('history.missedBy', { amount: '' }),
    finalAmount: tGoal('history.finalAmount'),
    targetWas: tGoal('history.targetWas', { amount: '' }),
    exceededBy: tGoal('history.exceededBy', { amount: '' }),
  }), [tGoal]);

  const handleOpenEditor = () => {
    setFormError(null);
    if (goal) {
      const value = formatMinorToMoney(
        displayProgress?.targetMinor ?? 0n,
        baseCurrency
      );
      setAmountInput(value);
    } else {
      setAmountInput("");
    }
    setIsEditorOpen(true);
  };

  const handleSave = async () => {
    if (!canEdit) return;
    const cleaned = amountInput.trim();
    const parsed = parseMoneyToMinor(cleaned, baseCurrency);
    if (typeof parsed === "object" && "error" in parsed) {
      setFormError(tGlobal(parsed.error.key, parsed.error.params));
      return;
    }

    if (parsed <= 0n) {
      setFormError(tGlobal("money.invalidAmount"));
      return;
    }

    setIsSaving(true);
    setFormError(null);

    try {
      const nextGoal = await upsertMonthlyGoal({
        client: supabase,
        accountId,
        month: monthKey,
        targetAmountBaseMinor: parsed,
        createdBy: currentUserId,
      });
      setGoal(nextGoal);
      fetchGoalSummary();
      setIsEditorOpen(false);
    } catch (error) {
      console.error("[Goal] Save error", error);
      setFormError(tGlobal("errors.internalServer"));
    } finally {
      setIsSaving(false);
    }
  };

  const hasTransactions = initialTransactions.length > 0;

  const monthNavigator = goal ? (
    <div
      className="text-sm"
      style={{
        display: "flex",
        alignItems: "center",
        gap: tokens.spacing.sm,
        color: colors.text.secondary,
        fontSize: typography.body.fontSize,
        fontWeight: typography.body.fontWeight,
      }}
    >
      <Button
        variant="ghost"
        size="icon"
        onClick={handlePreviousMonth}
        disabled={!canGoBack}
        aria-label="Previous month"
        style={{
          color: canGoBack ? colors.text.primary : colors.text.muted,
        }}
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>
      <span style={{ textTransform: "capitalize" }}>
        {isViewingCurrentMonth
          ? monthLabel
          : formatMonthLabel(selectedMonth, locale)}
      </span>
      <Button
        variant="ghost"
        size="icon"
        onClick={handleNextMonth}
        disabled={!canGoForward}
        aria-label="Next month"
        style={{
          color: canGoForward ? colors.text.primary : colors.text.muted,
        }}
      >
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  ) : null;

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4">
      <div className="space-y-1">
        <h1
          style={{
            fontSize: typography.display.fontSize,
            fontWeight: typography.display.fontWeight,
            color: colors.text.primary,
          }}
        >
          {tGoal("pageTitle")}
        </h1>
      </div>

      {/* CURRENT MONTH VIEW */}
      {goal && isViewingCurrentMonth ? (
        <>
        <Card>
          <CardHeader className="space-y-4">
            {/* V3: Simplified hero */}
            <div className="flex items-center justify-between">
              {monthNavigator}
              <Button
                variant="outline"
                size="sm"
                style={{
                  borderColor: colors.state.neutral,
                  backgroundColor: colors.bg.surface,
                  color: colors.text.primary,
                }}
                onClick={handleOpenEditor}
                disabled={!canEdit}
              >
                {tGoal("heroEditShort")}
              </Button>
            </div>

            {/* Main savings amount - big and centered */}
            <div className="text-center space-y-1">
              <h2
                style={{
                  fontSize: "2.5rem",
                  fontWeight: typography.display.fontWeight,
                  color: (() => {
                    if (!heroDisplay || !goalSummary) return colors.text.primary;

                    const savedReal = heroDisplay.savedRealMinor;
                    const savedTotal = goalSummary.savedTotalMinor ?? savedReal;
                    const target = heroDisplay.targetMinor;

                    // Verde: El ahorro real ya cumple el objetivo
                    if (savedReal >= target) return colors.state.positive;

                    // Amarillo: El ahorro real no cumple, pero con los pendientes sí llegará
                    if (savedTotal >= target) return colors.state.warning;

                    // Rojo: Ni con los pendientes llegará al objetivo
                    return colors.state.negative;
                  })(),
                  lineHeight: 1.1,
                }}
              >
                {heroDisplay
                  ? formatSignedMoney(
                      heroDisplay.savedRealMinor,
                      baseCurrency,
                      currencySymbol
                    )
                  : formattedSaved}
              </h2>
              <p
                className="text-sm"
                style={{ color: colors.text.secondary }}
              >
                {tGoal("heroTargetContext", { amount: formattedTarget })}
              </p>
            </div>

            {/* Progress bar based on real savings */}
            <div
              className="h-2 w-full rounded-full"
              style={{ backgroundColor: colors.state.neutral }}
              aria-hidden
            >
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: heroDisplay
                    ? `${Math.round(heroDisplay.realProgressRatio * 100)}%`
                    : progressWidth,
                  backgroundColor: heroDisplay
                    ? heroDisplay.barStatus === "positive"
                      ? colors.state.positive
                      : heroDisplay.barStatus === "negative"
                      ? colors.state.negative
                      : colors.state.neutral
                    : progressColor,
                }}
              />
            </div>

            {/* Projection chip - only show when applicable */}
            {heroDisplay?.projection && (
              <div
                className="flex items-center justify-center gap-2 rounded-lg px-3 py-2"
                style={{
                  backgroundColor: `${colors.state.positive}15`,
                  color: colors.state.positive,
                }}
              >
                <span className="text-sm">↑</span>
                <p className="text-sm font-medium">
                  {tGoal("heroProjection", {
                    day: heroDisplay.projection.day,
                    amount: formatMoneyWithSymbol(
                      heroDisplay.projection.amountMinor,
                      baseCurrency,
                      currencySymbol
                    ),
                  })}
                </p>
              </div>
            )}

            {!hasTransactions && (
              <p className="text-sm text-center" style={{ color: colors.text.secondary }}>
                {tGoal("noTransactions")}
              </p>
            )}
          </CardHeader>
        </Card>

        {/* Gamification Section - Only if there's history */}
        {gamification && shouldShowGamification(gamification) && (
          <GoalGamificationSection
            gamification={gamification}
            comparison={currentComparison}
            baseCurrency={baseCurrency}
            currencySymbol={currencySymbol}
            copy={gamificationCopy}
          />
        )}

        {/* Simulator */}
        {summaryViewV2?.monthStatus && (
          <GoalSimulator
            monthStatus={summaryViewV2.monthStatus}
            candidates={savingsCandidates}
            baseCurrency={baseCurrency}
            currencySymbol={currencySymbol}
            gapToGoalMinor={
              summaryViewV2?.remainingMinor ?? goalSummary?.gapToGoalMinor ?? null
            }
            categoriesById={{}}
            copy={simulatorCopy}
          />
        )}
        </>
      ) : goal && currentHistoryView ? (
        /* PAST MONTH VIEW */
        <>
          <GoalHistoryHero
            view={currentHistoryView}
            baseCurrency={baseCurrency}
            currencySymbol={currencySymbol}
            copy={historyHeroCopy}
            monthNavigator={monthNavigator}
          />
        </>
      ) : goal && !isViewingCurrentMonth ? (
        /* PAST MONTH - NO DATA */
        <>
          <Card>
            <CardContent className="p-6 text-center">
              <div
                className="flex items-center justify-start"
                style={{ marginBottom: tokens.spacing.sm }}
              >
                {monthNavigator}
              </div>
              <p className="text-sm" style={{ color: colors.text.secondary }}>
                {tGoal('history.noHistory')}
              </p>
            </CardContent>
          </Card>
        </>
      ) : (
        /* NO GOAL - EMPTY STATE */
        <Card>
          <CardContent className="space-y-4 p-6">
            <div className="space-y-2">
              <h2
                style={{
                  fontSize: typography.h2.fontSize,
                  fontWeight: typography.h2.fontWeight,
                  color: colors.text.primary,
                }}
              >
                {tGoal("emptyTitle")}
              </h2>
              <p className="text-sm" style={{ color: colors.text.secondary }}>
                {tGoal("emptyDescription")}
              </p>
            </div>
            <Button
              variant="outline"
              style={{
                borderColor: colors.state.neutral,
                backgroundColor: colors.bg.surface,
                color: colors.text.primary,
              }}
              onClick={handleOpenEditor}
              disabled={!canEdit}
            >
              {tGoal("createCta")}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Editor Panel */}
      <SlidePanel open={isEditorOpen} onOpenChange={setIsEditorOpen}>
        <SlidePanelContent>
          <SlidePanelHeader>
            <SlidePanelTitle>{tGoal("editorTitle")}</SlidePanelTitle>
            <SlidePanelDescription>{tGoal("editorDescription")}</SlidePanelDescription>
          </SlidePanelHeader>
          <SlidePanelBody className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="goal-amount">{tGoal("amountLabel")}</Label>
              <Input
                id="goal-amount"
                inputMode="decimal"
                value={amountInput}
                onChange={(event) =>
                  setAmountInput(sanitizeNumericInput(event.target.value))
                }
                placeholder={tGoal("amountPlaceholder")}
              />
              {formError && (
                <p className="text-sm" style={{ color: colors.state.negative }}>
                  {formError}
                </p>
              )}
            </div>
          </SlidePanelBody>
          <SlidePanelFooter>
            <Button
              variant="outline"
              onClick={() => setIsEditorOpen(false)}
              style={{
                borderColor: colors.state.neutral,
                backgroundColor: colors.bg.surface,
                color: colors.text.primary,
              }}
            >
              {tCommon("cancel")}
            </Button>
            <Button
              onClick={handleSave}
              disabled={!canEdit || isSaving}
              style={{
                backgroundColor: colors.text.primary,
                color: colors.bg.primary,
              }}
            >
              {isSaving ? tGoal("savingCta") : tGoal("saveCta")}
            </Button>
          </SlidePanelFooter>
        </SlidePanelContent>
      </SlidePanel>
    </div>
  );
}
