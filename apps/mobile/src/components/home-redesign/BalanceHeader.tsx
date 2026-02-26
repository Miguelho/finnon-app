import { View, Text, StyleSheet } from "react-native";
import { themeTokens } from "@poleursus/shared";
import { formatCurrencyParts } from "./utils";
import { useCopy, t } from "../../lib/i18n";
import { useUserTheme } from "../../contexts/UserThemeContext";

const tokens = themeTokens.light;

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
  const { dictionary } = useCopy();
  const { tokens: userTokens } = useUserTheme();
  const { integer, decimals } = formatCurrencyParts(amountMinor, currencySymbol);

  return (
    <View style={styles.container}>
      <Text style={[styles.label, { color: userTokens.textSecondary }]}>
        {t(dictionary, "mobile.home.balanceLabel")}
      </Text>
      <Text style={[styles.amount, { color: userTokens.textPrimary }]}>
        {integer}
        <Text style={[styles.decimals, { color: userTokens.textSecondary }]}>
          ,{decimals}
        </Text>
      </Text>
      <Text style={[styles.month, { color: userTokens.textSecondary }]}>
        {monthLabel}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    marginBottom: 20,
  },
  label: {
    fontSize: 12,
    fontWeight: tokens.typography.weight.medium,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    fontFamily: "DMSans-Medium",
  },
  amount: {
    fontSize: 36,
    fontWeight: tokens.typography.weight.medium,
    marginTop: tokens.spacing.xs,
    letterSpacing: -1.5,
    lineHeight: 40,
    fontFamily: "JetBrainsMono-Medium",
  },
  decimals: {
    fontSize: 18,
    fontFamily: "JetBrainsMono-Medium",
  },
  month: {
    marginTop: tokens.spacing.xs,
    fontSize: tokens.typography.size.sm,
    fontFamily: "DMSans",
  },
});
