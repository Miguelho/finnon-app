"use client";

import { themeTokens, formatMarkerBadge, type DayMarkerData } from "@poleursus/shared";

type DayMarkerProps = DayMarkerData & {
  variant: "week" | "month";
  isSelected?: boolean;
  isToday?: boolean;
};

const MIN_SEGMENT_WIDTH = 2; // px - minimum visible segment width
const BAR_WIDTH = 24; // px - total bar width

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
  const colors = themeTokens.light.colors;

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

  // Tooltip text for accessibility
  const tooltipText = [
    incomeCount > 0 && `Income: ${incomeCount}`,
    expenseCount > 0 && `Expense: ${expenseCount}`,
    pendingCount > 0 && `Pendientes: ${pendingCount}`,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div
      className="flex flex-col items-center gap-0.5"
      title={tooltipText}
      aria-label={`${total} movimientos: ${tooltipText}`}
    >
      {/* Badge */}
      <span
        className="text-[10px] font-semibold leading-none"
        style={{
          color: isSelected ? colors.action.primary : colors.text.secondary,
        }}
      >
        {badgeText}
      </span>

      {/* Proportional bar */}
      <div
        className="flex overflow-hidden rounded-full"
        style={{
          width: BAR_WIDTH,
          height: variant === "week" ? 4 : 3,
          backgroundColor: colors.state.neutral,
        }}
      >
        {incomeCount > 0 && (
          <div
            style={{
              width: incomeWidth,
              backgroundColor: colors.state.positive,
            }}
          />
        )}
        {expenseCount > 0 && (
          <div
            style={{
              width: expenseWidth,
              backgroundColor: colors.state.negative,
            }}
          />
        )}
        {pendingCount > 0 && (
          <div
            style={{
              width: pendingWidth,
              backgroundColor: colors.state.warning,
            }}
          />
        )}
      </div>
    </div>
  );
}
