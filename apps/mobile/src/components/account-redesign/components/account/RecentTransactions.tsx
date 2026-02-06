import { View, Text, StyleSheet, Pressable } from 'react-native';
import { CategoryIcon } from '../../../CategoryIcon';
import { colors, typography, spacing, radii } from '../../theme/tokens';
import { formatCurrency } from '../../utils/currency';
import type { Transaction } from '../../types/account';

interface RecentTransactionsProps {
  transactions: Transaction[];
  currencySymbol?: string;
  currencyDecimals?: number;
  limit?: number;
  onViewAllPress?: () => void;
}

export function RecentTransactions({
  transactions,
  currencySymbol = '€',
  currencyDecimals = 2,
  limit = 4,
  onViewAllPress,
}: RecentTransactionsProps) {
  const visible = transactions.slice(0, limit);

  // Formatear fecha relativa sencilla
  const formatDate = (isoDate: string) => {
    const [year, month, day] = isoDate.split('-').map(Number);
    const date = new Date(year, (month ?? 1) - 1, day ?? 1);
    const dayNum = date.getDate();
    const months = [
      'ene', 'feb', 'mar', 'abr', 'may', 'jun',
      'jul', 'ago', 'sep', 'oct', 'nov', 'dic',
    ];
    return `${dayNum} ${months[date.getMonth()]}`;
  };

  return (
    <View>
      {/* Section header */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Últimos movimientos</Text>
        <Pressable onPress={onViewAllPress} hitSlop={8}>
          <Text style={styles.sectionAction}>Ver todos →</Text>
        </Pressable>
      </View>

      {/* List */}
      <View style={styles.list}>
        {visible.map((tx, i) => {
          const formatted = formatCurrency(Math.abs(tx.amount), {
            currency: currencySymbol,
            decimals: currencyDecimals,
          });
          const isIncome = tx.amount > 0;

          return (
            <View
              key={tx.id}
              style={[
                styles.item,
                i < visible.length - 1 && styles.itemBorder,
              ]}
            >
              {/* Icon */}
              <View style={styles.icon}>
                <CategoryIcon
                  iconKey={(tx.categoryIconId ?? 'Tag') as any}
                  size={14}
                  tone="primary"
                />
              </View>

              {/* Info */}
              <View style={styles.info}>
                <Text style={styles.name} numberOfLines={1}>
                  {tx.description}
                </Text>
                <Text style={styles.meta}>
                  {tx.categoryName} · {formatDate(tx.date)}
                </Text>
              </View>

              {/* Amount */}
              <Text
                style={[
                  styles.amount,
                  isIncome ? styles.amountPositive : styles.amountNegative,
                ]}
              >
                {isIncome ? '+' : '-'}
                {currencySymbol}
                {formatted.whole}
                {formatted.cents}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing['4xl'],
    marginBottom: spacing.lg,
    marginTop: spacing.xs,
  },
  sectionTitle: {
    fontFamily: typography.family.sansBold,
    fontSize: typography.size.lg,
    color: colors.textPrimary,
    letterSpacing: -0.2,
  },
  sectionAction: {
    fontFamily: typography.family.sansSemiBold,
    fontSize: typography.size.base,
    color: colors.accent,
  },
  list: {
    paddingHorizontal: spacing['4xl'],
    marginBottom: spacing['6xl'],
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xl,
    paddingVertical: spacing.lg + 1,
  },
  itemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  icon: {
    width: 32,
    height: 32,
    borderRadius: radii.sm,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  info: {
    flex: 1,
    minWidth: 0,
  },
  name: {
    fontFamily: typography.family.sansMedium,
    fontSize: typography.size.md,
    color: colors.textPrimary,
  },
  meta: {
    fontFamily: typography.family.sans,
    fontSize: typography.size.sm,
    color: colors.textTertiary,
    marginTop: 1,
  },
  amount: {
    fontFamily: typography.family.monoMedium,
    fontSize: typography.size.md,
  },
  amountPositive: {
    color: colors.income,
  },
  amountNegative: {
    color: colors.expense,
  },
});
