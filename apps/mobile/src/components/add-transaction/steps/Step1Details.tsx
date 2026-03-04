import { useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  Switch,
  StyleSheet,
  Modal,
  ScrollView,
  TouchableOpacity,
} from "react-native";
import {
  ArrowDownLeft,
  ArrowUpRight,
  ChevronDown,
  Info,
} from "lucide-react-native";
import {
  themeTokens,
  type TransactionDraft,
  type TransactionType,
  type ObligationType,
  parseMoneyToMinor,
  buildEqualSplit,
  CURRENCY_MINOR_UNITS,
  CURRENCIES,
  formatDateForDisplay,
} from "@poleursus/shared";
import { useCopy, t } from "../../../lib/i18n";
import { useUserTheme } from "../../../contexts/UserThemeContext";
import { DateQuickPicker } from "../DateQuickPicker";
import { DatePickerField } from "../../DatePickerField";
import { Button } from "../../Button";
import { FutureObligationSuggestion } from "../FutureObligationSuggestion";
import { Step0QuickAdd } from "./Step0QuickAdd";
import { PaidBySelector } from "./PaidBySelector";
import { SplitSelector } from "./SplitSelector";

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
  accountId?: string;
  categories?: {
    id: string;
    name: string;
    icon_id: string;
    type: "income" | "expense";
  }[];
  showQuickAdd?: boolean;
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
  accountId = "",
  categories = [],
  showQuickAdd = false,
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
  const [paidByBoth, setPaidByBoth] = useState(() => draft.paidByUserId === null);
  const [isCurrencySheetOpen, setIsCurrencySheetOpen] = useState(false);
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
  const shouldShowSplitSection = canConfigureSplit && draft.type !== "income";
  const currencyCodes = useMemo(
    () => Object.keys(CURRENCY_MINOR_UNITS).sort(),
    []
  );
  const currencySymbol = useMemo(
    () => CURRENCIES.find((item) => item.code === draft.currency)?.symbol ?? draft.currency,
    [draft.currency]
  );

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
    if (draft.type === "income") return;
    if (paidByBoth) return;
    if (draft.paidByUserId) return;
    const fallbackPaidBy =
      (currentUserId && splitParticipantIds.includes(currentUserId)
        ? currentUserId
        : splitParticipantIds[0]) ?? null;
    if (fallbackPaidBy) {
      onFieldChange("paidByUserId", fallbackPaidBy);
    }
  }, [
    canConfigureSplit,
    currentUserId,
    draft.paidByUserId,
    onFieldChange,
    paidByBoth,
    splitParticipantIds,
    draft.type,
  ]);

  useEffect(() => {
    if (!canConfigureSplit) return;
    if (draft.type === "income") return;
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
    draft.type,
  ]);

  useEffect(() => {
    if (!canConfigureSplit || draft.type === "income") {
      if (paidByBoth) {
        setPaidByBoth(false);
      }
      return;
    }

    const shouldBeBoth = draft.paidByUserId === null;
    if (paidByBoth !== shouldBeBoth) {
      setPaidByBoth(shouldBeBoth);
    }
  }, [canConfigureSplit, draft.paidByUserId, draft.type, paidByBoth]);

  useEffect(() => {
    if (!canConfigureSplit) return;
    if (draft.type !== "income") return;
    if (draft.splitType !== "equal") {
      onFieldChange("splitType", "equal");
    }
    if (draft.splitDetails !== null) {
      onFieldChange("splitDetails", null);
    }
  }, [
    canConfigureSplit,
    draft.splitDetails,
    draft.splitType,
    draft.type,
    onFieldChange,
  ]);

  const handlePaidByChange = (userId: string | null, bothSelected: boolean) => {
    setPaidByBoth(bothSelected);
    if (bothSelected) {
      onFieldChange("paidByUserId", null);
      return;
    }

    const nextUserId =
      userId ??
      (currentUserId && splitParticipantIds.includes(currentUserId)
        ? currentUserId
        : splitParticipantIds[0] ?? null);
    onFieldChange("paidByUserId", nextUserId);
  };

  const handleSplitTypeChange = (
    value: "equal" | "personal" | "custom",
    splitDetails?: TransactionDraft["splitDetails"]
  ) => {
    onFieldChange("splitType", value);
    if (value !== "custom") {
      onFieldChange("splitDetails", null);
      return;
    }
    if (splitDetails && splitDetails.length > 0) {
      onFieldChange("splitDetails", splitDetails);
      return;
    }
    const amountMinor = resolveAmountMinor();
    onFieldChange("splitDetails", buildEqualSplit(amountMinor ?? 0, splitParticipantIds));
  };

  const paidByParticipant =
    visibleSplitParticipants.find((member) => member.userId === draft.paidByUserId) ??
    null;
  const paidByFirstName = paidByParticipant?.name.trim().split(/\s+/)[0] ?? "";
  const personalSplitLabel =
    !paidByBoth &&
    draft.paidByUserId &&
    draft.paidByUserId !== currentUserId &&
    paidByFirstName
      ? t(dictionary, "addTransaction.splitPersonalOf", { name: paidByFirstName })
      : t(dictionary, "addTransaction.splitPersonalOption");

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

      {showQuickAdd ? (
        <Step0QuickAdd
          accountId={accountId}
          categories={categories}
          draft={draft}
          onFieldChange={onFieldChange}
        />
      ) : null}

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
          <Pressable
            onPress={() => setIsCurrencySheetOpen(true)}
            style={[
              styles.currencySelector,
              { borderColor: userTokens.border, backgroundColor: userTokens.surface },
            ]}
          >
            <Text style={[styles.currencySelectorText, { color: userTokens.textPrimary }]}>
              {draft.currency}
            </Text>
            <ChevronDown size={14} color={userTokens.textSecondary} />
          </Pressable>
        </View>
        <View style={styles.amountDisplayRow}>
          <TextInput
            style={[
              styles.amountInput,
              {
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
          <Text style={[styles.amountCurrencySymbol, { color: userTokens.textSecondary }]}>
            {currencySymbol}
          </Text>
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

      {shouldShowSplitSection && (
        <View
          style={[
            styles.splitCard,
            { backgroundColor: userTokens.surfaceAlt, borderColor: userTokens.border },
          ]}
        >
          <View
            style={[
              styles.splitCardSection,
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
            <PaidBySelector
              participants={visibleSplitParticipants}
              currentUserId={currentUserId}
              value={draft.paidByUserId}
              bothSelected={paidByBoth}
              bothLabel={t(dictionary, "addTransaction.bothPaidOption")}
              borderColor={userTokens.border}
              surfaceColor={userTokens.surface}
              mutedTextColor={userTokens.textSecondary}
              primaryColor={primaryActionColor}
              onChange={handlePaidByChange}
            />
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

          <View style={[styles.splitCardDivider, { backgroundColor: userTokens.border }]} />

          <View
            style={[
              styles.splitCardSection,
            ]}
          >
            <Text style={[styles.sectionLabel, { color: userTokens.textPrimary }]}>
              {t(dictionary, "addTransaction.splitLabel")}
            </Text>
            <SplitSelector
              value={draft.splitType}
              paidByBoth={paidByBoth}
              participants={visibleSplitParticipants}
              splitDetails={draft.splitDetails}
              totalAmountMinor={resolveAmountMinor() ?? 0}
              equalLabel={t(dictionary, "addTransaction.splitEqualOption")}
              personalLabel={personalSplitLabel}
              customLabel={t(dictionary, "addTransaction.splitCustomOption")}
              equalHintText={t(dictionary, "addTransaction.splitEqualRequiresBoth")}
              personalHintText={t(
                dictionary,
                "addTransaction.splitPersonalDisabledForBoth"
              )}
              customHelperText={t(dictionary, "addTransaction.splitCustomHelper")}
              formatTotalLabel={(total) =>
                t(dictionary, "addTransaction.splitTotalLabel", { total })
              }
              borderColor={userTokens.border}
              surfaceColor={userTokens.surface}
              textPrimaryColor={userTokens.textPrimary}
              textSecondaryColor={userTokens.textSecondary}
              primaryColor={primaryActionColor}
              onChange={handleSplitTypeChange}
            />

            {errors.splitDetails ? (
              <Text style={styles.errorText}>
                {t(dictionary, "addTransaction.errors.splitTotalMismatch")}
              </Text>
            ) : null}
          </View>
        </View>
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

      <Modal
        transparent
        visible={isCurrencySheetOpen}
        animationType="slide"
        onRequestClose={() => setIsCurrencySheetOpen(false)}
      >
        <View style={styles.sheetOverlay}>
          <Pressable
            style={styles.sheetBackdrop}
            onPress={() => setIsCurrencySheetOpen(false)}
          />
          <View
            style={[
              styles.sheetContainer,
              { backgroundColor: userTokens.surface, borderTopColor: userTokens.border },
            ]}
          >
            <View style={[styles.sheetHandle, { backgroundColor: userTokens.border }]} />
            <View style={styles.sheetHeader}>
              <Text style={[styles.sheetTitle, { color: userTokens.textPrimary }]}>
                {t(dictionary, "common.currencyLabel")}
              </Text>
              <TouchableOpacity onPress={() => setIsCurrencySheetOpen(false)}>
                <Text style={[styles.sheetAction, { color: primaryActionColor }]}>
                  {t(dictionary, "common.close")}
                </Text>
              </TouchableOpacity>
            </View>
            <ScrollView
              style={styles.currencyList}
              contentContainerStyle={styles.currencyListContent}
              showsVerticalScrollIndicator={false}
            >
              {currencyCodes.map((code) => {
                const isCurrent = code === draft.currency;
                return (
                  <Pressable
                    key={code}
                    onPress={() => {
                      onFieldChange("currency", code);
                      setIsCurrencySheetOpen(false);
                    }}
                    style={[
                      styles.currencyItem,
                      {
                        borderColor: isCurrent ? primaryActionColor : userTokens.border,
                        backgroundColor: isCurrent
                          ? primaryActionColor
                          : userTokens.surfaceAlt,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.currencyItemText,
                        {
                          color: isCurrent
                            ? primaryActionTextColor
                            : userTokens.textPrimary,
                        },
                      ]}
                    >
                      {code}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>

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
    alignItems: "center",
    justifyContent: "flex-start",
  },
  amountDisplayRow: {
    marginTop: tokens.spacing.sm,
    minHeight: 52,
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 4,
  },
  amountInput: {
    flex: 1,
    borderWidth: 0,
    borderRadius: 0,
    backgroundColor: "transparent",
    fontSize: 40,
    fontWeight: "300",
    letterSpacing: -1,
    lineHeight: 42,
    minHeight: 52,
    paddingHorizontal: 0,
    paddingVertical: 0,
    fontVariant: ["tabular-nums"],
  },
  amountCurrencySymbol: {
    fontSize: 20,
    fontWeight: tokens.typography.weight.medium,
    marginBottom: 6,
  },
  amountLabel: {
    fontSize: tokens.typography.size.xl,
    fontWeight: tokens.typography.weight.bold,
    color: colors.text.primary,
  },
  amountSection: {
    paddingVertical: tokens.spacing.xl,
  },
  currencySelector: {
    minWidth: 84,
    minHeight: 34,
    borderWidth: 1,
    borderRadius: tokens.radii.md,
    paddingHorizontal: tokens.spacing.sm,
    paddingVertical: 4,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: tokens.spacing.xs,
  },
  currencySelectorText: {
    fontSize: tokens.typography.size.sm,
    fontWeight: tokens.typography.weight.semibold,
  },
  splitCard: {
    borderWidth: 1,
    borderRadius: tokens.radii.lg,
    overflow: "hidden",
  },
  splitCardSection: {
    padding: tokens.spacing.lg,
    gap: tokens.spacing.md,
  },
  splitCardDivider: {
    height: 1,
    marginHorizontal: tokens.spacing.lg,
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
  currencyList: {
    maxHeight: 360,
  },
  currencyListContent: {
    gap: tokens.spacing.xs,
    paddingBottom: tokens.spacing.sm,
  },
  currencyItem: {
    minHeight: 44,
    borderWidth: 1,
    borderRadius: tokens.radii.md,
    paddingHorizontal: tokens.spacing.md,
    justifyContent: "center",
  },
  currencyItemText: {
    fontSize: tokens.typography.size.md,
    fontWeight: tokens.typography.weight.semibold,
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
