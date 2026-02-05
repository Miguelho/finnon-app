/**
 * Goal History Types
 * Types for historical goal tracking and gamification
 */

/** Raw entry from get_goal_history RPC */
export type GoalHistoryEntry = {
  month: string; // YYYY-MM
  targetMinor: bigint;
  finalSavedMinor: bigint | null;
  completed: boolean | null;
  completedAt: string | null; // YYYY-MM-DD
  isCurrent: boolean;
};

/** Gamification stats from get_goal_gamification RPC */
export type GoalGamification = {
  currentStreak: number;
  totalCompleted: number;
  totalGoals: number;
  avgSavedMinor: bigint;
  avgCompletionDay: number | null;
};

/** Computed view for a past month */
export type GoalHistoryView = {
  month: string;
  targetMinor: bigint;
  finalSavedMinor: bigint;
  completed: boolean;
  completedAt: string | null;
  // Derived values
  difference: bigint; // finalSavedMinor - targetMinor
  completionDayDelta: number | null; // days before/after average
};

/** Comparison of current month vs historical average */
export type CurrentMonthComparison = {
  savedVsAvg: bigint; // positive = saving more than average
  velocityVsAvg: number | null; // positive = days earlier than average
};

/** Goal data for a specific month (from get_goal_for_month RPC) */
export type GoalMonthData = {
  id: string;
  month: string;
  targetMinor: bigint;
  finalSavedMinor: bigint | null;
  completed: boolean | null;
  completedAt: string | null;
  isClosed: boolean;
};

/** Props for MonthNavigator component */
export type MonthNavigatorProps = {
  currentMonth: string; // YYYY-MM
  onMonthChange: (month: string) => void;
  minMonth?: string; // Oldest available month
};

/** Copy structure for gamification UI */
export type GamificationCopy = {
  streak: (months: number) => string;
  history: (completed: number, total: number) => string;
  savedVsAvg: (amount: string, isPositive: boolean) => string;
  velocityVsAvg: (days: number) => string;
  completedLabel: string;
  failedLabel: string;
  completedOnDay: (day: number, daysDelta: number | null) => string;
  missedBy: (amount: string) => string;
};
