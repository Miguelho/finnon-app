import { View, Text, StyleSheet } from 'react-native';
import { typography, spacing } from '../../theme/tokens';
import { formatCurrency } from '../../utils/currency';
import { useUserTheme } from '../../../../contexts/UserThemeContext';
import { useCopy, t } from '../../../../lib/i18n';

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
  const { dictionary } = useCopy();
  const { tokens: userTokens } = useUserTheme();
  const formatted = formatCurrency(balance, { currency, decimals });

  return (
    <View style={styles.container}>
      <Text style={[styles.label, { color: userTokens.textSecondary }]}>
        {t(dictionary, "account.redesign.balanceTotalLabel")}
      </Text>
      <Text style={[styles.amount, { color: userTokens.textPrimary }]}>
        {currency}
        {formatted.whole}
        <Text style={[styles.cents, { color: userTokens.textSecondary }]}>
          {formatted.cents}
        </Text>
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
    letterSpacing: 0.5,
    marginBottom: spacing.xs,
  },
  amount: {
    fontFamily: typography.family.monoMedium,
    fontSize: typography.size['4xl'],
    letterSpacing: -1.5,
    lineHeight: 40,
  },
  cents: {
    fontSize: typography.size['2xl'],
    fontFamily: typography.family.mono,
  },
});
