"use client";

import { forwardRef, useImperativeHandle, useRef } from "react";
import {
  createTypographyStyles,
  themeTokens,
  isSameDay,
  toDayKey,
  type WeekDay,
  type DayMarkerData,
} from "@poleursus/shared";
import { DayMarker } from "./day-marker";

type WeekViewProps = {
  days: WeekDay[];
  locale: string;
  markerData: Map<string, DayMarkerData>;
  selectedDate: Date | null;
  onSelectDate: (date: Date) => void;
};

export type WeekViewHandle = {
  getDayRect: (dayKey: string) => DOMRect | null;
};

const DAY_NAMES_ES = ["L", "M", "X", "J", "V", "S", "D"] as const;
const DAY_NAMES_EN = ["M", "T", "W", "T", "F", "S", "S"] as const;

const getDayNames = (locale: string): readonly string[] => {
  if (locale === "en") return DAY_NAMES_EN;
  return DAY_NAMES_ES;
};

const colors = themeTokens.light.colors;
const typography = createTypographyStyles(themeTokens.light);

// Fixed height for week view (needed for MonthOverlay positioning)
export const WEEK_VIEW_HEIGHT = 80;

/**
 * WeekView component displaying a 7-column grid of days with DayMarkers.
 * Used inside CalendarCard for the week strip.
 */
export const WeekView = forwardRef<WeekViewHandle, WeekViewProps>(
  function WeekView(
    { days, locale, markerData, selectedDate, onSelectDate },
    ref
  ) {
    const dayRefs = useRef<Map<string, HTMLButtonElement>>(new Map());
    const dayNames = getDayNames(locale);

    // Expose method to measure day positions (for ghost morph)
    useImperativeHandle(ref, () => ({
      getDayRect: (dayKey: string) => {
        const el = dayRefs.current.get(dayKey);
        return el?.getBoundingClientRect() ?? null;
      },
    }));

    return (
      <div
        className="grid grid-cols-7 gap-1"
        style={{ height: WEEK_VIEW_HEIGHT }}
      >
        {days.map((day, index) => {
          const isSelected = isSameDay(selectedDate, day.date);
          const isToday = day.isToday;
          const dayKey = day.dayKey;
          const marker = markerData.get(dayKey);

          return (
            <button
              key={dayKey}
              ref={(el) => {
                if (el) {
                  dayRefs.current.set(dayKey, el);
                } else {
                  dayRefs.current.delete(dayKey);
                }
              }}
              type="button"
              onClick={() => onSelectDate(day.date)}
              className="flex flex-col items-center justify-start rounded-lg p-2 transition-colors hover:bg-gray-50"
              style={{
                backgroundColor: "transparent",
                border: isToday || isSelected
                  ? `2px solid ${colors.action.primary}`
                  : "2px solid transparent",
              }}
              aria-label={`${dayNames[index]} ${day.dayOfMonth}`}
              aria-pressed={isSelected}
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
                  color:
                    isToday || isSelected ? colors.action.primary : colors.text.primary,
                }}
              >
                {day.dayOfMonth}
              </span>

              {/* DayMarker */}
              <div className="mt-1">
                {marker ? (
                  <DayMarker
                    {...marker}
                    variant="week"
                    isSelected={isSelected}
                    isToday={isToday}
                  />
                ) : (
                  // Placeholder for consistent height
                  <div style={{ height: 16 }} />
                )}
              </div>
            </button>
          );
        })}
      </div>
    );
  }
);
