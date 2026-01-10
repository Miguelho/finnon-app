import { useMemo } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import {
  createTypographyStyles,
  themeTokens,
  type CalendarEvent,
  type DateRange,
} from "@poleursus/shared";

type MonthMapProps = {
  month: Date;
  locale: string;
  events: CalendarEvent[];
  highlightRange?: DateRange;
  selectedDate?: Date | null;
  onSelectDate: (date: Date) => void;
};

const tokens = themeTokens.light;
const colors = tokens.colors;
const typography = createTypographyStyles(tokens);

const buildDayKey = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const startOfMonth = (date: Date) =>
  new Date(date.getFullYear(), date.getMonth(), 1);

const endOfMonth = (date: Date) =>
  new Date(date.getFullYear(), date.getMonth() + 1, 0);

const isSameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

const toMondayIndex = (weekday: number) => (weekday + 6) % 7;

const getMarkerStyle = (type: CalendarEvent["type"]) => {
  switch (type) {
    case "obligation_paid":
      return { color: colors.action.primary, shape: "square" as const };
    case "obligation_pending":
      return { color: colors.state.warning, shape: "square" as const };
    case "recurring_income":
      return { color: colors.state.positive, shape: "ring" as const };
    case "recurring_expense":
      return { color: colors.state.negative, shape: "ring" as const };
    case "one_off_income":
      return { color: colors.state.positive, shape: "dot" as const };
    case "one_off_expense":
    default:
      return { color: colors.state.negative, shape: "dot" as const };
  }
};

export function MonthMap({
  month,
  locale,
  events,
  highlightRange,
  selectedDate,
  onSelectDate,
}: MonthMapProps) {
  const monthStart = startOfMonth(month);
  const monthEnd = endOfMonth(month);
  const weekdayStart = toMondayIndex(monthStart.getDay());
  const totalDays = monthEnd.getDate();
  const totalCells = Math.ceil((weekdayStart + totalDays) / 7) * 7;

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
              const dayKey = buildDayKey(date);
              const dayEvents = eventsByDay.get(dayKey) ?? [];
              const markers = dayEvents.slice(0, 3);
              const overflowCount = dayEvents.length - markers.length;
              const isHighlighted =
                isCurrentMonth &&
                highlightRange &&
                date >= highlightRange.start &&
                date <= highlightRange.end;
              const isSelected = selectedDate
                ? isSameDay(date, selectedDate)
                : false;

              return (
                <TouchableOpacity
                  key={dayKey}
                  style={[
                    styles.cell,
                    dayIndex < 6 && styles.cellGap,
                    isHighlighted && styles.cellHighlight,
                    isSelected && styles.cellSelected,
                  ]}
                  onPress={() => isCurrentMonth && onSelectDate(date)}
                  disabled={!isCurrentMonth}
                >
                  <Text
                    style={[
                      styles.dayLabel,
                      !isCurrentMonth && styles.dayLabelMuted,
                    ]}
                  >
                    {date.getDate()}
                  </Text>
                  <View style={styles.markerRow}>
                    {markers.map((event) => {
                      const marker = getMarkerStyle(event.type);
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
                              ? { borderColor: marker.color }
                              : { backgroundColor: marker.color },
                          ]}
                        />
                      );
                    })}
                    {overflowCount > 0 && (
                      <Text style={styles.overflowText}>+{overflowCount}</Text>
                    )}
                  </View>
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
    color: colors.text.muted,
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
    borderColor: colors.state.neutral,
    paddingVertical: tokens.spacing.xs,
    paddingHorizontal: 2,
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.bg.secondary,
  },
  cellGap: {
    marginRight: tokens.spacing.xs,
  },
  cellHighlight: {
    backgroundColor: colors.action.secondary,
    borderColor: colors.action.secondary,
  },
  cellSelected: {
    borderColor: colors.action.primary,
  },
  dayLabel: {
    ...typography.meta,
    color: colors.text.primary,
  },
  dayLabelMuted: {
    color: colors.text.muted,
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
    color: colors.text.muted,
  },
});
