import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, typography, spacing, radii } from '../../theme/tokens';
import { formatCurrency } from '../../utils/currency';
import type { CategorySummary } from '../../types/account';

interface CategoryListProps {
  categories: CategorySummary[];
  /** Máximo de categorías visibles antes de "Ver todas" */
  limit?: number;
  onCategoryPress?: (category: CategorySummary) => void;
  onViewAllPress?: () => void;
}

export function CategoryList({
  categories,
  limit = 4,
  onCategoryPress,
  onViewAllPress,
}: CategoryListProps) {
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
        <Text style={styles.sectionTitle}>Gastos por categoría</Text>
        {hasMore && (
          <Pressable onPress={onViewAllPress} hitSlop={8}>
            <Text style={styles.sectionAction}>Ver todas →</Text>
          </Pressable>
        )}
      </View>

      {/* List */}
      <View style={styles.list}>
        {visible.map((cat, i) => {
          const formatted = formatCurrency(cat.amount);
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
                pressed && styles.itemPressed,
              ]}
              onPress={() => onCategoryPress?.(cat)}
            >
              {/* Icon */}
              <View style={[styles.icon, { backgroundColor: bgColor }]}>
                <Text style={styles.iconEmoji}>{cat.icon}</Text>
              </View>

              {/* Info */}
              <View style={styles.info}>
                <Text style={styles.name}>{cat.name}</Text>
                <Text style={styles.count}>
                  {cat.transactionCount} movimiento
                  {cat.transactionCount !== 1 ? 's' : ''}
                </Text>
              </View>

              {/* Amount + bar */}
              <View style={styles.right}>
                <Text style={styles.amount}>
                  €{formatted.whole}
                  {formatted.cents}
                </Text>
                <View style={styles.barTrack}>
                  <View
                    style={[styles.barFill, { width: `${barWidth}%` }]}
                  />
                </View>
              </View>

              {/* Chevron */}
              <Ionicons
                name="chevron-forward"
                size={14}
                color={colors.textTertiary}
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
    borderBottomColor: colors.borderLight,
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
  iconEmoji: {
    fontSize: 15,
  },
  info: {
    flex: 1,
    minWidth: 0,
  },
  name: {
    fontFamily: typography.family.sansSemiBold,
    fontSize: typography.size.md,
    color: colors.textPrimary,
  },
  count: {
    fontFamily: typography.family.sans,
    fontSize: typography.size.sm,
    color: colors.textTertiary,
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
    backgroundColor: colors.borderLight,
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
