import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { themeTokens } from "@poleursus/shared";
import { useUserTheme } from "../../contexts/UserThemeContext";

const tokens = themeTokens.light;

type EmptyStateCardProps = {
  icon: string;
  title: string;
  description: string;
  buttonLabel: string;
  onAction: () => void;
};

export function EmptyStateCard({
  icon,
  title,
  description,
  buttonLabel,
  onAction,
}: EmptyStateCardProps) {
  const {
    tokens: userTokens,
    primaryActionColor,
    primaryActionTextColor,
  } = useUserTheme();

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: userTokens.surface, borderColor: userTokens.border },
      ]}
    >
      <View style={styles.inner}>
        <View style={[styles.iconWrap, { backgroundColor: userTokens.surfaceAlt }]}>
          <Text style={styles.icon}>{icon}</Text>
        </View>
        <Text style={[styles.title, { color: userTokens.textPrimary }]}>{title}</Text>
        <Text style={[styles.description, { color: userTokens.textSecondary }]}>
          {description}
        </Text>
        <TouchableOpacity
          style={[styles.button, { backgroundColor: primaryActionColor }]}
          onPress={onAction}
        >
          <Text style={[styles.buttonText, { color: primaryActionTextColor }]}>
            {buttonLabel}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: tokens.radii.lg,
  },
  inner: {
    paddingVertical: tokens.spacing.xl,
    paddingHorizontal: tokens.spacing.lg,
    alignItems: "center",
  },
  iconWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: tokens.spacing.sm,
  },
  icon: {
    fontSize: 22,
  },
  title: {
    fontSize: tokens.typography.size.sm,
    fontWeight: tokens.typography.weight.semibold,
    fontFamily: "DMSans-SemiBold",
    textAlign: "center",
  },
  description: {
    marginTop: tokens.spacing.xs,
    fontSize: 13,
    textAlign: "center",
    lineHeight: 18,
    fontFamily: "DMSans",
  },
  button: {
    marginTop: tokens.spacing.md,
    borderRadius: tokens.radii.pill,
    paddingHorizontal: tokens.spacing.xl,
    paddingVertical: tokens.spacing.sm,
  },
  buttonText: {
    fontSize: 13,
    fontWeight: tokens.typography.weight.semibold,
    fontFamily: "DMSans-SemiBold",
  },
});
