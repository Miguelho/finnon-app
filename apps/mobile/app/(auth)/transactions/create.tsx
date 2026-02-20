import { useState, useEffect } from "react";
import { ActivityIndicator, View, Text, StyleSheet, Alert } from "react-native";
import { useIsFocused } from "@react-navigation/native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { supabase } from "../../../src/lib/supabase";
import { useAuth } from "../../../src/contexts/AuthContext";
import { useUserTheme } from "../../../src/contexts/UserThemeContext";
import { AddTransactionForm } from "../../../src/components/add-transaction";
import {
  type AccountSummaryData,
  type TransactionType,
  type TopCategory,
  type MerchantSuggestion,
  type TransactionDraft,
  type RecurringFrequency,
  parseMoneyToMinor,
  CURRENCY_MINOR_UNITS,
  themeTokens,
} from "@poleursus/shared";
import { useCopy, t } from "../../../src/lib/i18n";

type Category = {
  id: string;
  name: string;
  icon_id: string;
  type: "income" | "expense";
};

type FormParticipant = {
  userId: string;
  name: string;
  role: "viewer" | "contributor" | "admin";
};

type RecurringPayload = {
  recurring?: {
    frequency: RecurringFrequency;
    interval: number;
    startDate: string;
    endDate: string | null;
  };
};

export default function CreateTransactionScreen(): React.JSX.Element {
  const params = useLocalSearchParams<{ kind?: string }>();
  const kind = Array.isArray(params.kind) ? params.kind[0] : params.kind;

  if (kind === "recurring") {
    return <CreateRecurringTransactionScreen />;
  }

  return <CreateMovementTransactionScreen />;
}

function CreateMovementTransactionScreen(): React.JSX.Element {
  const router = useRouter();
  const params = useLocalSearchParams<{ type?: string }>();
  const { selectedAccountId } = useAuth();
  const { tokens: userThemeTokens } = useUserTheme();
  const { dictionary } = useCopy();
  const isFocused = useIsFocused();
  const insets = useSafeAreaInsets();

  const [baseCurrency, setBaseCurrency] = useState("EUR");
  const [categories, setCategories] = useState<Category[]>([]);
  const [topCategories, setTopCategories] = useState<{
    expense: TopCategory[];
    income: TopCategory[];
  }>({ expense: [], income: [] });
  const [merchantSuggestions, setMerchantSuggestions] = useState<{
    expense: MerchantSuggestion[];
    income: MerchantSuggestion[];
  }>({ expense: [], income: [] });
  const [participants, setParticipants] = useState<FormParticipant[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const resolvedType = Array.isArray(params.type) ? params.type[0] : params.type;
  const initialType: TransactionType =
    resolvedType === "income" ? "income" : "expense";

  useEffect(() => {
    if (!isFocused || !selectedAccountId) return;
    let cancelled = false;

    const loadData = async () => {
      setIsLoading(true);
      try {
        const [
          accountResult,
          categoriesResult,
          topExpenseResult,
          topIncomeResult,
          merchantExpenseResult,
          merchantIncomeResult,
          accountSummaryResult,
        ] = await Promise.all([
          supabase
            .from("accounts")
            .select("base_currency")
            .eq("id", selectedAccountId)
            .single(),
          supabase
            .from("categories")
            .select("id, name, icon_id, type")
            .eq("account_id", selectedAccountId)
            .order("name", { ascending: true }),
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
          supabase.rpc("get_account_summary", {
            p_account_id: selectedAccountId,
          }),
        ]);

        if (accountResult.error) throw accountResult.error;
        if (categoriesResult.error) throw categoriesResult.error;
        if (topExpenseResult.error) throw topExpenseResult.error;
        if (topIncomeResult.error) throw topIncomeResult.error;
        if (merchantExpenseResult.error) throw merchantExpenseResult.error;
        if (merchantIncomeResult.error) throw merchantIncomeResult.error;
        if (accountSummaryResult.error) throw accountSummaryResult.error;

        if (cancelled) return;

        setBaseCurrency(accountResult.data?.base_currency ?? "EUR");
        setCategories((categoriesResult.data ?? []) as Category[]);
        setTopCategories({
          expense: (topExpenseResult.data ?? []) as TopCategory[],
          income: (topIncomeResult.data ?? []) as TopCategory[],
        });
        setMerchantSuggestions({
          expense: (merchantExpenseResult.data ?? []) as MerchantSuggestion[],
          income: (merchantIncomeResult.data ?? []) as MerchantSuggestion[],
        });
        const summary = accountSummaryResult.data as AccountSummaryData | null;
        const nextParticipants = (summary?.participants ?? []).map((member) => ({
          userId: member.user_id,
          role: member.role,
          name:
            member.display_name?.trim() ||
            member.email?.trim() ||
            member.user_id.slice(0, 6),
        }));
        setParticipants(nextParticipants);
      } catch (error) {
        console.error("[CreateMovementTransaction] Error loading data:", error);
        if (!cancelled) {
          Alert.alert(
            t(dictionary, "common.errorTitle"),
            t(dictionary, "errors.internalServer")
          );
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    loadData();
    return () => {
      cancelled = true;
    };
  }, [dictionary, isFocused, selectedAccountId]);

  if (!selectedAccountId) {
    return (
      <View
        style={[
          styles.container,
          { paddingTop: insets.top, backgroundColor: userThemeTokens.background },
        ]}
      >
        <View style={styles.loadingContainer}>
          <Text style={styles.loadErrorText}>
            {t(dictionary, "transactions.noAccountSelected")}
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View
      style={[
        styles.container,
        { paddingTop: insets.top, backgroundColor: userThemeTokens.background },
      ]}
    >
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.action.primary} />
        </View>
      ) : (
        <AddTransactionForm
          key={`${selectedAccountId}-${initialType}`}
          type={initialType}
          accountId={selectedAccountId}
          currency={baseCurrency}
          categories={categories}
          topCategories={topCategories}
          merchantSuggestions={merchantSuggestions}
          participants={participants}
          onSuccess={() => router.back()}
          onCancel={() => router.back()}
        />
      )}
    </View>
  );
}

function CreateRecurringTransactionScreen(): React.JSX.Element {
  const router = useRouter();
  const params = useLocalSearchParams<{ type?: string }>();
  const { selectedAccountId, user } = useAuth();
  const { tokens: userThemeTokens } = useUserTheme();
  const { dictionary } = useCopy();
  const isFocused = useIsFocused();
  const insets = useSafeAreaInsets();

  const [baseCurrency, setBaseCurrency] = useState("EUR");
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

  const resolvedType = Array.isArray(params.type) ? params.type[0] : params.type;
  const initialType: TransactionType =
    resolvedType === "income" ? "income" : "expense";

  useEffect(() => {
    if (!isFocused || !selectedAccountId) return;
    let cancelled = false;

    const loadData = async () => {
      setIsLoading(true);
      try {
        const [
          accountResult,
          categoriesResult,
          topExpenseResult,
          topIncomeResult,
          merchantExpenseResult,
          merchantIncomeResult,
        ] = await Promise.all([
          supabase
            .from("accounts")
            .select("base_currency")
            .eq("id", selectedAccountId)
            .single(),
          supabase
            .from("categories")
            .select("id, name, icon_id, type")
            .eq("account_id", selectedAccountId)
            .order("name", { ascending: true }),
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

        if (accountResult.error) throw accountResult.error;
        if (categoriesResult.error) throw categoriesResult.error;
        if (topExpenseResult.error) throw topExpenseResult.error;
        if (topIncomeResult.error) throw topIncomeResult.error;
        if (merchantExpenseResult.error) throw merchantExpenseResult.error;
        if (merchantIncomeResult.error) throw merchantIncomeResult.error;

        if (cancelled) return;

        setBaseCurrency(accountResult.data?.base_currency ?? "EUR");
        setCategories((categoriesResult.data ?? []) as Category[]);
        setTopCategories({
          expense: (topExpenseResult.data ?? []) as TopCategory[],
          income: (topIncomeResult.data ?? []) as TopCategory[],
        });
        setMerchantSuggestions({
          expense: (merchantExpenseResult.data ?? []) as MerchantSuggestion[],
          income: (merchantIncomeResult.data ?? []) as MerchantSuggestion[],
        });
      } catch (error) {
        console.error("[CreateRecurringTransaction] Error loading data:", error);
        if (!cancelled) {
          Alert.alert(
            t(dictionary, "common.errorTitle"),
            t(dictionary, "errors.internalServer")
          );
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    loadData();
    return () => {
      cancelled = true;
    };
  }, [dictionary, isFocused, selectedAccountId]);

  const handleSubmitRecurringDraft = async (
    draft: TransactionDraft,
    extra?: RecurringPayload
  ) => {
    if (!selectedAccountId) {
      throw new Error(t(dictionary, "transactions.noAccountSelected"));
    }
    if (!user) {
      throw new Error(t(dictionary, "transactions.notAuthenticated"));
    }

    const recurring = extra?.recurring;
    if (!recurring) {
      throw new Error(t(dictionary, "errors.invalidRequest"));
    }

    const amountMinorResult = parseMoneyToMinor(
      draft.amount,
      draft.currency,
      CURRENCY_MINOR_UNITS
    );

    if (typeof amountMinorResult === "object" && "error" in amountMinorResult) {
      throw new Error(
        t(
          dictionary,
          amountMinorResult.error.key,
          amountMinorResult.error.params
        )
      );
    }

    const { error } = await supabase
      .from("recurring_items")
      .insert({
        account_id: selectedAccountId,
        type: draft.type,
        amount_minor: amountMinorResult.toString(),
        currency: draft.currency,
        category_id: draft.categoryId || null,
        start_date: recurring.startDate,
        frequency: recurring.frequency,
        interval: recurring.interval,
        end_date: recurring.endDate,
        merchant: draft.merchant.trim() || null,
        notes: draft.notes.trim() || null,
        is_paused: false,
        created_by: user.id,
      })
      .select()
      .single();

    if (error) throw error;
  };

  if (!selectedAccountId) {
    return (
      <View
        style={[
          styles.container,
          { paddingTop: insets.top, backgroundColor: userThemeTokens.background },
        ]}
      >
        <View style={styles.loadingContainer}>
          <Text style={styles.loadErrorText}>
            {t(dictionary, "transactions.noAccountSelected")}
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View
      style={[
        styles.container,
        { paddingTop: insets.top, backgroundColor: userThemeTokens.background },
      ]}
    >
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.action.primary} />
        </View>
      ) : (
        <AddTransactionForm
          key={`${selectedAccountId}-${initialType}-recurring`}
          type={initialType}
          accountId={selectedAccountId}
          currency={baseCurrency}
          categories={categories}
          topCategories={topCategories}
          merchantSuggestions={merchantSuggestions}
          allowObligation={false}
          submitMode="recurring"
          successMessageKey="transactions.repeat.createSuccess"
          errorMessageKey="transactions.repeat.createError"
          onSubmitDraft={handleSubmitRecurringDraft}
          onSuccess={() => router.back()}
          onCancel={() => router.back()}
        />
      )}
    </View>
  );
}

const colors = themeTokens.light.colors;

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  loadErrorText: {
    fontSize: 14,
    color: colors.text.secondary,
    textAlign: "center",
  },
});
