import { View, Text, Pressable, StyleSheet } from "react-native";
import { themeTokens } from "@poleursus/shared";
import { useCopy, t } from "../../lib/i18n";

const tokens = themeTokens.light;
const colors = tokens.colors;

interface FutureObligationSuggestionProps {
  visible: boolean;
  onAccept: () => void;
  onDismiss: () => void;
}

export function FutureObligationSuggestion({
  visible,
  onAccept,
  onDismiss,
}: FutureObligationSuggestionProps) {
  const { dictionary } = useCopy();

  if (!visible) return null;

  return (
    <View style={styles.container}>
      <Text style={styles.text}>
        {t(dictionary, "addTransaction.obligationSuggestion")}
      </Text>
      <View style={styles.actions}>
        <Pressable onPress={onAccept} style={styles.primaryButton}>
          <Text style={styles.primaryButtonText}>
            {t(dictionary, "addTransaction.obligationSuggestionAccept")}
          </Text>
        </Pressable>
        <Pressable onPress={onDismiss} style={styles.dismissButton}>
          <Text style={styles.dismissText}>
            {t(dictionary, "addTransaction.obligationSuggestionDismiss")}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderWidth: 1,
    borderColor: colors.state.neutral,
    borderRadius: tokens.radii.lg,
    padding: tokens.spacing.md,
    backgroundColor: colors.bg.surface,
    gap: tokens.spacing.md,
  },
  text: {
    fontSize: tokens.typography.size.sm,
    color: colors.text.primary,
  },
  actions: {
    flexDirection: "row",
    alignItems: "center",
    gap: tokens.spacing.md,
  },
  primaryButton: {
    backgroundColor: colors.action.primary,
    borderRadius: tokens.radii.pill,
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: tokens.spacing.sm,
    minHeight: 44,
    justifyContent: "center",
  },
  primaryButtonText: {
    color: colors.bg.primary,
    fontSize: tokens.typography.size.sm,
    fontWeight: tokens.typography.weight.semibold,
  },
  dismissButton: {
    paddingVertical: tokens.spacing.sm,
    paddingHorizontal: tokens.spacing.sm,
    minHeight: 44,
    justifyContent: "center",
  },
  dismissText: {
    fontSize: tokens.typography.size.sm,
    fontWeight: tokens.typography.weight.semibold,
    color: colors.text.secondary,
  },
});
