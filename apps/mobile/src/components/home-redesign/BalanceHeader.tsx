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
  monthLabel: _monthLabel,
  currencySymbol,
}: BalanceHeaderProps) {
  const { dictionary } = useCopy();
  const { tokens: userTokens } = useUserTheme();
  const { integer, decimals } = formatCurrencyParts(amountMinor, currencySymbol);

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: userTokens.surface, borderColor: userTokens.border },
      ]}
    >
      <Text style={[styles.label, { color: userTokens.textPrimary }]}>
        {t(dictionary, "mobile.home.balanceLabel")}
      </Text>
      <View style={styles.amountWrap}>
        <Text
          style={[styles.amount, { color: userTokens.textPrimary }]}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.55}
        >
          {integer}
          <Text style={[styles.decimals, { color: userTokens.textSecondary }]}>
            ,{decimals}
          </Text>
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: "100%",
    borderWidth: 1,
    borderRadius: tokens.radii.lg,
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: tokens.spacing.md,
    justifyContent: "flex-start",
    alignItems: "stretch",
  },
  amountWrap: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  label: {
    fontSize: 12,
    fontWeight: tokens.typography.weight.medium,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    fontFamily: "DMSans-Medium",
    alignSelf: "flex-start",
    textAlign: "left",
  },
  amount: {
    fontSize: 30,
    fontWeight: tokens.typography.weight.medium,
    marginTop: tokens.spacing.xs,
    letterSpacing: -1.2,
    lineHeight: 34,
    fontFamily: "JetBrainsMono-Medium",
  },
  decimals: {
    fontSize: 16,
    fontFamily: "JetBrainsMono-Medium",
  },
});
