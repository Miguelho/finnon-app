import { useEffect, useState } from "react";
import {
  View,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
} from "react-native";
import { Picker } from "@react-native-picker/picker";
import { Input } from "../../../src/components/Input";
import { Button } from "../../../src/components/Button";
import { CURRENCIES } from "@poleursus/shared";
import { useUserTheme } from "../../../src/contexts/UserThemeContext";
import { useCopy, t } from "../../../src/lib/i18n";
import { OnboardingSurface } from "./OnboardingSurface";

interface CreateAccountStepProps {
  initialAccountName: string;
  initialCurrency: string;
  onContinue: (accountName: string, currency: string) => void;
  onBack?: () => void;
}

export function CreateAccountStep({
  initialAccountName,
  initialCurrency,
  onContinue,
  onBack,
}: CreateAccountStepProps) {
  const [accountName, setAccountName] = useState(initialAccountName);
  const [currency, setCurrency] = useState(initialCurrency || "EUR");
  const [error, setError] = useState<string | null>(null);
  const { tokens: userTokens } = useUserTheme();
  const { dictionary } = useCopy();

  useEffect(() => {
    setAccountName(initialAccountName);
  }, [initialAccountName]);

  useEffect(() => {
    setCurrency(initialCurrency || "EUR");
  }, [initialCurrency]);

  const handleContinue = () => {
    const normalizedName = accountName.trim();
    if (!normalizedName || !currency) {
      setError(t(dictionary, "errors.onboardingMissingFields"));
      return;
    }
    setError(null);
    onContinue(normalizedName, currency);
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
            {onBack ? (
              <Button
                title={t(dictionary, "common.back")}
                onPress={onBack}
                variant="secondary"
              />
            ) : null}
            <Button
              title={t(dictionary, "common.continue")}
              onPress={handleContinue}
              disabled={!accountName.trim()}
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
