export type Period = "week" | "month" | "quarter" | "year";

export interface DateRange {
  start: Date;
  end: Date;
}

export interface PeriodConfig {
  key: Period;
  label: string;
}

export const PERIODS: PeriodConfig[] = [
  { key: "week", label: "Semana" },
  { key: "month", label: "Mes" },
  { key: "quarter", label: "Trimestre" },
  { key: "year", label: "Año" },
];
