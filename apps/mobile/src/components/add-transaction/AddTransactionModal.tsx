import { useEffect, useState, useRef } from "react";
import { Modal, View, StyleSheet, ActivityIndicator } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  themeTokens,
  type TopCategory,
  type MerchantSuggestion,
} from "@poleursus/shared";
import { supabase } from "../../lib/supabase";
import { AddTransactionForm } from "./AddTransactionForm";

const tokens = themeTokens.light;
const colors = tokens.colors;

interface Category {
  id: string;
  name: string;
  icon_id: string;
  type: "income" | "expense";
}

interface AddTransactionModalProps {
  visible: boolean;
  type?: "income" | "expense";
  accountId: string;
  currency: string;
  defaultDate?: string;
  onClose: () => void;
  onSuccess?: () => void;
}

export function AddTransactionModal({
  visible,
  type = "expense",
  accountId,
  currency,
  defaultDate,
  onClose,
  onSuccess,
}: AddTransactionModalProps) {
  const insets = useSafeAreaInsets();

  const [categories, setCategories] = useState<Category[]>([]);
  const [topCategories, setTopCategories] = useState<{
    expense: TopCategory[];
    income: TopCategory[];
  }>({ expense: [], income: [] });
  const [merchantSuggestions, setMerchantSuggestions] = useState<{
    expense: MerchantSuggestion[];
    income: MerchantSuggestion[];
  }>({ expense: [], income: [] });
  const [isLoading, setIsLoading] = useState(true);

  const topCategoriesCache = useRef<Record<string, TopCategory[]>>({});
  const merchantSuggestionsCache = useRef<Record<string, MerchantSuggestion[]>>({});

  useEffect(() => {
    if (visible && accountId) {
      loadData();
    }
  }, [visible, accountId]);

  const loadData = async () => {
    setIsLoading(true);

    try {
      // Load categories (all types)
      const { data: categoriesData } = await supabase
        .from("categories")
        .select("id, name, icon_id, type")
        .eq("account_id", accountId)
        .order("name");

      setCategories(categoriesData ?? []);

      // Load top categories for both types
      const expenseTopKey = `${accountId}:expense`;
      const incomeTopKey = `${accountId}:income`;

      let expenseTop: TopCategory[] = [];
      let incomeTop: TopCategory[] = [];

      if (topCategoriesCache.current[expenseTopKey]) {
        expenseTop = topCategoriesCache.current[expenseTopKey];
      } else {
        const { data: topData } = await supabase.rpc("get_top_categories", {
          p_account_id: accountId,
          p_tx_type: "expense",
          p_limit: 3,
        });
        expenseTop = topData ?? [];
        topCategoriesCache.current[expenseTopKey] = expenseTop;
      }

      if (topCategoriesCache.current[incomeTopKey]) {
        incomeTop = topCategoriesCache.current[incomeTopKey];
      } else {
        const { data: topData } = await supabase.rpc("get_top_categories", {
          p_account_id: accountId,
          p_tx_type: "income",
          p_limit: 3,
        });
        incomeTop = topData ?? [];
        topCategoriesCache.current[incomeTopKey] = incomeTop;
      }

      setTopCategories({ expense: expenseTop, income: incomeTop });

      // Load merchant suggestions for both types
      let expenseMerchants: MerchantSuggestion[] = [];
      let incomeMerchants: MerchantSuggestion[] = [];

      if (merchantSuggestionsCache.current[expenseTopKey]) {
        expenseMerchants = merchantSuggestionsCache.current[expenseTopKey];
      } else {
        const { data: merchantData } = await supabase.rpc("get_merchant_suggestions", {
          p_account_id: accountId,
          p_tx_type: "expense",
          p_limit: 20,
        });
        expenseMerchants = merchantData ?? [];
        merchantSuggestionsCache.current[expenseTopKey] = expenseMerchants;
      }

      if (merchantSuggestionsCache.current[incomeTopKey]) {
        incomeMerchants = merchantSuggestionsCache.current[incomeTopKey];
      } else {
        const { data: merchantData } = await supabase.rpc("get_merchant_suggestions", {
          p_account_id: accountId,
          p_tx_type: "income",
          p_limit: 20,
        });
        incomeMerchants = merchantData ?? [];
        merchantSuggestionsCache.current[incomeTopKey] = incomeMerchants;
      }

      setMerchantSuggestions({ expense: expenseMerchants, income: incomeMerchants });
    } catch (error) {
      console.error("Error loading data for transaction form:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSuccess = () => {
    // Clear caches on success so next load gets fresh data
    topCategoriesCache.current = {};
    merchantSuggestionsCache.current = {};
    onSuccess?.();
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={[styles.container, { paddingTop: insets.top }]}>
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.action.primary} />
          </View>
        ) : (
          <AddTransactionForm
            key={`${accountId}-${type}-${defaultDate ?? "new"}`}
            type={type}
            accountId={accountId}
            currency={currency}
            categories={categories}
            topCategories={topCategories}
            merchantSuggestions={merchantSuggestions}
            defaultDate={defaultDate}
            onSuccess={handleSuccess}
            onCancel={onClose}
          />
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg.primary,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
});
