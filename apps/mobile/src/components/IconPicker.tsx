import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from "react-native";
import { ICONS, themeTokens, type IconDefinition } from "@poleursus/shared";

type IconPickerProps = {
  value?: string;
  onChange: (iconId: string) => void;
  filterType?: "income" | "expense" | "both";
};

export function IconPicker({ value, onChange, filterType }: IconPickerProps) {
  const icons = filterType
    ? ICONS.filter(
        (icon) =>
          icon.suggested_for === filterType || icon.suggested_for === "both"
      )
    : ICONS;

  return (
    <ScrollView style={styles.container}>
      <View style={styles.grid}>
        {icons.map((icon) => (
          <TouchableOpacity
            key={icon.id}
            onPress={() => onChange(icon.id)}
            style={[
              styles.iconButton,
              value === icon.id && styles.iconButtonSelected,
            ]}
          >
            <Text style={styles.emoji}>{icon.emoji}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </ScrollView>
  );
}

const tokens = themeTokens.light;
const colors = tokens.colors;

const styles = StyleSheet.create({
  container: {
    maxHeight: 300,
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
  emoji: {
    fontSize: 24,
  },
});
