"use client";

import { useEffect, useMemo, useState } from "react";
import { getHeatLevel, type CalendarDayData } from "@poleursus/shared";
import { formatCurrencyParts } from "./utils";
import { useWebUserTheme } from "@/components/theme/web-user-theme-provider";
import { useTranslations } from "next-intl";

const WEEK_BAR_LAYOUT = {
  phone: {
    stackMaxHeight: 44,
    incomeMaxHeight: 18,
    columnMinHeight: 146,
    frameMinHeight: 52,
    barWidth: 18,
  },
  tablet: {
    stackMaxHeight: 56,
    incomeMaxHeight: 24,
    columnMinHeight: 170,
    frameMinHeight: 74,
    barWidth: 22,
  },
} as const;

export type CalendarDay = CalendarDayData & {
  dayNumber: number;
  isToday: boolean;
  isOtherMonth: boolean;
  dayLabel: string;
};

type CalendarProps = {
  view: "week" | "month";
  onViewChange: (view: "week" | "month") => void;
  periodLabel: string;
  monthDays: CalendarDay[];
  weekDays: CalendarDay[];
  selectedDayKey: string;
  onSelectDay: (dateKey: string) => void;
  onPrevPeriod?: () => void;
  onNextPeriod?: () => void;
  currencySymbol: string;
};

const HEAT_COLORS = {
  grafito: [
    "transparent",
    "rgba(212, 148, 58, 0.10)",
    "rgba(212, 140, 50, 0.20)",
    "rgba(215, 130, 42, 0.34)",
    "rgba(218, 118, 35, 0.52)",
    "rgba(222, 105, 28, 0.70)",
  ],
  oceano: [
    "transparent",
    "rgba(220, 140, 100, 0.10)",
    "rgba(218, 125, 85, 0.22)",
    "rgba(215, 110, 70, 0.36)",
    "rgba(212, 95, 55, 0.54)",
    "rgba(210, 80, 42, 0.72)",
  ],
} as const;

const HEAT_NUMBER_COLORS = {
  grafito: {
    0: "var(--account-text-secondary)",
    1: "var(--account-text-primary)",
    2: "var(--account-text-primary)",
    3: "#F5E6D8",
    4: "#FFF4EA",
    5: "#FFFFFF",
  },
  oceano: {
    0: "var(--account-text-secondary)",
    1: "var(--account-text-primary)",
    2: "var(--account-text-primary)",
    3: "#F0DDD0",
    4: "#FFF0E6",
    5: "#FFFFFF",
  },
} as const;

const TODAY_RING = {
  grafito: "rgba(237, 235, 232, 0.45)",
  oceano: "rgba(226, 234, 242, 0.40)",
} as const;

const TODAY_BG = {
  grafito: "rgba(255, 255, 255, 0.06)",
  oceano: "rgba(140, 180, 230, 0.08)",
} as const;

const TODAY_BORDER = {
  grafito: "rgba(255, 255, 255, 0.12)",
  oceano: "rgba(140, 180, 230, 0.15)",
} as const;

const INCOME = "#6DC9A0";
const INCOME_BRIGHT = "#8EDBB5";
const INCOME_BG = "rgba(109, 201, 160, 0.10)";

const EXPENSE_TEXT = {
  grafito: "#E0956A",
  oceano: "#E8A07A",
} as const;

const EXPENSE_BG = {
  grafito: "rgba(224, 149, 106, 0.10)",
  oceano: "rgba(232, 160, 122, 0.10)",
} as const;

const toMinorInt = (value: number) => {
  if (!Number.isFinite(value)) return 0n;
  return BigInt(Math.max(0, Math.round(value)));
};

const toSignedMinorInt = (value: number) => {
  if (!Number.isFinite(value)) return 0n;
  return BigInt(Math.round(value));
};

const getSignedAmountLabel = (minor: bigint, currencySymbol: string, locale: string) => {
  if (minor === 0n) return "—";
  const abs = minor < 0n ? -minor : minor;
  const sign = minor > 0n ? "+" : "−";
  return `${sign}${formatCurrencyParts(abs, currencySymbol, locale).full}`;
};

const clampNumber = (value: number, min: number, max: number) => {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
};

function TooltipContent({
  day,
  currencySymbol,
  locale,
  expenseColor,
}: {
  day: CalendarDay;
  currencySymbol: string;
  locale: string;
  expenseColor: string;
}) {
  const t = useTranslations();
  const expense = formatCurrencyParts(toMinorInt(day.totalExpense), currencySymbol, locale);
  const income = formatCurrencyParts(toMinorInt(day.totalIncome), currencySymbol, locale);
  const netAbs = formatCurrencyParts(
    day.net >= 0 ? toMinorInt(day.net) : toMinorInt(-day.net),
    currencySymbol,
    locale
  );
  const netSign = day.net > 0 ? "+" : day.net < 0 ? "−" : "";

  return (
    <div className="w-[220px] rounded-xl border border-[color:rgba(255,255,255,0.14)] bg-[var(--account-surface-alt)] p-3 shadow-[0_6px_20px_rgba(0,0,0,0.4)]">
      <div className="flex items-center justify-between text-xs">
        <span className="text-[var(--account-text-secondary)]">{t("home.calendar.expense")}</span>
        <span style={{ color: expenseColor }}>−{expense.full}</span>
      </div>
      <div className="mt-1 flex items-center justify-between text-xs">
        <span className="text-[var(--account-text-secondary)]">{t("home.calendar.income")}</span>
        <span style={{ color: INCOME }}>+{income.full}</span>
      </div>
      <div className="my-2 h-px bg-border" />
      <div className="flex items-center justify-between text-xs">
        <span className="text-[var(--account-text-secondary)]">{t("home.calendar.net")}</span>
        <span style={{ color: day.net >= 0 ? INCOME : expenseColor }}>
          {netSign}
          {netAbs.full}
        </span>
      </div>
    </div>
  );
}

export function Calendar({
  view,
  onViewChange,
  periodLabel,
  monthDays,
  weekDays,
  selectedDayKey,
  onSelectDay,
  onPrevPeriod,
  onNextPeriod,
  currencySymbol,
}: CalendarProps) {
  const t = useTranslations();
  const { theme } = useWebUserTheme();
  const [hoveredMonthDay, setHoveredMonthDay] = useState<CalendarDay | null>(null);
  const [hoveredWeekDay, setHoveredWeekDay] = useState<CalendarDay | null>(null);
  const [isTabletViewport, setIsTabletViewport] = useState(false);
  const isWeek = view === "week";
  const activeTheme = theme === "oceano" ? "oceano" : "grafito";
  const locale = typeof navigator !== "undefined" ? navigator.language : "es-ES";
  const weeklyLayout = isTabletViewport ? WEEK_BAR_LAYOUT.tablet : WEEK_BAR_LAYOUT.phone;

  useEffect(() => {
    if (typeof window === "undefined") return;

    const media = window.matchMedia("(min-width: 768px)");
    const update = () => setIsTabletViewport(media.matches);
    update();

    if (typeof media.addEventListener === "function") {
      media.addEventListener("change", update);
      return () => media.removeEventListener("change", update);
    }

    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  const visibleDays = isWeek ? weekDays : monthDays;

  const monthTotals = useMemo(() => {
    const monthVisibleDays = monthDays.filter((day) => !day.isOtherMonth);
    const income = monthVisibleDays.reduce((sum, day) => sum + day.totalIncome, 0);
    const expense = monthVisibleDays.reduce((sum, day) => sum + day.totalExpense, 0);
    return { income: toMinorInt(income), expense: toMinorInt(expense) };
  }, [monthDays]);

  const selectedDayData = useMemo(() => {
    return (
      visibleDays.find((day) => day.date === selectedDayKey) ??
      monthDays.find((day) => day.date === selectedDayKey) ??
      null
    );
  }, [visibleDays, monthDays, selectedDayKey]);

  const selectedDayTotals = useMemo(
    () => ({
      income: toMinorInt(selectedDayData?.totalIncome ?? 0),
      expense: toMinorInt(selectedDayData?.totalExpense ?? 0),
    }),
    [selectedDayData]
  );

  const monthHeatReference = useMemo(
    () => monthDays.filter((day) => !day.isOtherMonth),
    [monthDays]
  );

  const weeklyMaxExpense = useMemo(
    () => Math.max(1, ...weekDays.map((day) => day.totalExpense)),
    [weekDays]
  );

  const weeklyMaxIncome = useMemo(
    () => Math.max(1, ...weekDays.map((day) => day.totalIncome)),
    [weekDays]
  );

  const weeklyLegend = useMemo(() => {
    const map = new Map<string, { label: string; color: string }>();
    weekDays.forEach((day) => {
      day.expensesByCategory.forEach((category) => {
        if (!map.has(category.categoryId)) {
          map.set(category.categoryId, {
            label: category.categoryName,
            color: category.categoryColor,
          });
        }
      });
    });
    return Array.from(map.values());
  }, [weekDays]);

  const weekdayHeaders =
    locale.startsWith("en") ? ["M", "T", "W", "T", "F", "S", "S"] : ["L", "M", "X", "J", "V", "S", "D"];

  return (
    <div className="rounded-[14px] border border-border bg-card p-3">
      <div className="flex items-center gap-2">
        <div className="shrink-0">
          <div className="inline-flex rounded-full bg-[rgba(255,255,255,0.04)] p-[2px]">
            <button
              type="button"
              onClick={() => onViewChange("week")}
              className={`rounded-full px-3 py-1 text-[11px] ${
                isWeek
                  ? "bg-[rgba(255,255,255,0.08)] text-[var(--account-text-primary)]"
                  : "text-[var(--account-text-secondary)]"
              }`}
            >
              {t("home.calendar.week")}
            </button>
            <button
              type="button"
              onClick={() => onViewChange("month")}
              className={`rounded-full px-3 py-1 text-[11px] ${
                !isWeek
                  ? "bg-[rgba(255,255,255,0.08)] text-[var(--account-text-primary)]"
                  : "text-[var(--account-text-secondary)]"
              }`}
            >
              {t("home.calendar.month")}
            </button>
          </div>
        </div>

        <div className="flex min-w-0 flex-1 items-center justify-end">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onPrevPeriod}
              className="text-lg leading-none text-[var(--account-text-tertiary)]"
            >
              ‹
            </button>
            <span className="whitespace-nowrap text-center text-[13px] font-medium text-[var(--account-text-primary)]">
              {periodLabel}
            </span>
            <button
              type="button"
              onClick={onNextPeriod}
              className="text-lg leading-none text-[var(--account-text-tertiary)]"
            >
              ›
            </button>
          </div>
        </div>
      </div>

      {isWeek ? (
        <div className="mt-3">
          <div className="grid grid-cols-7 gap-[4px]">
            {weekDays.map((day) => {
              const isSelected = day.date === selectedDayKey;
              const dayTotal = day.totalExpense;
              const stackHeight = Math.max(
                dayTotal > 0
                  ? clampNumber(
                      (dayTotal / weeklyMaxExpense) * weeklyLayout.stackMaxHeight,
                      0,
                      weeklyLayout.stackMaxHeight
                    )
                  : 0,
                0
              );
              const incomeHeight =
                day.totalIncome > 0
                  ? clampNumber(
                      (day.totalIncome / weeklyMaxIncome) * weeklyLayout.incomeMaxHeight,
                      3,
                      weeklyLayout.incomeMaxHeight
                    )
                  : 0;

              return (
                <button
                  key={day.date}
                  type="button"
                  onMouseEnter={() => setHoveredWeekDay(day)}
                  onMouseLeave={() => setHoveredWeekDay((current) => (current?.date === day.date ? null : current))}
                  onClick={() => onSelectDay(day.date)}
                  className="rounded-[14px] border border-transparent px-0 py-[7px]"
                  style={{
                    minHeight: `${weeklyLayout.columnMinHeight}px`,
                    backgroundColor: day.isToday ? TODAY_BG[activeTheme] : isSelected ? "rgba(255,255,255,0.03)" : "transparent",
                    borderColor: day.isToday
                      ? TODAY_BORDER[activeTheme]
                      : isSelected
                        ? "rgba(255,255,255,0.14)"
                        : "transparent",
                  }}
                >
                  <div className="text-[8px] uppercase tracking-[0.5px] text-[var(--account-text-tertiary)]">
                    {day.dayLabel}
                  </div>
                  <div
                    className="mt-[2px] text-[16px] leading-[18px]"
                    style={{
                      color: day.totalIncome > 0 ? INCOME : "var(--account-text-primary)",
                      fontWeight: day.totalIncome > 0 ? 500 : 300,
                    }}
                  >
                    {day.dayNumber}
                  </div>

                  <div
                    className="mt-[2px] flex w-full items-end justify-center"
                    style={{ minHeight: `${weeklyLayout.frameMinHeight}px` }}
                  >
                    <div style={{ width: `${weeklyLayout.barWidth}px` }}>
                      <div
                        className="flex flex-col justify-end overflow-hidden rounded-[4px]"
                        style={{ height: `${weeklyLayout.stackMaxHeight}px` }}
                      >
                        {day.expensesByCategory.map((category) => {
                          const segment = dayTotal > 0 ? (category.amount / dayTotal) * stackHeight : 0;
                          return (
                            <div
                              key={`${day.date}-${category.categoryId}`}
                              className="w-full border-t border-black/10"
                              style={{
                                height: `${clampNumber(
                                  Math.max(segment, dayTotal > 0 ? 2 : 0),
                                  0,
                                  weeklyLayout.stackMaxHeight
                                )}px`,
                                backgroundColor: category.categoryColor,
                              }}
                            />
                          );
                        })}
                      </div>
                      <div
                        className="mt-[2px] rounded-[3px] bg-[#6DC9A0]"
                        style={{
                          width: `${weeklyLayout.barWidth}px`,
                          height: `${incomeHeight}px`,
                          opacity: day.totalIncome > 0 ? 0.52 : 0,
                        }}
                      />
                    </div>
                  </div>

                  <div
                    className="mt-[4px] text-[8px] font-semibold"
                    style={{
                      color:
                        day.net > 0
                          ? INCOME
                          : day.net < 0
                            ? EXPENSE_TEXT[activeTheme]
                            : "var(--account-text-tertiary)",
                    }}
                  >
                    {getSignedAmountLabel(toSignedMinorInt(day.net), currencySymbol, locale)}
                  </div>
                </button>
              );
            })}
          </div>

          <div className="mt-2 flex flex-wrap items-center justify-center gap-x-2 gap-y-2 border-t border-[color:rgba(255,255,255,0.12)] pt-2">
            {weeklyLegend.map((item) => (
              <div key={`${item.label}-${item.color}`} className="inline-flex items-center gap-1">
                <span className="h-[6px] w-[6px] rounded-[2px]" style={{ backgroundColor: item.color }} />
                <span className="text-[9px] text-[var(--account-text-tertiary)]">{item.label}</span>
              </div>
            ))}
            <div className="inline-flex items-center gap-1">
              <span className="h-[6px] w-[6px] rounded-[2px]" style={{ backgroundColor: INCOME }} />
              <span className="text-[9px] text-[var(--account-text-tertiary)]">{t("home.calendar.income")}</span>
            </div>
          </div>
        </div>
      ) : (
        <div className="mt-3">
          <div className="mx-auto w-full lg:w-1/2">
            <div className="grid grid-cols-7">
              {weekdayHeaders.map((label, index) => (
                <div
                  key={`${label}-${index}`}
                  className="pb-[2px] text-center text-[9px] tracking-[0.3px] text-[var(--account-text-tertiary)]"
                >
                  {label}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-[3px]">
              {monthDays.map((day) => {
                const heatLevel = getHeatLevel(day.totalExpense, monthHeatReference);
                const isSelected = day.date === selectedDayKey;
                const hasIncome = day.totalIncome > 0 || day.net > 0;
                const numberColor = hasIncome
                  ? heatLevel >= 4
                    ? INCOME_BRIGHT
                    : INCOME
                  : HEAT_NUMBER_COLORS[activeTheme][heatLevel];
                const numberWeight = hasIncome || day.isToday ? 500 : 300;

                return (
                  <button
                    key={day.date}
                    type="button"
                    onMouseEnter={() => setHoveredMonthDay(day)}
                    onMouseLeave={() =>
                      setHoveredMonthDay((current) => (current?.date === day.date ? null : current))
                    }
                    onClick={() => onSelectDay(day.date)}
                    className="aspect-square rounded-[8px] transition-transform hover:scale-[1.06]"
                    style={{
                      opacity: day.isOtherMonth ? 0.18 : 1,
                      backgroundColor: HEAT_COLORS[activeTheme][heatLevel],
                      border:
                        day.isToday
                          ? `1.5px solid ${TODAY_RING[activeTheme]}`
                          : isSelected
                            ? "1px solid rgba(255,255,255,0.16)"
                            : "1px solid transparent",
                    }}
                  >
                    <span
                      className="text-[13px]"
                      style={{
                        color: numberColor,
                        fontWeight: numberWeight,
                        textShadow: hasIncome && heatLevel >= 4
                          ? "0 0 8px rgba(109,201,160,0.25)"
                          : "none",
                      }}
                    >
                      {day.dayNumber}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mt-2 flex flex-wrap items-center justify-center gap-[6px] border-t border-[color:rgba(255,255,255,0.12)] pt-2">
            <span className="text-[9px] text-[var(--account-text-tertiary)]">{t("home.calendar.less")}</span>
            <div className="flex items-center gap-[3px]">
              {[0, 1, 2, 3, 4, 5].map((level) => (
                <span
                  key={`h-${level}`}
                  className="h-[10px] w-[10px] rounded-[3px]"
                  style={{
                    backgroundColor:
                      level === 0
                        ? "rgba(255,255,255,0.04)"
                        : HEAT_COLORS[activeTheme][level as 1 | 2 | 3 | 4 | 5],
                  }}
                />
              ))}
            </div>
            <span className="text-[9px] text-[var(--account-text-tertiary)]">{t("home.calendar.moreExpense")}</span>
            <span className="text-[11px] font-bold text-[#6DC9A0]">5</span>
            <span className="text-[9px] text-[var(--account-text-tertiary)]">{t("home.calendar.equalsIncome")}</span>
          </div>
        </div>
      )}

      <div className="mt-2 flex items-start justify-between gap-3">
        <div className="text-left">
          <p className="mb-1 text-[9px] uppercase tracking-[0.45px] text-[var(--account-text-tertiary)]">
            {t("home.calendar.day")}
          </p>
          <div className="flex items-center gap-1.5">
            <span className="rounded-full px-2 py-[4px] text-[10px] font-semibold" style={{ backgroundColor: INCOME_BG, color: INCOME }}>
              ↑ {formatCurrencyParts(selectedDayTotals.income, currencySymbol, locale).full}
            </span>
            <span
              className="rounded-full px-2 py-[4px] text-[10px] font-semibold"
              style={{ backgroundColor: EXPENSE_BG[activeTheme], color: EXPENSE_TEXT[activeTheme] }}
            >
              ↓ {formatCurrencyParts(selectedDayTotals.expense, currencySymbol, locale).full}
            </span>
          </div>
        </div>
        <div className="text-right">
          <p className="mb-1 text-[9px] uppercase tracking-[0.45px] text-[var(--account-text-tertiary)]">
            {t("home.calendar.month")}
          </p>
          <div className="flex items-center gap-1.5">
            <span className="rounded-full px-2 py-[4px] text-[10px] font-semibold" style={{ backgroundColor: INCOME_BG, color: INCOME }}>
              ↑ {formatCurrencyParts(monthTotals.income, currencySymbol, locale).full}
            </span>
            <span
              className="rounded-full px-2 py-[4px] text-[10px] font-semibold"
              style={{ backgroundColor: EXPENSE_BG[activeTheme], color: EXPENSE_TEXT[activeTheme] }}
            >
              ↓ {formatCurrencyParts(monthTotals.expense, currencySymbol, locale).full}
            </span>
          </div>
        </div>
      </div>

      {(hoveredMonthDay || hoveredWeekDay) ? (
        <div className="pointer-events-none fixed bottom-5 right-5 z-[80] hidden md:block">
          <TooltipContent
            day={(hoveredMonthDay ?? hoveredWeekDay)!}
            currencySymbol={currencySymbol}
            locale={locale}
            expenseColor={EXPENSE_TEXT[activeTheme]}
          />
        </div>
      ) : null}
    </div>
  );
}
