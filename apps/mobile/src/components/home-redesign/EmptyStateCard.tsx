import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { themeTokens } from "@poleursus/shared";

const tokens = themeTokens.light;
const colors = tokens.colors;

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
  return (
    <View style={styles.card}>
      <View style={styles.inner}>
        <View style={styles.iconWrap}>
          <Text style={styles.icon}>{icon}</Text>
        </View>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.description}>{description}</Text>
        <TouchableOpacity style={styles.button} onPress={onAction}>
          <Text style={styles.buttonText}>{buttonLabel}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderColor: colors.state.neutral,
    borderRadius: tokens.radii.lg,
    backgroundColor: colors.bg.surface,
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
    backgroundColor: colors.bg.secondary,
    marginBottom: tokens.spacing.sm,
  },
  icon: {
    fontSize: 22,
  },
  title: {
    fontSize: tokens.typography.size.sm,
    fontWeight: tokens.typography.weight.semibold,
    color: colors.text.primary,
    fontFamily: "DMSans-SemiBold",
    textAlign: "center",
  },
  description: {
    marginTop: tokens.spacing.xs,
    fontSize: 13,
    color: colors.text.muted,
    textAlign: "center",
    lineHeight: 18,
    fontFamily: "DMSans",
  },
  button: {
    marginTop: tokens.spacing.md,
    backgroundColor: colors.text.primary,
    borderRadius: tokens.radii.pill,
    paddingHorizontal: tokens.spacing.xl,
    paddingVertical: tokens.spacing.sm,
  },
  buttonText: {
    fontSize: 13,
    fontWeight: tokens.typography.weight.semibold,
    color: colors.bg.primary,
    fontFamily: "DMSans-SemiBold",
  },
});
