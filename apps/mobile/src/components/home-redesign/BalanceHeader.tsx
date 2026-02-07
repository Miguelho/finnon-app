import { View, Text, StyleSheet } from "react-native";
import { themeTokens } from "@poleursus/shared";
import { formatCurrencyParts } from "./utils";

const tokens = themeTokens.light;
const colors = tokens.colors;

type BalanceHeaderProps = {
  amountMinor: bigint;
  monthLabel: string;
  currencySymbol: string;
};

export function BalanceHeader({
  amountMinor,
  monthLabel,
  currencySymbol,
}: BalanceHeaderProps) {
  const { integer, decimals } = formatCurrencyParts(amountMinor, currencySymbol);

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Balance del mes</Text>
      <Text style={styles.amount}>
        {integer}
        <Text style={styles.decimals}>,{decimals}</Text>
      </Text>
      <Text style={styles.month}>{monthLabel}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    marginBottom: tokens.spacing.lg,
  },
  label: {
    fontSize: tokens.typography.size.xs,
    fontWeight: tokens.typography.weight.medium,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    color: colors.text.secondary,
    fontFamily: "DMSans-Medium",
  },
  amount: {
    fontSize: 42,
    fontWeight: tokens.typography.weight.medium,
    color: colors.text.primary,
    marginTop: tokens.spacing.xs,
    fontFamily: "JetBrainsMono-Medium",
  },
  decimals: {
    fontSize: 24,
    color: colors.text.muted,
    fontFamily: "JetBrainsMono-Medium",
  },
  month: {
    marginTop: tokens.spacing.xs,
    fontSize: tokens.typography.size.sm,
    color: colors.text.muted,
    fontFamily: "DMSans",
  },
});
