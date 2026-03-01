import { Pressable, StyleSheet, Text, View } from "react-native";
import { themeTokens, withAlpha } from "@poleursus/shared";
import { ChevronRight } from "lucide-react-native";
import { useUserTheme } from "../../contexts/UserThemeContext";
import { formatCurrencyParts } from "./utils";

const tokens = themeTokens.light;

export type BalanceAccountItem = {
  id: string;
  name: string;
  balanceMinor: bigint;
  color: string;
};

type BalanceRowProps = {
  totalBalanceMinor: bigint;
  currencySymbol: string;
  accounts: BalanceAccountItem[];
  onPress?: () => void;
};

function BalanceContent({
  totalBalanceMinor,
  currencySymbol,
  accounts,
  isClickable = false,
}: Omit<BalanceRowProps, "onPress"> & { isClickable?: boolean }) {
  const { tokens: userTokens } = useUserTheme();
  const { integer, decimals } = formatCurrencyParts(totalBalanceMinor, currencySymbol);
  const showBreakdown = accounts.length > 1;

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: userTokens.surface,
          borderColor: withAlpha(userTokens.textPrimary, 0.14),
        },
      ]}
    >
      <View style={styles.left}>
        <Text style={[styles.label, { color: userTokens.textTertiary }]}>BALANCE</Text>
        <Text style={[styles.amount, { color: userTokens.textPrimary }]}>
          {integer}
          <Text style={[styles.decimals, { color: userTokens.textSecondary }]}>
            ,{decimals}
          </Text>
        </Text>
      </View>

      <View style={styles.right}>
        {showBreakdown ? (
          <View style={styles.accountsWrap}>
            {accounts.map((account) => {
              const parts = formatCurrencyParts(account.balanceMinor, currencySymbol);
              return (
                <View key={account.id} style={styles.accountItem}>
                  <View style={[styles.dot, { backgroundColor: account.color }]} />
                  <Text
                    style={[styles.accountAmount, { color: userTokens.textSecondary }]}
                    numberOfLines={1}
                  >
                    {parts.full}
                  </Text>
                </View>
              );
            })}
          </View>
        ) : null}
        {isClickable ? (
          <ChevronRight
            size={16}
            color={userTokens.textTertiary}
            style={styles.chevron}
          />
        ) : null}
      </View>
    </View>
  );
}

export function BalanceRow(props: BalanceRowProps) {
  if (!props.onPress) {
    return <BalanceContent {...props} isClickable={false} />;
  }

  return (
    <Pressable onPress={props.onPress} style={({ pressed }) => [pressed && styles.pressed]}>
      <BalanceContent {...props} isClickable />
    </Pressable>
  );
}

// Backward-compatible alias used by existing imports.
export const BalanceHeader = BalanceRow;

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  pressed: {
    opacity: 0.92,
  },
  left: {
    flexShrink: 1,
    minWidth: 0,
  },
  label: {
    fontSize: 9,
    letterSpacing: 0.7,
    fontFamily: "DMSans-SemiBold",
    textTransform: "uppercase",
  },
  amount: {
    marginTop: 2,
    fontSize: 21,
    lineHeight: 25,
    fontFamily: "JetBrainsMono-Medium",
    letterSpacing: -0.5,
    includeFontPadding: false,
  },
  decimals: {
    fontSize: 14,
    fontFamily: "JetBrainsMono-Medium",
  },
  right: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    minWidth: 0,
  },
  accountsWrap: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    flexWrap: "wrap",
    gap: 8,
    flexShrink: 1,
  },
  accountItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 999,
  },
  accountAmount: {
    fontSize: 11,
    fontFamily: "JetBrainsMono-Medium",
  },
  chevron: {
    marginLeft: 2,
  },
});
