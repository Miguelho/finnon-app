import { useMemo } from "react";
import { View, StyleSheet, ScrollView, Text, TouchableOpacity } from "react-native";
import { Button } from "../../../src/components/Button";
import { useCopy, t } from "../../../src/lib/i18n";
import {
  DEFAULT_CATEGORIES,
  withAlpha,
  type DefaultCategory,
  type CategoryIconKey,
} from "@poleursus/shared";
import { CategoryIcon } from "../../../src/components/CategoryIcon";
import { useUserTheme } from "../../../src/contexts/UserThemeContext";
import { OnboardingProgress } from "./OnboardingProgress";
import { OnboardingSurface } from "./OnboardingSurface";
import { onboardingRadii } from "./onboarding-theme";

interface CategoriesStepProps {
  selectedCategories: DefaultCategory[];
  onChangeSelectedCategories: (selected: DefaultCategory[]) => void;
  onContinue: () => void;
  onBack: () => void;
}

export function CategoriesStep({
  selectedCategories,
  onChangeSelectedCategories,
  onContinue,
  onBack,
}: CategoriesStepProps) {
  const { dictionary, locale } = useCopy();
  const { tokens: userTokens, primaryActionColor } = useUserTheme();
  const selectedNames = useMemo(
    () => new Set(selectedCategories.map((category) => category.name)),
    [selectedCategories]
  );
  const selectedCategoryBg = withAlpha(primaryActionColor, 0.12);

  const toggleCategory = (category: DefaultCategory) => {
    const next = new Set(selectedNames);
    if (next.has(category.name)) {
      next.delete(category.name);
    } else {
      next.add(category.name);
    }
    onChangeSelectedCategories(
      DEFAULT_CATEGORIES.filter((item) => next.has(item.name))
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: userTokens.background }]}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <OnboardingSurface
          style={{
            backgroundColor: userTokens.surface,
            borderColor: userTokens.border,
          }}
        >
          <OnboardingProgress current="categories" />
          <View style={styles.header}>
            <Text style={[styles.title, { color: userTokens.textPrimary }]}>
              {t(dictionary, "onboarding.categories.title")}
            </Text>
            <Text style={[styles.subtitle, { color: userTokens.textSecondary }]}>
              {t(dictionary, "onboarding.categories.subtitle")}
            </Text>
          </View>
          <View style={styles.grid}>
            {DEFAULT_CATEGORIES.map((category) => {
              const isSelected = selectedNames.has(category.name);
              const label = locale === "en" ? category.name_en : category.name;
              return (
                <TouchableOpacity
                  key={category.name}
                  style={[
                    styles.categoryItem,
                    {
                      borderColor: userTokens.border,
                      backgroundColor: userTokens.surfaceAlt,
                    },
                    isSelected && {
                      borderColor: primaryActionColor,
                      backgroundColor: selectedCategoryBg,
                    },
                  ]}
                  onPress={() => toggleCategory(category)}
                >
                  <View
                    style={[
                      styles.iconChip,
                      { backgroundColor: userTokens.background },
                    ]}
                  >
                    <CategoryIcon
                      iconKey={category.icon_id as CategoryIconKey}
                      size={18}
                      tone="muted"
                    />
                  </View>
                  <Text
                    style={[styles.categoryLabel, { color: userTokens.textPrimary }]}
                    numberOfLines={1}
                    ellipsizeMode="tail"
                  >
                    {label}
                  </Text>
                  <View
                    style={[
                      styles.checkChip,
                      { borderColor: userTokens.border },
                      isSelected && {
                        backgroundColor: primaryActionColor,
                        borderColor: primaryActionColor,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.checkText,
                        { color: userTokens.surface },
                        !isSelected && styles.checkHidden,
                      ]}
                    >
                      ✓
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
          <Text style={[styles.footerText, { color: userTokens.textSecondary }]}>
            {t(dictionary, "onboarding.categories.footer")}
          </Text>
          <View style={styles.actions}>
            <Button title={t(dictionary, "common.back")} onPress={onBack} variant="secondary" />
            <Button
              title={t(dictionary, "onboarding.categories.continue")}
              onPress={onContinue}
            />
          </View>
        </OnboardingSurface>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: "center",
    padding: 20,
  },
  header: {
    marginTop: 12,
    alignItems: "center",
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
  },
  subtitle: {
    marginTop: 6,
    fontSize: 13,
    textAlign: "center",
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    marginTop: 20,
    gap: 10,
  },
  categoryItem: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1.5,
    borderRadius: onboardingRadii.sm,
    paddingVertical: 12,
    paddingHorizontal: 12,
    width: "48%",
  },
  iconChip: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  categoryLabel: {
    fontSize: 12,
    fontWeight: "500",
    marginLeft: 8,
    flex: 1,
  },
  checkChip: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  checkText: {
    fontSize: 10,
    fontWeight: "700",
  },
  checkHidden: {
    opacity: 0,
  },
  footerText: {
    fontSize: 12,
    marginTop: 12,
    marginBottom: 16,
    textAlign: "center",
  },
  actions: {
    gap: 12,
  },
});
