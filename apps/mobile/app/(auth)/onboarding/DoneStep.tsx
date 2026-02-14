import { useMemo, useState } from "react";
import { View, StyleSheet, ScrollView, Text } from "react-native";
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Button } from "../../../src/components/Button";
import { useAuth } from "../../../src/contexts/AuthContext";
import { useCopy, t } from "../../../src/lib/i18n";
import { supabase } from "../../../src/lib/supabase";
import {
  CURRENCIES,
  formatMoneyWithSymbol,
  persistOnboarding,
  type DefaultCategory,
  type OnboardingGoalInput,
  type OnboardingPayload,
  type OnboardingRecurrentInput,
} from "@poleursus/shared";
import { OnboardingSurface } from "./OnboardingSurface";
import { onboardingColors, onboardingRadii } from "./onboarding-theme";
import { ONBOARDING_STORAGE_KEY } from "./state";

interface DoneStepProps {
  accountId: string | null;
  accountName: string;
  selectedCategories: DefaultCategory[];
  recurrents: OnboardingRecurrentInput[];
  goal: OnboardingGoalInput | null;
  currency: string;
  onAccountResolved: (accountId: string) => void;
}

export function DoneStep({
  accountId,
  accountName,
  selectedCategories,
  recurrents,
  goal,
  currency,
  onAccountResolved,
}: DoneStepProps) {
  const { dictionary, locale } = useCopy();
  const { user, setSelectedAccountId, signOut } = useAuth();
  const router = useRouter();
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resolvedAccountId, setResolvedAccountId] = useState<string | null>(
    accountId
  );

  const currencySymbol = useMemo(
    () => CURRENCIES.find((curr) => curr.code === currency)?.symbol ?? currency,
    [currency]
  );

  const formatSignedAmount = (rec: OnboardingRecurrentInput) => {
    const amount = formatMoneyWithSymbol(
      BigInt(rec.amountMinor),
      currency,
      currencySymbol
    );
    const sign = rec.type === "income" ? "+" : "-";
    return `${sign}${amount}`;
  };

  const handlePersist = async () => {
    if (isSaving) return;
    setIsSaving(true);
    setError(null);

    if (!user) {
      await signOut();
      setIsSaving(false);
      router.replace("/(auth)/login");
      return;
    }

    try {
      let targetAccountId = resolvedAccountId;
      if (!targetAccountId) {
        const normalizedName = accountName.trim();
        if (!normalizedName || !currency) {
          setError(t(dictionary, "errors.onboardingMissingFields"));
          setIsSaving(false);
          return;
        }

        const { data: account, error: accountError } = await supabase
          .from("accounts")
          .insert({
            name: normalizedName,
            base_currency: currency,
            owner_user_id: user.id,
          })
          .select("id")
          .single();

        if (accountError || !account) {
          throw accountError ?? new Error("Failed to create account");
        }

        targetAccountId = account.id;
        setResolvedAccountId(targetAccountId);
        onAccountResolved(targetAccountId);
      }
      if (!targetAccountId) {
        setError(t(dictionary, "errors.internalServer"));
        setIsSaving(false);
        return;
      }

      const payload: OnboardingPayload = {
        accountId: targetAccountId,
        selectedCategories,
        recurrents,
        goal,
      };

      const result = await persistOnboarding(
        supabase,
        payload,
        user.id,
        locale === "en" ? "en" : "es"
      );

      if (!result.success) {
        setError(result.error ?? t(dictionary, "errors.internalServer"));
        setIsSaving(false);
        return;
      }

      await AsyncStorage.removeItem(ONBOARDING_STORAGE_KEY);
      await setSelectedAccountId(targetAccountId);
      setIsSaving(false);
      router.replace("/(auth)/(tabs)/home");
    } catch (err) {
      console.error("Error persisting onboarding:", err);
      setError(t(dictionary, "errors.internalServer"));
      setIsSaving(false);
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <OnboardingSurface style={styles.surface}>
          <View style={styles.checkmark}>
            <Text style={styles.checkmarkText}>✓</Text>
          </View>
          <Text style={styles.title}>{t(dictionary, "onboarding.done.title")}</Text>
          <Text style={styles.subtitle}>{t(dictionary, "onboarding.done.subtitle")}</Text>

          <View style={styles.preview}>
            <Text style={styles.previewLabel}>
              {t(dictionary, "onboarding.done.thisWeek")}
            </Text>
            {recurrents.length === 0 ? (
              <Text style={styles.previewEmpty}>
                {t(dictionary, "common.noneOption")}
              </Text>
            ) : (
              recurrents.map((rec) => (
                <View key={rec.suggestedId} style={styles.previewRow}>
                  <View style={styles.previewLeft}>
                    <View
                      style={[
                        styles.previewDot,
                        rec.type === "income"
                          ? styles.dotIncome
                          : styles.dotExpense,
                      ]}
                    />
                    <Text style={styles.previewName}>{rec.label}</Text>
                  </View>
                  <Text
                    style={[
                      styles.previewAmount,
                      rec.type === "income" ? styles.amountIncome : styles.amountExpense,
                    ]}
                  >
                    {formatSignedAmount(rec)}
                  </Text>
                </View>
              ))
            )}
          </View>

          {goal && (
            <View style={styles.goalCard}>
              <Text style={styles.goalTitle}>
                {t(dictionary, "onboarding.objective.previewTitle")}
              </Text>
              <Text style={styles.goalText}>
                {t(dictionary, "onboarding.objective.previewText", {
                  amount: formatMoneyWithSymbol(
                    BigInt(goal.targetAmountMinor) / BigInt(goal.months),
                    currency,
                    currencySymbol
                  ),
                })}
              </Text>
            </View>
          )}

          <View style={styles.inviteCard}>
            <View style={styles.inviteIcon}>
              <Text style={styles.inviteIconText}>＋</Text>
            </View>
            <View style={styles.inviteTextBox}>
              <Text style={styles.inviteTitle}>
                {t(dictionary, "onboarding.done.inviteTitle")}
              </Text>
              <Text style={styles.inviteDesc}>
                {t(dictionary, "onboarding.done.inviteDesc")}
              </Text>
              <Text style={styles.inviteHint}>
                {t(dictionary, "onboarding.done.inviteHint")}
              </Text>
            </View>
          </View>

          {error && <Text style={styles.errorText}>{error}</Text>}

          <View style={styles.primaryAction}>
            <Button
              title={isSaving ? t(dictionary, "common.saving") : t(dictionary, "onboarding.done.goToApp")}
              onPress={handlePersist}
              disabled={isSaving}
            />
          </View>
        </OnboardingSurface>
      </ScrollView>
    </View>
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
  surface: {
    alignItems: "center",
  },
  checkmark: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: onboardingColors.greenBg,
    borderWidth: 2,
    borderColor: onboardingColors.greenBorder,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  checkmarkText: {
    fontSize: 28,
    color: onboardingColors.green,
    fontWeight: "700",
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
  preview: {
    marginTop: 20,
    width: "100%",
  },
  previewLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: onboardingColors.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  previewEmpty: {
    marginTop: 8,
    fontSize: 12,
    color: onboardingColors.textMuted,
  },
  previewRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: onboardingColors.border,
  },
  previewLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  previewDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  dotIncome: {
    backgroundColor: onboardingColors.green,
  },
  dotExpense: {
    backgroundColor: onboardingColors.red,
  },
  previewName: {
    fontSize: 13,
    fontWeight: "500",
    color: onboardingColors.text,
  },
  previewAmount: {
    fontSize: 13,
    fontWeight: "600",
  },
  amountIncome: {
    color: onboardingColors.green,
  },
  amountExpense: {
    color: onboardingColors.red,
  },
  goalCard: {
    marginTop: 16,
    width: "100%",
    borderWidth: 1,
    borderColor: onboardingColors.greenBorder,
    borderRadius: onboardingRadii.sm,
    padding: 12,
    backgroundColor: onboardingColors.greenBg,
  },
  goalTitle: {
    fontSize: 12,
    fontWeight: "600",
    color: onboardingColors.green,
    marginBottom: 4,
  },
  goalText: {
    fontSize: 12,
    color: onboardingColors.text,
  },
  inviteCard: {
    marginTop: 16,
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
    borderColor: onboardingColors.blueBorder,
    borderRadius: onboardingRadii.md,
    padding: 12,
    backgroundColor: onboardingColors.blueBg,
  },
  inviteIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: onboardingColors.white,
    borderWidth: 1,
    borderColor: onboardingColors.blueBorder,
    alignItems: "center",
    justifyContent: "center",
  },
  inviteIconText: {
    fontSize: 16,
    color: onboardingColors.blue,
  },
  inviteTextBox: {
    flex: 1,
  },
  inviteTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: onboardingColors.text,
  },
  inviteDesc: {
    fontSize: 11,
    color: onboardingColors.textSecondary,
  },
  inviteHint: {
    marginTop: 6,
    fontSize: 11,
    fontWeight: "600",
    color: onboardingColors.text,
  },
  errorText: {
    color: onboardingColors.red,
    fontSize: 12,
    marginTop: 10,
  },
  primaryAction: {
    marginTop: 16,
    width: "100%",
  },
});
