import { useMemo, type ReactNode } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import {
  createTypographyStyles,
  themeTokens,
  startOfMonth,
  endOfMonth,
  toDayKey,
  isSameDay,
  toMondayIndex,
  isFutureDay,
  getCalendarMarkerStyle,
  type CalendarEvent,
  type DateRange,
  type DayMarkerData,
} from "@poleursus/shared";
import { useUserTheme } from "../../contexts/UserThemeContext";

type DayRenderContext = {
  date: Date;
  dayKey: string;
  isCurrentMonth: boolean;
  isSelected: boolean;
  isToday: boolean;
  markerData: DayMarkerData | undefined;
};

type MonthMapProps = {
  month: Date;
  locale: string;
  events: CalendarEvent[];
  highlightRange?: DateRange;
  selectedDate?: Date | null;
  onSelectDate: (date: Date) => void;
  /** Optional marker data for DayMarker rendering */
  markerData?: Map<string, DayMarkerData>;
  /** Optional custom day content renderer */
  renderDayContent?: (context: DayRenderContext) => ReactNode;
};

const tokens = themeTokens.light;
const colors = tokens.colors;
const typography = createTypographyStyles(tokens);

export function MonthMap({
  month,
  locale,
  events,
  highlightRange,
  selectedDate,
  onSelectDate,
  markerData,
  renderDayContent,
}: MonthMapProps) {
  const { tokens: userTokens, primaryActionColor } = useUserTheme();
  const monthStart = startOfMonth(month);
  const monthEnd = endOfMonth(month);
  const weekdayStart = toMondayIndex(monthStart.getDay());
  const totalDays = monthEnd.getDate();
  const totalCells = Math.ceil((weekdayStart + totalDays) / 7) * 7;
  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const eventsByDay = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    events.forEach((event) => {
      const list = map.get(event.dayKey) ?? [];
      list.push(event);
      map.set(event.dayKey, list);
    });
    return map;
  }, [events]);

  const weekdayLabels = useMemo(() => {
    const formatter = new Intl.DateTimeFormat(locale, { weekday: "short" });
    const base = new Date(2023, 0, 2);
    return Array.from({ length: 7 }, (_, index) =>
      formatter.format(new Date(base.getTime() + index * 86400000))
    );
  }, [locale]);

  const cells = Array.from({ length: totalCells }, (_, index) => {
    const dayOffset = index - weekdayStart + 1;
    return new Date(month.getFullYear(), month.getMonth(), dayOffset);
  });

  const weeks = useMemo(() => {
    const rows: Date[][] = [];
    for (let i = 0; i < cells.length; i += 7) {
      rows.push(cells.slice(i, i + 7));
    }
    return rows;
  }, [cells]);

  return (
    <View style={styles.container}>
      <View style={styles.weekdays}>
        {weekdayLabels.map((label, index) => (
          <Text
            key={`${label}-${index}`}
            style={[
              styles.weekdayLabel,
              { color: userTokens.textTertiary },
              index < 6 && styles.weekdayLabelGap,
            ]}
          >
            {label}
          </Text>
        ))}
      </View>
      <View style={styles.weeks}>
        {weeks.map((week, weekIndex) => (
          <View
            key={`week-${weekIndex}`}
            style={[
              styles.weekRow,
              weekIndex < weeks.length - 1 && styles.weekRowGap,
            ]}
          >
            {week.map((date, dayIndex) => {
              const isCurrentMonth = date >= monthStart && date <= monthEnd;
              const dayKey = toDayKey(date);
              const dayEvents = eventsByDay.get(dayKey) ?? [];
              const markers = dayEvents.slice(0, 3);
              const overflowCount = dayEvents.length - markers.length;
              const isHighlighted =
                isCurrentMonth &&
                highlightRange &&
                date >= highlightRange.start &&
                date <= highlightRange.end;
              const isSelected = isSameDay(date, selectedDate);
              const isToday = isSameDay(date, today);
              const dayMarkerData = markerData?.get(dayKey);

              // Custom render content if provided
              const customContent = renderDayContent
                ? renderDayContent({
                    date,
                    dayKey,
                    isCurrentMonth,
                    isSelected,
                    isToday,
                    markerData: dayMarkerData,
                  })
                : null;

              return (
                <TouchableOpacity
                  key={dayKey}
              style={[
                styles.cell,
                dayIndex < 6 && styles.cellGap,
                {
                  borderColor: userTokens.border,
                  backgroundColor: userTokens.surfaceAlt,
                },
                isHighlighted && {
                  backgroundColor: userTokens.surface,
                  borderColor: primaryActionColor,
                },
                isSelected && { borderColor: primaryActionColor },
                isToday && { borderColor: primaryActionColor },
              ]}
              onPress={() => isCurrentMonth && onSelectDate(date)}
              disabled={!isCurrentMonth}
            >
              <Text
                style={[
                  styles.dayLabel,
                  { color: userTokens.textPrimary },
                  !isCurrentMonth && { color: userTokens.textTertiary },
                  isToday && { color: primaryActionColor },
                ]}
              >
                {date.getDate()}
                  </Text>
                  {customContent ?? (
                    <View style={styles.markerRow}>
                      {markers.map((event) => {
                        const isPending = isFutureDay(event.date);
                        const marker = getCalendarMarkerStyle(event.type, {
                          isPending,
                          colors,
                        });
                        const markerColor = marker.color;
                        const markerStyle =
                          marker.shape === "square"
                            ? styles.markerSquare
                            : marker.shape === "ring"
                              ? styles.markerRing
                              : styles.markerDot;
                        return (
                          <View
                            key={`${event.id}-${event.type}`}
                            style={[
                              markerStyle,
                              marker.shape === "ring"
                                ? { borderColor: markerColor }
                                : { backgroundColor: markerColor },
                            ]}
                          />
                        );
                      })}
                      {overflowCount > 0 && (
                        <Text style={[styles.overflowText, { color: userTokens.textTertiary }]}>
                          +{overflowCount}
                        </Text>
                      )}
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: tokens.spacing.sm,
  },
  weekdays: {
    flexDirection: "row",
  },
  weekdayLabel: {
    ...typography.meta,
    textAlign: "center",
    flex: 1,
  },
  weekdayLabelGap: {
    marginRight: tokens.spacing.xs,
  },
  weeks: {
    flexDirection: "column",
  },
  weekRow: {
    flexDirection: "row",
  },
  weekRowGap: {
    marginBottom: tokens.spacing.xs,
  },
  cell: {
    flex: 1,
    minHeight: 44,
    minWidth: 0,
    flexShrink: 1,
    borderRadius: tokens.radii.sm,
    borderWidth: 1,
    paddingVertical: tokens.spacing.xs,
    paddingHorizontal: 2,
    alignItems: "center",
    justifyContent: "space-between",
  },
  cellGap: {
    marginRight: tokens.spacing.xs,
  },
  dayLabel: {
    ...typography.meta,
  },
  markerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    minHeight: 10,
  },
  markerDot: {
    width: 6,
    height: 6,
    borderRadius: 999,
    opacity: 0.8,
  },
  markerSquare: {
    width: 6,
    height: 6,
    borderRadius: 2,
  },
  markerRing: {
    width: 7,
    height: 7,
    borderRadius: 999,
    borderWidth: 1,
  },
  overflowText: {
    ...typography.meta,
  },
});
