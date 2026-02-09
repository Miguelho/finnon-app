import { useMemo } from "react";
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
import { Button } from "../../../src/components/Button";
import { useCopy, t } from "../../../src/lib/i18n";
import {
  CURRENCIES,
  GOAL_TIMELINE_OPTIONS,
  formatMoneyWithSymbol,
  parseMoneyToMinor,
  type OnboardingGoalInput,
} from "@poleursus/shared";
import { OnboardingProgress } from "./OnboardingProgress";
import { OnboardingSurface } from "./OnboardingSurface";
import { onboardingColors, onboardingRadii } from "./onboarding-theme";

interface ObjectiveStepProps {
  currency: string;
  amount: string;
  months: 3 | 6 | 12;
  onAmountChange: (value: string) => void;
  onMonthsChange: (value: 3 | 6 | 12) => void;
  onContinue: (goal: OnboardingGoalInput) => void;
  onSkip: () => void;
  onBack: () => void;
}

export function ObjectiveStep({
  currency,
  amount,
  months,
  onAmountChange,
  onMonthsChange,
  onContinue,
  onSkip,
  onBack,
}: ObjectiveStepProps) {
  const { dictionary } = useCopy();

  const currencySymbol = useMemo(
    () => CURRENCIES.find((curr) => curr.code === currency)?.symbol ?? currency,
    [currency]
  );

  const parsedAmount = amount.trim() ? parseMoneyToMinor(amount, currency) : null;
  const amountValid = parsedAmount !== null && typeof parsedAmount !== "object";

  const monthlyAmount = amountValid
    ? formatMoneyWithSymbol(parsedAmount / BigInt(months), currency, currencySymbol)
    : formatMoneyWithSymbol(0n, currency, currencySymbol);

  const handleContinue = () => {
    if (!amountValid || typeof parsedAmount === "object") return;
    onContinue({
      targetAmountMinor: Number(parsedAmount),
      months,
    });
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <OnboardingSurface>
          <OnboardingProgress current="objective" />
          <View style={styles.header}>
            <Text style={styles.title}>
              {t(dictionary, "onboarding.objective.title")}
            </Text>
            <Text style={styles.subtitle}>
              {t(dictionary, "onboarding.objective.subtitle")}
            </Text>
          </View>

          <View style={styles.objectiveCard}>
            <Text style={styles.sectionLabel}>
              {t(dictionary, "onboarding.objective.amountLabel")}
            </Text>
            <View style={styles.amountRow}>
              <Text style={styles.currencySymbol}>{currencySymbol}</Text>
              <TextInput
                style={styles.amountInput}
                value={amount}
                onChangeText={onAmountChange}
                keyboardType="decimal-pad"
                placeholder="3.000"
              />
            </View>
            {!amountValid && amount.trim() !== "" && (
              <Text style={styles.errorText}>{t(dictionary, "money.invalidFormat")}</Text>
            )}

            <Text style={[styles.sectionLabel, styles.timelineLabel]}>
              {t(dictionary, "onboarding.objective.timelineLabel")}
            </Text>
            <View style={styles.timelineRow}>
              {GOAL_TIMELINE_OPTIONS.map((option) => (
                <TouchableOpacity
                  key={option}
                  style={[
                    styles.timelineButton,
                    months === option && styles.timelineButtonActive,
                  ]}
                  onPress={() => onMonthsChange(option)}
                >
                  <Text
                    style={[
                      styles.timelineText,
                      months === option && styles.timelineTextActive,
                    ]}
                  >
                    {t(dictionary, `onboarding.objective.months${option}`)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {amountValid && (
            <View style={styles.previewCard}>
              <Text style={styles.previewTitle}>
                {t(dictionary, "onboarding.objective.previewTitle")}
              </Text>
              <Text style={styles.previewText}>
                {t(dictionary, "onboarding.objective.previewText", {
                  amount: monthlyAmount,
                })}
              </Text>
            </View>
          )}

          <View style={styles.actions}>
            <Button
              title={t(dictionary, "onboarding.objective.continue")}
              onPress={handleContinue}
              disabled={!amountValid}
            />
            <TouchableOpacity onPress={onSkip} style={styles.skipLink}>
              <Text style={styles.skipText}>
                {t(dictionary, "onboarding.objective.skip")}
              </Text>
            </TouchableOpacity>
            <Button title={t(dictionary, "common.back")} onPress={onBack} variant="secondary" />
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
  objectiveCard: {
    marginTop: 18,
    borderWidth: 1.5,
    borderColor: onboardingColors.border,
    borderRadius: onboardingRadii.lg,
    padding: 18,
    backgroundColor: onboardingColors.white,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: onboardingColors.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  timelineLabel: {
    marginTop: 18,
    marginBottom: 8,
  },
  amountRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 12,
  },
  currencySymbol: {
    fontSize: 24,
    fontWeight: "700",
    color: onboardingColors.textMuted,
  },
  amountInput: {
    flex: 1,
    fontSize: 28,
    fontWeight: "700",
    color: onboardingColors.text,
  },
  errorText: {
    color: onboardingColors.red,
    fontSize: 12,
    marginTop: 6,
  },
  previewCard: {
    marginTop: 16,
    borderWidth: 1,
    borderColor: onboardingColors.greenBorder,
    borderRadius: onboardingRadii.sm,
    padding: 14,
    backgroundColor: onboardingColors.greenBg,
  },
  previewTitle: {
    fontSize: 12,
    fontWeight: "600",
    marginBottom: 6,
    color: onboardingColors.green,
  },
  previewText: {
    fontSize: 12,
    color: onboardingColors.text,
  },
  timelineRow: {
    flexDirection: "row",
    gap: 8,
    flexWrap: "wrap",
  },
  timelineButton: {
    borderWidth: 1.5,
    borderColor: onboardingColors.border,
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  timelineButtonActive: {
    backgroundColor: onboardingColors.dark,
    borderColor: onboardingColors.dark,
  },
  timelineText: {
    fontSize: 12,
    color: onboardingColors.textSecondary,
    fontWeight: "500",
  },
  timelineTextActive: {
    color: onboardingColors.white,
  },
  actions: {
    gap: 12,
    marginTop: 18,
  },
  skipLink: {
    alignItems: "center",
    paddingVertical: 6,
  },
  skipText: {
    fontSize: 13,
    color: onboardingColors.textMuted,
  },
});
