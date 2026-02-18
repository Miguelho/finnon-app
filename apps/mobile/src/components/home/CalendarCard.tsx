import { useState, useEffect, useCallback, useMemo } from "react";
import { View, Text, TouchableOpacity, StyleSheet, Pressable } from "react-native";
import { ChevronDown, ChevronLeft, ChevronRight } from "lucide-react-native";
import {
  createTypographyStyles,
  themeTokens,
  getMarkerDataForRange,
  getExpandedMonthRange,
  type WeekDay,
  type CalendarEvent,
  type Obligation,
  type Transaction,
  type DateRange,
} from "@poleursus/shared";
import { WeekView, WEEK_VIEW_HEIGHT } from "./WeekView";
import { MonthOverlay } from "./MonthOverlay";
import { useUserTheme } from "../../contexts/UserThemeContext";

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
 * Replaces WeekStrip + MonthViewModal with a unified experience.
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
  const { primaryActionColor } = useUserTheme();
  const [mode, setMode] = useState<"week" | "month">("week");
  const [currentMonth, setCurrentMonth] = useState(() => new Date());

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
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>
          {isMonthOpen ? monthTitle : weekTitle}
        </Text>

        <View style={styles.headerActions}>
          {/* Month navigation (only when month is open) */}
          {isMonthOpen && (
            <>
              <TouchableOpacity
                onPress={handlePrevMonth}
                style={styles.navButton}
                accessibilityLabel="Mes anterior"
              >
                <ChevronLeft size={18} color={colors.text.secondary} />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleNextMonth}
                style={styles.navButton}
                accessibilityLabel="Mes siguiente"
              >
                <ChevronRight size={18} color={colors.text.secondary} />
              </TouchableOpacity>
            </>
          )}

          {/* Week navigation (only when week is shown) */}
          {!isMonthOpen && (
            <>
              <TouchableOpacity
                onPress={onPrevWeek}
                style={styles.navButton}
                accessibilityLabel="Semana anterior"
              >
                <ChevronLeft size={18} color={colors.text.secondary} />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={onNextWeek}
                style={styles.navButton}
                accessibilityLabel="Semana siguiente"
              >
                <ChevronRight size={18} color={colors.text.secondary} />
              </TouchableOpacity>
            </>
          )}

          {/* Toggle button */}
          <TouchableOpacity
            onPress={handleToggleMode}
            style={styles.toggleButton}
            accessibilityLabel={isMonthOpen ? viewWeekCta : viewMonthCta}
            accessibilityState={{ expanded: isMonthOpen }}
          >
            <Text style={[styles.toggleText, { color: primaryActionColor }]}>
              {isMonthOpen ? viewWeekCta : viewMonthCta}
            </Text>
            <ChevronDown
              size={16}
              color={primaryActionColor}
              style={{
                transform: [{ rotate: isMonthOpen ? "180deg" : "0deg" }],
              }}
            />
          </TouchableOpacity>
        </View>
      </View>

      {/* Body with dynamic height based on mode */}
      <View style={[styles.body, { height: isMonthOpen ? MONTH_VIEW_HEIGHT : WEEK_VIEW_HEIGHT }]}>
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
      </View>

      {/* Underlay shield for blocking interactions below (invisible) */}
      {isMonthOpen && (
        <Pressable
          style={styles.shield}
          onPress={handleCloseOverlay}
          accessibilityElementsHidden
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "relative",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: tokens.spacing.md,
  },
  title: {
    ...typography.h3,
    color: colors.text.primary,
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: tokens.spacing.sm,
  },
  navButton: {
    padding: tokens.spacing.xs,
  },
  toggleButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: tokens.spacing.xs,
  },
  toggleText: {
    fontSize: tokens.typography.size.sm,
    color: colors.text.primary,
  },
  body: {
    position: "relative",
  },
  shield: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 10,
    backgroundColor: "transparent",
  },
});
