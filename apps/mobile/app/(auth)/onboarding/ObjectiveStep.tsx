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
  DEFAULT_PROJECT_EMOJI,
  parseMoneyToMinor,
  PROJECT_EMOJI_SUGGESTIONS,
  PROJECT_PALETTE,
  type OnboardingFirstProjectInput,
} from "@poleursus/shared";
import { OnboardingProgress } from "./OnboardingProgress";
import { OnboardingSurface } from "./OnboardingSurface";
import { onboardingRadii } from "./onboarding-theme";

interface ObjectiveStepProps {
  currency: string;
  name: string;
  emoji: string;
  color: string;
  targetAmount: string;
  monthlyCommitment: string;
  onNameChange: (value: string) => void;
  onEmojiChange: (value: string) => void;
  onColorChange: (value: string) => void;
  onTargetAmountChange: (value: string) => void;
  onMonthlyCommitmentChange: (value: string) => void;
  onContinue: (project: OnboardingFirstProjectInput) => void;
  onSkip: () => void;
  onBack: () => void;
}

const sanitizeNumericInput = (value: string) => value.replace(/[^0-9.,]/g, "");

export function ObjectiveStep({
  currency,
  name,
  emoji,
  color,
  targetAmount,
  monthlyCommitment,
  onNameChange,
  onEmojiChange,
  onColorChange,
  onTargetAmountChange,
  onMonthlyCommitmentChange,
  onContinue,
  onSkip,
  onBack,
}: ObjectiveStepProps) {
  const { dictionary } = useCopy();
  const { tokens: userTokens } = useUserTheme();

  const currencySymbol = useMemo(
    () => CURRENCIES.find((curr) => curr.code === currency)?.symbol ?? currency,
    [currency]
  );
  const selectedEmoji = emoji.trim() || DEFAULT_PROJECT_EMOJI;
  const selectedColor = PROJECT_PALETTE.includes(color as (typeof PROJECT_PALETTE)[number])
    ? color
    : PROJECT_PALETTE[0];

  const parsedTarget = targetAmount.trim()
    ? parseMoneyToMinor(targetAmount, currency)
    : null;
  const parsedCommitment = monthlyCommitment.trim()
    ? parseMoneyToMinor(monthlyCommitment, currency)
    : null;

  const targetValid = parsedTarget !== null && typeof parsedTarget !== "object" && parsedTarget > 0n;
  const commitmentValid =
    parsedCommitment !== null &&
    typeof parsedCommitment !== "object" &&
    parsedCommitment > 0n;
  const hasName = name.trim().length > 0;
  const canContinue = hasName && targetValid && commitmentValid;

  const handleContinue = () => {
    if (!canContinue) return;
    if (typeof parsedTarget === "object" || typeof parsedCommitment === "object") return;
    if (parsedTarget === null || parsedCommitment === null) return;

    onContinue({
      name: name.trim(),
      emoji: selectedEmoji,
      color: selectedColor,
      targetAmountMinor: Number(parsedTarget),
      monthlyCommitmentMinor: Number(parsedCommitment),
    });
  };

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
          <OnboardingProgress current="project" />
          <View style={styles.header}>
            <Text style={[styles.title, { color: userTokens.textPrimary }]}>
              {t(dictionary, "onboarding.project.title")}
            </Text>
            <Text style={[styles.subtitle, { color: userTokens.textSecondary }]}>
              {t(dictionary, "onboarding.project.subtitle")}
            </Text>
          </View>

          <View
            style={[
              styles.projectCard,
              {
                borderColor: userTokens.border,
                backgroundColor: userTokens.surfaceAlt,
              },
            ]}
          >
            <Text style={[styles.sectionLabel, { color: userTokens.textSecondary }]}>
              {t(dictionary, "onboarding.project.nameLabel")}
            </Text>
            <TextInput
              style={[
                styles.input,
                {
                  color: userTokens.textPrimary,
                  borderColor: userTokens.border,
                  backgroundColor: userTokens.surface,
                },
              ]}
              value={name}
              onChangeText={onNameChange}
              placeholder={t(dictionary, "onboarding.project.namePlaceholder")}
              placeholderTextColor={userTokens.textTertiary}
            />

            <Text style={[styles.sectionLabel, { color: userTokens.textSecondary }]}>
              {t(dictionary, "onboarding.project.emojiLabel")}
            </Text>
            <View style={styles.pickerRow}>
              {PROJECT_EMOJI_SUGGESTIONS.map((emojiOption) => {
                const isSelected = selectedEmoji === emojiOption;
                return (
                  <TouchableOpacity
                    key={emojiOption}
                    onPress={() => onEmojiChange(emojiOption)}
                    style={[
                      styles.emojiOption,
                      {
                        borderColor: isSelected ? userTokens.primary : userTokens.border,
                        backgroundColor: isSelected ? `${userTokens.primary}1A` : userTokens.surface,
                      },
                    ]}
                    accessibilityRole="button"
                    accessibilityLabel={emojiOption}
                  >
                    <Text style={styles.emojiOptionText}>{emojiOption}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={[styles.sectionLabel, { color: userTokens.textSecondary }]}>
              {t(dictionary, "projects.colorLabel")}
            </Text>
            <View style={styles.pickerRow}>
              {PROJECT_PALETTE.map((paletteColor) => {
                const isSelected = selectedColor === paletteColor;
                return (
                  <TouchableOpacity
                    key={paletteColor}
                    onPress={() => onColorChange(paletteColor)}
                    style={[
                      styles.colorOption,
                      {
                        backgroundColor: paletteColor,
                        borderColor: isSelected ? userTokens.textPrimary : userTokens.border,
                        borderWidth: isSelected ? 2 : 1,
                      },
                    ]}
                    accessibilityRole="button"
                    accessibilityLabel={`${t(dictionary, "projects.colorLabel")} ${paletteColor}`}
                  >
                    {isSelected ? <View style={styles.colorInnerDot} /> : null}
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={[styles.sectionLabel, { color: userTokens.textSecondary }]}>
              {t(dictionary, "onboarding.project.targetLabel")}
            </Text>
            <View style={styles.amountRow}>
              <Text style={[styles.currencySymbol, { color: userTokens.textTertiary }]}>
                {currencySymbol}
              </Text>
              <TextInput
                style={[styles.amountInput, { color: userTokens.textPrimary }]}
                value={targetAmount}
                onChangeText={(value) => onTargetAmountChange(sanitizeNumericInput(value))}
                keyboardType="decimal-pad"
                placeholder="25000"
                placeholderTextColor={userTokens.textTertiary}
              />
            </View>

            <Text style={[styles.sectionLabel, { color: userTokens.textSecondary }]}>
              {t(dictionary, "onboarding.project.commitmentLabel")}
            </Text>
            <View style={styles.amountRow}>
              <Text style={[styles.currencySymbol, { color: userTokens.textTertiary }]}>
                {currencySymbol}
              </Text>
              <TextInput
                style={[styles.amountInput, { color: userTokens.textPrimary }]}
                value={monthlyCommitment}
                onChangeText={(value) =>
                  onMonthlyCommitmentChange(sanitizeNumericInput(value))
                }
                keyboardType="decimal-pad"
                placeholder="200"
                placeholderTextColor={userTokens.textTertiary}
              />
            </View>
          </View>

          <View style={styles.actions}>
            <Button
              title={t(dictionary, "onboarding.project.continue")}
              onPress={handleContinue}
              disabled={!canContinue}
            />
            <TouchableOpacity onPress={onSkip} style={styles.skipLink}>
              <Text style={[styles.skipText, { color: userTokens.textSecondary }]}>
                {t(dictionary, "onboarding.project.skip")}
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
  projectCard: {
    marginTop: 18,
    borderWidth: 1.5,
    borderRadius: onboardingRadii.lg,
    padding: 18,
    gap: 10,
  },
  sectionLabel: {
    marginTop: 4,
    fontSize: 11,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    fontWeight: "500",
  },
  pickerRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  emojiOption: {
    width: 38,
    height: 38,
    borderRadius: onboardingRadii.sm,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  emojiOptionText: {
    fontSize: 20,
    lineHeight: 22,
  },
  colorOption: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
  },
  colorInnerDot: {
    width: 9,
    height: 9,
    borderRadius: 4.5,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.9)",
  },
  amountRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  currencySymbol: {
    fontSize: 24,
    fontWeight: "700",
  },
  amountInput: {
    flex: 1,
    fontSize: 24,
    fontWeight: "700",
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
