import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, StyleSheet, View } from "react-native";
import { useIsFocused } from "@react-navigation/native";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  CURRENCY_MINOR_UNITS,
  computeAmountBaseMinor,
  formatMinorToMoney,
  parseFxRate,
  parseMoneyToMinor,
  type MerchantSuggestion,
  type TopCategory,
  type TransactionDraft,
} from "@poleursus/shared";
import { supabase } from "../../../src/lib/supabase";
import { useAuth } from "../../../src/contexts/AuthContext";
import { useCopy, t } from "../../../src/lib/i18n";
import { AddTransactionForm } from "../../../src/components/add-transaction";

interface Category {
  id: string;
  name: string;
  icon_id: string;
  type: "income" | "expense";
}

interface Transaction {
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
}

export default function EditTransactionScreen(): React.JSX.Element {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const isFocused = useIsFocused();
  const { selectedAccountId } = useAuth();
  const { dictionary } = useCopy();

  const transactionId = useMemo(() => {
    if (!id) return null;
    return Array.isArray(id) ? id[0] : id;
  }, [id]);

  const [transaction, setTransaction] = useState<Transaction | null>(null);
  const [initialDraft, setInitialDraft] = useState<TransactionDraft | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [topCategories, setTopCategories] = useState<{
    expense: TopCategory[];
    income: TopCategory[];
  }>({ expense: [], income: [] });
  const [merchantSuggestions, setMerchantSuggestions] = useState<{
    expense: MerchantSuggestion[];
    income: MerchantSuggestion[];
  }>({ expense: [], income: [] });
  const [baseCurrency, setBaseCurrency] = useState("EUR");
  const [isLoading, setIsLoading] = useState(true);

  const buildDraft = useCallback((row: Transaction): TransactionDraft => {
    const amountMinor = BigInt(row.amount_minor);
    return {
      type: row.type,
      name: "",
      date: row.date,
      amount: formatMinorToMoney(amountMinor, row.currency, CURRENCY_MINOR_UNITS),
      currency: row.currency,
      categoryId: row.category_id,
      merchant: row.merchant ?? "",
      notes: row.notes ?? "",
      photos: [],
      isObligation: false,
      obligationType: null,
      scheduledDate: null,
      scheduledDateOverridden: false,
    };
  }, []);

  useEffect(() => {
    if (!isFocused) return;
    if (!transactionId || !selectedAccountId) {
      setIsLoading(false);
      Alert.alert(
        t(dictionary, "common.errorTitle"),
        t(dictionary, "transactions.noAccountSelected"),
        [{ text: t(dictionary, "common.ok"), onPress: () => router.back() }]
      );
      return;
    }

    const loadData = async () => {
      setIsLoading(true);
      try {
        const [
          transactionResult,
          categoriesResult,
          accountResult,
          topExpenseResult,
          topIncomeResult,
          merchantExpenseResult,
          merchantIncomeResult,
        ] = await Promise.all([
          supabase
            .from("transactions")
            .select("*")
            .eq("id", transactionId)
            .single(),
          supabase
            .from("categories")
            .select("id, name, icon_id, type")
            .eq("account_id", selectedAccountId)
            .order("name", { ascending: true }),
          supabase
            .from("accounts")
            .select("base_currency")
            .eq("id", selectedAccountId)
            .single(),
          supabase.rpc("get_top_categories", {
            p_account_id: selectedAccountId,
            p_tx_type: "expense",
            p_limit: 3,
          }),
          supabase.rpc("get_top_categories", {
            p_account_id: selectedAccountId,
            p_tx_type: "income",
            p_limit: 3,
          }),
          supabase.rpc("get_merchant_suggestions", {
            p_account_id: selectedAccountId,
            p_tx_type: "expense",
            p_limit: 20,
          }),
          supabase.rpc("get_merchant_suggestions", {
            p_account_id: selectedAccountId,
            p_tx_type: "income",
            p_limit: 20,
          }),
        ]);

        if (transactionResult.error) throw transactionResult.error;
        if (categoriesResult.error) throw categoriesResult.error;
        if (accountResult.error) throw accountResult.error;

        const tx = transactionResult.data as Transaction | null;
        if (!tx) {
          throw new Error(t(dictionary, "transactions.loadError"));
        }

        setTransaction(tx);
        setInitialDraft(buildDraft(tx));
        setCategories((categoriesResult.data ?? []) as Category[]);
        setBaseCurrency(accountResult.data?.base_currency ?? "EUR");
        setTopCategories({
          expense: (topExpenseResult.data ?? []) as TopCategory[],
          income: (topIncomeResult.data ?? []) as TopCategory[],
        });
        setMerchantSuggestions({
          expense: (merchantExpenseResult.data ?? []) as MerchantSuggestion[],
          income: (merchantIncomeResult.data ?? []) as MerchantSuggestion[],
        });
      } catch (error: any) {
        console.error("Error loading transaction:", error);
        Alert.alert(
          t(dictionary, "common.errorTitle"),
          error?.message || t(dictionary, "transactions.loadError"),
          [{ text: t(dictionary, "common.ok"), onPress: () => router.back() }]
        );
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [
    buildDraft,
    dictionary,
    isFocused,
    router,
    selectedAccountId,
    transactionId,
  ]);

  const handleSubmitDraft = useCallback(
    async (draft: TransactionDraft) => {
      if (!transaction) {
        throw new Error(t(dictionary, "transactions.loadError"));
      }

      const amountMinorResult = parseMoneyToMinor(
        draft.amount,
        draft.currency,
        CURRENCY_MINOR_UNITS
      );
      if (typeof amountMinorResult === "object" && "error" in amountMinorResult) {
        throw new Error(
          t(dictionary, amountMinorResult.error.key, amountMinorResult.error.params)
        );
      }

      let amountBaseMinor: bigint;
      let fxRateValue = "1";

      if (draft.currency === baseCurrency) {
        amountBaseMinor = amountMinorResult;
      } else {
        const rawFx = transaction.fx_rate ?? "";
        if (!rawFx) {
          throw new Error(t(dictionary, "transactions.fxRateRequired"));
        }
        const parsedFx = parseFxRate(rawFx);
        if (typeof parsedFx === "object" && "error" in parsedFx) {
          throw new Error(t(dictionary, parsedFx.error.key));
        }
        fxRateValue = rawFx.replace(",", ".");

        const computed = computeAmountBaseMinor({
          amountMinor: amountMinorResult,
          currency: draft.currency,
          baseCurrency,
          fxRate: fxRateValue,
          currencyMeta: CURRENCY_MINOR_UNITS,
        });
        if (typeof computed === "object" && "error" in computed) {
          throw new Error(t(dictionary, computed.error.key));
        }
        amountBaseMinor = computed;
      }

      const { error } = await supabase
        .from("transactions")
        .update({
          type: draft.type,
          amount_minor: amountMinorResult.toString(),
          currency: draft.currency,
          amount_base_minor: amountBaseMinor.toString(),
          fx_rate: fxRateValue,
          fx_date: draft.date,
          category_id: draft.categoryId,
          date: draft.date,
          merchant: draft.merchant.trim() || null,
          notes: draft.notes.trim() || null,
        })
        .eq("id", transaction.id);

      if (error) throw error;
    },
    [baseCurrency, dictionary, transaction]
  );

  if (isLoading || !initialDraft || !transactionId) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <AddTransactionForm
        key={transactionId}
        mode="edit"
        allowObligation={false}
        initialDraft={initialDraft}
        accountId={transaction.account_id}
        currency={baseCurrency}
        categories={categories}
        topCategories={topCategories}
        merchantSuggestions={merchantSuggestions}
        onSubmitDraft={handleSubmitDraft}
        onSuccess={() => router.back()}
        onCancel={() => router.back()}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
});
