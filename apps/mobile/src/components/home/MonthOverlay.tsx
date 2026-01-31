import { useEffect, useRef, forwardRef, useImperativeHandle, useCallback } from "react";
import { View, StyleSheet } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
  useReducedMotion,
} from "react-native-reanimated";
import {
  themeTokens,
  type CalendarEvent,
  type DateRange,
  type DayMarkerData,
} from "@poleursus/shared";
import { MonthMap } from "./MonthMap";
import { DayMarker } from "./DayMarker";

type MonthOverlayProps = {
  isOpen: boolean;
  month: Date;
  locale: string;
  events: CalendarEvent[];
  highlightRange: DateRange;
  markerData: Map<string, DayMarkerData>;
  selectedDate: Date | null;
  onSelectDate: (date: Date) => void;
  onClose: () => void;
};

export type MonthOverlayHandle = {
  measureDay: (
    dayKey: string,
    callback: (x: number, y: number, width: number, height: number) => void
  ) => void;
};

const tokens = themeTokens.light;
const colors = tokens.colors;

// Duration constants
const OPEN_DURATION = 200;
const CLOSE_DURATION = 160;

// Approximate month grid height (6 weeks max * row height)
const MONTH_GRID_HEIGHT = 320;

/**
 * MonthOverlay component that reveals the month calendar with animated height.
 * Positioned absolutely within CalendarCard.
 */
export const MonthOverlay = forwardRef<MonthOverlayHandle, MonthOverlayProps>(
  function MonthOverlay(
    {
      isOpen,
      month,
      locale,
      events,
      highlightRange,
      markerData,
      selectedDate,
      onSelectDate,
      onClose,
    },
    ref
  ) {
    const dayRefs = useRef<Map<string, View | null>>(new Map());
    const reducedMotion = useReducedMotion();

    // Animation values
    const height = useSharedValue(0);
    const opacity = useSharedValue(0);

    // Expose method to measure day positions (for ghost morph)
    useImperativeHandle(ref, () => ({
      measureDay: (dayKey, callback) => {
        const viewRef = dayRefs.current.get(dayKey);
        if (viewRef) {
          viewRef.measureInWindow((x, y, width, h) => {
            callback(x, y, width, h);
          });
        }
      },
    }));

    // Animate on isOpen change
    useEffect(() => {
      const duration = isOpen ? OPEN_DURATION : CLOSE_DURATION;
      const easing = Easing.out(Easing.ease);

      if (reducedMotion) {
        // Instant transitions for reduced motion
        height.value = isOpen ? MONTH_GRID_HEIGHT : 0;
        opacity.value = isOpen ? 1 : 0;
      } else {
        height.value = withTiming(isOpen ? MONTH_GRID_HEIGHT : 0, { duration, easing });
        opacity.value = withTiming(isOpen ? 1 : 0, { duration, easing });
      }
    }, [isOpen, reducedMotion, height, opacity]);

    const animatedStyle = useAnimatedStyle(() => ({
      height: height.value,
      opacity: opacity.value,
    }));

    const setDayRef = useCallback((dayKey: string, el: View | null) => {
      if (el) {
        dayRefs.current.set(dayKey, el);
      } else {
        dayRefs.current.delete(dayKey);
      }
    }, []);

    return (
      <Animated.View
        style={[styles.container, animatedStyle]}
        pointerEvents={isOpen ? "auto" : "none"}
        accessibilityElementsHidden={!isOpen}
      >
        <View style={styles.content}>
          <MonthMap
            month={month}
            locale={locale}
            events={events}
            highlightRange={highlightRange}
            selectedDate={selectedDate}
            onSelectDate={onSelectDate}
            markerData={markerData}
            renderDayContent={({ dayKey, isSelected, isToday, markerData: dayData }) => (
              <View
                ref={(el) => setDayRef(dayKey, el)}
              >
                {dayData ? (
                  <DayMarker
                    {...dayData}
                    variant="month"
                    isSelected={isSelected}
                    isToday={isToday}
                  />
                ) : null}
              </View>
            )}
          />
        </View>
      </Animated.View>
    );
  }
);

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 20,
    overflow: "hidden",
    borderRadius: tokens.radii.md,
    backgroundColor: colors.bg.primary,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 8,
  },
  content: {
    padding: tokens.spacing.md,
  },
});
