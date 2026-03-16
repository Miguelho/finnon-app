import { StyleSheet, Text, View } from "react-native";
import { withAlpha } from "@poleursus/shared";
import { useUserTheme } from "../../contexts/UserThemeContext";
import {
  ACTION_BLUE,
  EXPENSE_RED,
  INCOME_GREEN,
  formatMinorCurrency,
} from "./homeResponsive";

type MonthCardProps = {
  currentMonth: string;
  savingsMinor: bigint | number | string;
  incomeMinor: bigint | number | string;
  expenseMinor: bigint | number | string;
  availableMinor: bigint | number | string;
};

export function MonthCard({
  currentMonth,
  savingsMinor,
  incomeMinor,
  expenseMinor,
  availableMinor,
}: MonthCardProps) {
  const { tokens: userTokens } = useUserTheme();

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: userTokens.surface,
          borderColor: withAlpha(userTokens.textPrimary, 0.12),
        },
      ]}
    >
      <View style={styles.header}>
        <View style={styles.headerCol}>
          <Text style={[styles.label, { color: userTokens.textTertiary }]}>ESTE MES</Text>
          <Text style={[styles.subLabel, { color: userTokens.textSecondary }]}>{currentMonth}</Text>
        </View>
        <View style={[styles.headerCol, styles.alignEnd]}>
          <Text style={[styles.label, { color: userTokens.textTertiary }]}>AHORRO</Text>
          <Text style={[styles.savingsValue, { color: ACTION_BLUE }]}>{formatMinorCurrency(savingsMinor)}</Text>
        </View>
      </View>

      <View
        style={[
          styles.pillsRow,
          {
            backgroundColor: userTokens.surfaceAlt,
            borderColor: withAlpha(userTokens.textPrimary, 0.08),
          },
        ]}
      >
        <View style={styles.pill}>
          <Text style={[styles.pillLabel, { color: userTokens.textTertiary }]}>INGRESOS</Text>
          <Text style={[styles.pillValue, styles.tabular, { color: INCOME_GREEN }]}>
            ↑ {formatMinorCurrency(incomeMinor)}
          </Text>
        </View>
        <View style={[styles.divider, { backgroundColor: withAlpha(userTokens.textPrimary, 0.08) }]} />
        <View style={styles.pill}>
          <Text style={[styles.pillLabel, { color: userTokens.textTertiary }]}>GASTOS</Text>
          <Text style={[styles.pillValue, styles.tabular, { color: EXPENSE_RED }]}>
            ↓ {formatMinorCurrency(expenseMinor)}
          </Text>
        </View>
        <View style={[styles.divider, { backgroundColor: withAlpha(userTokens.textPrimary, 0.08) }]} />
        <View style={styles.pill}>
          <Text style={[styles.pillLabel, { color: userTokens.textTertiary }]}>QUEDA</Text>
          <Text style={[styles.pillValue, styles.tabular, { color: ACTION_BLUE }]}>
            {formatMinorCurrency(availableMinor)}
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 16,
    gap: 14,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 16,
  },
  headerCol: {
    flex: 1,
  },
  alignEnd: {
    alignItems: "flex-end",
  },
  label: {
    fontSize: 11,
    letterSpacing: 0.9,
    textTransform: "uppercase",
    fontFamily: "DMSans-SemiBold",
  },
  subLabel: {
    marginTop: 3,
    fontSize: 11,
    fontFamily: "DMSans",
  },
  savingsValue: {
    marginTop: 4,
    fontSize: 28,
    lineHeight: 30,
    fontFamily: "JetBrainsMono-SemiBold",
    letterSpacing: -1,
    fontVariant: ["tabular-nums"],
  },
  pillsRow: {
    flexDirection: "row",
    alignItems: "stretch",
    borderWidth: 1,
    borderRadius: 12,
    overflow: "hidden",
  },
  pill: {
    flex: 1,
    paddingHorizontal: 10,
    paddingVertical: 9,
  },
  pillLabel: {
    fontSize: 10,
    letterSpacing: 0.7,
    textTransform: "uppercase",
    fontFamily: "DMSans-SemiBold",
  },
  pillValue: {
    marginTop: 4,
    fontSize: 13,
    fontFamily: "JetBrainsMono-SemiBold",
  },
  tabular: {
    fontVariant: ["tabular-nums"],
  },
  divider: {
    width: StyleSheet.hairlineWidth,
  },
});
