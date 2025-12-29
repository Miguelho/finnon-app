import { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  Platform,
} from "react-native";
import { useRouter } from "expo-router";
import { Picker } from "@react-native-picker/picker";
import { supabase } from "../../../src/lib/supabase";
import { useAuth } from "../../../src/contexts/AuthContext";
import { Button } from "../../../src/components/Button";
import { Input } from "../../../src/components/Input";
import { Card } from "../../../src/components/Card";
import {
  type TransactionType,
  CURRENCIES,
  parseMoneyToMinor,
  convertCurrency,
} from "@poleursus/shared";

type Category = {
  id: string;
  name: string;
  icon_id: string;
  type: "income" | "expense";
};

export default function CreateTransactionScreen(): React.JSX.Element {
  const router = useRouter();
  const { selectedAccountId } = useAuth();

  const [type, setType] = useState<TransactionType>("expense");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("EUR");
  const [categoryId, setCategoryId] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [merchant, setMerchant] = useState("");
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [categories, setCategories] = useState<Category[]>([]);
  const [baseCurrency, setBaseCurrency] = useState("EUR");

  useEffect(() => {
    loadCategories();
    loadAccount();
  }, [selectedAccountId]);

  const loadCategories = async () => {
    if (!selectedAccountId) return;

    try {
      const { data, error } = await supabase
        .from("categories")
        .select("*")
        .eq("account_id", selectedAccountId)
        .order("name", { ascending: true });

      if (error) throw error;

      setCategories(data || []);
    } catch (e: any) {
      console.error("Error loading categories:", e);
    }
  };

  const loadAccount = async () => {
    if (!selectedAccountId) return;

    try {
      const { data, error } = await supabase
        .from("accounts")
        .select("base_currency")
        .eq("id", selectedAccountId)
        .single();

      if (error) throw error;

      setBaseCurrency(data.base_currency);
      setCurrency(data.base_currency); // Default to base currency
    } catch (e: any) {
      console.error("Error loading account:", e);
    }
  };

  const handleCreate = async () => {
    if (!amount.trim()) {
      Alert.alert("Error", "Please enter an amount");
      return;
    }

    if (!selectedAccountId) {
      Alert.alert("Error", "No active account selected");
      return;
    }

    setIsSubmitting(true);

    try {
      // Parse amount to minor units
      const amountMinor = parseMoneyToMinor(amount, currency);
      if (typeof amountMinor === "object" && "error" in amountMinor) {
        Alert.alert("Error", amountMinor.error);
        setIsSubmitting(false);
        return;
      }

      // Calculate amount_base_minor
      let amountBaseMinor: bigint;
      const fxRate = 1; // v1 simple: always 1 (same currency or manual)

      if (currency === baseCurrency) {
        amountBaseMinor = amountMinor;
      } else {
        // For v1, if currency differs, we'll use 1:1 conversion
        // This should be improved in the future with real FX rates
        amountBaseMinor = convertCurrency(
          amountMinor,
          currency,
          baseCurrency,
          fxRate
        );
      }

      // Get current user
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        Alert.alert("Error", "Not authenticated");
        setIsSubmitting(false);
        return;
      }

      const { data, error } = await supabase
        .from("transactions")
        .insert([
          {
            account_id: selectedAccountId,
            type,
            amount_minor: amountMinor.toString(),
            currency,
            amount_base_minor: amountBaseMinor.toString(),
            category_id: categoryId || null,
            date,
            merchant: merchant.trim() || null,
            notes: notes.trim() || null,
            created_by: user.id,
          },
        ])
        .select()
        .single();

      if (error) throw error;

      Alert.alert("Success", "Transaction created successfully", [
        {
          text: "OK",
          onPress: () => router.back(),
        },
      ]);
    } catch (e: any) {
      console.error("Error creating transaction:", e);
      Alert.alert("Error", e?.message || "Failed to create transaction");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Filter categories by type
  const availableCategories = categories.filter((cat) => cat.type === type);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Card
        title="New Transaction"
        description="Record a new income or expense transaction"
      >
        <View style={styles.form}>
          {/* Type */}
          <View style={styles.field}>
            <Text style={styles.label}>Type</Text>
            <View style={styles.pickerContainer}>
              <Picker
                selectedValue={type}
                onValueChange={(value) => {
                  setType(value as TransactionType);
                  setCategoryId(""); // Reset category when type changes
                }}
                style={styles.picker}
              >
                <Picker.Item label="Expense" value="expense" />
                <Picker.Item label="Income" value="income" />
              </Picker>
            </View>
          </View>

          {/* Amount */}
          <Input
            label="Amount"
            value={amount}
            onChangeText={setAmount}
            placeholder="0.00"
            keyboardType="numeric"
          />

          {/* Currency */}
          <View style={styles.field}>
            <Text style={styles.label}>Currency</Text>
            <View style={styles.pickerContainer}>
              <Picker
                selectedValue={currency}
                onValueChange={(value) => setCurrency(value)}
                style={styles.picker}
              >
                {CURRENCIES.map((curr) => (
                  <Picker.Item
                    key={curr.code}
                    label={`${curr.code} - ${curr.name}`}
                    value={curr.code}
                  />
                ))}
              </Picker>
            </View>
          </View>

          {/* Date */}
          <Input
            label="Date"
            value={date}
            onChangeText={setDate}
            placeholder="YYYY-MM-DD"
          />

          {/* Category */}
          <View style={styles.field}>
            <Text style={styles.label}>Category (optional)</Text>
            <View style={styles.pickerContainer}>
              <Picker
                selectedValue={categoryId}
                onValueChange={(value) => setCategoryId(value)}
                style={styles.picker}
              >
                <Picker.Item label="None" value="" />
                {availableCategories.length === 0 ? (
                  <Picker.Item
                    label={`No ${type} categories yet`}
                    value=""
                    enabled={false}
                  />
                ) : (
                  availableCategories.map((cat) => (
                    <Picker.Item
                      key={cat.id}
                      label={cat.name}
                      value={cat.id}
                    />
                  ))
                )}
              </Picker>
            </View>
          </View>

          {/* Merchant */}
          <Input
            label="Merchant (optional)"
            value={merchant}
            onChangeText={setMerchant}
            placeholder="e.g., Starbucks"
          />

          {/* Notes */}
          <Input
            label="Notes (optional)"
            value={notes}
            onChangeText={setNotes}
            placeholder="Add any additional notes"
            multiline
            numberOfLines={3}
          />

          <View style={styles.actions}>
            <View style={{ flex: 1 }}>
              <Button
                title="Cancel"
                onPress={() => router.back()}
                variant="secondary"
                disabled={isSubmitting}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Button
                title={isSubmitting ? "Creating..." : "Create"}
                onPress={handleCreate}
                disabled={isSubmitting}
              />
            </View>
          </View>
        </View>
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  content: {
    padding: 16,
  },
  form: {
    gap: 16,
  },
  field: {
    gap: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: "#333",
  },
  pickerContainer: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    overflow: "hidden",
  },
  picker: {
    height: Platform.OS === "ios" ? 150 : 50,
  },
  actions: {
    flexDirection: "row",
    gap: 12,
    marginTop: 8,
  },
});
