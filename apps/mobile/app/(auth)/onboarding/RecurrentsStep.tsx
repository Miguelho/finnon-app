import type { Dispatch, SetStateAction } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { ArrowDownLeft, ArrowUpRight, Briefcase, House, Tv, Music, Dumbbell, Smartphone, Banknote, type LucideIcon } from "lucide-react-native";
import { Button } from "../../../src/components/Button";
import { DatePickerField } from "../../../src/components/DatePickerField";
import { Input } from "../../../src/components/Input";
import { useUserTheme } from "../../../src/contexts/UserThemeContext";
import { useCopy, t } from "../../../src/lib/i18n";
import {
  DEFAULT_CATEGORIES,
  ONBOARDING_MIN_RECURRENTS,
  formatDateForDisplay,
  parseMoneyToMinor,
  withAlpha,
  type OnboardingRecurrentInput,
} from "@poleursus/shared";
import { OnboardingProgress } from "./OnboardingProgress";
import { OnboardingSurface } from "./OnboardingSurface";
import { onboardingRadii } from "./onboarding-theme";
import type { RecurrentsStepState, RecurrentDraft } from "./state";

interface RecurrentsStepProps {
  currency: string;
  state: RecurrentsStepState;
  onChangeState: Dispatch<SetStateAction<RecurrentsStepState>>;
  onContinue: (recurrents: OnboardingRecurrentInput[]) => void;
  onBack: () => void;
}

const recurrentIcons: Record<string, LucideIcon> = {
  sug_salary: Briefcase,
  sug_rent: House,
  sug_netflix: Tv,
  sug_spotify: Music,
  sug_gym: Dumbbell,
  sug_phone: Smartphone,
};

export function RecurrentsStep({
  currency,
  state,
  onChangeState,
  onContinue,
  onBack,
}: RecurrentsStepProps) {
  const { dictionary, locale } = useCopy();
  const { tokens: userTokens, primaryActionColor } = useUserTheme();
  const {
    items,
    customEnabled,
    customLabel,
    customAmount,
    customExpectedDate,
    customType,
  } = state;
  const today = new Date().toISOString().slice(0, 10);

  const resolveCategoryName = (categoryName: string) => {
    const match = DEFAULT_CATEGORIES.find(
      (category) =>
        category.name === categoryName || category.name_en === categoryName
    );
    if (!match) return categoryName;
    return locale === "en" ? match.name_en : match.name;
  };

  const updateItem = (id: string, changes: Partial<RecurrentDraft>) => {
    onChangeState((prev) => ({
      ...prev,
      items: prev.items.map((item) =>
        item.id === id ? { ...item, ...changes } : item
      ),
    }));
  };

  const dayOfMonthFromDate = (value: string, fallback: number) => {
    const day = Number(value.slice(8, 10));
    if (!Number.isInteger(day) || day < 1 || day > 31) return fallback;
    return day;
  };

  const selectedItems = items.filter((item) => item.selected);
  const sanitizeNumericInput = (value: string) => value.replace(/[^0-9.,]/g, "");
  const selectedAmounts = selectedItems.map((item) =>
    parseMoneyToMinor(item.amount, currency)
  );
  const hasEmptySuggestedAmount = selectedItems.some(
    (item) => item.amount.trim() === ""
  );
  const hasInvalidSuggestedAmount = selectedAmounts.some(
    (result) => typeof result === "object"
  );

  const customHasInput = customLabel.trim() !== "" || customAmount.trim() !== "";
  const customAmountResult = customHasInput && customAmount.trim() !== ""
    ? parseMoneyToMinor(customAmount, currency)
    : null;
  const customValid =
    customHasInput &&
    customLabel.trim() !== "" &&
    customAmount.trim() !== "" &&
    typeof customAmountResult !== "object";
  const customHasEmptyAmount = customHasInput && customAmount.trim() === "";
  const customHasError =
    customHasInput &&
    (customHasEmptyAmount || !customValid || typeof customAmountResult === "object");

  const selectedCount = selectedItems.length + (customValid ? 1 : 0);
  const meetsMinimum = selectedCount >= ONBOARDING_MIN_RECURRENTS;
  const canContinue =
    meetsMinimum &&
    !hasEmptySuggestedAmount &&
    !hasInvalidSuggestedAmount &&
    !customHasError;

  const buildRecurrents = () => {
    const dayOfMonth = new Date().getUTCDate();

    const suggested: OnboardingRecurrentInput[] = selectedItems
      .map((item) => {
        const parsed = parseMoneyToMinor(item.amount, currency);
        if (typeof parsed === "object") return null;
        const expectedDate = item.expectedDate || today;
        return {
          suggestedId: item.id,
          label: item.label,
          type: item.type,
          amountMinor: Number(parsed),
          currency,
          categoryName: resolveCategoryName(item.suggestedCategoryName),
          expectedDate,
          frequency: item.frequency,
          interval: item.interval,
          dayOfMonth: dayOfMonthFromDate(expectedDate, dayOfMonth),
        };
      })
      .filter(Boolean) as OnboardingRecurrentInput[];

    if (!customValid || typeof customAmountResult === "object") {
      return suggested;
    }

    const customDate = customExpectedDate || today;
    const custom: OnboardingRecurrentInput = {
      suggestedId: `custom_${Date.now()}`,
      label: customLabel.trim(),
      type: customType,
      amountMinor: Number(customAmountResult),
      currency,
      categoryName: "",
      expectedDate: customDate,
      frequency: "monthly",
      interval: 1,
      dayOfMonth: dayOfMonthFromDate(customDate, dayOfMonth),
    };

    return [...suggested, custom];
  };

  const handleContinue = () => {
    if (!canContinue) return;
    onContinue(buildRecurrents());
  };

  const minimumLabel = meetsMinimum
    ? `${selectedCount} ${t(dictionary, "onboarding.recurrents.minimumMet")}`
    : t(dictionary, "onboarding.recurrents.minimum");
  const selectedItemBg = withAlpha(primaryActionColor, 0.12);

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={[styles.container, { backgroundColor: userTokens.background }]}
    >
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <OnboardingSurface
          style={{
            backgroundColor: userTokens.surface,
            borderColor: userTokens.border,
          }}
        >
          <OnboardingProgress current="recurrents" />
          <View style={styles.header}>
            <Text style={[styles.title, { color: userTokens.textPrimary }]}>
              {t(dictionary, "onboarding.recurrents.title")}
            </Text>
            <Text style={[styles.subtitle, { color: userTokens.textSecondary }]}>
              {t(dictionary, "onboarding.recurrents.subtitle")}
            </Text>
          </View>

          <View style={styles.list}>
            {items.map((item) => {
              const detail =
                item.type === "income"
                  ? t(dictionary, "common.incomeLabel")
                  : t(dictionary, "common.expenseLabel");
              const IconComponent = recurrentIcons[item.id] ?? Banknote;
              return (
                <TouchableOpacity
                  key={item.id}
                  style={[
                    styles.item,
                    {
                      borderColor: userTokens.border,
                      backgroundColor: userTokens.surfaceAlt,
                    },
                    item.selected && {
                      borderColor: primaryActionColor,
                      backgroundColor: selectedItemBg,
                    },
                  ]}
                  onPress={() => updateItem(item.id, { selected: !item.selected })}
                >
                  <View
                    style={[
                      styles.iconBox,
                      { backgroundColor: userTokens.background },
                    ]}
                  >
                    <IconComponent
                      size={18}
                      color={userTokens.textSecondary}
                    />
                  </View>
                  <View style={styles.info}>
                    <TextInput
                      style={[styles.labelInput, { color: userTokens.textPrimary }]}
                      value={item.label}
                      onChangeText={(text) => updateItem(item.id, { label: text })}
                      onFocus={() => updateItem(item.id, { selected: true })}
                    />
                    <Text style={[styles.detail, { color: userTokens.textSecondary }]}>
                      {detail}
                    </Text>
                  </View>
                  <View style={styles.amountRowInline}>
                    <TextInput
                      style={[
                        styles.itemAmountInput,
                        {
                          borderColor: userTokens.border,
                          backgroundColor: userTokens.surface,
                          color: userTokens.textPrimary,
                        },
                      ]}
                      value={item.amount}
                      onChangeText={(text) =>
                        updateItem(item.id, { amount: sanitizeNumericInput(text) })
                      }
                      onFocus={() => updateItem(item.id, { selected: true })}
                      keyboardType="decimal-pad"
                    />
                    <DatePickerField
                      label={t(dictionary, "addTransaction.dateLabel")}
                      hideLabel
                      value={item.expectedDate || today}
                      onChangeText={(value) =>
                        updateItem(item.id, { expectedDate: value })
                      }
                      placeholder={t(dictionary, "transactions.datePlaceholder")}
                      formatValue={(value) => formatDateForDisplay(value, locale)}
                      containerStyle={styles.inlineDateContainer}
                      inputStyle={[
                        styles.inlineDateInput,
                        {
                          borderColor: userTokens.border,
                          backgroundColor: userTokens.surface,
                        },
                      ]}
                      valueTextStyle={{
                        color: userTokens.textPrimary,
                      }}
                      placeholderTextColor={userTokens.textTertiary}
                      sheetBackgroundColor={userTokens.surface}
                      sheetBorderColor={userTokens.border}
                      sheetActionColor={primaryActionColor}
                      onOpen={() => updateItem(item.id, { selected: true })}
                    />
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>

          <TouchableOpacity
            onPress={() =>
              onChangeState((prev) => ({ ...prev, customEnabled: !prev.customEnabled }))
            }
            style={[
              styles.customToggle,
              {
                borderColor: userTokens.border,
                backgroundColor: userTokens.surface,
              },
            ]}
          >
            <Text style={[styles.customToggleText, { color: userTokens.textSecondary }]}>
              ＋
            </Text>
            <Text style={[styles.customToggleLabel, { color: userTokens.textSecondary }]}>
              {t(dictionary, "onboarding.recurrents.addCustom")}
            </Text>
          </TouchableOpacity>

          {customEnabled && (
            <View
              style={[
                styles.customCard,
                {
                  borderColor: userTokens.border,
                  backgroundColor: userTokens.surfaceAlt,
                },
              ]}
            >
              <Input
                label={t(dictionary, "common.nameLabel")}
                value={customLabel}
                onChangeText={(value) =>
                  onChangeState((prev) => ({ ...prev, customLabel: value }))
                }
                placeholder={t(dictionary, "addTransaction.namePlaceholder")}
              />
              <View style={styles.field}>
                <Text style={[styles.fieldLabel, { color: userTokens.textPrimary }]}>
                  {t(dictionary, "addTransaction.amountLabel")}
                </Text>
                <View style={styles.amountRow}>
                  <TextInput
                    style={[
                      styles.fieldAmountInput,
                      {
                        borderColor: userTokens.border,
                        backgroundColor: userTokens.surface,
                        color: userTokens.textPrimary,
                      },
                    ]}
                    value={customAmount}
                    onChangeText={(value) =>
                      onChangeState((prev) => ({
                        ...prev,
                        customAmount: sanitizeNumericInput(value),
                      }))
                    }
                    placeholder={t(dictionary, "addTransaction.amountPlaceholder")}
                    keyboardType="decimal-pad"
                    placeholderTextColor={userTokens.textTertiary}
                  />
                  <View
                    style={[
                      styles.currencyBadge,
                      {
                        borderColor: userTokens.border,
                        backgroundColor: userTokens.background,
                      },
                    ]}
                  >
                    <Text style={[styles.currencyText, { color: userTokens.textPrimary }]}>
                      {currency}
                    </Text>
                  </View>
                  <DatePickerField
                    label={t(dictionary, "addTransaction.dateLabel")}
                    hideLabel
                    value={customExpectedDate || today}
                    onChangeText={(value) =>
                      onChangeState((prev) => ({
                        ...prev,
                        customExpectedDate: value,
                      }))
                    }
                    placeholder={t(dictionary, "transactions.datePlaceholder")}
                    formatValue={(value) => formatDateForDisplay(value, locale)}
                    containerStyle={styles.inlineDateContainer}
                    inputStyle={[
                      styles.inlineDateInput,
                      {
                        borderColor: userTokens.border,
                        backgroundColor: userTokens.surface,
                      },
                    ]}
                    valueTextStyle={{
                      color: userTokens.textPrimary,
                    }}
                    placeholderTextColor={userTokens.textTertiary}
                    sheetBackgroundColor={userTokens.surface}
                    sheetBorderColor={userTokens.border}
                    sheetActionColor={primaryActionColor}
                  />
                </View>
              </View>
              <View style={styles.field}>
                <Text style={[styles.fieldLabel, { color: userTokens.textPrimary }]}>
                  {t(dictionary, "addTransaction.typeLabel")}
                </Text>
                <View
                  style={[
                    styles.typeToggle,
                    {
                      borderColor: userTokens.border,
                      backgroundColor: userTokens.background,
                    },
                  ]}
                >
                  <TouchableOpacity
                    style={[
                      styles.typeOption,
                      customType === "expense" && { backgroundColor: userTokens.surface },
                    ]}
                    onPress={() =>
                      onChangeState((prev) => ({ ...prev, customType: "expense" }))
                    }
                  >
                    <ArrowDownLeft
                      size={18}
                      color={
                        customType === "expense"
                          ? userTokens.textPrimary
                          : userTokens.textSecondary
                      }
                    />
                    <Text
                      style={[
                        styles.typeOptionText,
                        { color: userTokens.textSecondary },
                        customType === "expense" && { color: userTokens.textPrimary },
                      ]}
                    >
                      {t(dictionary, "addTransaction.typeExpense")}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.typeOption,
                      customType === "income" && { backgroundColor: userTokens.surface },
                    ]}
                    onPress={() =>
                      onChangeState((prev) => ({ ...prev, customType: "income" }))
                    }
                  >
                    <ArrowUpRight
                      size={18}
                      color={
                        customType === "income"
                          ? userTokens.textPrimary
                          : userTokens.textSecondary
                      }
                    />
                    <Text
                      style={[
                        styles.typeOptionText,
                        { color: userTokens.textSecondary },
                        customType === "income" && { color: userTokens.textPrimary },
                      ]}
                    >
                      {t(dictionary, "addTransaction.typeIncome")}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          )}

          <Text
            style={[
              styles.minimum,
              meetsMinimum ? styles.minimumMet : styles.minimumWarn,
            ]}
          >
            {minimumLabel}
          </Text>
          {(hasEmptySuggestedAmount || hasInvalidSuggestedAmount || customHasError) && (
            <Text style={styles.errorText}>
              {t(dictionary, "money.invalidFormat")}
            </Text>
          )}

          <View style={styles.actions}>
            <Button title={t(dictionary, "common.back")} onPress={onBack} variant="secondary" />
            <Button
              title={t(dictionary, "onboarding.recurrents.continue")}
              onPress={handleContinue}
              disabled={!canContinue}
            />
          </View>
        </OnboardingSurface>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: "center",
    padding: 20,
  },
  header: {
    marginTop: 12,
    alignItems: "center",
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
    textAlign: "center",
  },
  subtitle: {
    marginTop: 6,
    fontSize: 13,
    textAlign: "center",
  },
  list: {
    gap: 10,
    marginTop: 18,
  },
  item: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1.5,
    borderRadius: onboardingRadii.sm,
    padding: 12,
  },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  info: {
    flex: 1,
    marginLeft: 10,
  },
  labelInput: {
    fontSize: 14,
    fontWeight: "600",
    padding: 0,
  },
  detail: {
    fontSize: 12,
  },
  amountRowInline: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginLeft: 8,
  },
  itemAmountInput: {
    width: 72,
    borderWidth: 1,
    borderRadius: 6,
    paddingVertical: 4,
    paddingHorizontal: 6,
    fontSize: 13,
    fontWeight: "600",
    textAlign: "right",
  },
  inlineDateContainer: {
    marginBottom: 0,
  },
  inlineDateInput: {
    width: 120,
    borderWidth: 1,
    borderRadius: 6,
    paddingVertical: 4,
    paddingHorizontal: 6,
    fontSize: 12,
  },
  customToggle: {
    marginTop: 14,
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderRadius: onboardingRadii.sm,
    paddingVertical: 12,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  customToggleText: {
    fontSize: 16,
  },
  customToggleLabel: {
    fontSize: 13,
    fontWeight: "500",
  },
  customCard: {
    borderWidth: 1,
    borderRadius: onboardingRadii.md,
    padding: 12,
    marginTop: 12,
  },
  field: {
    marginBottom: 12,
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 8,
  },
  amountRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
  },
  fieldAmountInput: {
    flex: 1,
    minWidth: 120,
    borderWidth: 1,
    borderRadius: onboardingRadii.md,
    paddingVertical: 12,
    paddingHorizontal: 16,
    fontSize: 16,
  },
  currencyBadge: {
    borderWidth: 1,
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  currencyText: {
    fontSize: 12,
    fontWeight: "600",
  },
  typeToggle: {
    flexDirection: "row",
    gap: 6,
    padding: 4,
    borderRadius: 999,
    borderWidth: 1,
  },
  typeOption: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    borderRadius: 999,
  },
  typeOptionText: {
    fontSize: 14,
    fontWeight: "600",
  },
  minimum: {
    marginTop: 12,
    textAlign: "center",
    fontSize: 12,
    fontWeight: "600",
  },
  minimumWarn: {
    color: "#f59e0b",
  },
  minimumMet: {
    color: "#16a34a",
  },
  errorText: {
    color: "#dc2626",
    fontSize: 12,
    textAlign: "center",
    marginTop: 6,
  },
  actions: {
    gap: 12,
    marginTop: 16,
  },
});
