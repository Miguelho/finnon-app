import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { themeTokens } from "@poleursus/shared";
import { useUserTheme } from "../contexts/UserThemeContext";

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
  const { tokens: userTokens } = useUserTheme();

  return (
    <TouchableOpacity
      style={[
        styles.row,
        {
          backgroundColor: isActive ? userTokens.surfaceAlt : userTokens.surface,
          borderBottomColor: userTokens.border,
        },
      ]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      {iconName ? (
        <View
          style={[
            styles.iconWrapper,
            {
              backgroundColor: isActive ? userTokens.surface : userTokens.surfaceAlt,
            },
          ]}
        >
          <MaterialCommunityIcons
            name={iconName}
            size={18}
            color={isActive ? userTokens.textPrimary : userTokens.textSecondary}
          />
        </View>
      ) : null}
      <View style={styles.content}>
        <Text
          style={[
            styles.title,
            { color: userTokens.textPrimary },
            isActive && styles.titleActive,
          ]}
        >
          {title}
        </Text>
        <Text style={[styles.description, { color: userTokens.textSecondary }]}>
          {description}
        </Text>
      </View>
      <Text style={[styles.chevron, { color: userTokens.textTertiary }]}>›</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: tokens.spacing.md,
    paddingHorizontal: tokens.spacing.lg,
    borderBottomWidth: 1,
  },
  iconWrapper: {
    width: 32,
    height: 32,
    borderRadius: tokens.radii.sm,
    alignItems: "center",
    justifyContent: "center",
    marginRight: tokens.spacing.sm,
  },
  content: {
    flex: 1,
  },
  title: {
    fontSize: tokens.typography.size.md,
    fontWeight: tokens.typography.weight.medium,
    marginBottom: tokens.spacing.xs,
  },
  titleActive: {
    fontWeight: tokens.typography.weight.semibold,
  },
  description: {
    fontSize: tokens.typography.size.sm,
  },
  chevron: {
    fontSize: tokens.typography.size.xl,
    marginLeft: tokens.spacing.md,
  },
});
