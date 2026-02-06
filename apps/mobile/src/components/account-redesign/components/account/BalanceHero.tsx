import { View, Text, StyleSheet } from 'react-native';
import { colors, typography, spacing } from '../../theme/tokens';
import { formatCurrency } from '../../utils/currency';

interface BalanceHeroProps {
  balance: number;
  currency?: string;
  decimals?: number;
}

export function BalanceHero({
  balance,
  currency = '€',
  decimals = 2,
}: BalanceHeroProps) {
  const formatted = formatCurrency(balance, { currency, decimals });

  return (
    <View style={styles.container}>
      <Text style={styles.label}>BALANCE TOTAL</Text>
      <Text style={styles.amount}>
        {currency}
        {formatted.whole}
        <Text style={styles.cents}>{formatted.cents}</Text>
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingHorizontal: spacing['4xl'],
    paddingTop: spacing.md,
    paddingBottom: spacing['4xl'],
  },
  label: {
    fontFamily: typography.family.sansMedium,
    fontSize: typography.size.base,
    color: colors.textTertiary,
    letterSpacing: 0.5,
    marginBottom: spacing.xs,
  },
  amount: {
    fontFamily: typography.family.monoMedium,
    fontSize: typography.size['4xl'],
    color: colors.textPrimary,
    letterSpacing: -1.5,
    lineHeight: 40,
  },
  cents: {
    fontSize: typography.size['2xl'],
    color: colors.textTertiary,
    fontFamily: typography.family.mono,
  },
});
