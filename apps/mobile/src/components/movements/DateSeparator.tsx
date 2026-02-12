import { View, Text, StyleSheet } from "react-native";
import { movementsDesignTokens } from "../../types/movements";
import { useUserTheme } from "../../contexts/UserThemeContext";

type DateSeparatorProps = {
  label: string;
};

export function DateSeparator({ label }: DateSeparatorProps) {
  const { tokens: userTokens } = useUserTheme();
  return (
    <View style={styles.container}>
      <Text style={[styles.label, { color: userTokens.textSecondary }]}>{label}</Text>
      <View style={[styles.line, { backgroundColor: userTokens.border }]} />
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
    fontFamily: "DMSans-Medium",
  },
  line: {
    flex: 1,
    height: 1,
  },
});
