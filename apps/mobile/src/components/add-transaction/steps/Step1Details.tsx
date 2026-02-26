import { useEffect, useMemo, useRef, useState } from "react";
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
  type ContributionSplitType,
  parseMoneyToMinor,
  formatMinorToMoney,
  buildEqualSplit,
  CURRENCY_MINOR_UNITS,
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
  splitParticipants?: {
    userId: string;
    name: string;
    role: "viewer" | "contributor" | "admin";
  }[];
  currentUserId?: string | null;
  showSplitControls?: boolean;
}

export function Step1Details({
  draft,
  errors,
  onFieldChange,
  allowObligation = true,
  splitParticipants = [],
  currentUserId = null,
  showSplitControls = true,
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
  const [customSplitInputs, setCustomSplitInputs] = useState<Record<string, string>>({});
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
    if (draft.suggestedCategoryId) {
      if (draft.categoryId === draft.suggestedCategoryId) {
        onFieldChange("categoryId", null);
      }
      onFieldChange("suggestedCategoryId", null);
    }
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

  const visibleSplitParticipants = useMemo(
    () => (showSplitControls ? splitParticipants : []),
    [showSplitControls, splitParticipants]
  );
  const splitParticipantIds = useMemo(
    () => visibleSplitParticipants.map((member) => member.userId),
    [visibleSplitParticipants]
  );
  const canConfigureSplit = splitParticipantIds.length >= 2;

  const resolveAmountMinor = () => {
    const parsed = parseMoneyToMinor(
      draft.amount,
      draft.currency,
      CURRENCY_MINOR_UNITS
    );
    if (typeof parsed !== "bigint") return null;
    return Math.max(0, Number(parsed));
  };

  useEffect(() => {
    if (!canConfigureSplit) return;
    if (draft.paidByUserId) return;
    const fallbackPaidBy = currentUserId ?? splitParticipantIds[0] ?? null;
    if (fallbackPaidBy) {
      onFieldChange("paidByUserId", fallbackPaidBy);
    }
  }, [
    canConfigureSplit,
    currentUserId,
    draft.paidByUserId,
    onFieldChange,
    splitParticipantIds,
  ]);

  useEffect(() => {
    if (!canConfigureSplit) return;
    if (draft.splitType !== "custom") return;
    if (draft.splitDetails && draft.splitDetails.length > 0) return;
    const amountMinor = resolveAmountMinor();
    if (amountMinor === null) return;
    onFieldChange("splitDetails", buildEqualSplit(amountMinor, splitParticipantIds));
  }, [
    canConfigureSplit,
    draft.amount,
    draft.currency,
    draft.splitDetails,
    draft.splitType,
    onFieldChange,
    splitParticipantIds,
  ]);

  useEffect(() => {
    if (!canConfigureSplit || draft.splitType !== "custom") {
      setCustomSplitInputs((prev) => (Object.keys(prev).length > 0 ? {} : prev));
      return;
    }
    const details = draft.splitDetails ?? [];
    const nextInputs: Record<string, string> = {};
    splitParticipantIds.forEach((userId) => {
      const detail = details.find((item) => item.userId === userId);
      const shareMinor = detail?.shareMinor ?? 0;
      nextInputs[userId] = formatMinorToMoney(
        BigInt(Math.max(0, shareMinor)),
        draft.currency,
        CURRENCY_MINOR_UNITS
      ).replace(".", ",");
    });
    setCustomSplitInputs((prev) => {
      const prevKeys = Object.keys(prev);
      const nextKeys = Object.keys(nextInputs);
      if (
        prevKeys.length === nextKeys.length &&
        nextKeys.every((key) => prev[key] === nextInputs[key])
      ) {
        return prev;
      }
      return nextInputs;
    });
  }, [
    canConfigureSplit,
    draft.currency,
    draft.splitDetails,
    draft.splitType,
    splitParticipantIds,
  ]);

  const handlePaidByChange = (userId: string) => {
    onFieldChange("paidByUserId", userId);
  };

  const handleSplitTypeChange = (value: ContributionSplitType) => {
    onFieldChange("splitType", value);
    if (value !== "custom") {
      onFieldChange("splitDetails", null);
      return;
    }
    const amountMinor = resolveAmountMinor() ?? 0;
    onFieldChange("splitDetails", buildEqualSplit(amountMinor, splitParticipantIds));
  };

  const applyCustomSplitValue = (userId: string, rawValue: string) => {
    const amountMinor = resolveAmountMinor();
    if (amountMinor === null) return;

    const sanitized = rawValue.replace(/[^0-9.,]/g, "");
    setCustomSplitInputs((prev) => ({ ...prev, [userId]: sanitized }));

    const parsedTarget = parseMoneyToMinor(
      sanitized || "0",
      draft.currency,
      CURRENCY_MINOR_UNITS
    );

    const targetValue = Math.max(
      0,
      Math.min(
        amountMinor,
        typeof parsedTarget === "bigint" ? Number(parsedTarget) : 0
      )
    );

    const otherUserIds = splitParticipantIds.filter((id) => id !== userId);
    const remaining = Math.max(0, amountMinor - targetValue);
    const baseShare =
      otherUserIds.length > 0 ? Math.floor(remaining / otherUserIds.length) : 0;
    const remainder =
      otherUserIds.length > 0 ? remaining % otherUserIds.length : 0;

    const nextDetails = splitParticipantIds.map((id) => {
      if (id === userId) {
        return { userId: id, shareMinor: targetValue };
      }
      const otherIndex = otherUserIds.indexOf(id);
      return {
        userId: id,
        shareMinor:
          baseShare + (otherIndex >= 0 && otherIndex < remainder ? 1 : 0),
      };
    });

    onFieldChange("splitDetails", nextDetails);
  };

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

      {canConfigureSplit && (
        <>
          <View
            style={[
              styles.section,
              { backgroundColor: userTokens.surfaceAlt, borderColor: userTokens.border },
            ]}
          >
            <Text style={[styles.sectionLabel, { color: userTokens.textPrimary }]}>
              {t(
                dictionary,
                draft.type === "income"
                  ? "addTransaction.receivedByLabel"
                  : "addTransaction.paidByLabel"
              )}
            </Text>
            <View style={styles.memberWrap}>
              {visibleSplitParticipants.map((member) => {
                const isSelected = draft.paidByUserId === member.userId;
                return (
                  <Pressable
                    key={member.userId}
                    onPress={() => handlePaidByChange(member.userId)}
                    style={[
                      styles.memberChip,
                      {
                        borderColor: isSelected ? primaryActionColor : userTokens.border,
                        backgroundColor: isSelected
                          ? primaryActionColor
                          : userTokens.surface,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.memberChipText,
                        {
                          color: isSelected
                            ? primaryActionTextColor
                            : userTokens.textPrimary,
                        },
                      ]}
                    >
                      {member.name}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            {errors.paidByUserId ? (
              <Text style={styles.errorText}>
                {t(
                  dictionary,
                  draft.type === "income"
                    ? "addTransaction.errors.receivedByRequired"
                    : "addTransaction.errors.paidByRequired"
                )}
              </Text>
            ) : null}
          </View>

          <View
            style={[
              styles.section,
              { backgroundColor: userTokens.surfaceAlt, borderColor: userTokens.border },
            ]}
          >
            <Text style={[styles.sectionLabel, { color: userTokens.textPrimary }]}>
              {t(dictionary, "addTransaction.splitLabel")}
            </Text>
            <View
              style={[
                styles.segmentedControl,
                { borderColor: userTokens.border, backgroundColor: userTokens.surfaceAlt },
              ]}
            >
              {(
                [
                  { key: "equal", label: "addTransaction.splitEqualOption" },
                  { key: "personal", label: "addTransaction.splitPersonalOption" },
                  { key: "custom", label: "addTransaction.splitCustomOption" },
                ] as const
              ).map((option) => {
                const isActive = draft.splitType === option.key;
                return (
                  <Pressable
                    key={option.key}
                    onPress={() => handleSplitTypeChange(option.key)}
                    style={[
                      styles.segmentOption,
                      isActive && styles.segmentOptionActive,
                      isActive && { backgroundColor: primaryActionColor },
                    ]}
                  >
                    <Text
                      style={[
                        styles.segmentOptionText,
                        isActive && styles.segmentOptionTextActive,
                        { color: userTokens.textSecondary },
                        isActive && { color: primaryActionTextColor },
                      ]}
                    >
                      {t(dictionary, option.label)}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {draft.splitType === "custom" && (
              <View style={styles.customSplitList}>
                <Text style={[styles.helperText, { color: userTokens.textSecondary }]}>
                  {t(dictionary, "addTransaction.splitCustomHelper")}
                </Text>
                {visibleSplitParticipants.map((member) => (
                  <View key={member.userId} style={styles.customSplitRow}>
                    <Text style={[styles.customSplitName, { color: userTokens.textPrimary }]}>
                      {member.name}
                    </Text>
                    <TextInput
                      value={customSplitInputs[member.userId] ?? ""}
                      onChangeText={(value) => applyCustomSplitValue(member.userId, value)}
                      placeholder="0,00"
                      placeholderTextColor={userTokens.textTertiary}
                      keyboardType="decimal-pad"
                      style={[
                        styles.customSplitInput,
                        {
                          borderColor: userTokens.border,
                          backgroundColor: userTokens.surface,
                          color: userTokens.textPrimary,
                        },
                      ]}
                    />
                  </View>
                ))}
              </View>
            )}

            {errors.splitDetails ? (
              <Text style={styles.errorText}>
                {t(dictionary, "addTransaction.errors.splitTotalMismatch")}
              </Text>
            ) : null}
          </View>
        </>
      )}

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
  memberWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: tokens.spacing.sm,
  },
  memberChip: {
    borderWidth: 1,
    borderRadius: tokens.radii.pill,
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: tokens.spacing.sm,
    minHeight: 40,
    justifyContent: "center",
  },
  memberChipText: {
    fontSize: tokens.typography.size.sm,
    fontWeight: tokens.typography.weight.semibold,
  },
  customSplitList: {
    gap: tokens.spacing.sm,
  },
  customSplitRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: tokens.spacing.md,
  },
  customSplitName: {
    flex: 1,
    fontSize: tokens.typography.size.md,
    fontWeight: tokens.typography.weight.medium,
  },
  customSplitInput: {
    minWidth: 110,
    borderWidth: 1,
    borderRadius: tokens.radii.md,
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: tokens.spacing.sm,
    textAlign: "right",
    fontSize: tokens.typography.size.md,
    fontVariant: ["tabular-nums"],
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
