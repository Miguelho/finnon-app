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
import { ArrowDownRight, ArrowUpRight } from "phosphor-react-native";
import { Button } from "../../../src/components/Button";
import { Input } from "../../../src/components/Input";
import { useCopy, t } from "../../../src/lib/i18n";
import {
  DEFAULT_CATEGORIES,
  ONBOARDING_MIN_RECURRENTS,
  parseMoneyToMinor,
  themeTokens,
  type OnboardingRecurrentInput,
} from "@poleursus/shared";
import { OnboardingProgress } from "./OnboardingProgress";
import { OnboardingSurface } from "./OnboardingSurface";
import { onboardingColors, onboardingRadii } from "./onboarding-theme";
import type { RecurrentsStepState, RecurrentDraft } from "./state";

interface RecurrentsStepProps {
  currency: string;
  state: RecurrentsStepState;
  onChangeState: Dispatch<SetStateAction<RecurrentsStepState>>;
  onContinue: (recurrents: OnboardingRecurrentInput[]) => void;
  onBack: () => void;
}

const tokens = themeTokens.light;
const appColors = tokens.colors;

export function RecurrentsStep({
  currency,
  state,
  onChangeState,
  onContinue,
  onBack,
}: RecurrentsStepProps) {
  const { dictionary, locale } = useCopy();
  const { items, customEnabled, customLabel, customAmount, customType } = state;

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

  const selectedItems = items.filter((item) => item.selected);
  const selectedAmounts = selectedItems.map((item) =>
    parseMoneyToMinor(item.amount, currency)
  );
  const hasInvalidSuggestedAmount = selectedAmounts.some(
    (result) => typeof result === "object"
  );

  const customHasInput = customLabel.trim() !== "" || customAmount.trim() !== "";
  const customAmountResult = customHasInput
    ? parseMoneyToMinor(customAmount, currency)
    : null;
  const customValid =
    customHasInput &&
    customLabel.trim() !== "" &&
    typeof customAmountResult !== "object";
  const customHasError =
    customHasInput && (!customValid || typeof customAmountResult === "object");

  const selectedCount = selectedItems.length + (customValid ? 1 : 0);
  const meetsMinimum = selectedCount >= ONBOARDING_MIN_RECURRENTS;
  const canContinue = meetsMinimum && !hasInvalidSuggestedAmount && !customHasError;

  const buildRecurrents = () => {
    const dayOfMonth = new Date().getUTCDate();

    const suggested: OnboardingRecurrentInput[] = selectedItems
      .map((item) => {
        const parsed = parseMoneyToMinor(item.amount, currency);
        if (typeof parsed === "object") return null;
        return {
          suggestedId: item.id,
          label: item.label,
          type: item.type,
          amountMinor: Number(parsed),
          currency,
          categoryName: resolveCategoryName(item.suggestedCategoryName),
          frequency: item.frequency,
          interval: item.interval,
          dayOfMonth,
        };
      })
      .filter(Boolean) as OnboardingRecurrentInput[];

    if (!customValid || typeof customAmountResult === "object") {
      return suggested;
    }

    const custom: OnboardingRecurrentInput = {
      suggestedId: `custom_${Date.now()}`,
      label: customLabel.trim(),
      type: customType,
      amountMinor: Number(customAmountResult),
      currency,
      categoryName: "",
      frequency: "monthly",
      interval: 1,
      dayOfMonth,
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

  const sanitizeNumericInput = (value: string) => value.replace(/[^0-9.,]/g, "");

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <OnboardingSurface>
          <OnboardingProgress current="recurrents" />
          <View style={styles.header}>
            <Text style={styles.title}>
              {t(dictionary, "onboarding.recurrents.title")}
            </Text>
            <Text style={styles.subtitle}>
              {t(dictionary, "onboarding.recurrents.subtitle")}
            </Text>
          </View>

          <View style={styles.list}>
            {items.map((item) => {
              const detail =
                item.type === "income"
                  ? t(dictionary, "common.incomeLabel")
                  : t(dictionary, "common.expenseLabel");
              return (
                <TouchableOpacity
                  key={item.id}
                  style={[
                    styles.item,
                    item.selected && styles.itemSelected,
                  ]}
                  onPress={() => updateItem(item.id, { selected: !item.selected })}
                >
                  <View style={styles.iconBox}>
                    <Text style={styles.icon}>{item.icon}</Text>
                  </View>
                  <View style={styles.info}>
                    <TextInput
                      style={styles.labelInput}
                      value={item.label}
                      onChangeText={(text) => updateItem(item.id, { label: text })}
                      onFocus={() => updateItem(item.id, { selected: true })}
                    />
                    <Text style={styles.detail}>{detail}</Text>
                  </View>
                  <View style={styles.amountBox}>
                    <TextInput
                      style={styles.amountInput}
                      value={item.amount}
                      onChangeText={(text) => updateItem(item.id, { amount: text })}
                      onFocus={() => updateItem(item.id, { selected: true })}
                      keyboardType="decimal-pad"
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
            style={styles.customToggle}
          >
            <Text style={styles.customToggleText}>＋</Text>
            <Text style={styles.customToggleLabel}>
              {t(dictionary, "onboarding.recurrents.addCustom")}
            </Text>
          </TouchableOpacity>

          {customEnabled && (
            <View style={styles.customCard}>
              <Input
                label={t(dictionary, "common.nameLabel")}
                value={customLabel}
                onChangeText={(value) =>
                  onChangeState((prev) => ({ ...prev, customLabel: value }))
                }
                placeholder={t(dictionary, "addTransaction.namePlaceholder")}
              />
              <View style={styles.field}>
                <Text style={styles.fieldLabel}>
                  {t(dictionary, "addTransaction.amountLabel")}
                </Text>
                <View style={styles.amountRow}>
                  <TextInput
                    style={styles.amountInput}
                    value={customAmount}
                    onChangeText={(value) =>
                      onChangeState((prev) => ({
                        ...prev,
                        customAmount: sanitizeNumericInput(value),
                      }))
                    }
                    placeholder={t(dictionary, "addTransaction.amountPlaceholder")}
                    keyboardType="decimal-pad"
                    placeholderTextColor={appColors.text.muted}
                  />
                  <View style={styles.currencyBadge}>
                    <Text style={styles.currencyText}>{currency}</Text>
                  </View>
                </View>
              </View>
              <View style={styles.field}>
                <Text style={styles.fieldLabel}>
                  {t(dictionary, "addTransaction.typeLabel")}
                </Text>
                <View style={styles.typeToggle}>
                  <TouchableOpacity
                    style={[
                      styles.typeOption,
                      customType === "expense" && styles.typeOptionActive,
                    ]}
                    onPress={() =>
                      onChangeState((prev) => ({ ...prev, customType: "expense" }))
                    }
                  >
                    <ArrowDownRight
                      size={18}
                      weight="regular"
                      color={
                        customType === "expense"
                          ? appColors.text.primary
                          : appColors.text.muted
                      }
                    />
                    <Text
                      style={[
                        styles.typeOptionText,
                        customType === "expense" && styles.typeOptionTextActive,
                      ]}
                    >
                      {t(dictionary, "addTransaction.typeExpense")}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.typeOption,
                      customType === "income" && styles.typeOptionActive,
                    ]}
                    onPress={() =>
                      onChangeState((prev) => ({ ...prev, customType: "income" }))
                    }
                  >
                    <ArrowUpRight
                      size={18}
                      weight="regular"
                      color={
                        customType === "income"
                          ? appColors.text.primary
                          : appColors.text.muted
                      }
                    />
                    <Text
                      style={[
                        styles.typeOptionText,
                        customType === "income" && styles.typeOptionTextActive,
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
          {(hasInvalidSuggestedAmount || customHasError) && (
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
    backgroundColor: onboardingColors.bg,
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
    color: onboardingColors.text,
    textAlign: "center",
  },
  subtitle: {
    marginTop: 6,
    fontSize: 13,
    color: onboardingColors.textSecondary,
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
    borderColor: onboardingColors.border,
    borderRadius: onboardingRadii.sm,
    padding: 12,
    backgroundColor: onboardingColors.white,
  },
  itemSelected: {
    borderColor: onboardingColors.dark,
    backgroundColor: "#f8f9fc",
  },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: onboardingColors.bg,
    alignItems: "center",
    justifyContent: "center",
  },
  icon: {
    fontSize: 18,
  },
  info: {
    flex: 1,
    marginLeft: 10,
  },
  labelInput: {
    fontSize: 14,
    fontWeight: "600",
    color: onboardingColors.text,
    padding: 0,
  },
  detail: {
    fontSize: 12,
    color: onboardingColors.textMuted,
  },
  amountBox: {
    minWidth: 72,
    alignItems: "flex-end",
  },
  amountInput: {
    width: 72,
    borderWidth: 1,
    borderColor: onboardingColors.border,
    borderRadius: 6,
    paddingVertical: 4,
    paddingHorizontal: 6,
    fontSize: 13,
    fontWeight: "600",
    textAlign: "right",
    color: onboardingColors.text,
  },
  customToggle: {
    marginTop: 14,
    borderWidth: 1.5,
    borderColor: onboardingColors.border,
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
    color: onboardingColors.textSecondary,
  },
  customToggleLabel: {
    fontSize: 13,
    color: onboardingColors.textSecondary,
    fontWeight: "500",
  },
  customCard: {
    borderWidth: 1,
    borderColor: appColors.state.neutral,
    borderRadius: onboardingRadii.md,
    padding: 12,
    marginTop: 12,
    backgroundColor: appColors.bg.surface,
  },
  field: {
    marginBottom: 12,
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: appColors.text.primary,
    marginBottom: 8,
  },
  amountRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  amountInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: appColors.state.neutral,
    borderRadius: onboardingRadii.md,
    paddingVertical: 12,
    paddingHorizontal: 16,
    fontSize: 16,
    backgroundColor: appColors.bg.surface,
    color: appColors.text.primary,
  },
  currencyBadge: {
    borderWidth: 1,
    borderColor: appColors.state.neutral,
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: appColors.bg.secondary,
  },
  currencyText: {
    fontSize: 12,
    fontWeight: "600",
    color: appColors.text.primary,
  },
  typeToggle: {
    flexDirection: "row",
    gap: 6,
    padding: 4,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: appColors.state.neutral,
    backgroundColor: appColors.bg.secondary,
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
  typeOptionActive: {
    backgroundColor: appColors.bg.surface,
  },
  typeOptionText: {
    fontSize: 14,
    fontWeight: "600",
    color: appColors.text.muted,
  },
  typeOptionTextActive: {
    color: appColors.text.primary,
  },
  minimum: {
    marginTop: 12,
    textAlign: "center",
    fontSize: 12,
    fontWeight: "600",
  },
  minimumWarn: {
    color: onboardingColors.amber,
  },
  minimumMet: {
    color: onboardingColors.green,
  },
  errorText: {
    color: onboardingColors.red,
    fontSize: 12,
    textAlign: "center",
    marginTop: 6,
  },
  actions: {
    gap: 12,
    marginTop: 16,
  },
});
