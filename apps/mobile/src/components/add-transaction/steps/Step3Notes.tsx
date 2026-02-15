import {
  View,
  Text,
  TextInput,
  StyleSheet,
} from "react-native";
import type { ReactNode } from "react";
import { themeTokens, type TransactionDraft } from "@poleursus/shared";
import { useCopy, t } from "../../../lib/i18n";
import { useUserTheme } from "../../../contexts/UserThemeContext";

const tokens = themeTokens.light;

interface Step3NotesProps {
  draft: TransactionDraft;
  errors: Record<string, string>;
  children?: ReactNode;
  onFieldChange: <K extends keyof TransactionDraft>(
    field: K,
    value: TransactionDraft[K]
  ) => void;
}

export function Step3Notes({
  draft,
  errors,
  children,
  onFieldChange,
}: Step3NotesProps) {
  const { dictionary } = useCopy();
  const { tokens: userTokens } = useUserTheme();
  void errors;

  return (
    <View style={styles.container}>
      <View
        style={[
          styles.section,
          { backgroundColor: userTokens.surfaceAlt, borderColor: userTokens.border },
        ]}
      >
        <Text style={[styles.label, { color: userTokens.textPrimary }]}>
          {t(dictionary, "addTransaction.notesLabel")}
        </Text>
        <TextInput
          style={[
            styles.textArea,
            {
              borderColor: userTokens.border,
              backgroundColor: userTokens.surface,
              color: userTokens.textPrimary,
            },
          ]}
          value={draft.notes}
          onChangeText={(value) => onFieldChange("notes", value)}
          placeholder={t(dictionary, "addTransaction.notesPlaceholder")}
          placeholderTextColor={userTokens.textTertiary}
          multiline
          numberOfLines={4}
          textAlignVertical="top"
        />
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 32,
  },
  section: {
    gap: tokens.spacing.lg,
    padding: tokens.spacing.lg,
    borderRadius: tokens.radii.lg,
    borderWidth: 1,
  },
  label: {
    fontSize: tokens.typography.size.lg,
    fontWeight: tokens.typography.weight.semibold,
    marginBottom: tokens.spacing.sm,
  },
  textArea: {
    borderWidth: 1,
    borderRadius: tokens.radii.lg,
    paddingVertical: tokens.spacing.xl,
    paddingHorizontal: tokens.spacing.xl,
    fontSize: tokens.typography.size.md,
    minHeight: 160,
    textAlignVertical: "top",
  },
});
