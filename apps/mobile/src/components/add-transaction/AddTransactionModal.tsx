import { useEffect, useState, useRef } from "react";
import { Modal, View, Pressable, StyleSheet, ActivityIndicator } from "react-native";
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
  type: "income" | "expense";
  accountId: string;
  currency: string;
  onClose: () => void;
  onSuccess?: () => void;
}

export function AddTransactionModal({
  visible,
  type,
  accountId,
  currency,
  onClose,
  onSuccess,
}: AddTransactionModalProps) {
  const insets = useSafeAreaInsets();

  const [categories, setCategories] = useState<Category[]>([]);
  const [topCategories, setTopCategories] = useState<TopCategory[]>([]);
  const [merchantSuggestions, setMerchantSuggestions] = useState<MerchantSuggestion[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const topCategoriesCache = useRef<Record<string, TopCategory[]>>({});
  const merchantSuggestionsCache = useRef<Record<string, MerchantSuggestion[]>>({});

  useEffect(() => {
    if (visible && accountId) {
      loadData();
    }
  }, [visible, accountId, type]);

  const loadData = async () => {
    setIsLoading(true);

    try {
      // Load categories
      const { data: categoriesData } = await supabase
        .from("categories")
        .select("id, name, icon_id, type")
        .eq("account_id", accountId)
        .order("name");

      setCategories(categoriesData ?? []);

      // Load top categories (with cache)
      const cacheKey = `${accountId}:${type}`;
      if (topCategoriesCache.current[cacheKey]) {
        setTopCategories(topCategoriesCache.current[cacheKey]);
      } else {
        const { data: topData } = await supabase.rpc("get_top_categories", {
          p_account_id: accountId,
          p_tx_type: type,
          p_limit: 3,
        });
        const topCats = topData ?? [];
        topCategoriesCache.current[cacheKey] = topCats;
        setTopCategories(topCats);
      }

      // Load merchant suggestions (with cache)
      if (merchantSuggestionsCache.current[cacheKey]) {
        setMerchantSuggestions(merchantSuggestionsCache.current[cacheKey]);
      } else {
        const { data: merchantData } = await supabase.rpc("get_merchant_suggestions", {
          p_account_id: accountId,
          p_tx_type: type,
          p_limit: 20,
        });
        const merchants = merchantData ?? [];
        merchantSuggestionsCache.current[cacheKey] = merchants;
        setMerchantSuggestions(merchants);
      }
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
            type={type}
            accountId={accountId}
            currency={currency}
            categories={categories}
            topCategories={topCategories}
            merchantSuggestions={merchantSuggestions}
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
