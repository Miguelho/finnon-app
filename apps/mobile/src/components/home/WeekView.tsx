import { useRef, useImperativeHandle, forwardRef, useCallback } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import {
  createTypographyStyles,
  themeTokens,
  isSameDay,
  type WeekDay,
  type DayMarkerData,
} from "@poleursus/shared";
import { DayMarker } from "./DayMarker";
import { useUserTheme } from "../../contexts/UserThemeContext";

type WeekViewProps = {
  days: WeekDay[];
  locale: string;
  markerData: Map<string, DayMarkerData>;
  selectedDate: Date | null;
  onSelectDate: (date: Date) => void;
};

export type WeekViewHandle = {
  measureDay: (
    dayKey: string,
    callback: (x: number, y: number, width: number, height: number) => void
  ) => void;
};

const DAY_NAMES_ES = ["L", "M", "X", "J", "V", "S", "D"];
const DAY_NAMES_EN = ["M", "T", "W", "T", "F", "S", "S"];

const getDayNames = (locale: string): string[] => {
  if (locale === "en") return DAY_NAMES_EN;
  return DAY_NAMES_ES;
};

const tokens = themeTokens.light;
const colors = tokens.colors;
const typography = createTypographyStyles(tokens);

// Fixed height for week view (needed for MonthOverlay positioning)
export const WEEK_VIEW_HEIGHT = 80;

/**
 * WeekView component displaying a row of 7 days with DayMarkers.
 * Used inside CalendarCard for the week strip.
 */
export const WeekView = forwardRef<WeekViewHandle, WeekViewProps>(
  function WeekView(
    { days, locale, markerData, selectedDate, onSelectDate },
    ref
  ) {
    const { primaryActionColor } = useUserTheme();
    const dayRefs = useRef<Map<string, View | null>>(new Map());
    const dayNames = getDayNames(locale);

    // Expose method to measure day positions (for ghost morph)
    useImperativeHandle(ref, () => ({
      measureDay: (dayKey, callback) => {
        const viewRef = dayRefs.current.get(dayKey);
        if (viewRef) {
          viewRef.measureInWindow((x, y, width, height) => {
            callback(x, y, width, height);
          });
        }
      },
    }));

    const setDayRef = useCallback((dayKey: string, el: View | null) => {
      if (el) {
        dayRefs.current.set(dayKey, el);
      } else {
        dayRefs.current.delete(dayKey);
      }
    }, []);

    return (
      <View style={styles.container}>
        {days.map((day, index) => {
          const isSelected = isSameDay(selectedDate, day.date);
          const isToday = day.isToday;
          const dayKey = day.dayKey;
          const marker = markerData.get(dayKey);

          return (
            <TouchableOpacity
              key={dayKey}
              ref={(el) => setDayRef(dayKey, el)}
              onPress={() => onSelectDate(day.date)}
              style={[
                styles.dayCell,
                (isSelected || isToday) && { borderColor: primaryActionColor },
              ]}
              accessibilityLabel={`${dayNames[index]} ${day.dayOfMonth}`}
              accessibilityState={{ selected: isSelected }}
            >
              {/* Day name */}
              <Text style={styles.dayName}>{dayNames[index]}</Text>

              {/* Day number */}
              <Text
                style={[
                  styles.dayNumber,
                  (isToday || isSelected) && { color: primaryActionColor },
                ]}
              >
                {day.dayOfMonth}
              </Text>

              {/* DayMarker */}
              <View style={styles.markerContainer}>
                {marker ? (
                  <DayMarker
                    {...marker}
                    variant="week"
                    isSelected={isSelected}
                    isToday={isToday}
                  />
                ) : (
                  // Placeholder for consistent height
                  <View style={styles.markerPlaceholder} />
                )}
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
    );
  }
);

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    height: WEEK_VIEW_HEIGHT,
    gap: 4,
  },
  dayCell: {
    flex: 1,
    alignItems: "center",
    justifyContent: "flex-start",
    paddingVertical: 8,
    paddingHorizontal: 4,
    borderRadius: tokens.radii.md,
    borderWidth: 2,
    borderColor: "transparent",
  },
  dayName: {
    fontSize: tokens.typography.size.xs,
    fontWeight: "500",
    color: colors.text.secondary,
  },
  dayNumber: {
    fontSize: tokens.typography.size.sm,
    fontWeight: "600",
    color: colors.text.primary,
  },
  markerContainer: {
    marginTop: 4,
  },
  markerPlaceholder: {
    height: 16,
  },
});
