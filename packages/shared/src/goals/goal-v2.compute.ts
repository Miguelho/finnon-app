/**
 * Goal V2 Compute - Explicabilidad
 *
 * Funciones de cálculo cliente para la versión 2 de objetivos.
 * La métrica estrella es la fecha estimada de cumplimiento.
 */

import type {
  CompletionStatus,
  GoalProgressStatus,
  GoalProgressV2,
  MonthStatus,
} from "./types";
import type { SavingsSummary } from "./saving-mode";

const clampNumber = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

/**
 * Extrae el día del mes de una fecha YYYY-MM-DD
 */
export const getDayFromDate = (dateStr: string | null | undefined): number | null => {
  if (!dateStr) return null;
  const match = dateStr.match(/^\d{4}-\d{2}-(\d{2})$/);
  if (!match) return null;
  return parseInt(match[1], 10);
};

/**
 * Convierte SavingsSummary V2 a GoalProgressV2
 */
export const computeGoalProgressV2 = (
  summary: SavingsSummary | null
): GoalProgressV2 | null => {
  if (!summary) return null;

  // Usar métricas V2 si están disponibles, si no fallback a legacy
  const savedTotalMinor = summary.savedTotalMinor ?? summary.savedMinor;
  const targetMinor = summary.targetMinor;
  const remainingMinor =
    targetMinor > savedTotalMinor ? targetMinor - savedTotalMinor : 0n;

  const progressRatio =
    targetMinor > 0n
      ? clampNumber(Number(savedTotalMinor) / Number(targetMinor), 0, 1)
      : 0;

  // Completar con valores por defecto si no hay V2
  const completionStatus: CompletionStatus =
    summary.completionStatus ?? (savedTotalMinor >= targetMinor ? "completed_today" : "not_achievable");

  const estimatedCompletionDate = summary.estimatedCompletionDate ?? null;

  const monthStatus: MonthStatus = summary.monthStatus ?? "en_riesgo";

  return {
    targetMinor,
    savedTotalMinor,
    remainingMinor,
    progressRatio,
    completionStatus,
    estimatedCompletionDate,
    monthStatus,
    incomeRealMinor: summary.incomeRealMinor ?? summary.incomeMinor,
    expenseRealMinor: summary.expenseRealMinor ?? summary.expenseMinor,
    incomePendingMinor: summary.incomePendingMinor ?? 0n,
    expensePendingMinor: summary.expensePendingMinor ?? 0n,
  };
};

/**
 * Genera el texto del hero basado en el estado de cumplimiento
 */
export type HeroTextInput = {
  completionStatus: CompletionStatus;
  estimatedCompletionDate: string | null;
  copy: {
    completed: string;
    willComplete: (day: number) => string;
    notAchievable: string;
  };
};

export const getHeroText = ({
  completionStatus,
  estimatedCompletionDate,
  copy,
}: HeroTextInput): string => {
  switch (completionStatus) {
    case "completed_today":
      return copy.completed;
    case "completion_date": {
      const day = getDayFromDate(estimatedCompletionDate);
      return day !== null ? copy.willComplete(day) : copy.notAchievable;
    }
    case "not_achievable":
    default:
      return copy.notAchievable;
  }
};

/**
 * Determina el status visual basado en el estado V2
 */
export const getProgressStatusFromV2 = (
  progress: GoalProgressV2 | null
): GoalProgressStatus => {
  if (!progress) return "neutral";

  const hasActivity =
    progress.incomeRealMinor !== 0n || progress.expenseRealMinor !== 0n;

  if (!hasActivity) return "neutral";

  switch (progress.completionStatus) {
    case "completed_today":
      return "positive";
    case "completion_date":
      // Si cumple antes del 80% del mes, positivo
      if (progress.monthStatus === "adelantado") return "positive";
      return "neutral";
    case "not_achievable":
      return "negative";
    default:
      return "neutral";
  }
};

/**
 * Genera el texto del estado del mes
 */
export type MonthStatusTextInput = {
  monthStatus: MonthStatus;
  copy: {
    adelantado: string;
    enRiesgo: string;
    retrasado: string;
  };
};

export const getMonthStatusText = ({
  monthStatus,
  copy,
}: MonthStatusTextInput): string => {
  switch (monthStatus) {
    case "adelantado":
      return copy.adelantado;
    case "en_riesgo":
      return copy.enRiesgo;
    case "retrasado":
      return copy.retrasado;
    default:
      return copy.enRiesgo;
  }
};

/**
 * Genera el texto de impacto en días para un gasto
 */
export type DelayDaysTextInput = {
  delayDays: number | null | undefined;
  copy: {
    delayDays: (days: number) => string;
    noImpact?: string;
  };
};

export const getDelayDaysText = ({
  delayDays,
  copy,
}: DelayDaysTextInput): string | null => {
  if (delayDays === null || delayDays === undefined) return null;
  if (delayDays <= 0) return copy.noImpact ?? null;
  return copy.delayDays(delayDays);
};

/**
 * Determina si mostrar el impacto en días
 * Solo mostrar si hay impacto significativo (> 0 días)
 */
export const shouldShowDelayDays = (
  delayDays: number | null | undefined
): boolean => {
  return delayDays !== null && delayDays !== undefined && delayDays > 0;
};

/**
 * Convierte GoalProgressV2 al formato legacy GoalSummaryView para compatibilidad
 */
export type GoalSummaryViewV2 = {
  targetMinor: bigint;
  savedMinor: bigint;
  savedTotalMinor: bigint;
  remainingMinor: bigint;
  progressRatio: number;
  status: GoalProgressStatus;
  // V2
  completionStatus: CompletionStatus;
  estimatedCompletionDate: string | null;
  monthStatus: MonthStatus;
  // Legacy (para compatibilidad, deprecated)
  expectedSavedMinor?: bigint;
  deltaVsExpectedMinor?: bigint;
  requiredDailyFromTodayMinor?: bigint;
};

export const computeGoalSummaryViewV2 = (
  summary: SavingsSummary | null
): GoalSummaryViewV2 | null => {
  if (!summary) return null;

  const progressV2 = computeGoalProgressV2(summary);
  if (!progressV2) return null;

  const status = getProgressStatusFromV2(progressV2);

  return {
    targetMinor: progressV2.targetMinor,
    savedMinor: summary.savedMinor, // Real solo
    savedTotalMinor: progressV2.savedTotalMinor,
    remainingMinor: progressV2.remainingMinor,
    progressRatio: progressV2.progressRatio,
    status,
    completionStatus: progressV2.completionStatus,
    estimatedCompletionDate: progressV2.estimatedCompletionDate,
    monthStatus: progressV2.monthStatus,
    // Legacy
    expectedSavedMinor: summary.expectedSavedByTodayMinor,
    deltaVsExpectedMinor: summary.deltaVsExpectedMinor,
    requiredDailyFromTodayMinor: summary.requiredDailyFromTodayMinor,
  };
};

/**
 * Hero Display V3 - Simplified hero data
 * Based on real savings (not projected) with optional projection chip
 */
export type HeroDisplayData = {
  // Main data: real savings only
  savedRealMinor: bigint;
  targetMinor: bigint;
  realProgressRatio: number;

  // Bar status based on real progress
  barStatus: "positive" | "neutral" | "negative";

  // Projection chip (null if not applicable)
  projection: {
    amountMinor: bigint;
    day: number;
  } | null;
};

/**
 * Computes simplified hero display data
 * Shows real savings as primary metric with projection as secondary chip
 */
export const computeHeroDisplay = (
  summary: SavingsSummary | null
): HeroDisplayData | null => {
  if (!summary) return null;

  const savedRealMinor = summary.savedRealMinor ?? summary.savedMinor;
  const targetMinor = summary.targetMinor;
  const savedTotalMinor = summary.savedTotalMinor ?? summary.savedMinor;

  // Calculate real progress ratio (clamped 0-1)
  const realProgressRatio =
    targetMinor > 0n
      ? clampNumber(Number(savedRealMinor) / Number(targetMinor), 0, 1)
      : 0;

  // Determine bar status based on REAL savings (not projected)
  let barStatus: "positive" | "neutral" | "negative";
  if (savedRealMinor >= targetMinor) {
    // Goal already achieved with real savings
    barStatus = "positive";
  } else if (summary.completionStatus === "not_achievable") {
    // Won't reach goal even with pending
    barStatus = "negative";
  } else {
    // Pending, but will reach with future income
    barStatus = "neutral";
  }

  // Projection chip: only show if there's a difference between real and total
  // and we have a completion date
  let projection: HeroDisplayData["projection"] = null;
  const showProjection =
    savedTotalMinor > savedRealMinor &&
    summary.completionStatus === "completion_date" &&
    summary.estimatedCompletionDate;

  if (showProjection) {
    const day = getDayFromDate(summary.estimatedCompletionDate);
    if (day !== null) {
      projection = {
        amountMinor: savedTotalMinor,
        day,
      };
    }
  }

  return {
    savedRealMinor,
    targetMinor,
    realProgressRatio,
    barStatus,
    projection,
  };
};
