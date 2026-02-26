import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useIsFocused } from "@react-navigation/native";
import {
  CURRENCIES,
  CORE_5M,
  META_24H,
  cacheKeys,
  cacheTags,
  formatDateISO,
  getPeriodEnd,
  getPeriodRange,
  isFutureDay,
  type RecurringItem,
} from "@poleursus/shared";
import { supabase } from "../lib/supabase";
import { useAuth } from "../contexts/AuthContext";
import { useCopy, t } from "../lib/i18n";
import { useNetworkNotice } from "../contexts/NetworkNoticeContext";
import {
  selectMovementsSummary,
  selectUnregisteredRecurrents,
  useMovementsStore,
} from "../stores/useMovementsStore";
import { useDataCache } from "../cache/DataCacheProvider";
import {
  useCachedRecurringRange,
  useCachedTransactionsRange,
} from "../cache/hooks";
import type { Category, Movement, UserProfile } from "../types/movements";

type TransactionRow = {
  id: string;
  account_id: string;
  type: "income" | "expense";
  amount_minor: string | number;
  amount_base_minor?: string | number | null;
  currency: string;
  category_id: string | null;
  date: string;
  merchant: string | null;
  notes: string | null;
  created_by: string;
  recurring_item_id?: string | null;
  recurring_occurrence_date?: string | null;
  category?: {
    id: string;
    name: string;
    icon_id: string | null;
    type?: "income" | "expense" | null;
  } | null;
};

const toBigInt = (value: unknown) => {
  try {
    return BigInt(value as string | number | bigint);
  } catch {
    return 0n;
  }
};

const mapTransactionToMovement = (
  row: TransactionRow,
  labels: { uncategorized: string; movementFallback: string }
): Movement => {
  const amountMinor = toBigInt(row.amount_base_minor ?? row.amount_minor);
  const status = isFutureDay(row.date) ? "pending" : "confirmed";
  const categoryName = row.category?.name ?? labels.uncategorized;
  const title = row.merchant?.trim() || categoryName || labels.movementFallback;

  return {
    id: row.id,
    title,
    amountMinor,
    date: row.date,
    categoryId: row.category_id,
    categoryName,
    categoryIconId: row.category?.icon_id ?? null,
    subcategory: row.notes?.trim() || null,
    userId: row.created_by,
    accountId: row.account_id,
    status,
    type: row.type,
    merchant: row.merchant,
    recurringItemId: row.recurring_item_id ?? null,
    recurringOccurrenceDate: row.recurring_occurrence_date ?? null,
  };
};

const matchesSearch = (movement: Movement, query: string) => {
  const trimmed = query.trim().toLowerCase();
  if (!trimmed) return true;
  return (
    movement.title.toLowerCase().includes(trimmed) ||
    movement.categoryName.toLowerCase().includes(trimmed) ||
    (movement.subcategory ?? "").toLowerCase().includes(trimmed)
  );
};

export function useMovements() {
  const isFocused = useIsFocused();
  const { selectedAccountId } = useAuth();
  const { cache, userId } = useDataCache();
  const loadCachedTransactionsRange = useCachedTransactionsRange();
  const loadCachedRecurringRange = useCachedRecurringRange();
  const { locale, dictionary } = useCopy();
  const { reportNetworkIssue } = useNetworkNotice();

  const {
    selectedPeriod,
    filters,
    isSearchMode,
    periodMovements,
    searchMovements,
    categories,
    recurringItems,
    profilesById,
    baseCurrency,
    setPeriodMovements,
    setSearchMovements,
    setCategories,
    setRecurringItems,
    mergeProfilesById,
    setBaseCurrency,
  } = useMovementsStore();

  const [loading, setLoading] = useState(true);
  const [searchLoading, setSearchLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const latestPeriodCacheKeyRef = useRef<string | null>(null);
  const periodLoadRequestIdRef = useRef(0);

  const periodRange = useMemo(() => {
    const now = new Date();
    const range = getPeriodRange(selectedPeriod, now);
    return {
      start: formatDateISO(range.start),
      end: formatDateISO(getPeriodEnd(selectedPeriod, now)),
    };
  }, [selectedPeriod]);

  const periodCacheKey = useMemo(() => {
    if (!selectedAccountId) return null;
    return `${selectedAccountId}:${periodRange.start}:${periodRange.end}`;
  }, [selectedAccountId, periodRange.end, periodRange.start]);

  useEffect(() => {
    latestPeriodCacheKeyRef.current = periodCacheKey;
  }, [periodCacheKey]);

  const loadProfiles = useCallback(
    async (movements: Movement[]) => {
      const userIds = Array.from(
        new Set(movements.map((movement) => movement.userId))
      );
      if (userIds.length === 0) return;

      const { data, error: profileError } = await supabase
        .from("profiles")
        .select(
          "user_id, email, display_name, avatar_path, avatar_fallback_text, avatar_fallback_bg_token, avatar_color"
        )
        .in("user_id", userIds);

      if (profileError || !data) return;

      const nextProfiles: Record<string, UserProfile> = {};
      data.forEach((profile) => {
        nextProfiles[profile.user_id] = profile as UserProfile;
      });
      mergeProfilesById(nextProfiles);
    },
    [mergeProfilesById]
  );

  const loadPeriodData = useCallback(async (options?: { force?: boolean }) => {
    const forceReload = options?.force ?? false;
    if (!selectedAccountId || !periodCacheKey) {
      setLoading(false);
      return;
    }
    const requestKey = periodCacheKey;
    const requestId = periodLoadRequestIdRef.current + 1;
    periodLoadRequestIdRef.current = requestId;
    const isStaleRequest = () =>
      periodLoadRequestIdRef.current !== requestId ||
      latestPeriodCacheKeyRef.current !== requestKey;

    setLoading(true);
    setError(null);

    try {
      const accountPromise = userId
        ? cache.getOrLoad(
            cacheKeys.accountSummary(selectedAccountId),
            async () => {
              const { data, error } = await supabase
                .from("accounts")
                .select("base_currency")
                .eq("id", selectedAccountId)
                .maybeSingle();
              if (error) throw error;
              return { base_currency: data?.base_currency ?? baseCurrency };
            },
            CORE_5M,
            {
              userId,
              accountId: selectedAccountId,
              force: forceReload,
              tags: [cacheTags.accountSummary],
            }
          )
        : (async () => {
            const { data, error } = await supabase
              .from("accounts")
              .select("base_currency")
              .eq("id", selectedAccountId)
              .maybeSingle();
            if (error) throw error;
            return { base_currency: data?.base_currency ?? baseCurrency };
          })();

      const transactionsPromise = loadCachedTransactionsRange<TransactionRow[]>({
        accountId: selectedAccountId,
        start: periodRange.start,
        end: periodRange.end,
        force: forceReload,
        loader: async () => {
          const { data, error } = await supabase
            .from("transactions")
            .select("*, category:categories(id, name, icon_id, type)")
            .eq("account_id", selectedAccountId)
            .gte("date", periodRange.start)
            .lte("date", periodRange.end)
            .order("date", { ascending: false })
            .order("created_at", { ascending: false });
          if (error) throw error;
          return (data ?? []) as TransactionRow[];
        },
      });

      const categoriesPromise = userId
        ? cache.getOrLoad(
            cacheKeys.categories(selectedAccountId),
            async () => {
              const { data, error } = await supabase
                .from("categories")
                .select("id, name, icon_id, type, account_id")
                .eq("account_id", selectedAccountId);
              if (error) throw error;
              return (data ?? []) as Category[];
            },
            META_24H,
            {
              userId,
              accountId: selectedAccountId,
              force: forceReload,
              tags: [cacheTags.categories],
            }
          )
        : (async () => {
            const { data, error } = await supabase
              .from("categories")
              .select("id, name, icon_id, type, account_id")
              .eq("account_id", selectedAccountId);
            if (error) throw error;
            return (data ?? []) as Category[];
          })();

      const recurringPromise = loadCachedRecurringRange<RecurringItem[]>({
        accountId: selectedAccountId,
        start: periodRange.start,
        end: periodRange.end,
        force: forceReload,
        loader: async () => {
          const { data, error } = await supabase
            .from("recurring_items")
            .select(
              "id, account_id, type, amount_minor, currency, category_id, merchant, notes, start_date, frequency, interval, day_of_month, end_date, is_paused, created_by"
            )
            .eq("account_id", selectedAccountId)
            .lte("start_date", periodRange.end)
            .or(`end_date.is.null,end_date.gte.${periodRange.start}`);
          if (error) throw error;
          return (data ?? []) as RecurringItem[];
        },
      });

      const [accountResult, transactionsResult, categoriesResult, recurringResult] =
        await Promise.all([
          accountPromise,
          transactionsPromise,
          categoriesPromise,
          recurringPromise,
        ]);

      if (isStaleRequest()) return;

      const nextBaseCurrency = accountResult.base_currency ?? baseCurrency;
      setBaseCurrency(nextBaseCurrency);

      const mappedMovements = (transactionsResult || []).map((row) =>
        mapTransactionToMovement(row as TransactionRow, {
          uncategorized: t(dictionary, "transactions.uncategorized"),
          movementFallback: t(dictionary, "transactions.ui.movementFallback"),
        })
      );
      const nextCategories = (categoriesResult || []) as Category[];
      const nextRecurringItems = (recurringResult || []) as RecurringItem[];
      setPeriodMovements(mappedMovements);
      setCategories(nextCategories);
      setRecurringItems(nextRecurringItems);

      await loadProfiles(mappedMovements);
    } catch (e: any) {
      if (isStaleRequest()) return;
      setError(e?.message || t(dictionary, "transactions.loadError"));
      reportNetworkIssue({ onRetry: loadPeriodData });
    } finally {
      if (!isStaleRequest()) {
        setLoading(false);
      }
    }
  }, [
    loadProfiles,
    periodCacheKey,
    periodRange.end,
    periodRange.start,
    baseCurrency,
    cache,
    loadCachedRecurringRange,
    loadCachedTransactionsRange,
    userId,
    reportNetworkIssue,
    selectedAccountId,
    dictionary,
    setBaseCurrency,
    setCategories,
    setPeriodMovements,
    setRecurringItems,
  ]);

  const loadSearchResults = useCallback(async () => {
    const rawQuery = filters.searchQuery.trim();
    const query = rawQuery.replace(/[(),]/g, " ").trim();
    if (!selectedAccountId || !query) {
      setSearchMovements([]);
      return;
    }

    setSearchLoading(true);
    try {
      const { data: categoryMatches, error: categoryError } = await supabase
        .from("categories")
        .select("id")
        .eq("account_id", selectedAccountId)
        .ilike("name", `%${query}%`);

      if (categoryError) throw categoryError;

      const categoryIds = (categoryMatches || []).map((row) => row.id);
      const filtersOr = [
        `merchant.ilike.%${query}%`,
        `notes.ilike.%${query}%`,
      ];
      if (categoryIds.length > 0) {
        filtersOr.push(`category_id.in.(${categoryIds.join(",")})`);
      }

      const { data, error: searchError } = await supabase
        .from("transactions")
        .select("*, category:categories(id, name, icon_id, type)")
        .eq("account_id", selectedAccountId)
        .gte("date", periodRange.start)
        .lte("date", periodRange.end)
        .or(filtersOr.join(","))
        .order("date", { ascending: false })
        .order("created_at", { ascending: false });

      if (searchError) throw searchError;

      const mappedMovements = (data || []).map((row) =>
        mapTransactionToMovement(row as TransactionRow, {
          uncategorized: t(dictionary, "transactions.uncategorized"),
          movementFallback: t(dictionary, "transactions.ui.movementFallback"),
        })
      );
      setSearchMovements(mappedMovements);
      await loadProfiles(mappedMovements);
    } catch (e: any) {
      setError(e?.message || t(dictionary, "transactions.loadError"));
    } finally {
      setSearchLoading(false);
    }
  }, [
    filters.searchQuery,
    loadProfiles,
    periodRange.end,
    periodRange.start,
    selectedAccountId,
    dictionary,
    setSearchMovements,
  ]);

  useEffect(() => {
    if (!isFocused) return;
    loadPeriodData();
  }, [isFocused, loadPeriodData]);

  useEffect(() => {
    if (!isFocused) return;
    loadSearchResults();
  }, [isFocused, loadSearchResults]);

  const displayMovements = useMemo(
    () => (isSearchMode ? searchMovements : periodMovements),
    [isSearchMode, searchMovements, periodMovements]
  );

  const filteredMovements = useMemo(() => {
    let items = displayMovements;
    const query = filters.searchQuery.trim();
    if (query) {
      items = items.filter((movement) => matchesSearch(movement, query));
    }

    if (filters.categoryIds.length > 0) {
      items = items.filter((movement) =>
        movement.categoryId
          ? filters.categoryIds.includes(movement.categoryId)
          : false
      );
    }

    if (filters.merchantNames.length > 0) {
      items = items.filter((movement) =>
        movement.merchant
          ? filters.merchantNames.includes(movement.merchant)
          : false
      );
    }

    const hasTypeFilter = filters.types.length > 0;

    if (hasTypeFilter) {
      items = items.filter((movement) => filters.types.includes(movement.type));
    }

    return items;
  }, [displayMovements, filters.categoryIds, filters.merchantNames, filters.searchQuery, filters.types]);

  const groupedByStatus = useMemo(() => {
    const pending: Movement[] = [];
    const confirmed: Movement[] = [];
    filteredMovements.forEach((movement) => {
      if (movement.status === "pending") {
        pending.push(movement);
      } else {
        confirmed.push(movement);
      }
    });
    return { pending, confirmed };
  }, [filteredMovements]);

  const summary = useMemo(
    () => selectMovementsSummary(filteredMovements),
    [filteredMovements]
  );

  const unregisteredRecurrents = useMemo(
    () => selectUnregisteredRecurrents(useMovementsStore.getState()),
    [periodMovements, recurringItems, categories, selectedPeriod]
  );

  const counts = useMemo(() => {
    let income = 0;
    let expense = 0;
    displayMovements.forEach((movement) => {
      if (movement.type === "income") income += 1;
      if (movement.type === "expense") expense += 1;
    });
    return { income, expense };
  }, [displayMovements]);

  const merchantOptions = useMemo(() => {
    const unique = new Set<string>();
    displayMovements.forEach((movement) => {
      if (movement.merchant) unique.add(movement.merchant);
    });
    return Array.from(unique).map((name) => ({ id: name, name }));
  }, [displayMovements]);

  const categoryOptions = useMemo(
    () => categories.map((category) => ({ id: category.id, name: category.name })),
    [categories]
  );

  const currencySymbol =
    CURRENCIES.find((currency) => currency.code === baseCurrency)?.symbol ??
    baseCurrency;

  const refresh = useCallback(async () => {
    await loadPeriodData({ force: true });
    if (isSearchMode) {
      await loadSearchResults();
    }
  }, [isSearchMode, loadPeriodData, loadSearchResults]);

  return {
    loading,
    searchLoading,
    error,
    displayMovements,
    filteredMovements,
    groupedByStatus,
    summary,
    unregisteredRecurrents,
    counts,
    merchantOptions,
    categoryOptions,
    currencySymbol,
    currencyCode: baseCurrency,
    profilesById,
    refresh,
    locale,
  };
}
