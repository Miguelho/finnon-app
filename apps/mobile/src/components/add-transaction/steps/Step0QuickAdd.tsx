import { useMemo, useState } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import {
  themeTokens,
  CURRENCIES,
  type TransactionDraft,
  type CategoryIconKey,
  formatMinorToMoney,
  CURRENCY_MINOR_UNITS,
  type QuickAddSuggestion,
} from "@poleursus/shared";
import { useCopy, t } from "../../../lib/i18n";
import { useUserTheme } from "../../../contexts/UserThemeContext";
import { CategoryIcon } from "../../CategoryIcon";
import { Button } from "../../Button";
import { useQuickAddSuggestions } from "../../../hooks/useQuickAddSuggestions";

const tokens = themeTokens.light;

interface Step0QuickAddProps {
  accountId: string;
  categories: {
    id: string;
    name: string;
    icon_id: string;
    type: "income" | "expense";
  }[];
  draft: TransactionDraft;
  onFieldChange: <K extends keyof TransactionDraft>(
    field: K,
    value: TransactionDraft[K]
  ) => void;
  onContinueManual?: () => void;
}

export function Step0QuickAdd({
  accountId,
  categories,
  draft,
  onFieldChange,
  onContinueManual,
}: Step0QuickAddProps) {
  const { dictionary, locale } = useCopy();
  const { tokens: userTokens, primaryActionColor } = useUserTheme();
  const [selectedSuggestionKey, setSelectedSuggestionKey] = useState<string | null>(
    null
  );

  const { suggestions, isLoading } = useQuickAddSuggestions(accountId, draft.type);

  const categoriesById = useMemo(
    () => new Map(categories.map((category) => [category.id, category])),
    [categories]
  );

  const currencySymbol = useMemo(
    () =>
      CURRENCIES.find((item) => item.code === draft.currency)?.symbol ?? draft.currency,
    [draft.currency]
  );

  const formatSuggestionAmount = (amountMinor: number) => {
    const formatted = formatMinorToMoney(
      BigInt(Math.trunc(amountMinor)),
      draft.currency,
      CURRENCY_MINOR_UNITS
    );
    return locale.startsWith("es") ? formatted.replace(".", ",") : formatted;
  };

  const buildSuggestionKey = (suggestion: QuickAddSuggestion) =>
    `${suggestion.merchant}::${suggestion.categoryId}::${suggestion.amount}`;

  const handleQuickAddPress = (suggestion: QuickAddSuggestion) => {
    const key = buildSuggestionKey(suggestion);
    if (selectedSuggestionKey === key) {
      onFieldChange("amount", "");
      onFieldChange("merchant", "");
      if (draft.categoryId === suggestion.categoryId) {
        onFieldChange("categoryId", null);
      }
      onFieldChange("suggestedCategoryId", null);
      setSelectedSuggestionKey(null);
      return;
    }

    onFieldChange("amount", formatSuggestionAmount(suggestion.amount));
    onFieldChange("merchant", suggestion.merchant);
    onFieldChange("categoryId", suggestion.categoryId);
    onFieldChange("suggestedCategoryId", suggestion.categoryId);
    setSelectedSuggestionKey(key);
    onContinueManual?.();
  };

  return (
    <View style={styles.container}>
      <View
        style={[
          styles.section,
          { backgroundColor: userTokens.surfaceAlt, borderColor: userTokens.border },
        ]}
      >
        <Text style={[styles.sectionLabel, { color: userTokens.textPrimary }]}>
          {t(dictionary, "addTransaction.quickAddLabel")}
        </Text>
        {!isLoading && suggestions.length === 0 ? (
          <Text style={[styles.helperText, { color: userTokens.textSecondary }]}>
            {t(dictionary, "addTransaction.quickAddEmpty")}
          </Text>
        ) : (
          <View style={styles.quickAddList}>
            {suggestions.map((suggestion) => {
              const key = buildSuggestionKey(suggestion);
              const isSelected = key === selectedSuggestionKey;
              const category = categoriesById.get(suggestion.categoryId);
              return (
                <Pressable
                  key={key}
                  onPress={() => handleQuickAddPress(suggestion)}
                  style={[
                    styles.quickAddChip,
                    {
                      borderColor: userTokens.border,
                      backgroundColor: userTokens.surface,
                    },
                    isSelected && {
                      borderColor: primaryActionColor,
                      backgroundColor: userTokens.surfaceAlt,
                    },
                  ]}
                >
                  <View
                    style={[
                      styles.quickAddIconWrap,
                      {
                        borderColor: userTokens.border,
                        backgroundColor: userTokens.surfaceAlt,
                      },
                      isSelected && {
                        borderColor: primaryActionColor,
                        backgroundColor: userTokens.surface,
                      },
                    ]}
                  >
                    <CategoryIcon
                      iconKey={category?.icon_id as CategoryIconKey}
                      size={16}
                      tone={isSelected ? "primary" : "muted"}
                      accessibilityLabel={category?.name ?? suggestion.merchant}
                    />
                  </View>
                  <View style={styles.quickAddTextWrap}>
                    <Text
                      style={[styles.quickAddMerchant, { color: userTokens.textPrimary }]}
                      numberOfLines={1}
                    >
                      {suggestion.merchant}
                    </Text>
                    <Text
                      style={[
                        styles.quickAddAmount,
                        { color: isSelected ? primaryActionColor : userTokens.textSecondary },
                      ]}
                    >
                      {`${currencySymbol}${formatSuggestionAmount(suggestion.amount)}`}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
        )}

        {onContinueManual ? (
          <View style={styles.manualButtonWrap}>
            <Button
              onPress={onContinueManual}
              title={t(dictionary, "addTransaction.quickAddContinueManual")}
              variant="secondary"
            />
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: tokens.spacing.xl,
  },
  section: {
    borderRadius: tokens.radii.lg,
    padding: tokens.spacing.lg,
    borderWidth: 1,
    gap: tokens.spacing.lg,
  },
  sectionLabel: {
    fontSize: tokens.typography.size.md,
    fontWeight: tokens.typography.weight.semibold,
  },
  helperText: {
    fontSize: tokens.typography.size.sm,
    fontWeight: tokens.typography.weight.medium,
  },
  quickAddList: {
    gap: tokens.spacing.sm,
  },
  quickAddChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: tokens.spacing.sm,
    borderWidth: 1,
    borderRadius: tokens.radii.lg,
    paddingVertical: tokens.spacing.sm,
    paddingHorizontal: tokens.spacing.md,
  },
  quickAddIconWrap: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  quickAddTextWrap: {
    flex: 1,
    minWidth: 0,
  },
  quickAddMerchant: {
    fontSize: tokens.typography.size.sm,
    fontWeight: tokens.typography.weight.semibold,
  },
  quickAddAmount: {
    fontSize: tokens.typography.size.sm,
    fontWeight: tokens.typography.weight.medium,
  },
  manualButtonWrap: {
    marginTop: tokens.spacing.sm,
  },
});
