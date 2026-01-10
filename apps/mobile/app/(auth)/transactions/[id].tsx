import { useEffect, useState, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
  Platform,
  TouchableOpacity,
} from "react-native";
import { useIsFocused } from "@react-navigation/native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Picker } from "@react-native-picker/picker";
import { supabase } from "../../../src/lib/supabase";
import { useAuth } from "../../../src/contexts/AuthContext";
import { Button } from "../../../src/components/Button";
import { Input } from "../../../src/components/Input";
import { Card } from "../../../src/components/Card";
import { DatePickerField } from "../../../src/components/DatePickerField";
import {
  type TransactionType,
  CURRENCIES,
  parseMoneyToMinor,
  computeAmountBaseMinor,
  parseFxRate,
  CURRENCY_MINOR_UNITS,
  formatMinorToMoney,
} from "@poleursus/shared";
import { useCopy, t } from "../../../src/lib/i18n";

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
  fx_rate: string | null;
  fx_date: string | null;
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
  const { dictionary } = useCopy();
  const isFocused = useIsFocused();

  const [transaction, setTransaction] = useState<Transaction | null>(null);
  const [type, setType] = useState<TransactionType>("expense");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("EUR");
  const [fxRate, setFxRate] = useState("1");
  const [categoryId, setCategoryId] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [merchant, setMerchant] = useState("");
  const [notes, setNotes] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [categories, setCategories] = useState<Category[]>([]);
  const [baseCurrency, setBaseCurrency] = useState("EUR");
  const [fxRateError, setFxRateError] = useState<string | null>(null);

  const sanitizeNumericInput = (value: string) =>
    value.replace(/[^0-9.,]/g, "");

  useEffect(() => {
    if (isFocused) {
      loadTransaction();
      loadCategories();
      loadAccount();
    }
  }, [id, isFocused]);

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
        setAmount(
          formatMinorToMoney(
            BigInt(data.amount_minor),
            data.currency,
            CURRENCY_MINOR_UNITS
          )
        );
        setCurrency(data.currency);
        setFxRate(String(data.fx_rate) ?? "1");
        setCategoryId(data.category_id || "");
        setDate(data.date);
        setMerchant(data.merchant || "");
        setNotes(data.notes || "");
      }
    } catch (e: any) {
      console.error("Error loading transaction:", e);
      Alert.alert(
        t(dictionary, "common.errorTitle"),
        e?.message || t(dictionary, "transactions.loadError"),
        [
          {
            text: t(dictionary, "common.ok"),
            onPress: () => router.back(),
          },
        ]
      );
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
      Alert.alert(
        t(dictionary, "common.errorTitle"),
        t(dictionary, "transactions.amountRequired")
      );
      return;
    }

    if (!transaction) return;

    if (currency !== baseCurrency) {
      if (!fxRate.trim()) {
        setFxRateError(t(dictionary, "transactions.fxRateRequired"));
        return;
      }
      const parsedFx = parseFxRate(fxRate);
      if (typeof parsedFx === "object" && "error" in parsedFx) {
        setFxRateError(t(dictionary, parsedFx.error.key));
        return;
      }
    }

    setFxRateError(null);
    const fxRateValue =
      currency === baseCurrency ? "1" : fxRate.replace(",", ".");

    setIsSubmitting(true);

    try {
      // Parse amount to minor units
      const amountMinor = parseMoneyToMinor(
        amount,
        currency,
        CURRENCY_MINOR_UNITS
      );
      if (typeof amountMinor === "object" && "error" in amountMinor) {
        Alert.alert(
          t(dictionary, "common.errorTitle"),
          t(dictionary, amountMinor.error.key, amountMinor.error.params)
        );
        setIsSubmitting(false);
        return;
      }

      // Calculate amount_base_minor
      let amountBaseMinor: bigint;

      if (currency === baseCurrency) {
        amountBaseMinor = amountMinor;
      } else {
        const computed = computeAmountBaseMinor({
          amountMinor,
          currency,
          baseCurrency,
          fxRate: fxRateValue,
          currencyMeta: CURRENCY_MINOR_UNITS,
        });
        if (typeof computed === "object" && "error" in computed) {
          Alert.alert(
            t(dictionary, "common.errorTitle"),
            t(dictionary, computed.error.key)
          );
          setIsSubmitting(false);
          return;
        }
        amountBaseMinor = computed;
      }

      const { error } = await supabase
        .from("transactions")
        .update({
          type,
          amount_minor: amountMinor.toString(),
          currency,
          amount_base_minor: amountBaseMinor.toString(),
          fx_rate: fxRateValue,
          fx_date: date,
          category_id: categoryId || null,
          date,
          merchant: merchant.trim() || null,
          notes: notes.trim() || null,
        })
        .eq("id", transaction.id);

      if (error) throw error;

      Alert.alert(
        t(dictionary, "common.successTitle"),
        t(dictionary, "transactions.updateSuccess"),
        [
          {
            text: t(dictionary, "common.ok"),
            onPress: () => router.back(),
          },
        ]
      );
    } catch (e: any) {
      console.error("Error updating transaction:", e);
      Alert.alert(
        t(dictionary, "common.errorTitle"),
        e?.message || t(dictionary, "transactions.updateError")
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  // Filter categories by type
  const availableCategories = categories.filter((cat) => cat.type === type);
  const previewBaseAmount = useMemo(() => {
    if (currency === baseCurrency) return null;
    if (!amount.trim() || !fxRate.trim()) return null;

    const amountMinor = parseMoneyToMinor(
      amount,
      currency,
      CURRENCY_MINOR_UNITS
    );
    if (typeof amountMinor === "object" && "error" in amountMinor) {
      return null;
    }

    const computed = computeAmountBaseMinor({
      amountMinor,
      currency,
      baseCurrency,
      fxRate,
      currencyMeta: CURRENCY_MINOR_UNITS,
    });
    if (typeof computed === "object" && "error" in computed) {
      return null;
    }

    return formatMinorToMoney(computed, baseCurrency, CURRENCY_MINOR_UNITS);
  }, [amount, currency, baseCurrency, fxRate]);

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
        <Card
          title={t(dictionary, "transactions.notFoundTitle")}
          description={t(dictionary, "transactions.notFoundDescription")}
        >
          <Button title={t(dictionary, "transactions.goBack")} onPress={() => router.back()} />
        </Card>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Card
        title={t(dictionary, "transactions.edit.title")}
        description={t(dictionary, "transactions.edit.description")}
      >
        <View style={styles.form}>
          {/* Type - Pill Selector */}
          <View style={styles.field}>
            <Text style={styles.label}>{t(dictionary, "transactions.create.typeLabel")}</Text>
            <View style={styles.pillContainer}>
              <TouchableOpacity
                style={[
                  styles.pillButton,
                  type === "expense" ? styles.pillSelected : styles.pillUnselected,
                ]}
                onPress={() => {
                  setType("expense");
                  setCategoryId(""); // Reset category when type changes
                }}
              >
                <Text
                  style={[
                    styles.pillText,
                    type === "expense" ? styles.pillTextSelected : styles.pillTextUnselected,
                  ]}
                >
                  {t(dictionary, "transactions.create.typeExpense")}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.pillButton,
                  type === "income" ? styles.pillSelected : styles.pillUnselected,
                ]}
                onPress={() => {
                  setType("income");
                  setCategoryId(""); // Reset category when type changes
                }}
              >
                <Text
                  style={[
                    styles.pillText,
                    type === "income" ? styles.pillTextSelected : styles.pillTextUnselected,
                  ]}
                >
                  {t(dictionary, "transactions.create.typeIncome")}
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Amount */}
          <Input
            label={t(dictionary, "transactions.create.amountLabel")}
            value={amount}
            onChangeText={(value) => setAmount(sanitizeNumericInput(value))}
            placeholder={t(dictionary, "transactions.create.amountPlaceholder")}
            keyboardType="numeric"
          />

          {/* Currency */}
          <View style={styles.field}>
            <Text style={styles.label}>{t(dictionary, "transactions.create.currencyLabel")}</Text>
            <View style={styles.pickerContainer}>
              <Picker
                selectedValue={currency}
                onValueChange={(value) => {
                  setCurrency(value);
                  if (value === baseCurrency) {
                    setFxRate("1");
                    setFxRateError(null);
                  }
                }}
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

          {currency !== baseCurrency && (
            <>
              <Input
                label={t(dictionary, "transactions.fxRateLabel")}
                value={fxRate}
                onChangeText={(value) => {
                  setFxRateError(null);
                  setFxRate(sanitizeNumericInput(value));
                }}
                placeholder={t(dictionary, "transactions.fxRatePlaceholder")}
                keyboardType="numeric"
                error={fxRateError ?? undefined}
                helperText={t(dictionary, "transactions.fxRateHelper", {
                  currency,
                  baseCurrency,
                })}
              />
              <Text style={styles.previewText}>
                {t(dictionary, "transactions.baseAmountPreview", {
                  amount: previewBaseAmount ?? "-",
                  baseCurrency,
                })}
              </Text>
            </>
          )}

          {/* Date */}
          <DatePickerField
            label={t(dictionary, "transactions.create.dateLabel")}
            value={date}
            onChangeText={setDate}
            placeholder={t(dictionary, "transactions.datePlaceholder")}
          />

          {/* Category */}
          <View style={styles.field}>
            <Text style={styles.label}>{t(dictionary, "transactions.categoryOptionalLabel")}</Text>
            <View style={styles.pickerContainer}>
              <Picker
                selectedValue={categoryId}
                onValueChange={(value) => setCategoryId(value)}
                style={styles.picker}
              >
                <Picker.Item label={t(dictionary, "common.noneOption")} value="" />
                {availableCategories.length === 0 ? (
                  <Picker.Item
                    label={t(dictionary, "transactions.create.categoryEmpty", {
                      type:
                        type === "income"
                          ? t(dictionary, "categories.incomeLabel")
                          : t(dictionary, "categories.expenseLabel"),
                    })}
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
            label={t(dictionary, "transactions.merchantOptionalLabel")}
            value={merchant}
            onChangeText={setMerchant}
            placeholder={t(dictionary, "transactions.create.merchantPlaceholder")}
          />

          {/* Notes */}
          <Input
            label={t(dictionary, "transactions.notesOptionalLabel")}
            value={notes}
            onChangeText={setNotes}
            placeholder={t(dictionary, "transactions.notesPlaceholder")}
            multiline
            numberOfLines={3}
          />

          <View style={styles.actions}>
            <View style={{ flex: 1 }}>
              <Button
                title={t(dictionary, "common.cancel")}
                onPress={() => router.back()}
                variant="secondary"
                disabled={isSubmitting}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Button
                title={
                  isSubmitting
                    ? t(dictionary, "common.saving")
                    : t(dictionary, "transactions.saveChanges")
                }
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

// Finnon Color Tokens (color-guide.md)
const colors = {
  bg: {
    primary: "#FFFFFF",
    secondary: "#F7F8FA",
    surface: "#FFFFFF",
  },
  text: {
    primary: "#1C1E21",
    secondary: "#5F6368",
    muted: "#9AA0A6",
  },
  action: {
    primary: "#5B8DFF",
    secondary: "#E8EEFF",
    disabled: "#C7D2FE",
  },
  state: {
    positive: "#2E7D65",
    negative: "#B23B3B",
    neutral: "#DADCE0",
  },
};

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  container: {
    flex: 1,
    backgroundColor: colors.bg.primary,
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
    color: colors.text.primary,
  },
  previewText: {
    fontSize: 12,
    color: colors.text.secondary,
  },
  // Pill selector styles
  pillContainer: {
    flexDirection: "row",
    gap: 8,
  },
  pillButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  pillSelected: {
    backgroundColor: colors.action.primary,
    borderColor: colors.action.primary,
  },
  pillUnselected: {
    backgroundColor: colors.bg.primary,
    borderColor: colors.state.neutral,
  },
  pillText: {
    fontSize: 14,
    fontWeight: "600",
  },
  pillTextSelected: {
    color: "#FFFFFF",
  },
  pillTextUnselected: {
    color: colors.text.primary,
  },
  pickerContainer: {
    borderWidth: 1,
    borderColor: colors.state.neutral,
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
