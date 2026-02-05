/**
 * Goal History Compute Functions
 * Business logic for historical goal tracking and gamification
 */

import type {
  GoalHistoryEntry,
  GoalGamification,
  GoalHistoryView,
  CurrentMonthComparison,
  GamificationCopy,
} from "./goal-history.types";

/**
 * Computes a view model for a past month entry
 * Returns null if the month is current or data is incomplete
 */
export const computeGoalHistoryView = (
  entry: GoalHistoryEntry,
  gamification: GoalGamification
): GoalHistoryView | null => {
  if (
    entry.isCurrent ||
    entry.finalSavedMinor === null ||
    entry.completed === null
  ) {
    return null;
  }

  const completionDay = entry.completedAt
    ? parseInt(entry.completedAt.split("-")[2], 10)
    : null;

  return {
    month: entry.month,
    targetMinor: entry.targetMinor,
    finalSavedMinor: entry.finalSavedMinor,
    completed: entry.completed,
    completedAt: entry.completedAt,
    difference: entry.finalSavedMinor - entry.targetMinor,
    completionDayDelta:
      completionDay && gamification.avgCompletionDay
        ? gamification.avgCompletionDay - completionDay
        : null,
  };
};

/**
 * Computes current month comparison against historical average
 */
export const computeCurrentMonthComparison = (
  currentSavedMinor: bigint,
  estimatedCompletionDay: number | null,
  gamification: GoalGamification
): CurrentMonthComparison => {
  return {
    savedVsAvg: currentSavedMinor - gamification.avgSavedMinor,
    velocityVsAvg:
      estimatedCompletionDay && gamification.avgCompletionDay
        ? gamification.avgCompletionDay - estimatedCompletionDay
        : null,
  };
};

/**
 * Gets streak text based on current streak value
 */
export const getStreakText = (
  streak: number,
  copy: GamificationCopy
): string => {
  return copy.streak(streak);
};

/**
 * Gets history summary text (completed/total)
 */
export const getHistoryText = (
  completed: number,
  total: number,
  copy: GamificationCopy
): string => {
  return copy.history(completed, total);
};

/**
 * Gets text for savings comparison vs average
 */
export const getSavedVsAvgText = (
  difference: bigint,
  formatAmount: (minor: bigint) => string,
  copy: GamificationCopy
): string => {
  const isPositive = difference >= 0n;
  const absAmount = isPositive ? difference : -difference;
  return copy.savedVsAvg(formatAmount(absAmount), isPositive);
};

/**
 * Gets text for velocity comparison vs average
 */
export const getVelocityVsAvgText = (
  daysDelta: number | null,
  copy: GamificationCopy
): string | null => {
  if (daysDelta === null) return null;
  return copy.velocityVsAvg(daysDelta);
};

/**
 * Gets completion detail text for a past month
 */
export const getCompletionDetailText = (
  view: GoalHistoryView,
  formatAmount: (minor: bigint) => string,
  copy: GamificationCopy
): string => {
  if (view.completed && view.completedAt) {
    const day = parseInt(view.completedAt.split("-")[2], 10);
    return copy.completedOnDay(day, view.completionDayDelta);
  }
  // Not completed - show how much was missing
  const missingAmount = -view.difference; // difference is negative when not completed
  return copy.missedBy(formatAmount(missingAmount));
};

/**
 * Determines if gamification section should be shown
 * Only show if there's at least 1 closed month with data
 */
export const shouldShowGamification = (gamification: GoalGamification): boolean => {
  return gamification.totalGoals > 0;
};

/**
 * Calculates the previous month string in YYYY-MM format
 */
export const getPreviousMonth = (month: string): string => {
  const [year, monthNum] = month.split("-").map(Number);
  const prevMonth = monthNum === 1 ? 12 : monthNum - 1;
  const prevYear = monthNum === 1 ? year - 1 : year;
  return `${prevYear}-${String(prevMonth).padStart(2, "0")}`;
};

/**
 * Calculates the next month string in YYYY-MM format
 */
export const getNextMonth = (month: string): string => {
  const [year, monthNum] = month.split("-").map(Number);
  const nextMonth = monthNum === 12 ? 1 : monthNum + 1;
  const nextYear = monthNum === 12 ? year + 1 : year;
  return `${nextYear}-${String(nextMonth).padStart(2, "0")}`;
};

/**
 * Gets current month in YYYY-MM format
 */
export const getCurrentMonth = (): string => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
};

/**
 * Checks if a month string is the current month
 */
export const isCurrentMonth = (month: string): boolean => {
  return month === getCurrentMonth();
};

/**
 * Checks if a month is in the future
 */
export const isFutureMonth = (month: string): boolean => {
  return month > getCurrentMonth();
};

/**
 * Parses RPC response to GoalHistoryEntry array
 */
export const parseGoalHistoryResponse = (
  data: Array<{
    month: string;
    target_minor: string | number | bigint;
    final_saved_minor: string | number | bigint | null;
    completed: boolean | null;
    completed_at: string | null;
    is_current: boolean;
  }>
): GoalHistoryEntry[] => {
  return data.map((row) => ({
    month: row.month,
    targetMinor: BigInt(row.target_minor),
    finalSavedMinor:
      row.final_saved_minor !== null ? BigInt(row.final_saved_minor) : null,
    completed: row.completed,
    completedAt: row.completed_at,
    isCurrent: row.is_current,
  }));
};

/**
 * Parses RPC response to GoalGamification
 */
export const parseGoalGamificationResponse = (data: {
  current_streak: number;
  total_completed: number;
  total_goals: number;
  avg_saved_minor: string | number | bigint;
  avg_completion_day: number | null;
}): GoalGamification => {
  return {
    currentStreak: data.current_streak,
    totalCompleted: data.total_completed,
    totalGoals: data.total_goals,
    avgSavedMinor: BigInt(data.avg_saved_minor),
    avgCompletionDay: data.avg_completion_day,
  };
};
