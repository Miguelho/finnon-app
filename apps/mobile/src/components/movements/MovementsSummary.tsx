import { useEffect, useMemo, useRef, useState } from "react";
import {
  LayoutAnimation,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { formatMinorToMoney } from "@poleursus/shared";
import { movementsDesignTokens, type Movement } from "../../types/movements";

type MovementsSummaryProps = {
  movements: Movement[];
  currencyCode: string;
  currencySymbol: string;
};

type TooltipAnchor = {
  x: number;
  y: number;
  width: number;
  height: number;
};

const colors = movementsDesignTokens.colors;
const TOOLTIP_WIDTH = 220;

const toPercent = (part: bigint, total: bigint) => {
  if (part <= 0n || total <= 0n) return 0;
  return Number((part * 10000n) / total) / 100;
};

const clampPercent = (value: number) => Math.max(0, Math.min(100, value));

const formatSignedAmount = (
  amountMinor: bigint,
  currencyCode: string,
  currencySymbol: string
) => {
  const absoluteValue = amountMinor < 0n ? -amountMinor : amountMinor;
  const formatted = formatMinorToMoney(absoluteValue, currencyCode);
  if (amountMinor < 0n) return `-${currencySymbol}${formatted}`;
  return `${currencySymbol}${formatted}`;
};

const formatExpenseAmount = (
  amountMinor: bigint,
  currencyCode: string,
  currencySymbol: string
) => {
  const absoluteValue = amountMinor < 0n ? -amountMinor : amountMinor;
  return `-${currencySymbol}${formatMinorToMoney(absoluteValue, currencyCode)}`;
};

const formatIncomeAmount = (
  amountMinor: bigint,
  currencyCode: string,
  currencySymbol: string
) => `${currencySymbol}${formatMinorToMoney(amountMinor, currencyCode)}`;

export function MovementsSummary({
  movements,
  currencyCode,
  currencySymbol,
}: MovementsSummaryProps) {
  const { width: windowWidth } = useWindowDimensions();
  const infoAnchorRef = useRef<View>(null);
  const [isTooltipOpen, setIsTooltipOpen] = useState(false);
  const [tooltipAnchor, setTooltipAnchor] = useState<TooltipAnchor | null>(null);

  const summary = useMemo(() => {
    let totalIncome = 0n;
    let totalExpense = 0n;
    let confirmedIncome = 0n;
    let confirmedExpense = 0n;

    movements.forEach((movement) => {
      if (movement.type === "income") {
        totalIncome += movement.amountMinor;
        if (movement.status === "confirmed") confirmedIncome += movement.amountMinor;
      } else {
        totalExpense += movement.amountMinor;
        if (movement.status === "confirmed") confirmedExpense += movement.amountMinor;
      }
    });

    const combinedTotal = totalIncome + totalExpense;
    const incomeRatio = clampPercent(toPercent(totalIncome, combinedTotal));
    const expenseRatio = clampPercent(toPercent(totalExpense, combinedTotal));
    const incomeConfirmedRatio = clampPercent(
      toPercent(confirmedIncome, totalIncome)
    );
    const expenseConfirmedRatio = clampPercent(
      toPercent(confirmedExpense, totalExpense)
    );

    return {
      totalIncome,
      totalExpense,
      confirmedIncome,
      confirmedExpense,
      balance: totalIncome - totalExpense,
      confirmedBalance: confirmedIncome - confirmedExpense,
      incomeRatio,
      expenseRatio,
      incomeConfirmedRatio,
      expenseConfirmedRatio,
      hasIncome: totalIncome > 0n,
      hasExpense: totalExpense > 0n,
      isEmpty: movements.length === 0,
      movementCount: movements.length,
    };
  }, [movements]);

  useEffect(() => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
  }, [
    summary.incomeRatio,
    summary.expenseRatio,
    summary.incomeConfirmedRatio,
    summary.expenseConfirmedRatio,
    summary.hasIncome,
    summary.hasExpense,
  ]);

  const refreshTooltipAnchor = () => {
    infoAnchorRef.current?.measureInWindow((x, y, width, height) => {
      setTooltipAnchor({ x, y, width, height });
    });
  };

  const closeTooltip = () => setIsTooltipOpen(false);

  const toggleTooltip = () => {
    if (isTooltipOpen) {
      setIsTooltipOpen(false);
      return;
    }
    refreshTooltipAnchor();
    setIsTooltipOpen(true);
  };

  const hasSingleType =
    !summary.isEmpty && (summary.hasIncome ? !summary.hasExpense : summary.hasExpense);

  const movementCountLabel = `${summary.movementCount} ${
    summary.movementCount === 1 ? "movimiento" : "movimientos"
  }`;

  const tooltipTop = (tooltipAnchor?.y ?? 0) + (tooltipAnchor?.height ?? 0) + 8;
  const tooltipLeft = Math.min(
    windowWidth - TOOLTIP_WIDTH - 12,
    Math.max(12, (tooltipAnchor?.x ?? 0) + (tooltipAnchor?.width ?? 0) - TOOLTIP_WIDTH)
  );
  const tooltipArrowLeft = Math.min(
    TOOLTIP_WIDTH - 14,
    Math.max(
      14,
      (tooltipAnchor?.x ?? 0) + (tooltipAnchor?.width ?? 0) / 2 - tooltipLeft
    )
  );

  return (
    <View style={styles.container}>
      <View style={styles.hero}>
        <Text style={styles.heroLabel}>BALANCE</Text>
        <Text
          style={[
            styles.heroAmount,
            summary.balance < 0n && { color: colors.expenseRed },
          ]}
        >
          {formatSignedAmount(summary.balance, currencyCode, currencySymbol)}
        </Text>
        <Text style={styles.heroSub}>
          {formatSignedAmount(summary.confirmedBalance, currencyCode, currencySymbol)} confirmado
        </Text>
      </View>

      {summary.isEmpty ? (
        <Text style={styles.emptyText}>Sin movimientos en este periodo</Text>
      ) : (
        <View style={styles.proportionSection}>
          <View style={styles.barRow}>
            <View style={styles.proportionBar}>
              {summary.hasIncome && (
                <View
                  style={[
                    styles.barSide,
                    summary.hasExpense ? styles.barSideIncome : styles.barSideFull,
                    { flex: summary.hasExpense ? summary.incomeRatio : 100 },
                  ]}
                >
                  <View
                    style={[
                      styles.barSegment,
                      { backgroundColor: colors.incomeSolid, flex: summary.incomeConfirmedRatio },
                    ]}
                  />
                  <View
                    style={[
                      styles.barSegment,
                      {
                        backgroundColor: colors.incomePending,
                        flex: Math.max(0, 100 - summary.incomeConfirmedRatio),
                      },
                    ]}
                  />
                </View>
              )}

              {summary.hasExpense && (
                <View
                  style={[
                    styles.barSide,
                    summary.hasIncome ? styles.barSideExpense : styles.barSideFull,
                    summary.hasIncome && styles.barSideWithGap,
                    { flex: summary.hasIncome ? summary.expenseRatio : 100 },
                  ]}
                >
                  <View
                    style={[
                      styles.barSegment,
                      {
                        backgroundColor: colors.expenseSolid,
                        flex: summary.expenseConfirmedRatio,
                      },
                    ]}
                  />
                  <View
                    style={[
                      styles.barSegment,
                      {
                        backgroundColor: colors.expensePending,
                        flex: Math.max(0, 100 - summary.expenseConfirmedRatio),
                      },
                    ]}
                  />
                </View>
              )}
            </View>

            <View ref={infoAnchorRef} collapsable={false}>
              <Pressable
                style={({ pressed }) => [
                  styles.infoButton,
                  pressed && styles.infoButtonPressed,
                ]}
                onPress={toggleTooltip}
                accessibilityRole="button"
                accessibilityLabel="Mostrar leyenda de colores"
              >
                <Text style={styles.infoButtonText}>i</Text>
              </Pressable>
            </View>
          </View>

          {hasSingleType ? (
            <View style={styles.labelsRow}>
              <View style={styles.labelGroup}>
                <Text
                  style={[
                    styles.totalLabel,
                    summary.hasIncome ? styles.totalIncome : styles.totalExpense,
                  ]}
                >
                  {summary.hasIncome
                    ? formatIncomeAmount(summary.totalIncome, currencyCode, currencySymbol)
                    : formatExpenseAmount(summary.totalExpense, currencyCode, currencySymbol)}
                </Text>
                <Text style={styles.confirmedLabel}>
                  {summary.hasIncome
                    ? formatIncomeAmount(summary.confirmedIncome, currencyCode, currencySymbol)
                    : formatExpenseAmount(summary.confirmedExpense, currencyCode, currencySymbol)}{" "}
                  confirmados
                </Text>
              </View>
              <View style={[styles.labelGroup, styles.labelGroupRight]}>
                <Text style={styles.movementCount}>{movementCountLabel}</Text>
              </View>
            </View>
          ) : (
            <View style={styles.labelsRow}>
              <View style={styles.labelGroup}>
                <Text style={[styles.totalLabel, styles.totalIncome]}>
                  {formatIncomeAmount(summary.totalIncome, currencyCode, currencySymbol)}
                </Text>
                <Text style={styles.confirmedLabel}>
                  {formatIncomeAmount(summary.confirmedIncome, currencyCode, currencySymbol)} confirmados
                </Text>
              </View>
              <View style={[styles.labelGroup, styles.labelGroupRight]}>
                <Text style={[styles.totalLabel, styles.totalExpense]}>
                  {formatExpenseAmount(summary.totalExpense, currencyCode, currencySymbol)}
                </Text>
                <Text style={styles.confirmedLabel}>
                  {formatExpenseAmount(summary.confirmedExpense, currencyCode, currencySymbol)} confirmados
                </Text>
              </View>
            </View>
          )}
        </View>
      )}

      <Modal
        transparent
        visible={isTooltipOpen}
        onRequestClose={closeTooltip}
        animationType="fade"
      >
        <Pressable style={StyleSheet.absoluteFill} onPress={closeTooltip} />
        {tooltipAnchor && (
          <View style={[styles.tooltip, { top: tooltipTop, left: tooltipLeft }]}>
            <View style={[styles.tooltipArrow, { left: tooltipArrowLeft - 5 }]} />
            <View style={styles.tooltipRow}>
              <View style={[styles.tooltipDot, styles.tooltipDotConfirmed]} />
              <Text style={styles.tooltipText}>Color sólido = confirmado</Text>
            </View>
            <View style={styles.tooltipRow}>
              <View style={[styles.tooltipDot, styles.tooltipDotPending]} />
              <Text style={styles.tooltipText}>Color suave = pendiente</Text>
            </View>
          </View>
        )}
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 6,
  },
  hero: {
    alignItems: "center",
    marginBottom: 14,
  },
  heroLabel: {
    fontSize: 11,
    color: colors.textTertiary,
    fontFamily: "DMSans-Medium",
    letterSpacing: 0.5,
  },
  heroAmount: {
    marginTop: 2,
    fontSize: 30,
    color: colors.textPrimary,
    fontFamily: "DMSans-Bold",
    letterSpacing: -1,
  },
  heroSub: {
    marginTop: 1,
    fontSize: movementsDesignTokens.typography.sizes.sm,
    color: colors.textTertiary,
    fontFamily: "DMSans",
  },
  emptyText: {
    fontSize: movementsDesignTokens.typography.sizes.sm,
    color: colors.textTertiary,
    fontFamily: "DMSans-Medium",
    textAlign: "center",
    marginBottom: 8,
  },
  proportionSection: {
    marginBottom: 8,
  },
  barRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  proportionBar: {
    flex: 1,
    height: 10,
    flexDirection: "row",
    overflow: "hidden",
  },
  barSide: {
    flexDirection: "row",
    overflow: "hidden",
  },
  barSideIncome: {
    borderTopLeftRadius: 100,
    borderBottomLeftRadius: 100,
  },
  barSideExpense: {
    borderTopRightRadius: 100,
    borderBottomRightRadius: 100,
  },
  barSideFull: {
    borderRadius: 100,
  },
  barSideWithGap: {
    marginLeft: 2,
  },
  barSegment: {
    height: 10,
  },
  infoButton: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: colors.borderStrong,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "transparent",
  },
  infoButtonPressed: {
    borderColor: colors.textTertiary,
  },
  infoButtonText: {
    fontSize: movementsDesignTokens.typography.sizes.xs,
    lineHeight: 14,
    color: colors.textTertiary,
    fontFamily: "DMSans-SemiBold",
  },
  labelsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  labelGroup: {
    gap: 1,
  },
  labelGroupRight: {
    alignItems: "flex-end",
  },
  totalLabel: {
    fontSize: movementsDesignTokens.typography.sizes.md,
    fontFamily: "DMSans-Bold",
  },
  totalIncome: {
    color: colors.incomeGreen,
  },
  totalExpense: {
    color: colors.expenseRed,
  },
  confirmedLabel: {
    fontSize: movementsDesignTokens.typography.sizes.xs,
    color: colors.textTertiary,
    fontFamily: "DMSans",
  },
  movementCount: {
    fontSize: movementsDesignTokens.typography.sizes.base,
    color: colors.textTertiary,
    fontFamily: "DMSans-Medium",
  },
  tooltip: {
    position: "absolute",
    width: TOOLTIP_WIDTH,
    backgroundColor: colors.textPrimary,
    borderRadius: movementsDesignTokens.radius.sm,
    paddingHorizontal: 14,
    paddingVertical: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 24,
    elevation: 6,
  },
  tooltipArrow: {
    position: "absolute",
    top: -5,
    width: 10,
    height: 10,
    backgroundColor: colors.textPrimary,
    transform: [{ rotate: "45deg" }],
  },
  tooltipRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 2,
  },
  tooltipDot: {
    width: 10,
    height: 6,
    borderRadius: 3,
  },
  tooltipDotConfirmed: {
    backgroundColor: "#FFFFFF",
    opacity: 0.9,
  },
  tooltipDotPending: {
    backgroundColor: "#FFFFFF",
    opacity: 0.35,
  },
  tooltipText: {
    fontSize: movementsDesignTokens.typography.sizes.sm,
    color: colors.surface,
    fontFamily: "DMSans",
  },
});
