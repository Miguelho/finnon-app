"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight, Info } from "lucide-react";
import {
  createTypographyStyles,
  themeTokens,
  type WeekDay,
  type DotColorKey,
} from "@poleursus/shared";

type WeekStripProps = {
  days: WeekDay[];
  locale: string;
  selectedDate: Date | null;
  onSelectDate: (date: Date) => void;
  onViewMonth: () => void;
  onPrevWeek: () => void;
  onNextWeek: () => void;
  weekTitle: string;
  weekLabel: string;
  viewMonthCta: string;
  dotsLegend: string;
};

const DAY_NAMES_ES = ["L", "M", "X", "J", "V", "S", "D"] as const;
const DAY_NAMES_EN = ["M", "T", "W", "T", "F", "S", "S"] as const;

const getDayNames = (locale: string): readonly string[] => {
  if (locale === "en") return DAY_NAMES_EN;
  return DAY_NAMES_ES;
};

const DOT_COLORS: Record<DotColorKey, string> = {
  positive: themeTokens.light.colors.state.positive,
  negative: themeTokens.light.colors.state.negative,
  warning: themeTokens.light.colors.state.warning,
};

export function WeekStrip({
  days,
  locale,
  selectedDate,
  onSelectDate,
  onViewMonth,
  onPrevWeek,
  onNextWeek,
  weekTitle,
  weekLabel,
  viewMonthCta,
  dotsLegend,
}: WeekStripProps) {
  const [showLegend, setShowLegend] = useState(false);
  const colors = themeTokens.light.colors;
  const typography = createTypographyStyles(themeTokens.light);
  const dayNames = getDayNames(locale);

  const isSameDay = (date1: Date | null, date2: Date): boolean => {
    if (!date1) return false;
    return (
      date1.getFullYear() === date2.getFullYear() &&
      date1.getMonth() === date2.getMonth() &&
      date1.getDate() === date2.getDate()
    );
  };

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3
            style={{
              fontSize: typography.h3.fontSize,
              fontWeight: typography.h3.fontWeight,
              color: colors.text.primary,
            }}
          >
            {weekTitle}
          </h3>
          <button
            type="button"
            onClick={() => setShowLegend(!showLegend)}
            className="p-1 hover:opacity-70"
            style={{ color: colors.text.secondary }}
            aria-label="Ver leyenda de colores"
          >
            <Info size={16} />
          </button>
        </div>
        <button
          type="button"
          onClick={onViewMonth}
          className="text-sm hover:underline"
          style={{ color: colors.action.primary }}
        >
          {viewMonthCta}
        </button>
      </div>

      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={onPrevWeek}
          className="p-1 hover:opacity-70"
          style={{ color: colors.text.secondary }}
          aria-label="Semana anterior"
        >
          <ChevronLeft size={18} />
        </button>
        <span
          className="text-xs font-semibold"
          style={{ color: colors.text.secondary }}
        >
          {weekLabel}
        </span>
        <button
          type="button"
          onClick={onNextWeek}
          className="p-1 hover:opacity-70"
          style={{ color: colors.text.secondary }}
          aria-label="Semana siguiente"
        >
          <ChevronRight size={18} />
        </button>
      </div>

      {/* Legend tooltip */}
      {showLegend && (
        <div
          className="rounded-lg border px-3 py-2 text-xs"
          style={{
            backgroundColor: colors.bg.secondary,
            borderColor: colors.state.neutral,
            color: colors.text.secondary,
          }}
        >
          {dotsLegend}
        </div>
      )}

      {/* Week strip */}
      <div className="flex gap-1">
        {days.map((day, index) => {
          const isSelected = isSameDay(selectedDate, day.date);
          const isToday = day.isToday;

          return (
            <button
              key={day.dayKey}
              type="button"
              onClick={() => onSelectDate(day.date)}
              className="flex flex-1 flex-col items-center rounded-lg p-2 transition-colors"
              style={{
                backgroundColor: isSelected
                  ? colors.action.secondary
                  : "transparent",
                border: isToday
                  ? `2px solid ${colors.action.primary}`
                  : "2px solid transparent",
              }}
            >
              {/* Day name */}
              <span
                className="text-xs font-medium"
                style={{ color: colors.text.secondary }}
              >
                {dayNames[index]}
              </span>

              {/* Day number */}
              <span
                className="text-sm font-semibold"
                style={{
                  color: isToday ? colors.action.primary : colors.text.primary,
                }}
              >
                {day.dayOfMonth}
              </span>

              {/* Dots */}
              <div className="mt-1 flex items-center gap-0.5">
                {day.dots.map((dot, dotIndex) => (
                  <span
                    key={dotIndex}
                    className="h-1.5 w-1.5 rounded-full"
                    style={{ backgroundColor: DOT_COLORS[dot.color] }}
                  />
                ))}
                {day.overflowCount > 0 && (
                  <span
                    className="text-[10px]"
                    style={{ color: colors.text.muted }}
                  >
                    +{day.overflowCount}
                  </span>
                )}
                {day.dots.length === 0 && day.overflowCount === 0 && (
                  <span className="h-1.5 w-1.5" />
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
