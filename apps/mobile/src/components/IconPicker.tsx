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
import { useUserTheme } from "../contexts/UserThemeContext";

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
  const { tokens: userTokens, primaryActionColor } = useUserTheme();
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
    <ScrollView style={styles.container} nestedScrollEnabled>
      {/* Suggestions row */}
      {showSuggestions && (
        <View style={styles.suggestionsSection}>
          <Text style={[styles.suggestionsLabel, { color: userTokens.textSecondary }]}>
            Sugeridos
          </Text>
          <View style={styles.suggestionsRow}>
            {suggestion.suggestions.slice(0, 6).map((iconKey) => (
              <IconButton
                key={iconKey}
                iconKey={iconKey}
                isSelected={selectedValue === iconKey}
                isSuggested={iconKey === suggestion.primary}
                onPress={() => onChange(iconKey)}
                borderColor={userTokens.border}
                surfaceColor={userTokens.surface}
                selectedBorderColor={primaryActionColor}
                selectedBgColor={userTokens.surfaceAlt}
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
            borderColor={userTokens.border}
            surfaceColor={userTokens.surface}
            selectedBorderColor={primaryActionColor}
            selectedBgColor={userTokens.surfaceAlt}
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
  borderColor,
  surfaceColor,
  selectedBorderColor,
  selectedBgColor,
}: {
  iconKey: CategoryIconKey;
  isSelected: boolean;
  isSuggested?: boolean;
  onPress: () => void;
  borderColor: string;
  surfaceColor: string;
  selectedBorderColor: string;
  selectedBgColor: string;
}) {
  const suggestedBg = withAlpha(selectedBorderColor, 0.08);
  const suggestedBorder = withAlpha(selectedBorderColor, 0.5);

  return (
    <TouchableOpacity
      onPress={onPress}
      style={[
        styles.iconButton,
        { borderColor, backgroundColor: surfaceColor },
        isSelected && {
          borderColor: selectedBorderColor,
          backgroundColor: selectedBgColor,
        },
        isSuggested &&
          !isSelected && {
            borderColor: suggestedBorder,
            backgroundColor: suggestedBg,
          },
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

function withAlpha(hexColor: string, alpha: number) {
  const normalized = hexColor.replace("#", "");
  const expanded =
    normalized.length === 3
      ? normalized
          .split("")
          .map((chunk) => chunk + chunk)
          .join("")
      : normalized;
  if (expanded.length !== 6) return hexColor;
  const red = parseInt(expanded.slice(0, 2), 16);
  const green = parseInt(expanded.slice(2, 4), 16);
  const blue = parseInt(expanded.slice(4, 6), 16);
  if ([red, green, blue].some((value) => Number.isNaN(value))) return hexColor;
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

const styles = StyleSheet.create({
  container: {
    maxHeight: 300,
  },
  suggestionsSection: {
    marginBottom: 12,
  },
  suggestionsLabel: {
    fontSize: 12,
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
    borderRadius: tokens.radii.md,
  },
});
