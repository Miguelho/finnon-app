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

export default function OnboardingScreen() {
  const [accountName, setAccountName] = useState("");
  const [currency, setCurrency] = useState("EUR");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { user, setSelectedAccountId } = useAuth();
  const router = useRouter();

  const handleCreateAccount = async () => {
    if (!accountName || !currency || !user) {
      setError("Nombre de cuenta y moneda son requeridos");
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
      setError(err instanceof Error ? err.message : "Error al crear la cuenta");
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
          title="Configura tu cuenta"
          description="Crea tu primera cuenta para comenzar a gestionar tus finanzas"
        >
          <Input
            label="Nombre de la cuenta"
            value={accountName}
            onChangeText={setAccountName}
            placeholder="Mi cuenta personal"
            maxLength={255}
            disabled={loading}
            helperText="Puedes cambiar esto más tarde"
          />

          <View style={styles.pickerContainer}>
            <Text style={styles.pickerLabel}>Moneda</Text>
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
              Esta será la moneda base de tu cuenta
            </Text>
          </View>

          {error && (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          <Button
            title="Crear cuenta"
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
