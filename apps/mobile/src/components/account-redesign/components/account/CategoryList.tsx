import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { CategoryIcon } from '../../../CategoryIcon';
import { colors, typography, spacing, radii } from '../../theme/tokens';
import { formatCurrency } from '../../utils/currency';
import type { CategorySummary } from '../../types/account';
import { useUserTheme } from '../../../../contexts/UserThemeContext';
import { useCopy, t } from '../../../../lib/i18n';

interface CategoryListProps {
  categories: CategorySummary[];
  currencySymbol?: string;
  currencyDecimals?: number;
  /** Máximo de categorías visibles antes de "Ver todas" */
  limit?: number;
  onCategoryPress?: (category: CategorySummary) => void;
  onViewAllPress?: () => void;
}

export function CategoryList({
  categories,
  currencySymbol = '€',
  currencyDecimals = 2,
  limit = 4,
  onCategoryPress,
  onViewAllPress,
}: CategoryListProps) {
  const { dictionary } = useCopy();
  const { tokens: userTokens, primaryActionColor } = useUserTheme();
  // Solo gastos, ordenados de mayor a menor
  const expenseCategories = categories
    .filter((c) => c.type === 'expense')
    .sort((a, b) => b.amount - a.amount);

  const maxAmount = expenseCategories[0]?.amount ?? 1;
  const visible = expenseCategories.slice(0, limit);
  const hasMore = expenseCategories.length > limit;

  return (
    <View>
      {/* Section header */}
      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionTitle, { color: userTokens.textPrimary }]}>
          {t(dictionary, "account.redesign.categorySpendingTitle")}
        </Text>
        {hasMore && (
          <Pressable onPress={onViewAllPress} hitSlop={8}>
            <Text style={[styles.sectionAction, { color: primaryActionColor }]}>
              {t(dictionary, "account.redesign.viewAllCategories")}
            </Text>
          </Pressable>
        )}
      </View>

      {/* List */}
      <View style={styles.list}>
        {visible.map((cat, i) => {
          const formatted = formatCurrency(cat.amount, {
            currency: currencySymbol,
            decimals: currencyDecimals,
          });
          const barWidth = (cat.amount / maxAmount) * 100;
          const bgColor =
            colors.category[cat.colorKey as keyof typeof colors.category] ??
            colors.category.default;

          return (
            <Pressable
              key={cat.id}
              style={({ pressed }) => [
                styles.item,
                i < visible.length - 1 && styles.itemBorder,
                i < visible.length - 1 && { borderBottomColor: userTokens.border },
                pressed && styles.itemPressed,
              ]}
              onPress={() => onCategoryPress?.(cat)}
            >
              {/* Icon */}
              <View style={[styles.icon, { backgroundColor: bgColor }]}>
                <CategoryIcon
                  iconKey={(cat.iconId ?? 'Tag') as any}
                  size={16}
                  tone="primary"
                />
              </View>

              {/* Info */}
              <View style={styles.info}>
                <Text style={[styles.name, { color: userTokens.textPrimary }]}>
                  {cat.name}
                </Text>
                <Text style={[styles.count, { color: userTokens.textSecondary }]}>
                  {t(dictionary, "account.redesign.movementCount", {
                    count: cat.transactionCount,
                  })}
                </Text>
              </View>

              {/* Amount + bar */}
              <View style={styles.right}>
                <Text style={styles.amount}>
                  {currencySymbol}
                  {formatted.whole}
                  {formatted.cents}
                </Text>
                <View style={[styles.barTrack, { backgroundColor: userTokens.border }]}>
                  <View
                    style={[styles.barFill, { width: `${barWidth}%` }]}
                  />
                </View>
              </View>

              {/* Chevron */}
              <Ionicons
                name="chevron-forward"
                size={14}
                color={userTokens.textSecondary}
                style={styles.chevron}
              />
            </Pressable>
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
    letterSpacing: -0.2,
  },
  sectionAction: {
    fontFamily: typography.family.sansSemiBold,
    fontSize: typography.size.base,
  },
  list: {
    paddingHorizontal: spacing['4xl'],
    marginBottom: spacing['5xl'],
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xl,
    paddingVertical: spacing.xl,
  },
  itemBorder: {
    borderBottomWidth: 1,
  },
  itemPressed: {
    opacity: 0.7,
  },
  icon: {
    width: 36,
    height: 36,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  info: {
    flex: 1,
    minWidth: 0,
  },
  name: {
    fontFamily: typography.family.sansSemiBold,
    fontSize: typography.size.md,
  },
  count: {
    fontFamily: typography.family.sans,
    fontSize: typography.size.sm,
    marginTop: 1,
  },
  right: {
    alignItems: 'flex-end',
  },
  amount: {
    fontFamily: typography.family.monoMedium,
    fontSize: typography.size.md,
    color: colors.expense,
  },
  barTrack: {
    width: 64,
    height: 3,
    borderRadius: 2,
    marginTop: spacing.sm,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 2,
    backgroundColor: colors.expense,
    opacity: 0.5,
  },
  chevron: {
    marginLeft: spacing.xs,
    opacity: 0.4,
  },
});
