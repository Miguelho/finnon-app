import {
  movementsTokens,
  semanticColorTokens,
  type HomeProjectPreview,
} from "@poleursus/shared";

export const SAVINGS_VALUE_BLUE = semanticColorTokens.savings.primary;
export const INCOME_GREEN = movementsTokens.colors.incomeGreen;
export const EXPENSE_RED = movementsTokens.colors.expenseRed;

const euroFormatter = new Intl.NumberFormat("es-ES", {
  style: "currency",
  currency: "EUR",
});

export type MobileHomeProjectPreview = HomeProjectPreview;

export const formatMinorCurrency = (value: bigint | number | string | null | undefined) => {
  if (value === null || value === undefined) return euroFormatter.format(0);
  const numeric = typeof value === "bigint" ? Number(value) : Number(value);
  return euroFormatter.format(Number.isFinite(numeric) ? numeric / 100 : 0);
};

const resolveIntlLocale = (locale: string) =>
  locale.toLowerCase().startsWith("en") ? "en-US" : "es-ES";

export const formatEta = (
  value: Date | string | null,
  locale: string = "es",
  fallbackLabel: string = ""
) => {
  if (!value) return fallbackLabel;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return fallbackLabel;
  return new Intl.DateTimeFormat(resolveIntlLocale(locale), {
    month: "long",
    year: "numeric",
  }).format(date);
};

export const clampProgress = (value: number) => {
  if (!Number.isFinite(value) || value <= 0) return 0;
  if (value >= 1) return 1;
  return value;
};
