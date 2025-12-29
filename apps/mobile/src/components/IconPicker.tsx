import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from "react-native";
import { ICONS, type IconDefinition } from "@poleursus/shared";

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
    borderColor: "#ddd",
    borderRadius: 8,
    backgroundColor: "#fff",
  },
  iconButtonSelected: {
    borderColor: "#007AFF",
    backgroundColor: "#E3F2FD",
  },
  emoji: {
    fontSize: 24,
  },
});
