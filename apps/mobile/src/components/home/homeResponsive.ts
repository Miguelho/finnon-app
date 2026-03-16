import { semanticColorTokens, type HomeProjectPreview } from "@poleursus/shared";

export const SAVINGS_VALUE_BLUE = semanticColorTokens.savings.primary;
export const ACTION_BLUE = SAVINGS_VALUE_BLUE;
export const INCOME_GREEN = "#4ade80";
export const EXPENSE_RED = "#f87171";

const euroFormatter = new Intl.NumberFormat("es-ES", {
  style: "currency",
  currency: "EUR",
});

const etaFormatter = new Intl.DateTimeFormat("es-ES", {
  month: "long",
  year: "numeric",
});

export type MobileHomeProjectPreview = HomeProjectPreview;

export const formatMinorCurrency = (value: bigint | number | string | null | undefined) => {
  if (value === null || value === undefined) return euroFormatter.format(0);
  const numeric = typeof value === "bigint" ? Number(value) : Number(value);
  return euroFormatter.format(Number.isFinite(numeric) ? numeric / 100 : 0);
};

export const formatEta = (value: Date | string | null) => {
  if (!value) return "Sin fecha";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "Sin fecha";
  return etaFormatter.format(date);
};

export const clampProgress = (value: number) => {
  if (!Number.isFinite(value) || value <= 0) return 0;
  if (value >= 1) return 1;
  return value;
};
