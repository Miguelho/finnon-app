import { useMemo, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { colors, typography, spacing, radii, shadows } from '../../theme/tokens';
import type { AccountContributor, MonthlyDataPoint, Period } from '../../types/account';
import { useUserTheme } from '../../../../contexts/UserThemeContext';
import { useCopy, t } from '../../../../lib/i18n';

type ChartMode = 'both' | 'income' | 'expenses' | 'net';

interface MonthlyChartProps {
  data: MonthlyDataPoint[];
  period: Period;
  contributors: AccountContributor[];
}

const CHART_HEIGHT = 160;

export function MonthlyChart({ data, period, contributors }: MonthlyChartProps) {
  const [mode, setMode] = useState<ChartMode>('both');
  const { dictionary } = useCopy();
  const { tokens: userTokens } = useUserTheme();
  const contributorByUserId = useMemo(
    () => new Map(contributors.map((contributor) => [contributor.userId, contributor])),
    [contributors]
  );
  const isCollaborative = contributors.length >= 2;

  const modeLabels: Record<ChartMode, string> = {
    both: t(dictionary, 'account.redesign.monthlyEvolutionModeBoth'),
    income: t(dictionary, 'account.redesign.monthlyEvolutionModeIncome'),
    expenses: t(dictionary, 'account.redesign.monthlyEvolutionModeExpenses'),
    net: t(dictionary, 'account.redesign.monthlyEvolutionModeNet'),
  };

  const titleKeyByPeriod: Record<Period, string> = {
    week: 'account.redesign.evolutionWeeklyTitle',
    month: 'account.redesign.evolutionMonthlyTitle',
    quarter: 'account.redesign.evolutionQuarterlyTitle',
    year: 'account.redesign.evolutionYearlyTitle',
  };

  if (data.length === 0) {
    return (
      <View style={styles.wrapper}>
        <View
          style={[
            styles.container,
            { backgroundColor: userTokens.surface, borderColor: userTokens.border },
          ]}
        >
          <View style={styles.header}>
            <Text style={[styles.title, { color: userTokens.textPrimary }]}>
              {t(dictionary, titleKeyByPeriod[period] as any)}
            </Text>
          </View>
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>📊</Text>
            <Text style={[styles.emptyText, { color: userTokens.textSecondary }]}>
              {t(dictionary, 'account.redesign.monthlyEvolutionEmpty')}
            </Text>
          </View>
        </View>
      </View>
    );
  }

  const maxValue = data.reduce((max, point) => {
    if (mode === 'both') return Math.max(max, point.income, point.expense);
    if (mode === 'income') return Math.max(max, point.income);
    if (mode === 'expenses') return Math.max(max, point.expense);
    return Math.max(max, Math.abs(point.income - point.expense));
  }, 0);

  const getBarHeight = (value: number) => {
    if (maxValue === 0) return 3;
    return Math.max(3, (value / maxValue) * CHART_HEIGHT);
  };

  const showLegend = isCollaborative && (mode === 'income' || mode === 'expenses');

  return (
    <View style={styles.wrapper}>
      <View
        style={[
          styles.container,
          { backgroundColor: userTokens.surface, borderColor: userTokens.border },
        ]}
      >
        <View style={styles.header}>
          <Text style={[styles.title, { color: userTokens.textPrimary }]}>
            {t(dictionary, titleKeyByPeriod[period] as any)}
          </Text>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.toggleScroll}
          style={styles.toggleScrollView}
        >
          <View style={[styles.toggle, { backgroundColor: userTokens.surfaceAlt }]}> 
            {(Object.keys(modeLabels) as ChartMode[]).map((value) => (
              <Pressable
                key={value}
                style={[
                  styles.toggleBtn,
                  mode === value && styles.toggleBtnActive,
                  mode === value && { backgroundColor: userTokens.surface },
                ]}
                onPress={() => setMode(value)}
              >
                <Text
                  style={[
                    styles.toggleText,
                    { color: userTokens.textSecondary },
                    mode === value && { color: userTokens.textPrimary },
                  ]}
                >
                  {modeLabels[value]}
                </Text>
              </Pressable>
            ))}
          </View>
        </ScrollView>

        <View style={styles.chartArea}>
          {data.map((point, index) => {
            const netValue = point.income - point.expense;
            const totalForMode = mode === 'income' ? point.income : point.expense;
            const series = mode === 'income' ? point.incomeByUser : point.expenseByUser;

            return (
              <View key={`${point.label}-${index}`} style={styles.barGroup}>
                <View style={styles.bars}>
                  {mode === 'both' ? (
                    <>
                      <View
                        style={[
                          styles.bar,
                          styles.incomeBar,
                          point.isCurrent && styles.barCurrent,
                          { height: getBarHeight(point.income) },
                        ]}
                      />
                      <View
                        style={[
                          styles.bar,
                          styles.expenseBar,
                          point.isCurrent && styles.barCurrent,
                          { height: getBarHeight(point.expense) },
                        ]}
                      />
                    </>
                  ) : null}

                  {(mode === 'income' || mode === 'expenses') && !showLegend ? (
                    <View
                      style={[
                        styles.bar,
                        mode === 'income' ? styles.incomeBar : styles.expenseBar,
                        point.isCurrent && styles.barCurrent,
                        { height: getBarHeight(totalForMode) },
                      ]}
                    />
                  ) : null}

                  {(mode === 'income' || mode === 'expenses') && showLegend ? (
                    <View
                      style={[
                        styles.stackedBar,
                        {
                          height: getBarHeight(totalForMode),
                          opacity: point.isCurrent ? 1 : 0.8,
                        },
                      ]}
                    >
                      {series
                        .filter((item) => item.amount > 0)
                        .map((item) => {
                          const percentage = totalForMode > 0 ? (item.amount / totalForMode) * 100 : 0;
                          return (
                            <View
                              key={`${point.label}-${mode}-${item.userId}`}
                              style={{
                                height: `${Math.max(0, percentage)}%`,
                                backgroundColor:
                                  contributorByUserId.get(item.userId)?.color ?? '#2563EB',
                              }}
                            />
                          );
                        })}
                    </View>
                  ) : null}

                  {mode === 'net' ? (
                    <View
                      style={[
                        styles.bar,
                        netValue >= 0 ? styles.incomeBar : styles.expenseBar,
                        point.isCurrent && styles.barCurrent,
                        { height: getBarHeight(Math.abs(netValue)) },
                      ]}
                    />
                  ) : null}
                </View>

                <Text
                  style={[
                    styles.barLabel,
                    { color: userTokens.textSecondary },
                    point.isCurrent && styles.barLabelCurrent,
                    point.isCurrent && { color: userTokens.textPrimary },
                  ]}
                >
                  {point.label}
                </Text>
              </View>
            );
          })}
        </View>

        {showLegend ? (
          <View style={styles.legendRow}>
            {contributors.map((contributor) => (
              <View key={`${contributor.userId}-legend`} style={styles.legendItem}>
                <View
                  style={[
                    styles.legendDot,
                    { backgroundColor: contributor.color },
                  ]}
                />
                <Text style={[styles.legendText, { color: userTokens.textSecondary }]}>
                  {contributor.shortName}
                </Text>
              </View>
            ))}
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    paddingHorizontal: spacing['4xl'],
    marginBottom: spacing['4xl'],
  },
  container: {
    borderWidth: 1,
    borderRadius: radii.lg,
    padding: spacing['3xl'],
    ...shadows.sm,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  title: {
    fontFamily: typography.family.sansSemiBold,
    fontSize: typography.size.md,
  },
  toggleScrollView: {
    marginBottom: spacing['2xl'],
  },
  toggleScroll: {
    paddingRight: spacing.xs,
  },
  toggle: {
    flexDirection: 'row',
    gap: 2,
    borderRadius: radii.sm,
    padding: 2,
  },
  toggleBtn: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.lg,
    borderRadius: 6,
  },
  toggleBtnActive: {
    ...shadows.sm,
  },
  toggleText: {
    fontFamily: typography.family.sansSemiBold,
    fontSize: typography.size.xs,
  },
  chartArea: {
    height: CHART_HEIGHT + 24,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
    paddingBottom: 20,
  },
  barGroup: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  bars: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 2,
    justifyContent: 'center',
    width: '100%',
  },
  bar: {
    width: 8,
    borderTopLeftRadius: 3,
    borderTopRightRadius: 3,
    borderBottomLeftRadius: 1,
    borderBottomRightRadius: 1,
    minHeight: 3,
    opacity: 0.7,
  },
  stackedBar: {
    width: 12,
    minHeight: 3,
    borderTopLeftRadius: 3,
    borderTopRightRadius: 3,
    borderBottomLeftRadius: 1,
    borderBottomRightRadius: 1,
    overflow: 'hidden',
    justifyContent: 'flex-end',
  },
  barCurrent: {
    opacity: 1,
  },
  incomeBar: {
    backgroundColor: colors.income,
  },
  expenseBar: {
    backgroundColor: colors.expense,
  },
  barLabel: {
    fontFamily: typography.family.sansMedium,
    fontSize: 9,
    marginTop: spacing.xs,
    position: 'absolute',
    bottom: -18,
  },
  barLabelCurrent: {
    fontFamily: typography.family.sansBold,
  },
  legendRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    marginTop: spacing.sm,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
  },
  legendText: {
    fontFamily: typography.family.sansMedium,
    fontSize: typography.size.xs,
  },
  emptyState: {
    height: CHART_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  emptyIcon: {
    fontSize: 20,
    opacity: 0.4,
  },
  emptyText: {
    fontFamily: typography.family.sans,
    fontSize: typography.size.base,
    textAlign: 'center',
  },
});
