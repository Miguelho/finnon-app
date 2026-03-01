"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import {
  createTypographyStyles,
  themeTokens,
  toDayKey,
  getMarkerDataForRange,
  getExpandedMonthRange,
  getStartOfWeek,
  getWeekInfo,
  type WeekDay,
  type CalendarEvent,
  type Obligation,
  type Transaction,
  type DateRange,
} from "@poleursus/shared";
import { WeekView, WEEK_VIEW_HEIGHT } from "./week-view";
import { MonthOverlay } from "./month-overlay";

type CalendarCardProps = {
  locale: string;
  days: WeekDay[];
  obligations: Obligation[];
  transactions: Transaction[];
  calendarEvents: CalendarEvent[];
  selectedDate: Date | null;
  onSelectDate: (date: Date) => void;
  onPrevWeek: () => void;
  onNextWeek: () => void;
  weekTitle: string;
  viewMonthCta: string;
  viewWeekCta: string;
  /** Called when closing month view to reset week to current */
  onResetToToday?: () => void;
};

const tokens = themeTokens.light;
const colors = tokens.colors;
const typography = createTypographyStyles(tokens);

// Height for expanded month view (6 weeks * ~48px per row + padding)
const MONTH_VIEW_HEIGHT = 320;

/**
 * CalendarCard component with inline week-to-month expansion.
 * Replaces WeekStrip + MonthViewPanel with a unified experience.
 */
export function CalendarCard({
  locale,
  days,
  obligations,
  transactions,
  calendarEvents,
  selectedDate,
  onSelectDate,
  onPrevWeek,
  onNextWeek,
  weekTitle,
  viewMonthCta,
  viewWeekCta,
  onResetToToday,
}: CalendarCardProps) {
  const [mode, setMode] = useState<"week" | "month">("week");
  const [currentMonth, setCurrentMonth] = useState(() => new Date());
  const containerRef = useRef<HTMLDivElement>(null);

  const isMonthOpen = mode === "month";

  // Update currentMonth when selectedDate changes
  useEffect(() => {
    if (selectedDate) {
      setCurrentMonth(new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1));
    }
  }, [selectedDate]);

  // Compute marker data for the current view
  const weekMarkerData = useMemo(() => {
    if (days.length === 0) return new Map();
    const firstDay = days[0];
    const lastDay = days[days.length - 1];
    if (!firstDay || !lastDay) return new Map();
    return getMarkerDataForRange(firstDay.date, lastDay.date, obligations, transactions);
  }, [days, obligations, transactions]);

  const monthMarkerData = useMemo(() => {
    const range = getExpandedMonthRange(currentMonth);
    return getMarkerDataForRange(range.start, range.end, obligations, transactions);
  }, [currentMonth, obligations, transactions]);

  // Only highlight days that have activity (transactions/obligations)
  // Instead of highlighting a range, we'll use empty range to disable highlighting
  const monthHighlightRange = useMemo((): DateRange => {
    // Don't highlight any range - let DayMarkers show activity instead
    const start = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
    const end = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 0); // Invalid range = no highlight
    return { start, end };
  }, [currentMonth]);

  // Toggle mode
  const handleToggleMode = useCallback(() => {
    setMode((m) => (m === "week" ? "month" : "week"));
  }, []);

  // Close overlay and reset to current week/month
  const handleCloseOverlay = useCallback(() => {
    setMode("week");
    // Reset to current month
    setCurrentMonth(new Date());
    // Reset week to current if callback provided
    onResetToToday?.();
  }, [onResetToToday]);

  // Handle click outside to close
  useEffect(() => {
    if (!isMonthOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        handleCloseOverlay();
      }
    };

    // Delay to avoid closing immediately on toggle click
    const timeoutId = setTimeout(() => {
      document.addEventListener("mousedown", handleClickOutside);
    }, 10);

    return () => {
      clearTimeout(timeoutId);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isMonthOpen, handleCloseOverlay]);

  // Month navigation
  const handlePrevMonth = useCallback(() => {
    setCurrentMonth((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1));
  }, []);

  const handleNextMonth = useCallback(() => {
    setCurrentMonth((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1));
  }, []);

  // Format month title
  const monthTitle = useMemo(() => {
    return currentMonth.toLocaleDateString(locale, { month: "long", year: "numeric" });
  }, [currentMonth, locale]);

  return (
    <div ref={containerRef} className="relative">
      {/* Header - z-20 to stay above the shield (z-10) */}
      <div className="mb-3 flex items-center justify-between relative z-20">
        <div className="flex items-center gap-2">
          <h3
            style={{
              fontSize: typography.h3.fontSize,
              fontWeight: typography.h3.fontWeight,
              color: colors.text.primary,
            }}
          >
            {isMonthOpen ? monthTitle : weekTitle}
          </h3>
        </div>

        <div className="flex items-center gap-2">
          {/* Month navigation (only when month is open) */}
          {isMonthOpen && (
            <>
              <button
                type="button"
                onClick={handlePrevMonth}
                className="p-1 hover:opacity-70"
                style={{ color: colors.text.secondary }}
                aria-label="Previous month"
              >
                <ChevronLeft size={18} />
              </button>
              <button
                type="button"
                onClick={handleNextMonth}
                className="p-1 hover:opacity-70"
                style={{ color: colors.text.secondary }}
                aria-label="Next month"
              >
                <ChevronRight size={18} />
              </button>
            </>
          )}

          {/* Week navigation (only when week is shown) */}
          {!isMonthOpen && (
            <>
              <button
                type="button"
                onClick={onPrevWeek}
                className="p-1 hover:opacity-70"
                style={{ color: colors.text.secondary }}
                aria-label="Previous week"
              >
                <ChevronLeft size={18} />
              </button>
              <button
                type="button"
                onClick={onNextWeek}
                className="p-1 hover:opacity-70"
                style={{ color: colors.text.secondary }}
                aria-label="Next week"
              >
                <ChevronRight size={18} />
              </button>
            </>
          )}

          {/* Toggle button */}
          <button
            type="button"
            onClick={handleToggleMode}
            className="flex items-center gap-1 text-sm hover:underline"
            style={{ color: colors.action.primary }}
            aria-expanded={isMonthOpen}
            aria-controls="month-overlay"
          >
            {isMonthOpen ? viewWeekCta : viewMonthCta}
            <ChevronDown
              size={16}
              style={{
                transform: isMonthOpen ? "rotate(180deg)" : "rotate(0deg)",
                transition: "transform 200ms ease-out",
              }}
            />
          </button>
        </div>
      </div>

      {/* Body with dynamic height based on mode */}
      <div
        className="relative"
        style={{
          height: isMonthOpen ? MONTH_VIEW_HEIGHT : WEEK_VIEW_HEIGHT,
          transition: "height 200ms ease-out",
        }}
      >
        {/* WeekView (always visible) */}
        <WeekView
          days={days}
          locale={locale}
          markerData={weekMarkerData}
          selectedDate={selectedDate}
          onSelectDate={onSelectDate}
        />

        {/* MonthOverlay (absolute, reveals on top) */}
        <MonthOverlay
          isOpen={isMonthOpen}
          month={currentMonth}
          locale={locale}
          events={calendarEvents}
          highlightRange={monthHighlightRange}
          markerData={monthMarkerData}
          selectedDate={selectedDate}
          onSelectDate={(date) => {
            onSelectDate(date);
            // Keep overlay open after selection
          }}
          onClose={handleCloseOverlay}
        />
      </div>

      {/* Underlay shield for blocking interactions below (invisible) */}
      {isMonthOpen && (
        <div
          className="fixed inset-0 z-10"
          style={{ backgroundColor: "transparent" }}
          onClick={handleCloseOverlay}
          aria-hidden="true"
        />
      )}
    </div>
  );
}
