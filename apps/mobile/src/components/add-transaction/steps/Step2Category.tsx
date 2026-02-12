import { useState } from "react";
import { View, Text, Pressable, StyleSheet, ScrollView } from "react-native";
import {
  themeTokens,
  type TransactionDraft,
  type TopCategory,
  type MerchantSuggestion,
  type CategoryIconKey,
} from "@poleursus/shared";
import { useCopy, t } from "../../../lib/i18n";
import { useUserTheme } from "../../../contexts/UserThemeContext";
import { TopCategorySelector } from "../../TopCategorySelector";
import { MerchantAutocomplete } from "../../MerchantAutocomplete";
import { CategoryIcon } from "../../CategoryIcon";

const tokens = themeTokens.light;
const colors = tokens.colors;

interface Category {
  id: string;
  name: string;
  icon_id: string;
  type: "income" | "expense";
}

interface Step2CategoryProps {
  draft: TransactionDraft;
  errors: Record<string, string>;
  topCategories: TopCategory[];
  allCategories: Category[];
  merchantSuggestions: MerchantSuggestion[];
  onFieldChange: <K extends keyof TransactionDraft>(
    field: K,
    value: TransactionDraft[K]
  ) => void;
}

export function Step2Category({
  draft,
  errors,
  topCategories,
  allCategories,
  merchantSuggestions,
  onFieldChange,
}: Step2CategoryProps) {
  const { dictionary } = useCopy();
  const { tokens: userTokens, primaryActionColor } = useUserTheme();
  const [showAllCategories, setShowAllCategories] = useState(false);

  // Filter categories by transaction type
  const filteredCategories = allCategories.filter(
    (cat) => cat.type === draft.type
  );

  const handleCategorySelect = (categoryId: string) => {
    onFieldChange("categoryId", categoryId);
  };

  const selectedCategory = filteredCategories.find(
    (cat) => cat.id === draft.categoryId
  );

  return (
    <View style={styles.container}>
      {/* Category field */}
      <View
        style={[
          styles.section,
          { backgroundColor: userTokens.surfaceAlt, borderColor: userTokens.border },
        ]}
      >
        <Text style={[styles.label, { color: userTokens.textPrimary }]}>
          {t(dictionary, "addTransaction.categoryLabel")}
        </Text>

        {/* Top category chips */}
        {topCategories.length > 0 && (
          <TopCategorySelector
            topCategories={topCategories.slice(0, 3)}
            selectedCategoryId={draft.categoryId ?? undefined}
            onSelect={handleCategorySelect}
            onToggleAll={() => setShowAllCategories(!showAllCategories)}
            isExpanded={showAllCategories}
            seeOthersLabel={t(dictionary, "addTransaction.categorySeeAll")}
            hideOthersLabel={t(dictionary, "addTransaction.categoryHide")}
          />
        )}

        {/* All categories grid (expandable) */}
        {(showAllCategories || topCategories.length === 0) && (
          <View style={styles.allCategoriesGrid}>
            {filteredCategories.map((category) => {
              const isSelected = draft.categoryId === category.id;
              return (
                <Pressable
                  key={category.id}
                  onPress={() => handleCategorySelect(category.id)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isSelected }}
                  style={[
                    styles.categoryItem,
                    {
                      borderColor: userTokens.border,
                      backgroundColor: userTokens.surface,
                    },
                    isSelected && styles.categoryItemSelected,
                    isSelected && {
                      borderColor: primaryActionColor,
                      backgroundColor: userTokens.surfaceAlt,
                    },
                  ]}
                >
                  <CategoryIcon
                    iconKey={category.icon_id as CategoryIconKey}
                    size={24}
                    tone={isSelected ? "primary" : "muted"}
                    accessibilityLabel={category.name}
                  />
                  <Text
                    style={[
                      styles.categoryItemText,
                      { color: userTokens.textPrimary },
                      isSelected && styles.categoryItemTextSelected,
                      isSelected && { color: primaryActionColor },
                    ]}
                    numberOfLines={1}
                  >
                    {category.name}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        )}

        {/* Selected category display */}
        {selectedCategory && !showAllCategories && topCategories.length > 0 && (
          <Text style={[styles.selectedText, { color: userTokens.textSecondary }]}>
            {selectedCategory.name}
          </Text>
        )}

        {/* Empty state */}
        {filteredCategories.length === 0 && (
          <Text style={[styles.emptyText, { color: userTokens.textTertiary }]}>
            {t(dictionary, "addTransaction.categoryEmpty")}
          </Text>
        )}

        {/* Error */}
        {errors.categoryId && (
          <Text style={styles.errorText}>
            {t(dictionary, "addTransaction.errors.categoryRequired")}
          </Text>
        )}
      </View>

      {/* Merchant field */}
      <View
        style={[
          styles.section,
          styles.merchantField,
          { backgroundColor: userTokens.surfaceAlt, borderColor: userTokens.border },
        ]}
      >
        <MerchantAutocomplete
          label={t(dictionary, "addTransaction.merchantLabel")}
          helperText={
            merchantSuggestions.length > 0
              ? t(dictionary, "addTransaction.merchantHistoryHint")
              : undefined
          }
          value={draft.merchant}
          onChangeText={(value) => onFieldChange("merchant", value)}
          suggestions={merchantSuggestions}
          placeholder={t(dictionary, "addTransaction.merchantPlaceholder")}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 32,
  },
  section: {
    gap: tokens.spacing.lg,
    padding: tokens.spacing.lg,
    borderRadius: tokens.radii.lg,
    borderWidth: 1,
  },
  merchantField: {
    zIndex: 10,
    gap: tokens.spacing.md,
  },
  label: {
    fontSize: tokens.typography.size.lg,
    fontWeight: tokens.typography.weight.semibold,
    marginBottom: tokens.spacing.sm,
  },
  allCategoriesGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: tokens.spacing.md,
    marginTop: tokens.spacing.md,
  },
  categoryItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: tokens.spacing.md,
    paddingVertical: tokens.spacing.lg,
    paddingHorizontal: tokens.spacing.lg,
    borderRadius: tokens.radii.lg,
    borderWidth: 1,
    minWidth: "45%",
    flexGrow: 1,
    minHeight: 56,
  },
  categoryItemSelected: {
  },
  categoryItemText: {
    fontSize: tokens.typography.size.md,
    fontWeight: tokens.typography.weight.medium,
    flex: 1,
  },
  categoryItemTextSelected: {
  },
  selectedText: {
    fontSize: tokens.typography.size.md,
    marginTop: tokens.spacing.sm,
  },
  emptyText: {
    fontSize: tokens.typography.size.md,
    paddingVertical: tokens.spacing.xl,
  },
  errorText: {
    fontSize: tokens.typography.size.sm,
    color: colors.state.negative,
    marginTop: tokens.spacing.sm,
  },
});
