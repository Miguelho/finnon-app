import { View, Text, TextInput, StyleSheet } from "react-native";
import { themeTokens, type TransactionDraft } from "@poleursus/shared";
import { useCopy, t } from "../../../lib/i18n";
import { DateQuickPicker } from "../DateQuickPicker";

const tokens = themeTokens.light;
const colors = tokens.colors;

interface Step1DetailsProps {
  draft: TransactionDraft;
  errors: Record<string, string>;
  onFieldChange: <K extends keyof TransactionDraft>(
    field: K,
    value: TransactionDraft[K]
  ) => void;
}

export function Step1Details({ draft, errors, onFieldChange }: Step1DetailsProps) {
  const { dictionary } = useCopy();

  const handleAmountChange = (value: string) => {
    // Allow only numbers, comma, and dot for decimal input
    const sanitized = value.replace(/[^0-9.,]/g, "");
    onFieldChange("amount", sanitized);
  };

  return (
    <View style={styles.container}>
      {/* Name field */}
      <View style={styles.field}>
        <Text style={styles.label}>{t(dictionary, "addTransaction.nameLabel")}</Text>
        <TextInput
          style={[styles.input, errors.name && styles.inputError]}
          value={draft.name}
          onChangeText={(value) => onFieldChange("name", value)}
          placeholder={t(dictionary, "addTransaction.namePlaceholder")}
          placeholderTextColor={colors.text.muted}
        />
        {errors.name && (
          <Text style={styles.errorText}>
            {t(dictionary, "addTransaction.errors.nameRequired")}
          </Text>
        )}
      </View>

      {/* Date field */}
      <DateQuickPicker
        value={draft.date}
        onChange={(value) => onFieldChange("date", value)}
        error={errors.date ? t(dictionary, "addTransaction.errors.dateRequired") : undefined}
      />

      {/* Amount field */}
      <View style={styles.field}>
        <Text style={styles.label}>{t(dictionary, "addTransaction.amountLabel")}</Text>
        <View style={styles.amountRow}>
          <TextInput
            style={[styles.input, styles.amountInput, errors.amount && styles.inputError]}
            value={draft.amount}
            onChangeText={handleAmountChange}
            placeholder="0,00"
            placeholderTextColor={colors.text.muted}
            keyboardType="decimal-pad"
          />
          <View style={styles.currencyBadge}>
            <Text style={styles.currencyText}>{draft.currency}</Text>
          </View>
        </View>
        {errors.amount && (
          <Text style={styles.errorText}>
            {t(dictionary, "addTransaction.errors.amountRequired")}
          </Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 32,
  },
  field: {
    gap: tokens.spacing.md,
  },
  label: {
    fontSize: tokens.typography.size.lg,
    fontWeight: tokens.typography.weight.semibold,
    color: colors.text.primary,
    marginBottom: tokens.spacing.sm,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.state.neutral,
    borderRadius: tokens.radii.lg,
    paddingVertical: tokens.spacing.lg,
    paddingHorizontal: tokens.spacing.xl,
    fontSize: tokens.typography.size.lg,
    backgroundColor: colors.bg.surface,
    color: colors.text.primary,
    minHeight: 56,
  },
  inputError: {
    borderColor: colors.state.negative,
  },
  amountRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: tokens.spacing.md,
  },
  amountInput: {
    flex: 1,
  },
  currencyBadge: {
    backgroundColor: colors.bg.secondary,
    paddingHorizontal: tokens.spacing.xl,
    paddingVertical: tokens.spacing.lg,
    borderRadius: tokens.radii.lg,
    minHeight: 56,
    justifyContent: "center",
  },
  currencyText: {
    fontSize: tokens.typography.size.lg,
    fontWeight: tokens.typography.weight.semibold,
    color: colors.text.secondary,
  },
  errorText: {
    fontSize: tokens.typography.size.sm,
    color: colors.state.negative,
    marginTop: tokens.spacing.sm,
  },
});
