import { View, Text, StyleSheet } from "react-native";
import { ReactNode } from "react";
import { themeTokens } from "@poleursus/shared";

const tokens = themeTokens.light;
const colors = tokens.colors;

interface CardProps {
  title?: string;
  description?: string;
  children: ReactNode;
}

export function Card({ title, description, children }: CardProps) {
  return (
    <View style={styles.card}>
      {(title || description) && (
        <View style={styles.header}>
          {title && <Text style={styles.title}>{title}</Text>}
          {description && <Text style={styles.description}>{description}</Text>}
        </View>
      )}
      <View style={styles.content}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.bg.surface,
    borderRadius: tokens.radii.lg,
    borderWidth: 1,
    borderColor: colors.state.neutral,
    padding: tokens.spacing.lg,
    shadowColor: colors.shadow.soft,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  header: {
    marginBottom: tokens.spacing.lg,
  },
  title: {
    fontSize: tokens.typography.size.xl,
    fontWeight: tokens.typography.weight.bold,
    marginBottom: tokens.spacing.sm,
    color: colors.text.primary,
  },
  description: {
    fontSize: tokens.typography.size.sm,
    color: colors.text.secondary,
  },
  content: {
    // Container for card content
  },
});
