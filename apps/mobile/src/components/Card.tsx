import {
  View,
  Text,
  StyleSheet,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { ReactNode } from "react";
import { themeTokens } from "@poleursus/shared";
import { useUserTheme } from "../contexts/UserThemeContext";

const tokens = themeTokens.light;
const colors = tokens.colors;

interface CardProps {
  title?: string;
  description?: string;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}

export function Card({ title, description, children, style }: CardProps) {
  const { tokens: userTokens } = useUserTheme();

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: userTokens.surface, borderColor: userTokens.border },
        style,
      ]}
    >
      {(title || description) && (
        <View style={styles.header}>
          {title && <Text style={[styles.title, { color: userTokens.textPrimary }]}>{title}</Text>}
          {description && (
            <Text style={[styles.description, { color: userTokens.textSecondary }]}>
              {description}
            </Text>
          )}
        </View>
      )}
      <View style={styles.content}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: tokens.radii.lg,
    borderWidth: 1,
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
  },
  description: {
    fontSize: tokens.typography.size.sm,
  },
  content: {
    // Container for card content
  },
});
