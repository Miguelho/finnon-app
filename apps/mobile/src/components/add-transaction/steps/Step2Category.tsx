import { useCallback, useEffect, useMemo, useState } from "react";
import { View, Text, Pressable, StyleSheet, TextInput } from "react-native";
import { ChevronDown, ChevronRight, Plus } from "lucide-react-native";
import {
  normalizeMerchant,
  themeTokens,
  type TransactionDraft,
  type TopCategory,
  type MerchantSuggestion,
  type CategoryIconKey,
} from "@poleursus/shared";
import { useCopy, t } from "../../../lib/i18n";
import { useUserTheme } from "../../../contexts/UserThemeContext";
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

type ProjectOption = {
  id: string;
  name: string;
  emoji: string;
  color: string;
};

const LIGHT_TEXT_COLOR = "#FAFAF8";
const DARK_TEXT_COLOR = "#1C1E21";

const parseHexColor = (value: string): { r: number; g: number; b: number } | null => {
  const hex = value.trim().replace(/^#/, "");
  if (!/^[0-9a-fA-F]{3}([0-9a-fA-F]{3})?$/.test(hex)) return null;

  const normalized =
    hex.length === 3
      ? `${hex[0]}${hex[0]}${hex[1]}${hex[1]}${hex[2]}${hex[2]}`
      : hex;

  const r = Number.parseInt(normalized.slice(0, 2), 16);
  const g = Number.parseInt(normalized.slice(2, 4), 16);
  const b = Number.parseInt(normalized.slice(4, 6), 16);
  if ([r, g, b].some((component) => Number.isNaN(component))) return null;

  return { r, g, b };
};

const getReadableTextColor = (backgroundColor: string): string => {
  const rgb = parseHexColor(backgroundColor);
  if (!rgb) return DARK_TEXT_COLOR;
  const luminance = 0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b;
  return luminance > 128 ? DARK_TEXT_COLOR : LIGHT_TEXT_COLOR;
};

interface Step2CategoryProps {
  draft: TransactionDraft;
  errors: Record<string, string>;
  topCategories: TopCategory[];
  allCategories: Category[];
  categoryOccurrenceCounts: Record<string, number>;
  merchantSuggestions: MerchantSuggestion[];
  categoryMerchantOptions: Record<string, string[]>;
  projectOptions: ProjectOption[];
  showProjectAssignment?: boolean;
  onFieldChange: <K extends keyof TransactionDraft>(
    field: K,
    value: TransactionDraft[K]
  ) => void;
  onAddCategory?: (type: "income" | "expense") => void;
}

export function Step2Category({
  draft,
  errors,
  topCategories,
  allCategories,
  categoryOccurrenceCounts,
  merchantSuggestions,
  categoryMerchantOptions,
  projectOptions,
  showProjectAssignment = true,
  onFieldChange,
  onAddCategory,
}: Step2CategoryProps) {
  const { dictionary } = useCopy();
  const { tokens: userTokens, primaryActionColor } = useUserTheme();
  const [showAllCategories, setShowAllCategories] = useState(false);
  const [isProjectListOpen, setIsProjectListOpen] = useState(false);

  // Filter categories by transaction type
  const filteredCategories = useMemo(
    () => allCategories.filter((cat) => cat.type === draft.type),
    [allCategories, draft.type]
  );
  const topCategoryOrder = useMemo(() => {
    const map = new Map<string, number>();
    topCategories.forEach((category, index) => {
      map.set(category.id, index);
    });
    return map;
  }, [topCategories]);
  const sortedCategories = useMemo(() => {
    return [...filteredCategories].sort((left, right) => {
      const occurrenceDiff =
        (categoryOccurrenceCounts[right.id] ?? 0) -
        (categoryOccurrenceCounts[left.id] ?? 0);
      if (occurrenceDiff !== 0) return occurrenceDiff;

      const leftOrder = topCategoryOrder.get(left.id);
      const rightOrder = topCategoryOrder.get(right.id);
      if (leftOrder !== undefined || rightOrder !== undefined) {
        if (leftOrder === undefined) return 1;
        if (rightOrder === undefined) return -1;
        if (leftOrder !== rightOrder) return leftOrder - rightOrder;
      }

      return left.name.localeCompare(right.name);
    });
  }, [categoryOccurrenceCounts, filteredCategories, topCategoryOrder]);
  const collapsedLimit = 8;
  const shouldShowToggle = sortedCategories.length > collapsedLimit;
  const visibleCategories =
    shouldShowToggle && !showAllCategories
      ? sortedCategories.slice(0, collapsedLimit)
      : sortedCategories;

  const handleCategorySelect = useCallback((
    categoryId: string,
    options?: { clearMerchant?: boolean }
  ) => {
    const shouldClearMerchant = options?.clearMerchant ?? true;
    const isCategoryChange = draft.categoryId !== categoryId;

    onFieldChange("categoryId", categoryId);
    if (draft.suggestedCategoryId) {
      onFieldChange("suggestedCategoryId", null);
    }

    if (shouldClearMerchant && isCategoryChange) {
      onFieldChange("merchant", "");
    }

    const merchantsForCategory = categoryMerchantOptions[categoryId] ?? [];
    if (merchantsForCategory.length === 1) {
      const [onlyMerchant] = merchantsForCategory;
      if (onlyMerchant) {
        onFieldChange("merchant", onlyMerchant);
      }
    }
  }, [
    categoryMerchantOptions,
    draft.categoryId,
    draft.suggestedCategoryId,
    onFieldChange,
  ]);

  const selectedCategory = filteredCategories.find(
    (cat) => cat.id === draft.categoryId
  );
  const merchantsForSelectedCategory = draft.categoryId
    ? (categoryMerchantOptions[draft.categoryId] ?? [])
    : [];
  const selectedMerchantNormalized = normalizeMerchant(draft.merchant);

  useEffect(() => {
    setShowAllCategories(false);
  }, [draft.type]);

  useEffect(() => {
    if (draft.type !== "expense" || !showProjectAssignment) {
      setIsProjectListOpen(false);
    }
  }, [draft.type, showProjectAssignment]);

  useEffect(() => {
    if (draft.categoryId || !draft.suggestedCategoryId) return;
    const exists = filteredCategories.some(
      (category) => category.id === draft.suggestedCategoryId
    );
    if (!exists) return;
    handleCategorySelect(draft.suggestedCategoryId, { clearMerchant: false });
  }, [draft.categoryId, draft.suggestedCategoryId, filteredCategories, handleCategorySelect]);

  const selectedProject = draft.projectId
    ? projectOptions.find((project) => project.id === draft.projectId) ?? null
    : null;
  const selectedProjectTextColor = selectedProject
    ? getReadableTextColor(selectedProject.color)
    : userTokens.textPrimary;

  return (
    <View style={styles.container}>
      {/* Category field */}
      <View
        style={[
          styles.section,
          { backgroundColor: userTokens.surfaceAlt, borderColor: userTokens.border },
        ]}
      >
        <View style={styles.categoryHeaderRow}>
          <Text style={[styles.label, { color: userTokens.textPrimary }]}>
            {t(dictionary, "addTransaction.categoryLabel")}
          </Text>
          <Pressable
            onPress={() => onAddCategory?.(draft.type)}
            accessibilityRole="button"
            style={[
              styles.addCategoryButton,
              {
                borderColor: userTokens.border,
                backgroundColor: userTokens.surface,
              },
            ]}
          >
            <Plus size={14} color={primaryActionColor} />
            <Text
              style={[styles.addCategoryButtonText, { color: primaryActionColor }]}
            >
              {t(dictionary, "addTransaction.categoryAddLabel")}
            </Text>
          </Pressable>
        </View>

        {/* All categories grid (expandable) */}
        {sortedCategories.length > 0 && (
          <View style={styles.allCategoriesGrid}>
            {visibleCategories.map((category) => {
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

        {shouldShowToggle && (
          <Pressable
            onPress={() => setShowAllCategories((current) => !current)}
            accessibilityRole="button"
            style={[
              styles.categoriesToggleButton,
              {
                borderColor: userTokens.border,
                backgroundColor: showAllCategories
                  ? userTokens.surfaceAlt
                  : userTokens.surface,
              },
            ]}
          >
            <Text
              style={[styles.categoriesToggleText, { color: userTokens.textPrimary }]}
            >
              {showAllCategories
                ? t(dictionary, "addTransaction.categoryHide")
                : t(dictionary, "addTransaction.categorySeeAll")}
            </Text>
            {showAllCategories ? (
              <ChevronDown size={16} color={userTokens.textPrimary} />
            ) : (
              <ChevronRight size={16} color={userTokens.textPrimary} />
            )}
          </Pressable>
        )}

        {/* Selected category display */}
        {selectedCategory && !showAllCategories && shouldShowToggle && (
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
        {merchantsForSelectedCategory.length > 1 && (
          <View style={styles.merchantChipsRow}>
            {merchantsForSelectedCategory.map((merchant) => {
              const isSelected =
                selectedMerchantNormalized === normalizeMerchant(merchant);
              return (
                <Pressable
                  key={merchant}
                  onPress={() => onFieldChange("merchant", merchant)}
                  style={[
                    styles.merchantChip,
                    {
                      borderColor: isSelected ? primaryActionColor : userTokens.border,
                      backgroundColor: isSelected
                        ? userTokens.surfaceAlt
                        : userTokens.surface,
                    },
                  ]}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isSelected }}
                >
                  <Text
                    style={[
                      styles.merchantChipText,
                      { color: isSelected ? primaryActionColor : userTokens.textPrimary },
                    ]}
                  >
                    {merchant}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        )}
      </View>

      {/* Notes field */}
      <View
        style={[
          styles.section,
          { backgroundColor: userTokens.surfaceAlt, borderColor: userTokens.border },
        ]}
      >
        <Text style={[styles.label, { color: userTokens.textPrimary }]}>
          {t(dictionary, "addTransaction.notesLabel")}
        </Text>
        <TextInput
          style={[
            styles.notesTextArea,
            {
              borderColor: userTokens.border,
              backgroundColor: userTokens.surface,
              color: userTokens.textPrimary,
            },
          ]}
          value={draft.notes}
          onChangeText={(value) => onFieldChange("notes", value)}
          placeholder={t(dictionary, "addTransaction.notesPlaceholder")}
          placeholderTextColor={userTokens.textTertiary}
          multiline
          numberOfLines={4}
          textAlignVertical="top"
        />
      </View>

      {showProjectAssignment && draft.type === "expense" ? (
        <View
          style={[
            styles.section,
            { backgroundColor: userTokens.surfaceAlt, borderColor: userTokens.border },
          ]}
        >
          <Text style={[styles.label, { color: userTokens.textPrimary }]}>
            {t(dictionary, "addTransaction.projectLabel")}
          </Text>

          <Pressable
            onPress={() => setIsProjectListOpen((current) => !current)}
            accessibilityRole="button"
            style={[
              styles.projectSelectTrigger,
              selectedProject
                ? {
                    borderColor: "transparent",
                    backgroundColor: selectedProject.color,
                  }
                : {
                    borderColor: userTokens.border,
                    backgroundColor: userTokens.surface,
                  },
            ]}
          >
            <View style={styles.projectValueContent}>
              {selectedProject ? (
                <>
                  <Text style={[styles.projectEmoji, { color: selectedProjectTextColor }]}>
                    {selectedProject.emoji}
                  </Text>
                  <Text
                    style={[
                      styles.projectSelectValue,
                      { color: selectedProjectTextColor },
                    ]}
                    numberOfLines={1}
                  >
                    {selectedProject.name}
                  </Text>
                </>
              ) : (
                <Text
                  style={[
                    styles.projectSelectValue,
                    { color: userTokens.textPrimary },
                  ]}
                >
                  {t(dictionary, "addTransaction.projectNoneOption")}
                </Text>
              )}
            </View>
            {isProjectListOpen ? (
              <ChevronDown
                size={16}
                color={selectedProject ? selectedProjectTextColor : userTokens.textSecondary}
              />
            ) : (
              <ChevronRight
                size={16}
                color={selectedProject ? selectedProjectTextColor : userTokens.textSecondary}
              />
            )}
          </Pressable>

          {isProjectListOpen ? (
            <View style={styles.projectOptionsList}>
              <Pressable
                onPress={() => {
                  onFieldChange("projectId", null);
                  setIsProjectListOpen(false);
                }}
                accessibilityRole="button"
                style={[
                  styles.projectOptionRow,
                  {
                    borderColor:
                      draft.projectId === null ? primaryActionColor : userTokens.border,
                    backgroundColor:
                      draft.projectId === null
                        ? userTokens.surfaceAlt
                        : userTokens.surface,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.projectOptionText,
                    {
                      color:
                        draft.projectId === null
                          ? primaryActionColor
                          : userTokens.textPrimary,
                    },
                  ]}
                >
                  {t(dictionary, "addTransaction.projectNoneOption")}
                </Text>
              </Pressable>
              {projectOptions.map((project) => {
                const isSelected = draft.projectId === project.id;
                const textColor = getReadableTextColor(project.color);
                return (
                  <Pressable
                    key={project.id}
                    onPress={() => {
                      onFieldChange("projectId", project.id);
                      setIsProjectListOpen(false);
                    }}
                    accessibilityRole="button"
                    accessibilityState={{ selected: isSelected }}
                    style={[
                      styles.projectOptionRow,
                      {
                        borderColor: isSelected ? textColor : "transparent",
                        backgroundColor: project.color,
                      },
                    ]}
                  >
                    <View style={styles.projectOptionContent}>
                      <Text style={[styles.projectEmoji, { color: textColor }]}>
                        {project.emoji}
                      </Text>
                      <Text style={[styles.projectOptionText, { color: textColor }]}>
                        {project.name}
                      </Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          ) : null}

          {projectOptions.length === 0 ? (
            <Text style={[styles.emptyText, { color: userTokens.textTertiary }]}>
              {t(dictionary, "addTransaction.projectEmpty")}
            </Text>
          ) : null}
        </View>
      ) : null}
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
  merchantChipsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: tokens.spacing.sm,
  },
  merchantChip: {
    borderWidth: 1,
    borderRadius: tokens.radii.pill,
    paddingVertical: tokens.spacing.xs,
    paddingHorizontal: tokens.spacing.md,
  },
  merchantChipText: {
    fontSize: tokens.typography.size.sm,
    fontWeight: tokens.typography.weight.medium,
  },
  categoryHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: tokens.spacing.sm,
  },
  label: {
    fontSize: tokens.typography.size.lg,
    fontWeight: tokens.typography.weight.semibold,
  },
  addCategoryButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: tokens.spacing.xs,
    borderWidth: 1,
    borderRadius: tokens.radii.pill,
    paddingVertical: tokens.spacing.xs,
    paddingHorizontal: tokens.spacing.md,
  },
  addCategoryButtonText: {
    fontSize: tokens.typography.size.sm,
    fontWeight: tokens.typography.weight.semibold,
  },
  categoriesToggleButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: tokens.spacing.xs,
    alignSelf: "flex-start",
    borderWidth: 1,
    borderRadius: tokens.radii.md,
    paddingVertical: tokens.spacing.xs,
    paddingHorizontal: tokens.spacing.md,
  },
  categoriesToggleText: {
    fontSize: tokens.typography.size.sm,
    fontWeight: tokens.typography.weight.semibold,
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
  notesTextArea: {
    borderWidth: 1,
    borderRadius: tokens.radii.lg,
    paddingVertical: tokens.spacing.xl,
    paddingHorizontal: tokens.spacing.xl,
    fontSize: tokens.typography.size.md,
    minHeight: 160,
    textAlignVertical: "top",
  },
  projectSelectTrigger: {
    borderWidth: 1,
    borderRadius: tokens.radii.lg,
    paddingHorizontal: tokens.spacing.lg,
    paddingVertical: tokens.spacing.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: tokens.spacing.sm,
  },
  projectSelectValue: {
    flex: 1,
    fontSize: tokens.typography.size.md,
    fontWeight: tokens.typography.weight.medium,
  },
  projectValueContent: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: tokens.spacing.sm,
    minWidth: 0,
  },
  projectEmoji: {
    fontSize: tokens.typography.size.md,
  },
  projectOptionsList: {
    gap: tokens.spacing.sm,
  },
  projectOptionRow: {
    borderWidth: 1,
    borderRadius: tokens.radii.md,
    paddingVertical: tokens.spacing.sm,
    paddingHorizontal: tokens.spacing.md,
  },
  projectOptionContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: tokens.spacing.sm,
  },
  projectOptionText: {
    fontSize: tokens.typography.size.sm,
    fontWeight: tokens.typography.weight.medium,
    flexShrink: 1,
  },
});
