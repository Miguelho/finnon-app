import type { CategoryIconKey } from "../icons/category-icons";

export type GoalType = "save";
export type MonthKey = string;

export type FinancialGoal = {
  id: string;
  account_id: string;
  month: MonthKey;
  type: GoalType;
  target_amount_base_minor: bigint | number | string;
  created_by: string;
  created_at?: string | Date;
  updated_at?: string | Date;
};

export type GoalTotals = {
  incomeTotalMinor: bigint;
  expenseTotalMinor: bigint;
};

export type GoalProgressStatus = "positive" | "negative" | "neutral";

export type GoalProgress = {
  targetMinor: bigint;
  savedMinor: bigint;
  remainingMinor: bigint;
  progressRatio: number;
  daysLeft: number;
  ratePerDayMinor: bigint;
  forecastEndMinor: bigint;
  expectedSavedMinor: bigint;
  status: GoalProgressStatus;
};

// V2 Types - Explicabilidad
export type CompletionStatus =
  | "completed_today"
  | "completion_date"
  | "not_achievable";

export type MonthStatus = "adelantado" | "en_riesgo" | "retrasado";

export type GoalProgressV2 = {
  // Métricas principales
  targetMinor: bigint;
  savedTotalMinor: bigint; // Real + pendiente
  remainingMinor: bigint;
  progressRatio: number; // 0-1

  // Fecha estimada (métrica estrella)
  completionStatus: CompletionStatus;
  estimatedCompletionDate: string | null; // YYYY-MM-DD o día del mes

  // Estado del mes
  monthStatus: MonthStatus;

  // Desglose
  incomeRealMinor: bigint;
  expenseRealMinor: bigint;
  incomePendingMinor: bigint;
  expensePendingMinor: bigint;
};

export type GoalTransaction = {
  type: "income" | "expense";
  amount_minor?: bigint | number | string | null;
  amount_base_minor?: bigint | number | string | null;
  category?: {
    id?: string | null;
    name?: string | null;
    icon_id?: CategoryIconKey | null;
  } | null;
};

export type InsightId = "forecast" | "mom_expense" | "top_categories";

export type InsightViewModel = {
  id: InsightId;
  iconKind: "svg" | "category-icons";
  status: GoalProgressStatus;
  body: string;
  svgName?: "delta" | "compare";
  categories?: Array<{
    categoryId: string;
    iconName?: string | null;
    fallbackLetter?: string | null;
    colorToken?: string | null;
  }>;
};
