import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { themeTokens } from "@poleursus/shared";

const tokens = themeTokens.light;

interface SettingsRowProps {
  title: string;
  description: string;
  onPress: () => void;
  iconName?: keyof typeof MaterialCommunityIcons.glyphMap;
  isActive?: boolean;
}

export function SettingsRow({
  title,
  description,
  onPress,
  iconName,
  isActive = false,
}: SettingsRowProps) {
  return (
    <TouchableOpacity
      style={[styles.row, isActive && styles.rowActive]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      {iconName ? (
        <View style={[styles.iconWrapper, isActive && styles.iconWrapperActive]}>
          <MaterialCommunityIcons
            name={iconName}
            size={18}
            color={isActive ? tokens.colors.text.primary : tokens.colors.text.secondary}
          />
        </View>
      ) : null}
      <View style={styles.content}>
        <Text style={[styles.title, isActive && styles.titleActive]}>{title}</Text>
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
  rowActive: {
    backgroundColor: tokens.colors.bg.secondary,
  },
  iconWrapper: {
    width: 32,
    height: 32,
    borderRadius: tokens.radii.sm,
    alignItems: "center",
    justifyContent: "center",
    marginRight: tokens.spacing.sm,
    backgroundColor: tokens.colors.bg.surface,
  },
  iconWrapperActive: {
    backgroundColor: tokens.colors.bg.primary,
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
  titleActive: {
    fontWeight: tokens.typography.weight.semibold,
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
