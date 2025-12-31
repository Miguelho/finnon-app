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
import { supabase } from "../../src/lib/supabase";
import { Card } from "../../src/components/Card";
import { Input } from "../../src/components/Input";
import { Button } from "../../src/components/Button";
import { CURRENCIES } from "@poleursus/shared";
import { useAuth } from "../../src/contexts/AuthContext";
import { useCopy, t } from "../../src/lib/i18n";

export default function OnboardingScreen() {
  const [accountName, setAccountName] = useState("");
  const [currency, setCurrency] = useState("EUR");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { user, setSelectedAccountId, signOut } = useAuth();
  const router = useRouter();
  const { dictionary } = useCopy();

  const handleCreateAccount = async () => {
    if (!accountName || !currency) {
      setError(t(dictionary, "mobile.onboarding.errorRequired"));
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
      // Create account (trigger auto-adds owner as admin)
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

      // Set the newly created account as the selected account
      await setSelectedAccountId(account.id);

      // Navigate to home
      router.replace("/");
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

      setError(err instanceof Error ? err.message : t(dictionary, "mobile.onboarding.createError"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Card
          title={t(dictionary, "mobile.onboarding.title")}
          description={t(dictionary, "mobile.onboarding.description")}
        >
          <Input
            label={t(dictionary, "mobile.onboarding.accountNameLabel")}
            value={accountName}
            onChangeText={setAccountName}
            placeholder={t(dictionary, "mobile.onboarding.accountNamePlaceholder")}
            maxLength={255}
            disabled={loading}
            helperText={t(dictionary, "mobile.onboarding.accountNameHelper")}
          />

          <View style={styles.pickerContainer}>
            <Text style={styles.pickerLabel}>{t(dictionary, "mobile.onboarding.currencyLabel")}</Text>
            <View style={styles.pickerWrapper}>
              <Picker
                selectedValue={currency}
                onValueChange={(itemValue) => setCurrency(itemValue)}
                enabled={!loading}
                style={styles.picker}
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
            <Text style={styles.helperText}>
              {t(dictionary, "mobile.onboarding.currencyHelper")}
            </Text>
          </View>

          {error && (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          <Button
            title={t(dictionary, "mobile.onboarding.submitButton")}
            onPress={handleCreateAccount}
            disabled={loading || !accountName}
            loading={loading}
          />
        </Card>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
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
    color: "#000",
  },
  pickerWrapper: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    backgroundColor: "#fff",
  },
  picker: {
    height: 50,
  },
  helperText: {
    color: "#666",
    fontSize: 12,
    marginTop: 4,
  },
  errorContainer: {
    backgroundColor: "#ffe6e6",
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  errorText: {
    color: "#ff3b30",
    fontSize: 14,
  },
});
