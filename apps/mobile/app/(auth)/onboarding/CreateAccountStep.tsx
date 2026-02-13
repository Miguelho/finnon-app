import { useState } from "react";
import {
  View,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
} from "react-native";
import { Picker } from "@react-native-picker/picker";
import { useRouter } from "expo-router";
import { supabase } from "../../../src/lib/supabase";
import { Input } from "../../../src/components/Input";
import { Button } from "../../../src/components/Button";
import { CURRENCIES } from "@poleursus/shared";
import { useAuth } from "../../../src/contexts/AuthContext";
import { useUserTheme } from "../../../src/contexts/UserThemeContext";
import { useCopy, t } from "../../../src/lib/i18n";
import { OnboardingSurface } from "./OnboardingSurface";

interface CreateAccountStepProps {
  onComplete: (accountId: string, currency: string) => void;
}

export function CreateAccountStep({ onComplete }: CreateAccountStepProps) {
  const [accountName, setAccountName] = useState("");
  const [currency, setCurrency] = useState("EUR");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { user, signOut } = useAuth();
  const { tokens: userTokens } = useUserTheme();
  const router = useRouter();
  const { dictionary } = useCopy();

  const handleCreateAccount = async () => {
    if (!accountName || !currency) {
      setError(t(dictionary, "errors.onboardingMissingFields"));
      return;
    }

    if (!user) {
      await signOut();
      router.replace("/(auth)/login");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { data: account, error: accountError } = await supabase
        .from("accounts")
        .insert({
          name: accountName,
          base_currency: currency,
          owner_user_id: user.id,
        })
        .select()
        .single();

      if (accountError) throw accountError;

      console.log("Account created successfully:", account.id);
      onComplete(account.id, currency);
    } catch (err) {
      console.error("Error creating account:", err);
      const errorCode =
        typeof err === "object" && err !== null && "code" in err ? (err as any).code : null;
      const errorStatus =
        typeof err === "object" && err !== null && "status" in err ? (err as any).status : null;
      const isAuthError =
        errorCode === "401" ||
        errorCode === "403" ||
        errorCode === "42501" ||
        errorCode === "23503" ||
        errorStatus === 401 ||
        errorStatus === 403;

      if (isAuthError) {
        await signOut();
        router.replace("/(auth)/login");
        return;
      }

      setError(
        err instanceof Error ? err.message : t(dictionary, "errors.internalServer")
      );
    } finally {
      setLoading(false);
    }
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
          <Text style={[styles.title, { color: userTokens.textPrimary }]}>
            {t(dictionary, "onboarding.title")}
          </Text>
          <Text style={[styles.subtitle, { color: userTokens.textSecondary }]}>
            {t(dictionary, "onboarding.description")}
          </Text>

          <Input
            label={t(dictionary, "onboarding.accountNameLabel")}
            value={accountName}
            onChangeText={setAccountName}
            placeholder={t(dictionary, "onboarding.accountNamePlaceholder")}
            maxLength={255}
            disabled={loading}
            helperText={t(dictionary, "onboarding.accountNameHelper")}
            inputStyle={{ backgroundColor: userTokens.surfaceAlt }}
          />

          <View style={styles.pickerContainer}>
            <Text style={[styles.pickerLabel, { color: userTokens.textPrimary }]}>
              {t(dictionary, "onboarding.currencyLabel")}
            </Text>
            <View
              style={[
                styles.pickerWrapper,
                {
                  borderColor: userTokens.border,
                  backgroundColor: userTokens.surfaceAlt,
                },
              ]}
            >
              <Picker
                selectedValue={currency}
                onValueChange={(itemValue) => setCurrency(itemValue)}
                enabled={!loading}
                style={[styles.picker, { color: userTokens.textPrimary }]}
                dropdownIconColor={userTokens.textSecondary}
              >
                {CURRENCIES.map((curr) => (
                  <Picker.Item
                    key={curr.code}
                    label={`${curr.symbol} ${curr.name} (${curr.code})`}
                    value={curr.code}
                  />
                ))}
              </Picker>
            </View>
            <Text style={[styles.helperText, { color: userTokens.textSecondary }]}>
              {t(dictionary, "onboarding.currencyHelper")}
            </Text>
          </View>

          {error && (
            <View
              style={[
                styles.errorContainer,
                {
                  backgroundColor: userTokens.dangerBackground,
                  borderColor: userTokens.dangerBorder,
                },
              ]}
            >
              <Text style={[styles.errorText, { color: userTokens.dangerText }]}>
                {error}
              </Text>
            </View>
          )}

          <View style={styles.actions}>
            <Button
              title={t(dictionary, "onboarding.submitButton")}
              onPress={handleCreateAccount}
              disabled={loading || !accountName}
              loading={loading}
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
  pickerContainer: {
    marginBottom: 16,
  },
  pickerLabel: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 8,
  },
  pickerWrapper: {
    borderWidth: 1,
    borderRadius: 8,
  },
  picker: {
    height: 50,
  },
  helperText: {
    fontSize: 12,
    marginTop: 4,
  },
  errorContainer: {
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    borderWidth: 1,
  },
  errorText: {
    fontSize: 14,
  },
  actions: {
    gap: 12,
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
  },
  subtitle: {
    fontSize: 14,
    marginBottom: 16,
  },
});
