import { useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { colors, typography, spacing, radii, shadows } from '../../theme/tokens';
import type { MonthlyDataPoint } from '../../types/account';
import { useUserTheme } from '../../../../contexts/UserThemeContext';
import { useCopy, t } from '../../../../lib/i18n';

type ChartMode = 'both' | 'expenses' | 'net';

interface MonthlyChartProps {
  data: MonthlyDataPoint[];
}

const CHART_HEIGHT = 80;

export function MonthlyChart({ data }: MonthlyChartProps) {
  const [mode, setMode] = useState<ChartMode>('both');
  const { dictionary } = useCopy();
  const { tokens: userTokens } = useUserTheme();
  const MODE_LABELS: Record<ChartMode, string> = {
    both: t(dictionary, "account.redesign.monthlyEvolutionModeBoth"),
    expenses: t(dictionary, "account.redesign.monthlyEvolutionModeExpenses"),
    net: t(dictionary, "account.redesign.monthlyEvolutionModeNet"),
  };

  // Estado vacío
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
              {t(dictionary, "account.redesign.monthlyEvolutionTitle")}
            </Text>
          </View>
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>📊</Text>
            <Text style={[styles.emptyText, { color: userTokens.textSecondary }]}>
              {t(dictionary, "account.redesign.monthlyEvolutionEmpty")}
            </Text>
          </View>
        </View>
      </View>
    );
  }

  // Calcular máximo para escalar barras
  const maxValue = data.reduce((max, d) => {
    if (mode === 'both') return Math.max(max, d.income, d.expense);
    if (mode === 'expenses') return Math.max(max, d.expense);
    return Math.max(max, Math.abs(d.income - d.expense));
  }, 0);

  const getBarHeight = (value: number) => {
    if (maxValue === 0) return 3;
    return Math.max(3, (value / maxValue) * CHART_HEIGHT);
  };

  return (
    <View style={styles.wrapper}>
      <View
        style={[
          styles.container,
          { backgroundColor: userTokens.surface, borderColor: userTokens.border },
        ]}
      >
        {/* Header con toggle */}
        <View style={styles.header}>
          <Text style={[styles.title, { color: userTokens.textPrimary }]}>
            {t(dictionary, "account.redesign.monthlyEvolutionTitle")}
          </Text>
          <View style={[styles.toggle, { backgroundColor: userTokens.surfaceAlt }]}>
            {(Object.keys(MODE_LABELS) as ChartMode[]).map((m) => (
              <Pressable
                key={m}
                style={[
                  styles.toggleBtn,
                  mode === m && styles.toggleBtnActive,
                  mode === m && { backgroundColor: userTokens.surface },
                ]}
                onPress={() => setMode(m)}
              >
                <Text
                  style={[
                    styles.toggleText,
                    { color: userTokens.textSecondary },
                    mode === m && styles.toggleTextActive,
                    mode === m && { color: userTokens.textPrimary },
                  ]}
                >
                  {MODE_LABELS[m]}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* Barras */}
        <View style={styles.chartArea}>
          {data.map((point, i) => (
            <View key={i} style={styles.barGroup}>
              <View style={styles.bars}>
                {mode === 'both' && (
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
                )}
                {mode === 'expenses' && (
                  <View
                    style={[
                      styles.bar,
                      styles.expenseBar,
                      point.isCurrent && styles.barCurrent,
                      { height: getBarHeight(point.expense) },
                    ]}
                  />
                )}
                {mode === 'net' && (
                  <View
                    style={[
                      styles.bar,
                      point.income - point.expense >= 0
                        ? styles.incomeBar
                        : styles.expenseBar,
                      point.isCurrent && styles.barCurrent,
                      {
                        height: getBarHeight(
                          Math.abs(point.income - point.expense)
                        ),
                      },
                    ]}
                  />
                )}
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
          ))}
        </View>
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
    marginBottom: spacing['2xl'],
  },
  title: {
    fontFamily: typography.family.sansSemiBold,
    fontSize: typography.size.md,
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
  toggleTextActive: {
  },
  chartArea: {
    height: CHART_HEIGHT + 24, // extra para labels
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
    opacity: 0.6,
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
