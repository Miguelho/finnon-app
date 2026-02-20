import { useMemo } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { ArrowUp, ArrowDown } from "lucide-react-native";
import { colors, typography, spacing, radii } from '../../theme/tokens';
import { formatCurrency, formatDelta } from '../../utils/currency';
import type { AccountContributor, FlowSummary } from '../../types/account';
import { useUserTheme } from '../../../../contexts/UserThemeContext';
import { useCopy, t } from '../../../../lib/i18n';

interface FlowCardsProps {
  flow: FlowSummary;
  contributors: AccountContributor[];
  currency?: string;
  decimals?: number;
  onIncomePress?: () => void;
  onExpensePress?: () => void;
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
  if (expanded.length !== 6) return `rgba(0, 0, 0, ${alpha})`;
  const red = parseInt(expanded.slice(0, 2), 16);
  const green = parseInt(expanded.slice(2, 4), 16);
  const blue = parseInt(expanded.slice(4, 6), 16);
  if ([red, green, blue].some((value) => Number.isNaN(value))) return `rgba(0, 0, 0, ${alpha})`;
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

export function FlowCards({
  flow,
  contributors,
  currency = '€',
  decimals = 2,
  onIncomePress,
  onExpensePress,
}: FlowCardsProps) {
  const { dictionary } = useCopy();
  const { tokens: userTokens } = useUserTheme();
  const contributorByUserId = useMemo(
    () => new Map(contributors.map((contributor) => [contributor.userId, contributor])),
    [contributors]
  );
  const isCollaborative = contributors.length >= 2;

  const income = formatCurrency(flow.totalIncome, { currency, decimals });
  const expense = formatCurrency(flow.totalExpense, { currency, decimals });
  const incomeDelta = formatDelta(flow.incomeDelta);
  const expenseDelta = formatDelta(flow.expenseDelta);

  const renderContribution = (type: 'income' | 'expense') => {
    if (!isCollaborative) return null;

    const values = flow.byUser[type];
    if (!values || values.length === 0) return null;

    const total = values.reduce((acc, value) => acc + Math.max(0, value.amount), 0);
    if (total <= 0) return null;

    return (
      <View
        style={[
          styles.miniContribution,
          { borderTopColor: userTokens.border },
        ]}
      >
        <View style={styles.miniBarTrack}>
          {values.map((value) => {
            const contributor = contributorByUserId.get(value.userId);
            const width = (Math.max(0, value.amount) / total) * 100;
            return (
              <View
                key={`${type}-segment-${value.userId}`}
                style={[
                  styles.miniBarSegment,
                  {
                    width: `${width}%`,
                    backgroundColor: contributor?.color ?? '#2563EB',
                  },
                ]}
              />
            );
          })}
        </View>

        <View style={styles.miniLegend}>
          {values
            .filter((value) => value.amount > 0)
            .map((value) => {
              const contributor = contributorByUserId.get(value.userId);
              const amount = formatCurrency(value.amount, { currency, decimals }).full;
              return (
                <View key={`${type}-legend-${value.userId}`} style={styles.miniLegendItem}>
                  <View
                    style={[
                      styles.miniAvatar,
                      {
                        backgroundColor: contributor?.color ?? '#2563EB',
                        borderColor: hexToRgba(contributor?.color ?? '#2563EB', 0.42),
                      },
                    ]}
                  >
                    <Text style={styles.miniAvatarText}>{contributor?.initials ?? '?'}</Text>
                  </View>
                  <Text style={[styles.miniLegendAmount, { color: userTokens.textSecondary }]}>
                    {amount}
                  </Text>
                </View>
              );
            })}
        </View>
      </View>
    );
  };

  return (
    <View style={styles.row}>
      <Pressable
        style={({ pressed }) => [
          styles.card,
          { backgroundColor: userTokens.surface, borderColor: userTokens.border },
          pressed && styles.cardPressed,
        ]}
        onPress={onIncomePress}
      >
        <View style={styles.cardHeader}>
          <View style={[styles.arrow, styles.arrowUp]}>
            <ArrowUp size={10} color="#FFFFFF" />
          </View>
          <Text style={[styles.label, styles.incomeText]}>
            {t(dictionary, "account.redesign.incomeLabel").toUpperCase()}
          </Text>
        </View>
        <Text style={[styles.amount, styles.incomeText]}>
          {currency}
          {income.whole}
        </Text>
        {incomeDelta ? (
          <Text style={[styles.delta, styles.incomeText]}>
            {t(dictionary, "account.redesign.vsPreviousMonth", {
              value: incomeDelta,
            })}
          </Text>
        ) : null}
        {renderContribution('income')}
      </Pressable>

      <Pressable
        style={({ pressed }) => [
          styles.card,
          { backgroundColor: userTokens.surface, borderColor: userTokens.border },
          pressed && styles.cardPressed,
        ]}
        onPress={onExpensePress}
      >
        <View style={styles.cardHeader}>
          <View style={[styles.arrow, styles.arrowDown]}>
            <ArrowDown size={10} color="#FFFFFF" />
          </View>
          <Text style={[styles.label, styles.expenseText]}>
            {t(dictionary, "account.redesign.expenseLabel").toUpperCase()}
          </Text>
        </View>
        <Text style={[styles.amount, styles.expenseText]}>
          {currency}
          {expense.whole}
        </Text>
        {expenseDelta ? (
          <Text style={[styles.delta, styles.expenseText]}>
            {t(dictionary, "account.redesign.vsPreviousMonth", {
              value: expenseDelta,
            })}
          </Text>
        ) : null}
        {renderContribution('expense')}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: spacing.lg,
    paddingHorizontal: spacing['4xl'],
    marginBottom: spacing['3xl'],
  },
  card: {
    flex: 1,
    paddingHorizontal: spacing['2xl'],
    paddingTop: spacing['2xl'],
    paddingBottom: spacing.lg,
    borderRadius: radii.lg,
    borderWidth: 1,
  },
  cardPressed: {
    opacity: 0.85,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  arrow: {
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  arrowUp: {
    backgroundColor: colors.income,
  },
  arrowDown: {
    backgroundColor: colors.expense,
  },
  label: {
    fontFamily: typography.family.sansSemiBold,
    fontSize: typography.size.sm,
    letterSpacing: 0.5,
  },
  incomeText: {
    color: colors.income,
  },
  expenseText: {
    color: colors.expense,
  },
  amount: {
    fontFamily: typography.family.monoMedium,
    fontSize: typography.size['2xl'],
    letterSpacing: -0.5,
  },
  delta: {
    fontFamily: typography.family.sansMedium,
    fontSize: typography.size.xs,
    marginTop: spacing.xs,
    opacity: 0.7,
  },
  miniContribution: {
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    gap: spacing.sm,
  },
  miniBarTrack: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
    flexDirection: 'row',
  },
  miniBarSegment: {
    height: '100%',
  },
  miniLegend: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  miniLegendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  miniAvatar: {
    width: 16,
    height: 16,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  miniAvatarText: {
    fontFamily: typography.family.sansBold,
    fontSize: 6,
    color: '#FFFFFF',
  },
  miniLegendAmount: {
    fontFamily: typography.family.sansMedium,
    fontSize: typography.size.xs,
  },
});
