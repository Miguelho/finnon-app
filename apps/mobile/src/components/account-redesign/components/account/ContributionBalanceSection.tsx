import { useMemo } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useCopy, t } from "../../../../lib/i18n";
import { useUserTheme } from "../../../../contexts/UserThemeContext";
import type {
  AccountContributor,
  ContributionBalanceData,
  ContributionCategorySummary,
} from "../../types/account";
import { formatCurrency } from "../../utils/currency";
import { colors, spacing, typography, radii } from "../../theme/tokens";
import { CategoryIcon } from "../../../CategoryIcon";

const DEFAULT_VISIBLE_CATEGORIES = 2;

interface ContributionBalanceSectionProps {
  data: ContributionBalanceData | null;
  contributors: AccountContributor[];
  currencySymbol?: string;
  currencyDecimals?: number;
  onCategoryPress?: (categoryId: string, type: "income" | "expense") => void;
}

export function ContributionBalanceSection({
  data,
  contributors,
  currencySymbol = "€",
  currencyDecimals = 2,
  onCategoryPress,
}: ContributionBalanceSectionProps) {
  const { dictionary } = useCopy();
  const { tokens: userTokens } = useUserTheme();
  const translate = t as any;

  const contributorByUserId = useMemo(
    () => new Map(contributors.map((contributor) => [contributor.userId, contributor])),
    [contributors]
  );
  const firstContributor = contributors[0];
  const secondContributor = contributors[1];
  const isCollaborative = contributors.length >= 2 && (data?.members.length ?? 0) >= 2;

  if (!data) return null;

  const renderSection = (
    type: "expense" | "income",
    categories: ContributionCategorySummary[]
  ) => {
    const sortedCategories = [...categories].sort((a, b) => b.totalAmount - a.totalAmount);
    if (sortedCategories.length === 0) return null;

    const title = isCollaborative
      ? type === "expense"
        ? translate(dictionary, "account.redesign.expensesByContributionTitle")
        : translate(dictionary, "account.redesign.incomesByContributionTitle")
      : type === "expense"
      ? translate(dictionary, "account.redesign.categorySpendingTitle")
      : translate(dictionary, "account.redesign.incomeByCategoryTitle");
    const leadingCategories = sortedCategories.slice(0, DEFAULT_VISIBLE_CATEGORIES);

    const renderCategoryRow = (
      category: ContributionCategorySummary,
      options: {
        showBorder: boolean;
        interactive: boolean;
        keyPrefix?: string;
      }
    ) => {
      const formattedTotal = formatCurrency(category.totalAmount, {
        currency: currencySymbol,
        decimals: currencyDecimals,
      }).full;

      const firstShare = category.shares.find((share) => share.userId === firstContributor?.userId);
      const secondShare = category.shares.find((share) => share.userId === secondContributor?.userId);

      const leftLabel = firstShare && firstShare.amount > 0 ? `${Math.round(firstShare.percentage)}%` : "—";
      const rightLabel =
        secondShare && secondShare.amount > 0 ? `${Math.round(secondShare.percentage)}%` : "—";

      const rowBaseStyles = [
        styles.categoryItem,
        options.showBorder && styles.categoryItemBorder,
        options.showBorder && { borderBottomColor: userTokens.border },
      ];
      const rowContent = (
        <>
          <View style={styles.row1}>
            <View
              style={[
                styles.icon,
                {
                  backgroundColor: userTokens.surfaceAlt,
                  borderColor: userTokens.border,
                },
              ]}
            >
              <CategoryIcon
                iconKey={(category.iconId ?? "Tag") as any}
                size={16}
                tone={type === "expense" ? "negative" : "positive"}
              />
            </View>

            <View style={styles.info}>
              <Text style={[styles.name, { color: userTokens.textPrimary }]}>
                {category.name}
              </Text>
              <Text style={[styles.count, { color: userTokens.textSecondary }]}>
                {translate(dictionary, "account.redesign.movementCount", {
                  count: category.transactionCount,
                })}
              </Text>
            </View>

            <Text
              style={[
                styles.total,
                type === "expense" ? styles.totalExpense : styles.totalIncome,
              ]}
            >
              {formattedTotal}
            </Text>
          </View>

          {isCollaborative ? (
            <View style={styles.row2}>
              <Text style={[styles.row2Label, { color: userTokens.textSecondary }]}>
                {leftLabel}
              </Text>

              <View
                style={[
                  styles.barTrack,
                  { backgroundColor: userTokens.border },
                ]}
              >
                {category.shares
                  .filter((share) => share.amount > 0)
                  .map((share) => (
                    <View
                      key={`${category.id}-${share.userId}`}
                      style={[
                        styles.barSegment,
                        {
                          width: `${Math.max(0, share.percentage)}%`,
                          backgroundColor:
                            contributorByUserId.get(share.userId)?.color ?? "#2563EB",
                        },
                      ]}
                    />
                  ))}
              </View>

              <Text
                style={[
                  styles.row2Label,
                  styles.row2LabelRight,
                  { color: userTokens.textSecondary },
                ]}
              >
                {rightLabel}
              </Text>
            </View>
          ) : null}
        </>
      );
      const rowKey = options.keyPrefix
        ? `${options.keyPrefix}-${type}-${category.id}`
        : `${type}-${category.id}`;

      if (!options.interactive) {
        return (
          <View key={rowKey} style={rowBaseStyles}>
            {rowContent}
          </View>
        );
      }

      return (
        <Pressable
          key={rowKey}
          style={({ pressed }) => [
            ...rowBaseStyles,
            pressed && styles.categoryItemPressed,
          ]}
          onPress={() => onCategoryPress?.(category.id, type)}
        >
          {rowContent}
        </Pressable>
      );
    };

    return (
      <View
        style={[
          styles.sectionCard,
          {
            borderColor: userTokens.border,
            backgroundColor: userTokens.surface,
          },
        ]}
      >
        <Text style={[styles.sectionTitle, { color: userTokens.textPrimary }]}>{title}</Text>

        <View style={styles.categoryList}>
          {leadingCategories.map((category, index) =>
            renderCategoryRow(category, {
              showBorder: index < leadingCategories.length - 1,
              interactive: true,
            })
          )}
        </View>
      </View>
    );
  };

  if (data.expenseCategories.length === 0 && data.incomeCategories.length === 0) {
    return null;
  }

  return (
    <View style={styles.section}>
      {renderSection("expense", data.expenseCategories)}
      {renderSection("income", data.incomeCategories)}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    paddingHorizontal: spacing["4xl"],
    marginBottom: spacing["5xl"],
    gap: spacing.md,
  },
  sectionCard: {
    borderWidth: 1,
    borderRadius: radii.lg,
    padding: spacing["2xl"],
    gap: spacing.md,
  },
  sectionTitle: {
    fontFamily: typography.family.sansBold,
    fontSize: typography.size.md,
    letterSpacing: -0.1,
  },
  categoryList: {
    gap: spacing.sm,
  },
  categoryItem: {
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  categoryItemPressed: {
    opacity: 0.72,
  },
  categoryItemBorder: {
    borderBottomWidth: 1,
  },
  row1: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  icon: {
    width: 34,
    height: 34,
    borderRadius: radii.md,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  info: {
    flex: 1,
    minWidth: 0,
  },
  name: {
    fontSize: typography.size.md,
    fontFamily: typography.family.sansSemiBold,
  },
  count: {
    fontSize: typography.size.sm,
    fontFamily: typography.family.sans,
  },
  total: {
    fontSize: typography.size.md,
    fontFamily: typography.family.monoMedium,
  },
  totalExpense: {
    color: colors.expense,
  },
  totalIncome: {
    color: colors.income,
  },
  row2: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingLeft: spacing.lg,
  },
  row2Label: {
    width: 34,
    fontSize: typography.size.xs,
    fontFamily: typography.family.sansSemiBold,
  },
  row2LabelRight: {
    textAlign: "right",
  },
  barTrack: {
    flex: 1,
    height: 10,
    borderRadius: radii.full,
    overflow: "hidden",
    flexDirection: "row",
  },
  barSegment: {
    height: "100%",
  },
});
