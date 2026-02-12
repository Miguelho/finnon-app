import { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
} from "react-native";
import { useRouter } from "expo-router";
import { Picker } from "@react-native-picker/picker";
import { supabase } from "../../../src/lib/supabase";
import { useAuth } from "../../../src/contexts/AuthContext";
import { useUserTheme } from "../../../src/contexts/UserThemeContext";
import { Button } from "../../../src/components/Button";
import { Input } from "../../../src/components/Input";
import { Card } from "../../../src/components/Card";
import { DatePickerField } from "../../../src/components/DatePickerField";
import {
  parseMoneyToMinor,
  CURRENCY_MINOR_UNITS,
  themeTokens,
  upsertObligationTransaction,
} from "@poleursus/shared";
import { useCopy, t } from "../../../src/lib/i18n";

const tokens = themeTokens.light;
const colors = tokens.colors;

export default function CreateObligationScreen(): React.JSX.Element {
  const router = useRouter();
  const { selectedAccountId } = useAuth();
  const { tokens: userThemeTokens } = useUserTheme();
  const { dictionary } = useCopy();

  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [dueDate, setDueDate] = useState(new Date().toISOString().slice(0, 10));
  const [status, setStatus] = useState<"pending" | "paid">("pending");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [baseCurrency, setBaseCurrency] = useState("EUR");

  useEffect(() => {
    loadAccount();
  }, [selectedAccountId]);

  const sanitizeNumericInput = (value: string) =>
    value.replace(/[^0-9.,]/g, "");

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

  const handleCreate = async () => {
    if (!name.trim()) {
      Alert.alert(
        t(dictionary, "common.errorTitle"),
        t(dictionary, "obligations.create.nameRequired")
      );
      return;
    }
    if (!amount.trim()) {
      Alert.alert(
        t(dictionary, "common.errorTitle"),
        t(dictionary, "obligations.create.amountRequired")
      );
      return;
    }
    if (!dueDate.trim()) {
      Alert.alert(
        t(dictionary, "common.errorTitle"),
        t(dictionary, "obligations.create.dueDateRequired")
      );
      return;
    }
    if (!selectedAccountId) {
      Alert.alert(
        t(dictionary, "common.errorTitle"),
        t(dictionary, "transactions.noAccountSelected")
      );
      return;
    }

    setIsSubmitting(true);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        Alert.alert(
          t(dictionary, "common.errorTitle"),
          t(dictionary, "transactions.notAuthenticated")
        );
        setIsSubmitting(false);
        return;
      }

      const amountMinor = parseMoneyToMinor(
        amount,
        baseCurrency,
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

      const paidAt =
        status === "paid" ? new Date().toISOString().slice(0, 10) : null;

      const { data: created, error } = await supabase
        .from("obligations")
        .insert([
          {
            account_id: selectedAccountId,
            name: name.trim(),
            amount_minor: amountMinor.toString(),
            amount_base_minor: amountMinor.toString(),
            currency: baseCurrency,
            due_date: dueDate,
            status,
            paid_at: paidAt,
            created_by: user.id,
          },
        ])
        .select()
        .single();

      if (error) throw error;

      if (status === "paid" && created) {
        await upsertObligationTransaction(supabase, created as any);
      }

      Alert.alert(
        t(dictionary, "common.successTitle"),
        t(dictionary, "obligations.create.success"),
        [
          {
            text: t(dictionary, "common.ok"),
            onPress: () => router.back(),
          },
        ]
      );
    } catch (e: any) {
      console.error("Error creating obligation:", e);
      Alert.alert(
        t(dictionary, "common.errorTitle"),
        e?.message || t(dictionary, "obligations.create.error")
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: userThemeTokens.background }]}
      contentContainerStyle={styles.content}
    >
      <Card
        title={t(dictionary, "obligations.create.title")}
        description={t(dictionary, "obligations.create.description")}
      >
        <View style={styles.form}>
          <Input
            label={t(dictionary, "obligations.create.nameLabel")}
            value={name}
            onChangeText={setName}
            placeholder={t(dictionary, "obligations.create.namePlaceholder")}
          />

          <Input
            label={t(dictionary, "obligations.create.amountLabel")}
            value={amount}
            onChangeText={(value) => setAmount(sanitizeNumericInput(value))}
            placeholder={t(dictionary, "obligations.create.amountPlaceholder")}
            keyboardType="numeric"
            helperText={t(dictionary, "obligations.create.currencyHelper", {
              currency: baseCurrency,
            })}
          />

          <DatePickerField
            label={t(dictionary, "obligations.create.dueDateLabel")}
            value={dueDate}
            onChangeText={setDueDate}
            placeholder={t(dictionary, "transactions.datePlaceholder")}
          />

          <View style={styles.field}>
            <Text style={styles.label}>{t(dictionary, "obligations.create.statusLabel")}</Text>
            <View style={styles.pickerContainer}>
              <Picker
                selectedValue={status}
                onValueChange={(value) =>
                  setStatus(value as "pending" | "paid")
                }
                style={styles.picker}
              >
                <Picker.Item
                  label={t(dictionary, "obligations.create.statusPending")}
                  value="pending"
                />
                <Picker.Item
                  label={t(dictionary, "obligations.create.statusPaid")}
                  value="paid"
                />
              </Picker>
            </View>
            <Text style={styles.helper}>
              {t(dictionary, "obligations.create.statusHelper")}
            </Text>
          </View>

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
                    ? t(dictionary, "common.creating")
                    : t(dictionary, "common.create")
                }
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
  },
  content: {
    padding: tokens.spacing.lg,
  },
  form: {
    gap: tokens.spacing.md,
  },
  field: {
    gap: tokens.spacing.xs,
  },
  label: {
    fontSize: tokens.typography.size.sm,
    fontWeight: "600",
    color: colors.text.primary,
  },
  helper: {
    fontSize: tokens.typography.size.xs,
    color: colors.text.secondary,
  },
  pickerContainer: {
    borderWidth: 1,
    borderColor: colors.state.neutral,
    borderRadius: tokens.radii.md,
    backgroundColor: colors.bg.secondary,
    overflow: "hidden",
  },
  picker: {
    height: 44,
  },
  actions: {
    flexDirection: "row",
    gap: tokens.spacing.md,
    marginTop: tokens.spacing.sm,
  },
});
