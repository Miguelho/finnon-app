import { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  Switch,
  StyleSheet,
  Modal,
  TouchableOpacity,
} from "react-native";
import { ArrowDownLeft, ArrowUpRight, Info } from "lucide-react-native";
import {
  themeTokens,
  type TransactionDraft,
  type TransactionType,
  type ObligationType,
  formatDateForDisplay,
} from "@poleursus/shared";
import { useCopy, t } from "../../../lib/i18n";
import { useUserTheme } from "../../../contexts/UserThemeContext";
import { DateQuickPicker } from "../DateQuickPicker";
import { DatePickerField } from "../../DatePickerField";
import { Button } from "../../Button";
import { FutureObligationSuggestion } from "../FutureObligationSuggestion";

const tokens = themeTokens.light;
const colors = tokens.colors;

const parseIsoDate = (value: string) => {
  const [year, month, day] = value.split("-").map((part) => Number(part));
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day);
};

const isFutureDate = (value: string) => {
  const date = parseIsoDate(value);
  if (!date) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return date.getTime() > today.getTime();
};

const getDefaultObligationConfig = (date: string) =>
  isFutureDate(date)
    ? ({ type: "scheduled", scheduledDate: date } as const)
    : ({ type: "pending", scheduledDate: null } as const);

interface Step1DetailsProps {
  draft: TransactionDraft;
  errors: Record<string, string>;
  onFieldChange: <K extends keyof TransactionDraft>(
    field: K,
    value: TransactionDraft[K]
  ) => void;
  allowObligation?: boolean;
}

export function Step1Details({
  draft,
  errors,
  onFieldChange,
  allowObligation = true,
}: Step1DetailsProps) {
  const { dictionary, locale } = useCopy();
  const { tokens: userTokens, primaryActionColor, primaryActionTextColor } =
    useUserTheme();
  const [isInfoOpen, setIsInfoOpen] = useState(false);
  const [isObligationSheetOpen, setIsObligationSheetOpen] = useState(false);
  const [sheetType, setSheetType] = useState<ObligationType>("pending");
  const [sheetScheduledDate, setSheetScheduledDate] = useState(draft.date);
  const [sheetScheduledOverride, setSheetScheduledOverride] = useState(false);
  const [dismissedFutureSuggestion, setDismissedFutureSuggestion] = useState(false);
  const openedFromToggleRef = useRef(false);

  const handleAmountChange = (value: string) => {
    // Allow only numbers, comma, and dot for decimal input
    const sanitized = value.replace(/[^0-9.,]/g, "");
    onFieldChange("amount", sanitized);
  };

  const clearObligation = () => {
    onFieldChange("isObligation", false);
    onFieldChange("obligationType", null);
    onFieldChange("scheduledDate", null);
    onFieldChange("scheduledDateOverridden", false);
  };

  const handleTypeChange = (type: TransactionType) => {
    onFieldChange("type", type);
    // If switching to income while obligation is on, turn it off
    if (type === "income" && draft.isObligation) {
      clearObligation();
    }
  };

  const openObligationSheet = ({ fromToggle }: { fromToggle: boolean }) => {
    const defaults = draft.obligationType
      ? {
          type: draft.obligationType,
          scheduledDate: draft.scheduledDate ?? draft.date,
          overridden: draft.scheduledDateOverridden,
        }
      : {
          ...getDefaultObligationConfig(draft.date),
          overridden: false,
        };

    setSheetType(defaults.type);
    setSheetScheduledDate(defaults.scheduledDate ?? draft.date);
    setSheetScheduledOverride(defaults.overridden);
    openedFromToggleRef.current = fromToggle;
    setIsObligationSheetOpen(true);
  };

  const handleObligationToggle = (checked: boolean) => {
    if (checked) {
      onFieldChange("isObligation", true);
      onFieldChange("type", "expense");
      onFieldChange("obligationType", null);
      onFieldChange("scheduledDate", null);
      onFieldChange("scheduledDateOverridden", false);
      openObligationSheet({ fromToggle: true });
    } else {
      setIsObligationSheetOpen(false);
      clearObligation();
    }
  };

  const handleSaveObligationConfig = () => {
    onFieldChange("obligationType", sheetType);

    if (sheetType === "scheduled") {
      const resolvedDate = sheetScheduledDate || draft.date;
      onFieldChange("scheduledDate", resolvedDate);
      onFieldChange(
        "scheduledDateOverridden",
        sheetScheduledOverride && resolvedDate !== draft.date
      );
    } else {
      onFieldChange("scheduledDate", null);
      onFieldChange("scheduledDateOverridden", false);
    }

    openedFromToggleRef.current = false;
    setIsObligationSheetOpen(false);
  };

  const handleCancelObligationConfig = () => {
    if (openedFromToggleRef.current) {
      clearObligation();
    }
    openedFromToggleRef.current = false;
    setIsObligationSheetOpen(false);
  };

  const handleSuggestionAccept = () => {
    onFieldChange("isObligation", true);
    onFieldChange("type", "expense");
    onFieldChange("obligationType", "scheduled");
    onFieldChange("scheduledDate", draft.date);
    onFieldChange("scheduledDateOverridden", false);
  };

  const handleSuggestionDismiss = () => {
    setDismissedFutureSuggestion(true);
  };

  useEffect(() => {
    if (!draft.isObligation || draft.obligationType !== "scheduled") return;
    if (draft.scheduledDateOverridden) return;
    if (draft.scheduledDate !== draft.date) {
      onFieldChange("scheduledDate", draft.date);
    }
  }, [
    draft.date,
    draft.isObligation,
    draft.obligationType,
    draft.scheduledDateOverridden,
    draft.scheduledDate,
    onFieldChange,
  ]);

  const shouldShowFutureSuggestion =
    draft.type === "expense" &&
    !draft.isObligation &&
    isFutureDate(draft.date) &&
    !dismissedFutureSuggestion;

  const handleSheetTypeChange = (value: ObligationType) => {
    setSheetType(value);
    if (value === "scheduled" && !sheetScheduledDate) {
      setSheetScheduledDate(draft.scheduledDate ?? draft.date);
      setSheetScheduledOverride(false);
    }
  };

  const hasObligationConfig = draft.isObligation && !!draft.obligationType;
  const obligationSummary =
    draft.obligationType === "scheduled"
      ? `${t(dictionary, "addTransaction.obligationChipScheduled")} · ${formatDateForDisplay(
          draft.scheduledDate ?? draft.date,
          locale
        )}`
      : t(dictionary, "addTransaction.obligationChipPending");

  return (
    <View style={styles.container}>
      {/* Type selector */}
      <View
        style={[
          styles.section,
          { backgroundColor: userTokens.surfaceAlt, borderColor: userTokens.border },
        ]}
      >
        <Text style={[styles.sectionLabel, { color: userTokens.textPrimary }]}>
          {t(dictionary, "addTransaction.typeLabel")}
        </Text>
        <View
          style={[
            styles.typeToggle,
            { borderColor: userTokens.border, backgroundColor: userTokens.surfaceAlt },
            draft.isObligation && styles.typeToggleDisabled,
          ]}
        >
          <Pressable
            style={[
              styles.typeOption,
              draft.type === "expense" && styles.typeOptionActive,
              draft.type === "expense" && { backgroundColor: userTokens.surface },
            ]}
            onPress={() => handleTypeChange("expense")}
            disabled={draft.isObligation}
          >
            <ArrowDownLeft
              size={18}
              color={
                draft.type === "expense"
                  ? userTokens.textPrimary
                  : userTokens.textTertiary
              }
            />
            <Text
              style={[
                styles.typeOptionText,
                draft.type === "expense" && styles.typeOptionTextActive,
                { color: userTokens.textTertiary },
                draft.type === "expense" && { color: userTokens.textPrimary },
              ]}
            >
              {t(dictionary, "addTransaction.typeExpense")}
            </Text>
          </Pressable>
          <Pressable
            style={[
              styles.typeOption,
              draft.type === "income" && styles.typeOptionActive,
              draft.type === "income" && { backgroundColor: userTokens.surface },
            ]}
            onPress={() => handleTypeChange("income")}
            disabled={draft.isObligation}
          >
            <ArrowUpRight
              size={18}
              color={
                draft.type === "income"
                  ? userTokens.textPrimary
                  : userTokens.textTertiary
              }
            />
            <Text
              style={[
                styles.typeOptionText,
                draft.type === "income" && styles.typeOptionTextActive,
                { color: userTokens.textTertiary },
                draft.type === "income" && { color: userTokens.textPrimary },
              ]}
            >
              {t(dictionary, "addTransaction.typeIncome")}
            </Text>
          </Pressable>
        </View>
      </View>

      {allowObligation && draft.type === "expense" && draft.isObligation && (
        <View
          style={[
            styles.obligationSection,
            { backgroundColor: userTokens.surfaceAlt, borderColor: userTokens.border },
          ]}
        >
          <View style={styles.obligationRow}>
            <View style={styles.obligationLabelRow}>
              <Text style={[styles.toggleLabel, { color: userTokens.textPrimary }]}>
                {t(dictionary, "addTransaction.obligationLabel")}
              </Text>
              <Pressable
                onPress={() => setIsInfoOpen(true)}
                style={[
                  styles.infoButton,
                  { borderColor: userTokens.border, backgroundColor: userTokens.surface },
                ]}
                accessibilityRole="button"
                accessibilityLabel={t(dictionary, "addTransaction.obligationInfoTitle")}
              >
                <Info size={16} color={userTokens.textSecondary} />
              </Pressable>
            </View>
            <Switch
              value={draft.isObligation}
              onValueChange={handleObligationToggle}
              trackColor={{ false: userTokens.border, true: primaryActionColor }}
              thumbColor={userTokens.surface}
            />
          </View>

          {hasObligationConfig && (
            <View style={styles.obligationChipRow}>
              <View
                style={[
                  styles.obligationChip,
                  { borderColor: userTokens.border, backgroundColor: userTokens.surface },
                ]}
              >
                <Text style={[styles.obligationChipText, { color: userTokens.textPrimary }]}>
                  {obligationSummary}
                </Text>
              </View>
              <Pressable
                onPress={() => openObligationSheet({ fromToggle: false })}
                style={styles.obligationChipEditButton}
                accessibilityRole="button"
              >
                <Text style={[styles.obligationChipEdit, { color: primaryActionColor }]}>
                  {t(dictionary, "addTransaction.obligationEdit")}
                </Text>
              </Pressable>
            </View>
          )}

        </View>
      )}

      {/* Amount field */}
      <View
        style={[
          styles.section,
          styles.amountSection,
          { backgroundColor: userTokens.surfaceAlt, borderColor: userTokens.border },
        ]}
      >
        <Text style={[styles.amountLabel, { color: userTokens.textPrimary }]}>
          {t(dictionary, "addTransaction.amountLabel")}
        </Text>
        <View style={styles.amountRow}>
          <TextInput
            style={[
              styles.input,
              styles.amountInput,
              {
                borderColor: userTokens.border,
                backgroundColor: userTokens.surface,
                color: userTokens.textPrimary,
              },
              errors.amount && styles.inputError,
            ]}
            value={draft.amount}
            onChangeText={handleAmountChange}
            placeholder="0,00"
            placeholderTextColor={userTokens.textTertiary}
            keyboardType="decimal-pad"
          />
          <View
            style={[
              styles.currencyBadge,
              { backgroundColor: userTokens.surfaceAlt, borderColor: userTokens.border },
            ]}
          >
            <Text style={[styles.currencyText, { color: userTokens.textSecondary }]}>
              {draft.currency}
            </Text>
          </View>
        </View>
        {errors.amount ? (
          <Text style={styles.errorText}>
            {t(dictionary, "addTransaction.errors.amountRequired")}
          </Text>
        ) : (
          <Text style={[styles.helperText, { color: userTokens.textSecondary }]}>
            {t(dictionary, "addTransaction.amountHelper")}
          </Text>
        )}
      </View>

      {/* Date field */}
      <View
        style={[
          styles.section,
          { backgroundColor: userTokens.surfaceAlt, borderColor: userTokens.border },
        ]}
      >
        <DateQuickPicker
          value={draft.date}
          onChange={(value) => onFieldChange("date", value)}
          error={errors.date ? t(dictionary, "addTransaction.errors.dateRequired") : undefined}
        />
      </View>

      {allowObligation && (
        <>
          <FutureObligationSuggestion
            visible={shouldShowFutureSuggestion}
            onAccept={handleSuggestionAccept}
            onDismiss={handleSuggestionDismiss}
          />

          {/* Obligation info sheet */}
          <Modal
            transparent
            visible={isInfoOpen}
            animationType="slide"
            onRequestClose={() => setIsInfoOpen(false)}
          >
            <View style={styles.sheetOverlay}>
              <Pressable style={styles.sheetBackdrop} onPress={() => setIsInfoOpen(false)} />
              <View
                style={[
                  styles.sheetContainer,
                  { backgroundColor: userTokens.surface, borderTopColor: userTokens.border },
                ]}
              >
                <View style={[styles.sheetHandle, { backgroundColor: userTokens.border }]} />
                <View style={styles.sheetHeader}>
                  <Text style={[styles.sheetTitle, { color: userTokens.textPrimary }]}>
                    {t(dictionary, "addTransaction.obligationInfoTitle")}
                  </Text>
                  <TouchableOpacity onPress={() => setIsInfoOpen(false)}>
                    <Text style={[styles.sheetAction, { color: primaryActionColor }]}>
                      {t(dictionary, "common.close")}
                    </Text>
                  </TouchableOpacity>
                </View>
                <Text style={[styles.sheetDescription, { color: userTokens.textSecondary }]}>
                  {t(dictionary, "addTransaction.obligationInfoText")}
                </Text>
              </View>
            </View>
          </Modal>

          {/* Obligation configuration sheet */}
          <Modal
            transparent
            visible={isObligationSheetOpen}
            animationType="slide"
            onRequestClose={handleCancelObligationConfig}
          >
            <View style={styles.sheetOverlay}>
              <Pressable style={styles.sheetBackdrop} onPress={handleCancelObligationConfig} />
              <View
                style={[
                  styles.sheetContainer,
                  { backgroundColor: userTokens.surface, borderTopColor: userTokens.border },
                ]}
              >
                <View style={[styles.sheetHandle, { backgroundColor: userTokens.border }]} />
                <View style={styles.sheetHeader}>
                  <Text style={[styles.sheetTitle, { color: userTokens.textPrimary }]}>
                    {t(dictionary, "addTransaction.obligationSheetTitle")}
                  </Text>
                  <TouchableOpacity onPress={handleCancelObligationConfig}>
                    <Text style={[styles.sheetAction, { color: primaryActionColor }]}>
                      {t(dictionary, "common.close")}
                    </Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.sheetContent}>
                  <Text style={[styles.sheetSectionLabel, { color: userTokens.textPrimary }]}>
                    {t(dictionary, "addTransaction.obligationTypeLabel")}
                  </Text>
                  <View
                    style={[
                      styles.segmentedControl,
                      { borderColor: userTokens.border, backgroundColor: userTokens.surfaceAlt },
                    ]}
                  >
                    <Pressable
                      onPress={() => handleSheetTypeChange("pending")}
                      style={[
                        styles.segmentOption,
                        sheetType === "pending" && styles.segmentOptionActive,
                        sheetType === "pending" && { backgroundColor: primaryActionColor },
                      ]}
                    >
                      <Text
                        style={[
                          styles.segmentOptionText,
                          sheetType === "pending" && styles.segmentOptionTextActive,
                          { color: userTokens.textSecondary },
                          sheetType === "pending" && { color: primaryActionTextColor },
                        ]}
                      >
                        {t(dictionary, "addTransaction.obligationTypePending")}
                      </Text>
                    </Pressable>
                    <Pressable
                      onPress={() => handleSheetTypeChange("scheduled")}
                      style={[
                        styles.segmentOption,
                        sheetType === "scheduled" && styles.segmentOptionActive,
                        sheetType === "scheduled" && { backgroundColor: primaryActionColor },
                      ]}
                    >
                      <Text
                        style={[
                          styles.segmentOptionText,
                          sheetType === "scheduled" && styles.segmentOptionTextActive,
                          { color: userTokens.textSecondary },
                          sheetType === "scheduled" && { color: primaryActionTextColor },
                        ]}
                      >
                        {t(dictionary, "addTransaction.obligationTypeScheduled")}
                      </Text>
                    </Pressable>
                  </View>

                  {sheetType === "scheduled" && (
                    <DatePickerField
                      label={t(dictionary, "addTransaction.obligationScheduledDate")}
                      value={sheetScheduledDate}
                      onChangeText={(value) => {
                        setSheetScheduledDate(value);
                        setSheetScheduledOverride(value !== draft.date);
                      }}
                      placeholder={t(dictionary, "addTransaction.obligationPickDate")}
                      formatValue={(value) => formatDateForDisplay(value, locale)}
                    />
                  )}
                </View>

                <View style={styles.sheetActions}>
                  <View style={styles.sheetActionButton}>
                    <Button
                      title={t(dictionary, "common.cancel")}
                      onPress={handleCancelObligationConfig}
                      variant="secondary"
                    />
                  </View>
                  <View style={styles.sheetActionButton}>
                    <Button
                      title={t(dictionary, "common.save")}
                      onPress={handleSaveObligationConfig}
                    />
                  </View>
                </View>
              </View>
            </View>
          </Modal>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: tokens.spacing.xl,
  },
  section: {
    backgroundColor: colors.bg.secondary,
    borderRadius: tokens.radii.lg,
    padding: tokens.spacing.lg,
    borderWidth: 1,
    borderColor: colors.state.neutral,
    gap: tokens.spacing.lg,
  },
  obligationSection: {
    backgroundColor: colors.bg.secondary,
    borderRadius: tokens.radii.lg,
    padding: tokens.spacing.md,
    borderWidth: 1,
    borderColor: colors.state.neutral,
    gap: tokens.spacing.md,
  },
  sectionLabel: {
    fontSize: tokens.typography.size.md,
    fontWeight: tokens.typography.weight.semibold,
    color: colors.text.primary,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.state.neutral,
    borderRadius: tokens.radii.lg,
    paddingVertical: tokens.spacing.xl,
    paddingHorizontal: tokens.spacing.xl,
    fontSize: tokens.typography.size.xl,
    backgroundColor: colors.bg.surface,
    color: colors.text.primary,
    minHeight: 64,
  },
  inputError: {
    borderColor: colors.state.negative,
  },
  amountRow: {
    flexDirection: "row",
    alignItems: "stretch",
    gap: tokens.spacing.sm,
  },
  amountInput: {
    flex: 1,
  },
  amountLabel: {
    fontSize: tokens.typography.size.xl,
    fontWeight: tokens.typography.weight.bold,
    color: colors.text.primary,
  },
  amountSection: {
    paddingVertical: tokens.spacing.xl,
  },
  currencyBadge: {
    backgroundColor: colors.bg.secondary,
    paddingHorizontal: tokens.spacing.lg,
    paddingVertical: tokens.spacing.xl,
    borderRadius: tokens.radii.lg,
    minHeight: 64,
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.state.neutral,
  },
  currencyText: {
    fontSize: tokens.typography.size.md,
    fontWeight: tokens.typography.weight.semibold,
    color: colors.text.secondary,
  },
  errorText: {
    fontSize: tokens.typography.size.sm,
    color: colors.state.negative,
    marginTop: tokens.spacing.sm,
  },
  helperText: {
    fontSize: tokens.typography.size.sm,
    fontWeight: tokens.typography.weight.medium,
    color: colors.text.secondary,
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
  obligationRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: tokens.spacing.lg,
  },
  obligationLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: tokens.spacing.sm,
    flex: 1,
  },
  infoButton: {
    padding: tokens.spacing.xs,
    borderRadius: tokens.radii.pill,
    borderWidth: 1,
    borderColor: colors.state.neutral,
    backgroundColor: colors.bg.surface,
    minHeight: 44,
    minWidth: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  toggleLabel: {
    fontSize: tokens.typography.size.md,
    fontWeight: tokens.typography.weight.semibold,
    color: colors.text.primary,
  },
  obligationChipRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: tokens.spacing.md,
  },
  obligationChip: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.state.neutral,
    borderRadius: tokens.radii.pill,
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: tokens.spacing.sm,
    backgroundColor: colors.bg.surface,
  },
  obligationChipText: {
    fontSize: tokens.typography.size.sm,
    fontWeight: tokens.typography.weight.medium,
    color: colors.text.primary,
  },
  obligationChipEdit: {
    fontSize: tokens.typography.size.sm,
    fontWeight: tokens.typography.weight.semibold,
    color: colors.action.primary,
  },
  obligationChipEditButton: {
    paddingVertical: tokens.spacing.sm,
    paddingHorizontal: tokens.spacing.sm,
    minHeight: 44,
    justifyContent: "center",
  },
  sheetOverlay: {
    flex: 1,
    justifyContent: "flex-end",
  },
  sheetBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
  },
  sheetContainer: {
    backgroundColor: colors.bg.surface,
    borderTopLeftRadius: tokens.radii.lg,
    borderTopRightRadius: tokens.radii.lg,
    padding: tokens.spacing.lg,
  },
  sheetHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.state.neutral,
    alignSelf: "center",
    marginBottom: tokens.spacing.md,
  },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: tokens.spacing.md,
  },
  sheetTitle: {
    fontSize: tokens.typography.size.lg,
    fontWeight: tokens.typography.weight.semibold,
    color: colors.text.primary,
  },
  sheetAction: {
    fontSize: tokens.typography.size.sm,
    fontWeight: tokens.typography.weight.semibold,
    color: colors.action.primary,
  },
  sheetDescription: {
    fontSize: tokens.typography.size.sm,
    color: colors.text.secondary,
  },
  sheetContent: {
    gap: tokens.spacing.lg,
  },
  sheetSectionLabel: {
    fontSize: tokens.typography.size.sm,
    fontWeight: tokens.typography.weight.semibold,
    color: colors.text.primary,
  },
  segmentedControl: {
    flexDirection: "row",
    gap: tokens.spacing.xs,
    padding: tokens.spacing.xs,
    borderRadius: tokens.radii.pill,
    borderWidth: 1,
    borderColor: colors.state.neutral,
    backgroundColor: colors.bg.secondary,
  },
  segmentOption: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: tokens.spacing.sm,
    borderRadius: tokens.radii.pill,
  },
  segmentOptionActive: {
    backgroundColor: colors.action.primary,
  },
  segmentOptionText: {
    fontSize: tokens.typography.size.sm,
    fontWeight: tokens.typography.weight.semibold,
    color: colors.text.secondary,
  },
  segmentOptionTextActive: {
    color: colors.bg.primary,
  },
  sheetActions: {
    flexDirection: "row",
    gap: tokens.spacing.md,
    marginTop: tokens.spacing.lg,
  },
  sheetActionButton: {
    flex: 1,
  },
});
