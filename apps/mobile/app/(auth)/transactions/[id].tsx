import { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
  Platform,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
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
  formatMinorToMoney,
} from "@poleursus/shared";

type Category = {
  id: string;
  name: string;
  icon_id: string;
  type: "income" | "expense";
};

type Transaction = {
  id: string;
  account_id: string;
  type: "income" | "expense";
  amount_minor: string;
  currency: string;
  amount_base_minor: string;
  category_id: string | null;
  date: string;
  merchant: string | null;
  notes: string | null;
  created_by: string;
  created_at: string;
};

export default function EditTransactionScreen(): React.JSX.Element {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const { selectedAccountId } = useAuth();

  const [transaction, setTransaction] = useState<Transaction | null>(null);
  const [type, setType] = useState<TransactionType>("expense");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("EUR");
  const [categoryId, setCategoryId] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [merchant, setMerchant] = useState("");
  const [notes, setNotes] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [categories, setCategories] = useState<Category[]>([]);
  const [baseCurrency, setBaseCurrency] = useState("EUR");

  useEffect(() => {
    loadTransaction();
    loadCategories();
    loadAccount();
  }, [id]);

  const loadTransaction = async () => {
    if (!id) return;

    setIsLoading(true);

    try {
      const { data, error } = await supabase
        .from("transactions")
        .select("*")
        .eq("id", id)
        .single();

      if (error) throw error;

      if (data) {
        setTransaction(data);
        setType(data.type);
        setAmount(formatMinorToMoney(BigInt(data.amount_minor), data.currency));
        setCurrency(data.currency);
        setCategoryId(data.category_id || "");
        setDate(data.date);
        setMerchant(data.merchant || "");
        setNotes(data.notes || "");
      }
    } catch (e: any) {
      console.error("Error loading transaction:", e);
      Alert.alert("Error", e?.message || "Failed to load transaction", [
        {
          text: "OK",
          onPress: () => router.back(),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

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
    } catch (e: any) {
      console.error("Error loading account:", e);
    }
  };

  const handleUpdate = async () => {
    if (!amount.trim()) {
      Alert.alert("Error", "Please enter an amount");
      return;
    }

    if (!transaction) return;

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
      const fxRate = 1; // v1 simple

      if (currency === baseCurrency) {
        amountBaseMinor = amountMinor;
      } else {
        amountBaseMinor = convertCurrency(
          amountMinor,
          currency,
          baseCurrency,
          fxRate
        );
      }

      const { error } = await supabase
        .from("transactions")
        .update({
          type,
          amount_minor: amountMinor.toString(),
          currency,
          amount_base_minor: amountBaseMinor.toString(),
          category_id: categoryId || null,
          date,
          merchant: merchant.trim() || null,
          notes: notes.trim() || null,
        })
        .eq("id", transaction.id);

      if (error) throw error;

      Alert.alert("Success", "Transaction updated successfully", [
        {
          text: "OK",
          onPress: () => router.back(),
        },
      ]);
    } catch (e: any) {
      console.error("Error updating transaction:", e);
      Alert.alert("Error", e?.message || "Failed to update transaction");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Filter categories by type
  const availableCategories = categories.filter((cat) => cat.type === type);

  if (isLoading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (!transaction) {
    return (
      <View style={styles.container}>
        <Card title="Error" description="Transaction not found">
          <Button title="Go Back" onPress={() => router.back()} />
        </Card>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Card title="Edit Transaction" description="Update the transaction details">
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
                    <Picker.Item key={cat.id} label={cat.name} value={cat.id} />
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
                title={isSubmitting ? "Saving..." : "Save Changes"}
                onPress={handleUpdate}
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
  loading: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
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
