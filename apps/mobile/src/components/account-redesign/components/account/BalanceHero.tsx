import { useMemo } from 'react';
import { View, Text, StyleSheet, Pressable, Alert } from 'react-native';
import { Info } from 'lucide-react-native';
import { typography, spacing, radii } from '../../theme/tokens';
import { formatCurrency } from '../../utils/currency';
import { useUserTheme } from '../../../../contexts/UserThemeContext';
import { useCopy, t } from '../../../../lib/i18n';
import type {
  AccountContributor,
  ContributionBalanceData,
  Period,
} from '../../types/account';

interface BalanceHeroProps {
  balance: number;
  currency?: string;
  decimals?: number;
  contributors: AccountContributor[];
  contributionBalance: ContributionBalanceData | null;
  period: Period;
}

function hexToRgba(hex: string, alpha: number) {
  const normalized = hex.replace('#', '');
  const expanded =
    normalized.length === 3
      ? normalized
          .split('')
          .map((chunk) => chunk + chunk)
          .join('')
      : normalized;
  if (expanded.length !== 6) return `rgba(37, 99, 235, ${alpha})`;
  const red = parseInt(expanded.slice(0, 2), 16);
  const green = parseInt(expanded.slice(2, 4), 16);
  const blue = parseInt(expanded.slice(4, 6), 16);
  if ([red, green, blue].some((value) => Number.isNaN(value))) {
    return `rgba(37, 99, 235, ${alpha})`;
  }
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

export function BalanceHero({
  balance,
  currency = '€',
  decimals = 2,
  contributors,
  contributionBalance,
  period,
}: BalanceHeroProps) {
  const { dictionary } = useCopy();
  const { tokens: userTokens } = useUserTheme();
  const formatted = formatCurrency(balance, { currency, decimals });
  const translate = t as any;
  const handleBalanceInfoPress = () => {
    Alert.alert(
      translate(dictionary, 'account.redesign.balanceTotalLabel'),
      translate(dictionary, 'account.redesign.balanceTotalTooltip')
    );
  };

  const contributionBanner = useMemo(() => {
    if (!contributionBalance || contributionBalance.members.length < 2) return null;

    const periodKeyByValue: Record<Period, string> = {
      week: 'account.redesign.periodWeek',
      month: 'account.redesign.periodMonth',
      quarter: 'account.redesign.periodQuarter',
      year: 'account.redesign.periodYear',
    };

    const sorted = [...contributionBalance.members].sort((a, b) => b.totalPaid - a.totalPaid);
    const leader = sorted[0];
    const second = sorted[1];
    if (!leader || !second) return null;

    const periodLabel = translate(dictionary, periodKeyByValue[period] as any);
    const diff = leader.totalPaid - second.totalPaid;
    const threshold = 100 / Math.pow(10, decimals);

    const contributor = contributors.find((item) => item.userId === leader.userId);

    if (diff < threshold) {
      return {
        message: translate(dictionary, 'account.redesign.contributionBannerEqual', {
          period: periodLabel,
        }),
        initials: contributor?.initials ?? leader.initials,
        color: contributor?.color ?? leader.color,
      };
    }

    return {
      message: translate(dictionary, 'account.redesign.contributionBanner', {
        name: leader.name,
        amount: formatCurrency(diff, { currency, decimals }).full,
        otherName: second.name,
        period: periodLabel,
      }),
      initials: contributor?.initials ?? leader.initials,
      color: contributor?.color ?? leader.color,
    };
  }, [contributionBalance, contributors, currency, decimals, dictionary, period]);

  return (
    <View style={styles.container}>
      <View style={styles.labelRow}>
        <Text style={[styles.label, { color: userTokens.textSecondary }]}>
          {translate(dictionary, 'account.redesign.balanceTotalLabel')}
        </Text>
        <Pressable
          onPress={handleBalanceInfoPress}
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
        {currency}
        {formatted.whole}
        <Text style={[styles.cents, { color: userTokens.textSecondary }]}>
          {formatted.cents}
        </Text>
      </Text>

      {contributionBanner ? (
        <View
          style={[
            styles.banner,
            {
              backgroundColor: hexToRgba(contributionBanner.color, 0.14),
              borderColor: hexToRgba(contributionBanner.color, 0.25),
            },
          ]}
        >
          <View
            style={[
              styles.bannerAvatar,
              { backgroundColor: contributionBanner.color },
            ]}
          >
            <Text style={styles.bannerAvatarText}>{contributionBanner.initials}</Text>
          </View>
          <Text style={[styles.bannerText, { color: userTokens.textPrimary }]}>
            {contributionBanner.message}
          </Text>
        </View>
      ) : null}
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
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.xs,
  },
  tooltipButton: {
    width: 18,
    height: 18,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
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
  banner: {
    marginTop: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: radii.full,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    maxWidth: '95%',
    gap: spacing.sm,
  },
  bannerAvatar: {
    width: 18,
    height: 18,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  bannerAvatarText: {
    fontFamily: typography.family.sansBold,
    fontSize: 7,
    color: '#FFFFFF',
  },
  bannerText: {
    fontFamily: typography.family.sansMedium,
    fontSize: 11,
    lineHeight: 15,
    flexShrink: 1,
  },
});
