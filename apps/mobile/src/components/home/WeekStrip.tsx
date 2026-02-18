import { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Pressable,
} from "react-native";
import { Info, ChevronLeft, ChevronRight } from "lucide-react-native";
import {
  createTypographyStyles,
  themeTokens,
  isSameDay,
  type WeekDay,
  type DotColorKey,
} from "@poleursus/shared";
import { useUserTheme } from "../../contexts/UserThemeContext";

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

const tokens = themeTokens.light;
const colors = tokens.colors;
const typography = createTypographyStyles(tokens);

const DAY_NAMES_ES = ["L", "M", "X", "J", "V", "S", "D"];
const DAY_NAMES_EN = ["M", "T", "W", "T", "F", "S", "S"];

const getDayNames = (locale: string): string[] => {
  if (locale === "en") return DAY_NAMES_EN;
  return DAY_NAMES_ES;
};

const DOT_COLORS: Record<DotColorKey, string> = {
  positive: colors.state.positive,
  negative: colors.state.negative,
  warning: colors.state.warning,
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
  const { primaryActionColor } = useUserTheme();
  const dayNames = getDayNames(locale);

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Text style={styles.title}>{weekTitle}</Text>
          <TouchableOpacity
            onPress={() => setShowLegend(true)}
            style={styles.infoButton}
          >
            <Info size={16} color={colors.text.secondary} />
          </TouchableOpacity>
        </View>
        <TouchableOpacity onPress={onViewMonth}>
          <Text style={[styles.viewMonthCta, { color: primaryActionColor }]}>
            {viewMonthCta}
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.weekNavRow}>
        <TouchableOpacity onPress={onPrevWeek} style={styles.navButton}>
          <ChevronLeft size={18} color={colors.text.secondary} />
        </TouchableOpacity>
        <Text style={styles.weekLabel}>{weekLabel}</Text>
        <TouchableOpacity onPress={onNextWeek} style={styles.navButton}>
          <ChevronRight size={18} color={colors.text.secondary} />
        </TouchableOpacity>
      </View>

      {/* Week strip */}
      <View style={styles.weekRow}>
        {days.map((day, index) => {
          const isSelected = isSameDay(selectedDate, day.date);
          const isToday = day.isToday;

          return (
            <TouchableOpacity
              key={day.dayKey}
              onPress={() => onSelectDate(day.date)}
              style={[
                styles.dayCell,
                isSelected && styles.dayCellSelected,
                isToday && { borderColor: primaryActionColor },
              ]}
            >
              {/* Day name */}
              <Text style={styles.dayName}>{dayNames[index]}</Text>

              {/* Day number */}
              <Text
                style={[
                  styles.dayNumber,
                  isToday && { color: primaryActionColor },
                ]}
              >
                {day.dayOfMonth}
              </Text>

              {/* Dots */}
              <View style={styles.dotsRow}>
                {day.dots.map((dot, dotIndex) => (
                  <View
                    key={dotIndex}
                    style={[
                      styles.dot,
                      { backgroundColor: DOT_COLORS[dot.color] },
                    ]}
                  />
                ))}
                {day.overflowCount > 0 && (
                  <Text style={styles.overflowText}>+{day.overflowCount}</Text>
                )}
              </View>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Legend Modal */}
      <Modal
        visible={showLegend}
        transparent
        animationType="fade"
        onRequestClose={() => setShowLegend(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setShowLegend(false)}
        >
          <View style={styles.legendCard}>
            <Text style={styles.legendText}>{dotsLegend}</Text>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: tokens.spacing.sm,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: tokens.spacing.xs,
  },
  title: {
    fontSize: typography.h3.fontSize,
    fontWeight: typography.h3.fontWeight as "700",
    color: colors.text.primary,
  },
  infoButton: {
    padding: 4,
  },
  viewMonthCta: {
    fontSize: typography.caption.fontSize,
  },
  weekNavRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  navButton: {
    padding: 4,
  },
  weekLabel: {
    fontSize: typography.caption.fontSize,
    fontWeight: "600",
    color: colors.text.secondary,
  },
  weekRow: {
    flexDirection: "row",
    gap: 4,
  },
  dayCell: {
    flex: 1,
    alignItems: "center",
    padding: tokens.spacing.sm,
    borderRadius: tokens.radii.sm,
    borderWidth: 2,
    borderColor: "transparent",
  },
  dayCellSelected: {
    backgroundColor: colors.action.secondary,
  },
  dayName: {
    fontSize: typography.caption.fontSize,
    fontWeight: "500",
    color: colors.text.secondary,
  },
  dayNumber: {
    fontSize: typography.body.fontSize,
    fontWeight: "600",
    color: colors.text.primary,
    marginTop: 2,
  },
  dotsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    marginTop: 4,
    minHeight: 6,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  overflowText: {
    fontSize: 10,
    color: colors.text.muted,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.3)",
  },
  legendCard: {
    backgroundColor: colors.bg.surface,
    borderRadius: tokens.radii.md,
    padding: tokens.spacing.md,
    marginHorizontal: tokens.spacing.xl,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  legendText: {
    fontSize: typography.caption.fontSize,
    color: colors.text.secondary,
    textAlign: "center",
  },
});
