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
import { useUserTheme } from "../../../src/contexts/UserThemeContext";
import { useCopy, t } from "../../../src/lib/i18n";
import {
  CURRENCIES,
  GOAL_TIMELINE_OPTIONS,
  formatMoneyWithSymbol,
  parseMoneyToMinor,
  withAlpha,
  type OnboardingGoalInput,
} from "@poleursus/shared";
import { OnboardingProgress } from "./OnboardingProgress";
import { OnboardingSurface } from "./OnboardingSurface";
import { onboardingRadii } from "./onboarding-theme";

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
  const { tokens: userTokens, primaryActionColor, primaryActionTextColor } =
    useUserTheme();

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
  const previewBg = withAlpha(primaryActionColor, 0.12);
  const previewBorder = withAlpha(primaryActionColor, 0.28);

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
          <OnboardingProgress current="objective" />
          <View style={styles.header}>
            <Text style={[styles.title, { color: userTokens.textPrimary }]}>
              {t(dictionary, "onboarding.objective.title")}
            </Text>
            <Text style={[styles.subtitle, { color: userTokens.textSecondary }]}>
              {t(dictionary, "onboarding.objective.subtitle")}
            </Text>
          </View>

          <View
            style={[
              styles.objectiveCard,
              {
                borderColor: userTokens.border,
                backgroundColor: userTokens.surfaceAlt,
              },
            ]}
          >
            <Text style={[styles.sectionLabel, { color: userTokens.textSecondary }]}>
              {t(dictionary, "onboarding.objective.amountLabel")}
            </Text>
            <View style={styles.amountRow}>
              <Text style={[styles.currencySymbol, { color: userTokens.textTertiary }]}>
                {currencySymbol}
              </Text>
              <TextInput
                style={[styles.amountInput, { color: userTokens.textPrimary }]}
                value={amount}
                onChangeText={onAmountChange}
                keyboardType="decimal-pad"
                placeholder="3.000"
                placeholderTextColor={userTokens.textTertiary}
              />
            </View>
            {!amountValid && amount.trim() !== "" && (
              <Text style={[styles.errorText, { color: userTokens.dangerText }]}>
                {t(dictionary, "money.invalidFormat")}
              </Text>
            )}

            <Text
              style={[
                styles.sectionLabel,
                styles.timelineLabel,
                { color: userTokens.textSecondary },
              ]}
            >
              {t(dictionary, "onboarding.objective.timelineLabel")}
            </Text>
            <View style={styles.timelineRow}>
              {GOAL_TIMELINE_OPTIONS.map((option) => (
                <TouchableOpacity
                  key={option}
                  style={[
                    styles.timelineButton,
                    { borderColor: userTokens.border },
                    months === option && {
                      backgroundColor: primaryActionColor,
                      borderColor: primaryActionColor,
                    },
                  ]}
                  onPress={() => onMonthsChange(option)}
                >
                  <Text
                    style={[
                      styles.timelineText,
                      { color: userTokens.textSecondary },
                      months === option && {
                        color: primaryActionTextColor,
                      },
                    ]}
                  >
                    {t(dictionary, `onboarding.objective.months${option}`)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {amountValid && (
            <View
              style={[
                styles.previewCard,
                {
                  borderColor: previewBorder,
                  backgroundColor: previewBg,
                },
              ]}
            >
              <Text style={[styles.previewTitle, { color: primaryActionColor }]}>
                {t(dictionary, "onboarding.objective.previewTitle")}
              </Text>
              <Text style={[styles.previewText, { color: userTokens.textPrimary }]}>
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
              <Text style={[styles.skipText, { color: userTokens.textSecondary }]}>
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
  objectiveCard: {
    marginTop: 18,
    borderWidth: 1.5,
    borderRadius: onboardingRadii.lg,
    padding: 18,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: "600",
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
  },
  amountInput: {
    flex: 1,
    fontSize: 28,
    fontWeight: "700",
  },
  errorText: {
    fontSize: 12,
    marginTop: 6,
  },
  previewCard: {
    marginTop: 16,
    borderWidth: 1,
    borderRadius: onboardingRadii.sm,
    padding: 14,
  },
  previewTitle: {
    fontSize: 12,
    fontWeight: "600",
    marginBottom: 6,
  },
  previewText: {
    fontSize: 12,
  },
  timelineRow: {
    flexDirection: "row",
    gap: 8,
    flexWrap: "wrap",
  },
  timelineButton: {
    borderWidth: 1.5,
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  timelineText: {
    fontSize: 12,
    fontWeight: "500",
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
  },
});
