import { useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import {
  createTypographyStyles,
  formatMoneyWithSymbol,
  themeTokens,
  type ArrowStyle,
} from "@poleursus/shared";
import { CashFlowArrow } from "../CashFlowArrow";

type CashFlowArrowsProps = {
  incomeMinor: bigint;
  expenseMinor: bigint;
  netMinor: bigint;
  currency: string;
  currencySymbol: string;
  incomeLabel: string;
  expenseLabel: string;
  balanceLabel: string;
  /** Arrow style variant (default: "chevron") */
  arrowStyle?: ArrowStyle;
  /** Show directional accent on arrow tips (default: true) */
  showDirectionalAccent?: boolean;
};

const tokens = themeTokens.light;
const colors = tokens.colors;
const typography = createTypographyStyles(tokens);

export function CashFlowArrows({
  incomeMinor,
  expenseMinor,
  netMinor,
  currency,
  currencySymbol,
  incomeLabel,
  expenseLabel,
  balanceLabel,
  arrowStyle = "chevron",
  showDirectionalAccent = true,
}: CashFlowArrowsProps) {
  const [arrowContainerWidth, setArrowContainerWidth] = useState(0);

  const incomeValue = Number(incomeMinor);
  const expenseValue = Number(expenseMinor);

  // Visibility logic
  const showIncome = incomeMinor !== 0n;
  const showExpense = expenseMinor !== 0n;
  const showLeftColumn = showIncome || showExpense;

  // Proportional arrow widths
  const maxValue = Math.max(Math.abs(incomeValue), Math.abs(expenseValue), 1);
  const incomeWidthPercent = Math.max(15, (Math.abs(incomeValue) / maxValue) * 100);
  const expenseWidthPercent = Math.max(15, (Math.abs(expenseValue) / maxValue) * 100);

  // Convert percentage to pixels based on container width
  const maxArrowWidth = arrowContainerWidth > 0 ? arrowContainerWidth : 80;
  const incomeWidth = (incomeWidthPercent / 100) * maxArrowWidth;
  const expenseWidth = (expenseWidthPercent / 100) * maxArrowWidth;

  // Balance color
  const netColor =
    netMinor < 0n ? colors.state.negative : colors.text.primary;

  return (
    <View style={styles.container}>
      {/* Left Column: Stacked Arrows (40%) */}
      {showLeftColumn && (
        <View style={styles.leftColumn}>
          {/* Income Row */}
          {showIncome && (
            <View
              style={styles.arrowSection}
              accessible
              accessibilityLabel={`${incomeLabel}: +${formatMoneyWithSymbol(incomeMinor, currency, currencySymbol)}`}
            >
              <Text style={styles.meta}>{incomeLabel}</Text>
              <View style={styles.arrowWithBadge}>
                <View
                  style={styles.arrowWrapper}
                  onLayout={(event) => {
                    const width = event.nativeEvent.layout.width;
                    setArrowContainerWidth((current) =>
                      current === width ? current : width
                    );
                  }}
                >
                  <View style={{ width: incomeWidth, minWidth: 20 }}>
                    <CashFlowArrow
                      direction="right"
                      widthPx={incomeWidth}
                      style={arrowStyle}
                      accentColor={
                        showDirectionalAccent ? colors.state.positive : undefined
                      }
                      showAccent={showDirectionalAccent}
                    />
                  </View>
                </View>
                <View style={[styles.badge, { backgroundColor: colors.bg.secondary }]}>
                  <Text style={[styles.badgeText, { color: colors.state.positive }]}>
                    +{formatMoneyWithSymbol(incomeMinor, currency, currencySymbol)}
                  </Text>
                </View>
              </View>
            </View>
          )}

          {/* Expense Row */}
          {showExpense && (
            <View
              style={styles.arrowSection}
              accessible
              accessibilityLabel={`${expenseLabel}: -${formatMoneyWithSymbol(expenseMinor, currency, currencySymbol)}`}
            >
              <Text style={styles.meta}>{expenseLabel}</Text>
              <View style={styles.arrowWithBadge}>
                <View style={styles.arrowWrapper}>
                  <View style={{ width: expenseWidth, minWidth: 20 }}>
                    <CashFlowArrow
                      direction="left"
                      widthPx={expenseWidth}
                      style={arrowStyle}
                      accentColor={
                        showDirectionalAccent ? colors.state.negative : undefined
                      }
                      showAccent={showDirectionalAccent}
                    />
                  </View>
                </View>
                <View style={[styles.badge, { backgroundColor: colors.bg.secondary }]}>
                  <Text style={[styles.badgeText, { color: colors.state.negative }]}>
                    -{formatMoneyWithSymbol(expenseMinor, currency, currencySymbol)}
                  </Text>
                </View>
              </View>
            </View>
          )}
        </View>
      )}

      {/* Right Column: Balance (60%) */}
      <View style={[styles.balanceColumn, !showLeftColumn && styles.balanceColumnFull]}>
        <Text style={styles.meta}>{balanceLabel}</Text>
        <Text style={[styles.netValue, { color: netColor }]}>
          {netMinor < 0n ? "-" : "+"}
          {formatMoneyWithSymbol(
            netMinor < 0n ? -netMinor : netMinor,
            currency,
            currencySymbol
          )}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    gap: tokens.spacing.lg,
  },
  leftColumn: {
    flex: 0.4,
    gap: tokens.spacing.lg,
  },
  arrowSection: {
    gap: tokens.spacing.xs,
  },
  arrowWithBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: tokens.spacing.sm,
  },
  arrowWrapper: {
    flex: 1,
  },
  badge: {
    borderRadius: 8,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  badgeText: {
    fontSize: typography.meta.fontSize,
    fontWeight: "600",
  },
  meta: {
    ...typography.meta,
    color: colors.text.secondary,
  },
  balanceColumn: {
    flex: 0.6,
    alignItems: "center",
    justifyContent: "center",
    gap: tokens.spacing.xs,
  },
  balanceColumnFull: {
    flex: 1,
  },
  netValue: {
    ...typography.display,
  },
});
