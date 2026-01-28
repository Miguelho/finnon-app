import { View, Text, TextInput, Pressable, Switch, StyleSheet } from "react-native";
import { ArrowDownRight, ArrowUpRight } from "phosphor-react-native";
import { themeTokens, type TransactionDraft, type TransactionType } from "@poleursus/shared";
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

  const handleTypeChange = (type: TransactionType) => {
    onFieldChange("type", type);
    // If switching to income while obligation is on, turn it off
    if (type === "income" && draft.isObligation) {
      onFieldChange("isObligation", false);
      onFieldChange("isPaid", false);
    }
  };

  const handleObligationChange = (checked: boolean) => {
    onFieldChange("isObligation", checked);
    if (checked) {
      // Force type to expense when obligation is enabled
      onFieldChange("type", "expense");
    } else {
      // Reset paid status when obligation is disabled
      onFieldChange("isPaid", false);
    }
  };

  return (
    <View style={styles.container}>
      {/* Type selector */}
      <View style={styles.field}>
        <Text style={styles.label}>{t(dictionary, "addTransaction.typeLabel")}</Text>
        <View
          style={[
            styles.typeToggle,
            draft.isObligation && styles.typeToggleDisabled,
          ]}
        >
          <Pressable
            style={[
              styles.typeOption,
              draft.type === "expense" && styles.typeOptionActive,
            ]}
            onPress={() => handleTypeChange("expense")}
            disabled={draft.isObligation}
          >
            <ArrowDownRight
              size={18}
              weight="regular"
              color={
                draft.type === "expense" ? colors.text.primary : colors.text.muted
              }
            />
            <Text
              style={[
                styles.typeOptionText,
                draft.type === "expense" && styles.typeOptionTextActive,
              ]}
            >
              {t(dictionary, "addTransaction.typeExpense")}
            </Text>
          </Pressable>
          <Pressable
            style={[
              styles.typeOption,
              draft.type === "income" && styles.typeOptionActive,
            ]}
            onPress={() => handleTypeChange("income")}
            disabled={draft.isObligation}
          >
            <ArrowUpRight
              size={18}
              weight="regular"
              color={
                draft.type === "income" ? colors.text.primary : colors.text.muted
              }
            />
            <Text
              style={[
                styles.typeOptionText,
                draft.type === "income" && styles.typeOptionTextActive,
              ]}
            >
              {t(dictionary, "addTransaction.typeIncome")}
            </Text>
          </Pressable>
        </View>
      </View>

      {draft.type === "expense" && (
        <>
          {/* Obligation toggle */}
          <View style={styles.toggleRow}>
            <View style={styles.toggleTextContainer}>
              <Text style={styles.toggleLabel}>
                {t(dictionary, "addTransaction.obligationLabel")}
              </Text>
              <Text style={styles.toggleHelper}>
                {t(dictionary, "addTransaction.obligationHelper")}
              </Text>
            </View>
            <Switch
              value={draft.isObligation}
              onValueChange={handleObligationChange}
              trackColor={{ false: colors.state.neutral, true: colors.action.primary }}
              thumbColor={colors.bg.surface}
            />
          </View>

          {/* Paid toggle (only visible when obligation is on) */}
          {draft.isObligation && (
            <View style={styles.toggleRow}>
              <View style={styles.toggleTextContainer}>
                <Text style={styles.toggleLabel}>
                  {t(dictionary, "addTransaction.paidLabel")}
                </Text>
                <Text style={styles.toggleHelper}>
                  {t(dictionary, "addTransaction.paidHelper")}
                </Text>
              </View>
              <Switch
                value={draft.isPaid}
                onValueChange={(checked) => onFieldChange("isPaid", checked)}
                trackColor={{ false: colors.state.neutral, true: colors.action.primary }}
                thumbColor={colors.bg.surface}
              />
            </View>
          )}
        </>
      )}

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
    gap: 24,
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
  typeToggle: {
    flexDirection: "row",
    gap: tokens.spacing.xs,
    padding: tokens.spacing.xs,
    borderRadius: tokens.radii.pill,
    borderWidth: 1,
    borderColor: colors.state.neutral,
    backgroundColor: colors.bg.secondary,
  },
  typeToggleDisabled: {
    opacity: 0.5,
  },
  typeOption: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: tokens.spacing.sm,
    paddingVertical: tokens.spacing.md,
    borderRadius: tokens.radii.pill,
  },
  typeOptionActive: {
    backgroundColor: colors.bg.surface,
  },
  typeOptionText: {
    fontSize: tokens.typography.size.md,
    fontWeight: tokens.typography.weight.semibold,
    color: colors.text.muted,
  },
  typeOptionTextActive: {
    color: colors.text.primary,
  },
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: tokens.spacing.lg,
    paddingHorizontal: tokens.spacing.xl,
    borderRadius: tokens.radii.lg,
    borderWidth: 1,
    borderColor: colors.state.neutral,
    backgroundColor: colors.bg.secondary,
  },
  toggleTextContainer: {
    flex: 1,
    marginRight: tokens.spacing.lg,
  },
  toggleLabel: {
    fontSize: tokens.typography.size.md,
    fontWeight: tokens.typography.weight.semibold,
    color: colors.text.primary,
  },
  toggleHelper: {
    fontSize: tokens.typography.size.sm,
    color: colors.text.muted,
    marginTop: tokens.spacing.xs,
  },
});
