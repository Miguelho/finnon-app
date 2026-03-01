import { useState } from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { Info } from "lucide-react-native";
import { ConfirmationModal } from "@poleursus/shared";
import { typography, spacing } from "../../theme/tokens";
import { formatCurrency } from "../../utils/currency";
import { useUserTheme } from "../../../../contexts/UserThemeContext";
import { useCopy, t } from "../../../../lib/i18n";

interface BalanceHeroProps {
  balance: number;
  currency?: string;
  decimals?: number;
}

export function BalanceHero({
  balance,
  currency = "€",
  decimals = 2,
}: BalanceHeroProps) {
  const { dictionary } = useCopy();
  const { tokens: userTokens } = useUserTheme();
  const formatted = formatCurrency(balance, { currency, decimals });
  const translate = t as any;
  const [isBalanceModalOpen, setIsBalanceModalOpen] = useState(false);

  return (
    <View style={styles.container}>
      <View style={styles.labelRow}>
        <Text style={[styles.label, { color: userTokens.textSecondary }]}>
          {translate(dictionary, "account.redesign.balanceTotalLabel")}
        </Text>
        <Pressable
          onPress={() => setIsBalanceModalOpen(true)}
          hitSlop={8}
          style={[
            styles.tooltipButton,
            { borderColor: userTokens.border, backgroundColor: userTokens.surfaceAlt },
          ]}
        >
          <Info size={11} color={userTokens.textSecondary} />
        </Pressable>
      </View>
      <Text style={[styles.amount, { color: userTokens.textPrimary }]}>
        {formatted.sign}
        {currency}
        {formatted.whole}
        <Text style={[styles.cents, { color: userTokens.textSecondary }]}>
          {formatted.cents}
        </Text>
      </Text>

      <ConfirmationModal
        open={isBalanceModalOpen}
        title={translate(dictionary, "account.redesign.balanceTotalLabel")}
        description={translate(dictionary, "account.redesign.balanceTotalTooltip")}
        confirmLabel={translate(dictionary, "common.ok")}
        onConfirm={() => setIsBalanceModalOpen(false)}
        onCancel={() => setIsBalanceModalOpen(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    marginBottom: 20,
  },
  label: {
    fontFamily: typography.family.sansMedium,
    fontSize: 12,
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  labelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  tooltipButton: {
    width: 18,
    height: 18,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  amount: {
    fontFamily: "JetBrainsMono-Medium",
    fontSize: 36,
    letterSpacing: -1.5,
    lineHeight: 40,
  },
  cents: {
    fontSize: 18,
    fontFamily: "JetBrainsMono-Medium",
  },
});
