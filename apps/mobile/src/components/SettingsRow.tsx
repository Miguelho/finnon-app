import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { themeTokens } from "@poleursus/shared";

const tokens = themeTokens.light;

interface SettingsRowProps {
  title: string;
  description: string;
  onPress: () => void;
}

export function SettingsRow({ title, description, onPress }: SettingsRowProps) {
  return (
    <TouchableOpacity style={styles.row} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.content}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.description}>{description}</Text>
      </View>
      <Text style={styles.chevron}>›</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: tokens.spacing.md,
    paddingHorizontal: tokens.spacing.lg,
    backgroundColor: tokens.colors.bg.surface,
    borderBottomWidth: 1,
    borderBottomColor: tokens.colors.state.neutral,
  },
  content: {
    flex: 1,
  },
  title: {
    fontSize: tokens.typography.size.md,
    fontWeight: tokens.typography.weight.medium,
    color: tokens.colors.text.primary,
    marginBottom: tokens.spacing.xs,
  },
  description: {
    fontSize: tokens.typography.size.sm,
    color: tokens.colors.text.secondary,
  },
  chevron: {
    fontSize: tokens.typography.size.xl,
    color: tokens.colors.text.muted,
    marginLeft: tokens.spacing.md,
  },
});
