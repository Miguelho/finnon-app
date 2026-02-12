import { View, Text, StyleSheet } from "react-native";
import { themeTokens, formatMarkerBadge, type DayMarkerData } from "@poleursus/shared";
import { useUserTheme } from "../../contexts/UserThemeContext";

type DayMarkerProps = DayMarkerData & {
  variant: "week" | "month";
  isSelected?: boolean;
  isToday?: boolean;
};

const MIN_SEGMENT_WIDTH = 2; // px - minimum visible segment width
const BAR_WIDTH = 24; // px - total bar width

const tokens = themeTokens.light;
const colors = tokens.colors;

/**
 * DayMarker component showing activity indicators.
 * Displays a badge with total count and a proportional 3-segment bar.
 */
export function DayMarker({
  total,
  incomeCount,
  expenseCount,
  pendingCount,
  variant,
  isSelected = false,
  isToday = false,
}: DayMarkerProps) {
  const { primaryActionColor } = useUserTheme();
  // Don't render if no activity
  if (total === 0) return null;

  // Calculate proportional widths for the bar
  const getSegmentWidths = () => {
    const nonZeroCounts = [
      incomeCount > 0 ? 1 : 0,
      expenseCount > 0 ? 1 : 0,
      pendingCount > 0 ? 1 : 0,
    ].reduce((a, b) => a + b, 0);

    // Reserve minimum width for non-zero segments
    const reservedWidth = nonZeroCounts * MIN_SEGMENT_WIDTH;
    const availableWidth = BAR_WIDTH - reservedWidth;

    // Calculate proportional widths from remaining space
    const incomeWidth = incomeCount > 0
      ? MIN_SEGMENT_WIDTH + (incomeCount / total) * availableWidth
      : 0;
    const expenseWidth = expenseCount > 0
      ? MIN_SEGMENT_WIDTH + (expenseCount / total) * availableWidth
      : 0;
    const pendingWidth = pendingCount > 0
      ? MIN_SEGMENT_WIDTH + (pendingCount / total) * availableWidth
      : 0;

    return { incomeWidth, expenseWidth, pendingWidth };
  };

  const { incomeWidth, expenseWidth, pendingWidth } = getSegmentWidths();
  const badgeText = formatMarkerBadge(total);
  const barHeight = variant === "week" ? 4 : 3;

  // Accessibility label
  const accessibilityParts = [
    incomeCount > 0 && `${incomeCount} ingreso${incomeCount > 1 ? "s" : ""}`,
    expenseCount > 0 && `${expenseCount} gasto${expenseCount > 1 ? "s" : ""}`,
    pendingCount > 0 && `${pendingCount} pendiente${pendingCount > 1 ? "s" : ""}`,
  ].filter(Boolean);

  const accessibilityLabel = `${total} movimientos: ${accessibilityParts.join(", ")}`;

  return (
    <View
      style={styles.container}
      accessible
      accessibilityLabel={accessibilityLabel}
    >
      {/* Badge */}
      <Text
        style={[
          styles.badge,
          {
            color:
              isSelected || isToday ? primaryActionColor : colors.text.secondary,
          },
        ]}
      >
        {badgeText}
      </Text>

      {/* Proportional bar */}
      <View style={[styles.bar, { height: barHeight }]}>
        {incomeCount > 0 && (
          <View
            style={[
              styles.segment,
              {
                width: incomeWidth,
                backgroundColor: colors.state.positive,
              },
            ]}
          />
        )}
        {expenseCount > 0 && (
          <View
            style={[
              styles.segment,
              {
                width: expenseWidth,
                backgroundColor: colors.state.negative,
              },
            ]}
          />
        )}
        {pendingCount > 0 && (
          <View
            style={[
              styles.segment,
              {
                width: pendingWidth,
                backgroundColor: colors.state.warning,
              },
            ]}
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    gap: 2,
  },
  badge: {
    fontSize: 10,
    fontWeight: "600",
    lineHeight: 12,
  },
  bar: {
    width: BAR_WIDTH,
    flexDirection: "row",
    borderRadius: 999,
    overflow: "hidden",
    backgroundColor: colors.state.neutral,
  },
  segment: {
    height: "100%",
  },
});
