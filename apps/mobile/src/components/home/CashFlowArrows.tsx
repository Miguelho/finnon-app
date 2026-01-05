import { useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import {
  createTypographyStyles,
  formatMoneyWithSymbol,
  themeTokens,
} from "@poleursus/shared";

type CashFlowArrowsProps = {
  incomeMinor: bigint;
  expenseMinor: bigint;
  netMinor: bigint;
  currency: string;
  currencySymbol: string;
  incomeLabel: string;
  expenseLabel: string;
  balanceLabel: string;
};

const tokens = themeTokens.light;
const colors = tokens.colors;
const typography = createTypographyStyles(tokens);

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

export function CashFlowArrows({
  incomeMinor,
  expenseMinor,
  netMinor,
  currency,
  currencySymbol,
  incomeLabel,
  expenseLabel,
  balanceLabel,
}: CashFlowArrowsProps) {
  const [containerWidth, setContainerWidth] = useState(0);
  const [netWidth, setNetWidth] = useState(0);
  const incomeValue = Number(incomeMinor);
  const expenseValue = Number(expenseMinor);
  const maxValue = Math.max(Math.abs(incomeValue), Math.abs(expenseValue), 1);
  const fallbackMaxWidth = 120;
  const availableColumns =
    containerWidth > 0 && netWidth > 0
      ? (containerWidth - netWidth - tokens.spacing.md * 2) / 2
      : fallbackMaxWidth;
  const maxWidth = Math.max(
    0,
    Math.min(fallbackMaxWidth, availableColumns - 10)
  );
  const minWidth = Math.min(16, maxWidth);
  const incomeWidth = clamp(
    (Math.abs(incomeValue) / maxValue) * maxWidth,
    minWidth,
    maxWidth
  );
  const expenseWidth = clamp(
    (Math.abs(expenseValue) / maxValue) * maxWidth,
    minWidth,
    maxWidth
  );
  const netColor =
    netMinor < 0n ? colors.state.negative : colors.text.primary;

  return (
    <View
      style={styles.container}
      onLayout={(event) => {
        const width = event.nativeEvent.layout.width;
        setContainerWidth((current) => (current === width ? current : width));
      }}
    >
      <View style={styles.arrowColumn}>
        <Text style={styles.meta}>{incomeLabel}</Text>
        <View style={styles.arrowRow}>
          <View
            style={[
              styles.arrowLine,
              { width: incomeWidth, backgroundColor: colors.text.secondary },
            ]}
          />
          <View
            style={[
              styles.arrowHeadRight,
              { borderLeftColor: colors.text.secondary },
            ]}
          />
        </View>
        <Text style={styles.amount}>
          +{formatMoneyWithSymbol(incomeMinor, currency, currencySymbol)}
        </Text>
      </View>

      <View
        style={styles.netColumn}
        onLayout={(event) => {
          const width = event.nativeEvent.layout.width;
          setNetWidth((current) => (current === width ? current : width));
        }}
      >
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

      <View style={styles.arrowColumn}>
        <Text style={styles.meta}>{expenseLabel}</Text>
        <View style={[styles.arrowRow, styles.arrowRowReverse]}>
          <View
            style={[
              styles.arrowLine,
              { width: expenseWidth, backgroundColor: colors.text.secondary },
            ]}
          />
          <View
            style={[
              styles.arrowHeadLeft,
              { borderRightColor: colors.text.secondary },
            ]}
          />
        </View>
        <Text style={styles.amount}>
          -{formatMoneyWithSymbol(expenseMinor, currency, currencySymbol)}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: tokens.spacing.md,
  },
  arrowColumn: {
    flex: 1,
    minWidth: 0,
    flexShrink: 1,
    gap: tokens.spacing.xs,
  },
  netColumn: {
    alignItems: "center",
    gap: tokens.spacing.xs,
  },
  meta: {
    ...typography.meta,
    color: colors.text.secondary,
  },
  netValue: {
    ...typography.display,
  },
  arrowRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    width: "100%",
  },
  arrowRowReverse: {
    flexDirection: "row-reverse",
  },
  arrowLine: {
    height: 2,
    borderRadius: 999,
  },
  arrowHeadRight: {
    width: 0,
    height: 0,
    borderTopWidth: 4,
    borderBottomWidth: 4,
    borderLeftWidth: 6,
    borderTopColor: "transparent",
    borderBottomColor: "transparent",
  },
  arrowHeadLeft: {
    width: 0,
    height: 0,
    borderTopWidth: 4,
    borderBottomWidth: 4,
    borderRightWidth: 6,
    borderTopColor: "transparent",
    borderBottomColor: "transparent",
  },
  amount: {
    ...typography.body,
    color: colors.text.primary,
  },
});
