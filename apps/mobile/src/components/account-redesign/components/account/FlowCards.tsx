import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, typography, spacing, radii } from '../../theme/tokens';
import { formatCurrency, formatDelta } from '../../utils/currency';
import type { FlowSummary } from '../../types/account';
import { useUserTheme } from '../../../../contexts/UserThemeContext';

interface FlowCardsProps {
  flow: FlowSummary;
  currency?: string;
  decimals?: number;
  onIncomePress?: () => void;
  onExpensePress?: () => void;
}

export function FlowCards({
  flow,
  currency = '€',
  decimals = 2,
  onIncomePress,
  onExpensePress,
}: FlowCardsProps) {
  const { tokens: userTokens } = useUserTheme();
  const income = formatCurrency(flow.totalIncome, { currency, decimals });
  const expense = formatCurrency(flow.totalExpense, { currency, decimals });
  const incomeDelta = formatDelta(flow.incomeDelta);
  const expenseDelta = formatDelta(flow.expenseDelta);

  return (
    <View style={styles.row}>
      {/* Income Card */}
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
            <Ionicons name="arrow-up" size={10} color="#FFFFFF" />
          </View>
          <Text style={[styles.label, styles.incomeText]}>INGRESOS</Text>
        </View>
        <Text style={[styles.amount, styles.incomeText]}>
          {currency}
          {income.whole}
        </Text>
        {incomeDelta && (
          <Text style={[styles.delta, styles.incomeText]}>
            {incomeDelta} vs mes anterior
          </Text>
        )}
      </Pressable>

      {/* Expense Card */}
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
            <Ionicons name="arrow-down" size={10} color="#FFFFFF" />
          </View>
          <Text style={[styles.label, styles.expenseText]}>GASTOS</Text>
        </View>
        <Text style={[styles.amount, styles.expenseText]}>
          {currency}
          {expense.whole}
        </Text>
        {expenseDelta && (
          <Text style={[styles.delta, styles.expenseText]}>
            {expenseDelta} vs mes anterior
          </Text>
        )}
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
    padding: spacing['2xl'],
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
});
