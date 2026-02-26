import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, StyleSheet, Text, View } from "react-native";
import { useIsFocused } from "@react-navigation/native";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  CORE_5M,
  cacheKeys,
  cacheTags,
  buildEqualSplit,
  CURRENCY_MINOR_UNITS,
  computeAmountBaseMinor,
  formatMinorToMoney,
  parseFxRate,
  parseMoneyToMinor,
  type AccountSummaryData,
  type ContributionSplitType,
  type MerchantSuggestion,
  type TopCategory,
  type TransactionDraft,
} from "@poleursus/shared";
import { supabase } from "../../../src/lib/supabase";
import { useAuth } from "../../../src/contexts/AuthContext";
import { useUserTheme } from "../../../src/contexts/UserThemeContext";
import { useCopy, t } from "../../../src/lib/i18n";
import { AddTransactionForm } from "../../../src/components/add-transaction";
import { useDataCache } from "../../../src/cache/DataCacheProvider";
import { useCachedCategoriesAndSuggestions } from "../../../src/cache/hooks";

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
  paid_by: string;
  split_type: ContributionSplitType;
  split_details: Array<{ user_id: string; share_minor: number }> | null;
  created_at: string;
}

type FormParticipant = {
  userId: string;
  name: string;
  role: "viewer" | "contributor" | "admin";
};

export default function EditTransactionScreen(): React.JSX.Element {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const isFocused = useIsFocused();
  const { selectedAccountId } = useAuth();
  const { cache, userId, emitMutation } = useDataCache();
  const loadCachedCategoriesAndSuggestions = useCachedCategoriesAndSuggestions();
  const { tokens: userTokens } = useUserTheme();
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
  const [addedByName, setAddedByName] = useState<string | null>(null);
  const [participants, setParticipants] = useState<FormParticipant[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const buildDraft = useCallback((row: Transaction): TransactionDraft => {
    const amountMinor = BigInt(row.amount_minor);
    const splitDetails =
      row.split_type === "custom" && Array.isArray(row.split_details)
        ? row.split_details.map((split) => ({
            userId: split.user_id,
            shareMinor: Math.max(0, Math.trunc(split.share_minor)),
          }))
        : null;
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
      paidByUserId: row.paid_by ?? row.created_by,
      splitType: row.split_type ?? "equal",
      splitDetails,
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
      setAddedByName(null);
      try {
        const [
          transactionResult,
          categoriesAndSuggestions,
          accountResult,
          accountSummaryResult,
        ] = await Promise.all([
          supabase
            .from("transactions")
            .select("*")
            .eq("id", transactionId)
            .single(),
          loadCachedCategoriesAndSuggestions({
            accountId: selectedAccountId,
            loadCategories: async () => {
              const { data, error } = await supabase
                .from("categories")
                .select("id, name, icon_id, type")
                .eq("account_id", selectedAccountId)
                .order("name", { ascending: true });
              if (error) throw error;
              return (data ?? []) as Category[];
            },
            loadTopCategories: async (txType) => {
              const { data, error } = await supabase.rpc("get_top_categories", {
                p_account_id: selectedAccountId,
                p_tx_type: txType,
                p_limit: 3,
              });
              if (error) throw error;
              return (data ?? []) as TopCategory[];
            },
            loadMerchantSuggestions: async (txType) => {
              const { data, error } = await supabase.rpc("get_merchant_suggestions", {
                p_account_id: selectedAccountId,
                p_tx_type: txType,
                p_limit: 20,
              });
              if (error) throw error;
              return (data ?? []) as MerchantSuggestion[];
            },
          }),
          userId
            ? cache.getOrLoad(
                cacheKeys.accountSummary(selectedAccountId),
                async () => {
                  const { data, error } = await supabase
                    .from("accounts")
                    .select("base_currency")
                    .eq("id", selectedAccountId)
                    .single();
                  if (error) throw error;
                  return { base_currency: data?.base_currency ?? "EUR" };
                },
                CORE_5M,
                {
                  userId,
                  accountId: selectedAccountId,
                  tags: [cacheTags.accountSummary],
                }
              )
            : (async () => {
                const { data, error } = await supabase
                  .from("accounts")
                  .select("base_currency")
                  .eq("id", selectedAccountId)
                  .single();
                if (error) throw error;
                return { base_currency: data?.base_currency ?? "EUR" };
              })(),
          supabase.rpc("get_account_summary", {
            p_account_id: selectedAccountId,
          }),
        ]);

        if (transactionResult.error) throw transactionResult.error;
        if (accountSummaryResult.error) throw accountSummaryResult.error;

        const tx = transactionResult.data as Transaction | null;
        if (!tx) {
          throw new Error(t(dictionary, "transactions.loadError"));
        }

        const { data: creatorProfile } = await supabase
          .from("profiles")
          .select("display_name, email")
          .eq("user_id", tx.created_by)
          .maybeSingle();

        const resolvedAddedBy =
          creatorProfile?.display_name?.trim() ||
          creatorProfile?.email?.trim() ||
          tx.created_by.slice(0, 6);

        setTransaction(tx);
        setInitialDraft(buildDraft(tx));
        setAddedByName(resolvedAddedBy);
        setCategories(categoriesAndSuggestions.categories);
        setBaseCurrency(accountResult.base_currency ?? "EUR");
        setTopCategories(categoriesAndSuggestions.topCategories);
        setMerchantSuggestions(categoriesAndSuggestions.merchantSuggestions);
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
    cache,
    loadCachedCategoriesAndSuggestions,
    transactionId,
    userId,
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

      const activeParticipants = participants.filter(
        (member) => member.role === "admin" || member.role === "contributor"
      );
      const activeMemberIds = activeParticipants.map((member) => member.userId);
      const splitType: ContributionSplitType =
        activeMemberIds.length < 2 ? "personal" : draft.splitType;
      const paidBy = draft.paidByUserId ?? transaction.paid_by ?? transaction.created_by;

      if (!paidBy) {
        throw new Error(t(dictionary, "addTransaction.errors.paidByRequired"));
      }

      const splitDetailsPayload =
        splitType === "custom"
          ? (draft.splitDetails ?? []).map((split) => ({
              user_id: split.userId,
              share_minor: Math.max(0, Math.trunc(split.shareMinor)),
            }))
          : null;

      if (splitType === "custom") {
        const fallbackSplit = buildEqualSplit(Number(amountMinorResult), activeMemberIds);
        const normalizedSplit =
          splitDetailsPayload && splitDetailsPayload.length > 0
            ? splitDetailsPayload
            : fallbackSplit.map((split) => ({
                user_id: split.userId,
                share_minor: split.shareMinor,
              }));
        const splitTotal = normalizedSplit.reduce(
          (acc, split) => acc + BigInt(split.share_minor),
          0n
        );
        if (splitTotal !== amountMinorResult) {
          throw new Error(t(dictionary, "addTransaction.errors.splitTotalMismatch"));
        }
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
          paid_by: paidBy,
          split_type: splitType,
          split_details: splitType === "custom" ? splitDetailsPayload : null,
        })
        .eq("id", transaction.id);

      if (error) throw error;
      await emitMutation("transactions", "update");
    },
    [baseCurrency, dictionary, emitMutation, participants, transaction]
  );

  const participantNameById = useMemo(() => {
    const map = new Map<string, string>();
    participants.forEach((participant) => {
      map.set(participant.userId, participant.name);
    });
    return map;
  }, [participants]);

  const splitRows = useMemo(() => {
    if (!transaction) return [];
    const activeMembers = participants.filter(
      (member) => member.role === "admin" || member.role === "contributor"
    );
    const activeMemberIds = activeMembers.map((member) => member.userId);
    const amountMinor = Number(transaction.amount_minor);

    if (activeMemberIds.length < 2) return [];

    if (transaction.split_type === "personal") {
      return activeMemberIds.map((userId) => ({
        userId,
        shareMinor: userId === transaction.paid_by ? amountMinor : 0,
      }));
    }

    if (
      transaction.split_type === "custom" &&
      Array.isArray(transaction.split_details) &&
      transaction.split_details.length > 0
    ) {
      const byUser = new Map(
        transaction.split_details.map((split) => [split.user_id, split.share_minor])
      );
      return activeMemberIds.map((userId) => ({
        userId,
        shareMinor: Math.max(0, Math.trunc(byUser.get(userId) ?? 0)),
      }));
    }

    return buildEqualSplit(amountMinor, activeMemberIds);
  }, [participants, transaction]);

  if (isLoading || !initialDraft || !transactionId || !transaction) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {addedByName ? (
        <View style={styles.addedByContainer}>
          <Text style={[styles.addedByText, { color: userTokens.textSecondary }]}>
            {t(dictionary, "transactions.addedBy", { name: addedByName })}
          </Text>
        </View>
      ) : null}
      <View
        style={[
          styles.splitSummaryCard,
          {
            borderColor: userTokens.border,
            backgroundColor: userTokens.surfaceAlt,
          },
        ]}
      >
        <Text style={[styles.splitSummaryLabel, { color: userTokens.textSecondary }]}>
          {t(dictionary, "transactions.paidByLabel")}
        </Text>
        <Text style={[styles.splitSummaryValue, { color: userTokens.textPrimary }]}>
          {participantNameById.get(transaction.paid_by) ?? transaction.paid_by.slice(0, 6)}
        </Text>
        {splitRows.length > 0 ? (
          <>
            <Text style={[styles.splitSummaryLabel, { color: userTokens.textSecondary }]}>
              {t(dictionary, "transactions.splitLabel")}
            </Text>
            {splitRows.map((split) => (
              <View key={split.userId} style={styles.splitSummaryRow}>
                <Text style={[styles.splitMemberName, { color: userTokens.textSecondary }]}>
                  {participantNameById.get(split.userId) ?? split.userId.slice(0, 6)}
                </Text>
                <Text style={[styles.splitMemberAmount, { color: userTokens.textPrimary }]}>
                  {formatMinorToMoney(
                    BigInt(Math.max(0, split.shareMinor)),
                    transaction.currency,
                    CURRENCY_MINOR_UNITS
                  )}{" "}
                  {transaction.currency}
                </Text>
              </View>
            ))}
          </>
        ) : null}
      </View>
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
        participants={participants}
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
  addedByContainer: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 6,
  },
  addedByText: {
    fontSize: 13,
    fontWeight: "500",
  },
  splitSummaryCard: {
    marginHorizontal: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    gap: 6,
  },
  splitSummaryLabel: {
    fontSize: 12,
    fontWeight: "600",
    textTransform: "uppercase",
  },
  splitSummaryValue: {
    fontSize: 15,
    fontWeight: "600",
    marginBottom: 4,
  },
  splitSummaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  splitMemberName: {
    fontSize: 13,
  },
  splitMemberAmount: {
    fontSize: 13,
    fontWeight: "600",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
});
