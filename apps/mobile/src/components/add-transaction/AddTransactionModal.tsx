import { useEffect, useState } from "react";
import { Modal, View, StyleSheet, ActivityIndicator } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  themeTokens,
  type MutationAction,
  type MutationEntity,
  type TopCategory,
  type MerchantSuggestion,
} from "@poleursus/shared";
import { supabase } from "../../lib/supabase";
import { AddTransactionForm } from "./AddTransactionForm";
import { useDataCache } from "../../cache/DataCacheProvider";
import { useCachedCategoriesAndSuggestions } from "../../cache/hooks";

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
  const { emitMutation } = useDataCache();
  const loadCachedCategoriesAndSuggestions = useCachedCategoriesAndSuggestions();

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

  useEffect(() => {
    if (visible && accountId) {
      loadData();
    }
  }, [visible, accountId]);

  const loadData = async () => {
    setIsLoading(true);

    try {
      const payload = await loadCachedCategoriesAndSuggestions({
        accountId,
        loadCategories: async () => {
          const { data, error } = await supabase
            .from("categories")
            .select("id, name, icon_id, type")
            .eq("account_id", accountId)
            .order("name");
          if (error) throw error;
          return (data ?? []) as Category[];
        },
        loadTopCategories: async (txType) => {
          const { data, error } = await supabase.rpc("get_top_categories", {
            p_account_id: accountId,
            p_tx_type: txType,
            p_limit: 3,
          });
          if (error) throw error;
          return (data ?? []) as TopCategory[];
        },
        loadMerchantSuggestions: async (txType) => {
          const { data, error } = await supabase.rpc("get_merchant_suggestions", {
            p_account_id: accountId,
            p_tx_type: txType,
            p_limit: 20,
          });
          if (error) throw error;
          return (data ?? []) as MerchantSuggestion[];
        },
      });

      setCategories(payload.categories);
      setTopCategories(payload.topCategories);
      setMerchantSuggestions(payload.merchantSuggestions);
    } catch (error) {
      console.error("Error loading data for transaction form:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleMutationSuccess = async (
    entity: MutationEntity,
    action: MutationAction
  ) => {
    await emitMutation(entity, action);
  };

  const handleSuccess = () => {
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
            onMutationSuccess={handleMutationSuccess}
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
