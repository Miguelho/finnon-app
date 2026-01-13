import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from "react-native";
import {
  type CategoryIconKey,
  CATEGORY_ICON_KEYS,
  getIconsByType,
  resolveCategoryIconKey,
  suggestCategoryIcon,
  themeTokens,
} from "@poleursus/shared";
import { CategoryIcon } from "./CategoryIcon";

type IconPickerProps = {
  value?: CategoryIconKey;
  onChange: (iconKey: CategoryIconKey) => void;
  filterType?: "income" | "expense";
  categoryName?: string;
};

export function IconPicker({
  value,
  onChange,
  filterType,
  categoryName,
}: IconPickerProps) {
  const suggestion = categoryName ? suggestCategoryIcon(categoryName) : null;
  const selectedValue = value ? resolveCategoryIconKey(value) : undefined;

  // Filter icons by type if provided
  const availableIcons = filterType
    ? getIconsByType(filterType)
    : CATEGORY_ICON_KEYS;

  // Show suggestions row if confidence is not high and we have a suggestion
  const showSuggestions =
    suggestion && suggestion.confidence !== "high" && categoryName;

  return (
    <ScrollView style={styles.container}>
      {/* Suggestions row */}
      {showSuggestions && (
        <View style={styles.suggestionsSection}>
          <Text style={styles.suggestionsLabel}>Sugeridos</Text>
          <View style={styles.suggestionsRow}>
            {suggestion.suggestions.slice(0, 6).map((iconKey) => (
              <IconButton
                key={iconKey}
                iconKey={iconKey}
                isSelected={selectedValue === iconKey}
                isSuggested={iconKey === suggestion.primary}
                onPress={() => onChange(iconKey)}
              />
            ))}
          </View>
        </View>
      )}

      {/* Main grid */}
      <View style={styles.grid}>
        {availableIcons.map((iconKey) => (
          <IconButton
            key={iconKey}
            iconKey={iconKey}
            isSelected={selectedValue === iconKey}
            onPress={() => onChange(iconKey)}
          />
        ))}
      </View>
    </ScrollView>
  );
}

function IconButton({
  iconKey,
  isSelected,
  isSuggested,
  onPress,
}: {
  iconKey: CategoryIconKey;
  isSelected: boolean;
  isSuggested?: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[
        styles.iconButton,
        isSelected && styles.iconButtonSelected,
        isSuggested && !isSelected && styles.iconButtonSuggested,
      ]}
    >
      <CategoryIcon
        iconKey={iconKey}
        size={24}
        weight={isSelected ? "fill" : "regular"}
        tone={isSelected ? "primary" : "muted"}
      />
    </TouchableOpacity>
  );
}

const tokens = themeTokens.light;
const colors = tokens.colors;

const styles = StyleSheet.create({
  container: {
    maxHeight: 300,
  },
  suggestionsSection: {
    marginBottom: 12,
  },
  suggestionsLabel: {
    fontSize: 12,
    color: colors.text.muted,
    marginBottom: 8,
  },
  suggestionsRow: {
    flexDirection: "row",
    gap: 8,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  iconButton: {
    width: 48,
    height: 48,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: colors.state.neutral,
    borderRadius: tokens.radii.md,
    backgroundColor: colors.bg.surface,
  },
  iconButtonSelected: {
    borderColor: colors.action.primary,
    backgroundColor: colors.action.secondary,
  },
  iconButtonSuggested: {
    borderColor: `${colors.action.primary}80`,
    backgroundColor: `${colors.action.primary}10`,
  },
});
