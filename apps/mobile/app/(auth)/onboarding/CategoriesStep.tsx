import { useMemo } from "react";
import { View, StyleSheet, ScrollView, Text, TouchableOpacity } from "react-native";
import { Button } from "../../../src/components/Button";
import { useCopy, t } from "../../../src/lib/i18n";
import {
  DEFAULT_CATEGORIES,
  type DefaultCategory,
  type CategoryIconKey,
} from "@poleursus/shared";
import { CategoryIcon } from "../../../src/components/CategoryIcon";
import { OnboardingProgress } from "./OnboardingProgress";
import { OnboardingSurface } from "./OnboardingSurface";
import { onboardingColors, onboardingRadii } from "./onboarding-theme";

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
  const selectedNames = useMemo(
    () => new Set(selectedCategories.map((category) => category.name)),
    [selectedCategories]
  );

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
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <OnboardingSurface>
          <OnboardingProgress current="categories" />
          <View style={styles.header}>
            <Text style={styles.title}>
              {t(dictionary, "onboarding.categories.title")}
            </Text>
            <Text style={styles.subtitle}>
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
                    isSelected && styles.categoryItemSelected,
                  ]}
                  onPress={() => toggleCategory(category)}
                >
                  <View style={styles.iconChip}>
                    <CategoryIcon
                      iconKey={category.icon_id as CategoryIconKey}
                      size={18}
                      tone="muted"
                    />
                  </View>
                  <Text
                    style={styles.categoryLabel}
                    numberOfLines={1}
                    ellipsizeMode="tail"
                  >
                    {label}
                  </Text>
                  <View
                    style={[
                      styles.checkChip,
                      isSelected && styles.checkChipSelected,
                    ]}
                  >
                    <Text
                      style={[
                        styles.checkText,
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
          <Text style={styles.footerText}>
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
    backgroundColor: onboardingColors.bg,
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
    color: onboardingColors.text,
  },
  subtitle: {
    marginTop: 6,
    fontSize: 13,
    color: onboardingColors.textSecondary,
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
    borderColor: onboardingColors.border,
    borderRadius: onboardingRadii.sm,
    paddingVertical: 12,
    paddingHorizontal: 12,
    width: "48%",
    backgroundColor: onboardingColors.white,
  },
  categoryItemSelected: {
    borderColor: onboardingColors.dark,
    backgroundColor: "#f8f9fc",
  },
  iconChip: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: onboardingColors.bg,
    alignItems: "center",
    justifyContent: "center",
  },
  categoryLabel: {
    fontSize: 12,
    fontWeight: "500",
    color: onboardingColors.text,
    marginLeft: 8,
    flex: 1,
  },
  checkChip: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1.5,
    borderColor: onboardingColors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  checkChipSelected: {
    backgroundColor: onboardingColors.dark,
    borderColor: onboardingColors.dark,
  },
  checkText: {
    fontSize: 10,
    color: onboardingColors.white,
    fontWeight: "700",
  },
  checkHidden: {
    opacity: 0,
  },
  footerText: {
    fontSize: 12,
    color: onboardingColors.textMuted,
    marginTop: 12,
    marginBottom: 16,
    textAlign: "center",
  },
  actions: {
    gap: 12,
  },
});
