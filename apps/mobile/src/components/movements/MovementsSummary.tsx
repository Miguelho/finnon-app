import { useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Easing,
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
import { useUserTheme } from "../../contexts/UserThemeContext";
import { useCopy, t } from "../../lib/i18n";

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
const BAR_ANIMATION_DURATION_MS = 360;

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
  const { dictionary } = useCopy();
  const { tokens: userTokens } = useUserTheme();
  const { width: windowWidth } = useWindowDimensions();
  const infoAnchorRef = useRef<View>(null);
  const [isTooltipOpen, setIsTooltipOpen] = useState(false);
  const [tooltipAnchor, setTooltipAnchor] = useState<TooltipAnchor | null>(null);
  const incomeSideFlex = useRef(new Animated.Value(0)).current;
  const expenseSideFlex = useRef(new Animated.Value(0)).current;
  const incomeConfirmedFlex = useRef(new Animated.Value(0)).current;
  const incomePendingFlex = useRef(new Animated.Value(0)).current;
  const expenseConfirmedFlex = useRef(new Animated.Value(0)).current;
  const expensePendingFlex = useRef(new Animated.Value(0)).current;

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
    const nextIncomeSide = summary.hasIncome
      ? summary.hasExpense
        ? summary.incomeRatio
        : 100
      : 0;
    const nextExpenseSide = summary.hasExpense
      ? summary.hasIncome
        ? summary.expenseRatio
        : 100
      : 0;
    const nextIncomeConfirmed = summary.hasIncome ? summary.incomeConfirmedRatio : 0;
    const nextExpenseConfirmed = summary.hasExpense ? summary.expenseConfirmedRatio : 0;

    Animated.parallel([
      Animated.timing(incomeSideFlex, {
        toValue: nextIncomeSide,
        duration: BAR_ANIMATION_DURATION_MS,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }),
      Animated.timing(expenseSideFlex, {
        toValue: nextExpenseSide,
        duration: BAR_ANIMATION_DURATION_MS,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }),
      Animated.timing(incomeConfirmedFlex, {
        toValue: nextIncomeConfirmed,
        duration: BAR_ANIMATION_DURATION_MS,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }),
      Animated.timing(incomePendingFlex, {
        toValue: Math.max(0, 100 - nextIncomeConfirmed),
        duration: BAR_ANIMATION_DURATION_MS,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }),
      Animated.timing(expenseConfirmedFlex, {
        toValue: nextExpenseConfirmed,
        duration: BAR_ANIMATION_DURATION_MS,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }),
      Animated.timing(expensePendingFlex, {
        toValue: Math.max(0, 100 - nextExpenseConfirmed),
        duration: BAR_ANIMATION_DURATION_MS,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }),
    ]).start();
  }, [
    summary.incomeRatio,
    summary.expenseRatio,
    summary.incomeConfirmedRatio,
    summary.expenseConfirmedRatio,
    summary.hasIncome,
    summary.hasExpense,
    incomeSideFlex,
    expenseSideFlex,
    incomeConfirmedFlex,
    incomePendingFlex,
    expenseConfirmedFlex,
    expensePendingFlex,
  ]);

  useEffect(() => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
  }, [
    summary.hasIncome,
    summary.hasExpense,
    summary.isEmpty,
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

  const movementCountLabel = t(dictionary, "transactions.ui.sectionMovementCount", {
    count: summary.movementCount,
  });

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
        <Text style={[styles.heroLabel, { color: userTokens.textSecondary }]}>
          {t(dictionary, "transactions.ui.summaryBalanceTitle")}
        </Text>
        <Text
          style={[
            styles.heroAmount,
            { color: userTokens.textPrimary },
            summary.balance < 0n && { color: colors.expenseRed },
          ]}
        >
          {formatSignedAmount(summary.balance, currencyCode, currencySymbol)}
        </Text>
        <Text style={[styles.heroSub, { color: userTokens.textSecondary }]}>
          {formatSignedAmount(summary.confirmedBalance, currencyCode, currencySymbol)}{" "}
          {t(dictionary, "transactions.ui.summaryConfirmedOne")}
        </Text>
      </View>

      {summary.isEmpty ? (
        <Text style={[styles.emptyText, { color: userTokens.textSecondary }]}>
          {t(dictionary, "transactions.ui.summaryEmpty")}
        </Text>
      ) : (
        <View style={styles.proportionSection}>
          <View style={styles.barRow}>
            <View style={styles.proportionBar}>
              {summary.hasIncome && (
                <Animated.View
                  style={[
                    styles.barSide,
                    summary.hasExpense ? styles.barSideIncome : styles.barSideFull,
                    { flex: incomeSideFlex },
                  ]}
                >
                  <Animated.View
                    style={[
                      styles.barSegment,
                      { backgroundColor: colors.incomeSolid, flex: incomeConfirmedFlex },
                    ]}
                  />
                  <Animated.View
                    style={[
                      styles.barSegment,
                      {
                        backgroundColor: colors.incomePending,
                        flex: incomePendingFlex,
                      },
                    ]}
                  />
                </Animated.View>
              )}

              {summary.hasExpense && (
                <Animated.View
                  style={[
                    styles.barSide,
                    summary.hasIncome ? styles.barSideExpense : styles.barSideFull,
                    summary.hasIncome && styles.barSideWithGap,
                    { flex: expenseSideFlex },
                  ]}
                >
                  <Animated.View
                    style={[
                      styles.barSegment,
                      {
                        backgroundColor: colors.expenseSolid,
                        flex: expenseConfirmedFlex,
                      },
                    ]}
                  />
                  <Animated.View
                    style={[
                      styles.barSegment,
                      {
                        backgroundColor: colors.expensePending,
                        flex: expensePendingFlex,
                      },
                    ]}
                  />
                </Animated.View>
              )}
            </View>

            <View ref={infoAnchorRef} collapsable={false}>
              <Pressable
                style={({ pressed }) => [
                  styles.infoButton,
                  { borderColor: userTokens.border },
                  pressed && styles.infoButtonPressed,
                ]}
                onPress={toggleTooltip}
                accessibilityRole="button"
                accessibilityLabel={t(dictionary, "transactions.ui.summaryLegendButton")}
              >
                <Text style={[styles.infoButtonText, { color: userTokens.textSecondary }]}>
                  i
                </Text>
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
                <Text style={[styles.confirmedLabel, { color: userTokens.textSecondary }]}>
                  {summary.hasIncome
                    ? formatIncomeAmount(summary.confirmedIncome, currencyCode, currencySymbol)
                    : formatExpenseAmount(summary.confirmedExpense, currencyCode, currencySymbol)}{" "}
                  {t(dictionary, "transactions.ui.summaryConfirmedOther")}
                </Text>
              </View>
              <View style={[styles.labelGroup, styles.labelGroupRight]}>
                <Text style={[styles.movementCount, { color: userTokens.textSecondary }]}>
                  {movementCountLabel}
                </Text>
              </View>
            </View>
          ) : (
            <View style={styles.labelsRow}>
              <View style={styles.labelGroup}>
                <Text style={[styles.totalLabel, styles.totalIncome]}>
                  {formatIncomeAmount(summary.totalIncome, currencyCode, currencySymbol)}
                </Text>
                <Text style={[styles.confirmedLabel, { color: userTokens.textSecondary }]}>
                  {formatIncomeAmount(summary.confirmedIncome, currencyCode, currencySymbol)}{" "}
                  {t(dictionary, "transactions.ui.summaryConfirmedOther")}
                </Text>
              </View>
              <View style={[styles.labelGroup, styles.labelGroupRight]}>
                <Text style={[styles.totalLabel, styles.totalExpense]}>
                  {formatExpenseAmount(summary.totalExpense, currencyCode, currencySymbol)}
                </Text>
                <Text style={[styles.confirmedLabel, { color: userTokens.textSecondary }]}>
                  {formatExpenseAmount(summary.confirmedExpense, currencyCode, currencySymbol)}{" "}
                  {t(dictionary, "transactions.ui.summaryConfirmedOther")}
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
          <View
            style={[
              styles.tooltip,
              {
                top: tooltipTop,
                left: tooltipLeft,
                backgroundColor: userTokens.surface,
                borderColor: userTokens.border,
              },
            ]}
          >
            <View
              style={[
                styles.tooltipArrow,
                { left: tooltipArrowLeft - 5, backgroundColor: userTokens.surface },
              ]}
            />
            <View style={styles.tooltipRow}>
              <View
                style={[
                  styles.tooltipDot,
                  styles.tooltipDotConfirmed,
                  { backgroundColor: userTokens.textPrimary },
                ]}
              />
              <Text style={[styles.tooltipText, { color: userTokens.textPrimary }]}>
                {t(dictionary, "transactions.ui.summaryLegendSolid")}
              </Text>
            </View>
            <View style={styles.tooltipRow}>
              <View
                style={[
                  styles.tooltipDot,
                  styles.tooltipDotPending,
                  { backgroundColor: userTokens.textPrimary },
                ]}
              />
              <Text style={[styles.tooltipText, { color: userTokens.textPrimary }]}>
                {t(dictionary, "transactions.ui.summaryLegendSoft")}
              </Text>
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
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "transparent",
  },
  infoButtonPressed: {
    opacity: 0.85,
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
    borderWidth: 1,
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
    backgroundColor: colors.surface,
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
    fontFamily: "DMSans",
  },
});
