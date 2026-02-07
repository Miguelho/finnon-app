import { View, Text, StyleSheet } from "react-native";
import { movementsDesignTokens } from "../../types/movements";

type DateSeparatorProps = {
  label: string;
};

const colors = movementsDesignTokens.colors;

export function DateSeparator({ label }: DateSeparatorProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.line} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 12,
    marginBottom: 6,
  },
  label: {
    fontSize: movementsDesignTokens.typography.sizes.sm,
    color: colors.textSecondary,
    fontFamily: "DMSans-Medium",
  },
  line: {
    flex: 1,
    height: 1,
    backgroundColor: colors.border,
  },
});
