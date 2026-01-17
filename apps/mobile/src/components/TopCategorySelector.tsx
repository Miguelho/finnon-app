import {
  View,
  Text,
  Pressable,
  StyleSheet,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { CaretRight } from "phosphor-react-native";
import { themeTokens, type TopCategory, type CategoryIconKey } from "@poleursus/shared";
import { CategoryIcon } from "./CategoryIcon";

const tokens = themeTokens.light;
const colors = tokens.colors;
const typography = tokens.typography;
const radii = tokens.radii;

export interface TopCategorySelectorProps {
  topCategories: TopCategory[];
  selectedCategoryId?: string;
  onSelect: (categoryId: string) => void;
  onOpenAll: () => void;
  seeOthersLabel: string;
  style?: StyleProp<ViewStyle>;
}

export function TopCategorySelector({
  topCategories,
  selectedCategoryId,
  onSelect,
  onOpenAll,
  seeOthersLabel,
  style,
}: TopCategorySelectorProps) {
  if (topCategories.length === 0) {
    return null;
  }

  return (
    <View style={[styles.container, style]}>
      {topCategories.map((category) => {
        const isSelected = selectedCategoryId === category.id;
        return (
          <Pressable
            key={category.id}
            onPress={() => onSelect(category.id)}
            accessibilityRole="button"
            accessibilityState={{ selected: isSelected }}
            accessibilityLabel={category.name}
            style={({ pressed }) => [
              styles.pill,
              isSelected ? styles.pillSelected : styles.pillDefault,
              pressed && styles.pillPressed,
            ]}
          >
            <CategoryIcon
              iconKey={category.icon_id as CategoryIconKey}
              size={16}
              tone={isSelected ? "primary" : "muted"}
              accessibilityLabel={category.name}
            />
            <Text
              style={[
                styles.pillText,
                isSelected ? styles.pillTextSelected : styles.pillTextDefault,
              ]}
              numberOfLines={1}
            >
              {category.name}
            </Text>
          </Pressable>
        );
      })}
      <Pressable
        onPress={onOpenAll}
        accessibilityRole="button"
        accessibilityLabel={seeOthersLabel}
        style={({ pressed }) => [
          styles.seeOthers,
          pressed && styles.seeOthersPressed,
        ]}
      >
        <Text style={styles.seeOthersText}>{seeOthersLabel}</Text>
        <CaretRight size={14} weight="bold" color={colors.text.muted} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 8,
  },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: radii.pill,
    borderWidth: 1,
  },
  pillDefault: {
    borderColor: colors.state.neutral,
    backgroundColor: colors.bg.primary,
  },
  pillSelected: {
    borderColor: colors.action.primary,
    backgroundColor: colors.action.secondary,
  },
  pillPressed: {
    opacity: 0.7,
  },
  pillText: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.medium,
  },
  pillTextDefault: {
    color: colors.text.primary,
  },
  pillTextSelected: {
    color: colors.action.primary,
  },
  seeOthers: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  seeOthersPressed: {
    opacity: 0.7,
  },
  seeOthersText: {
    fontSize: typography.size.sm,
    color: colors.text.muted,
  },
});
