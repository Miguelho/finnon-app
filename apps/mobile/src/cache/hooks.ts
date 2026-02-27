import { useCallback } from "react";
import {
  cacheKeys,
  cacheTags,
  CORE_5M,
  META_24H,
  type MerchantSuggestion,
  type TopCategory,
} from "@poleursus/shared";
import { useDataCache } from "./DataCacheProvider";

export function useCachedTransactionsRange() {
  const { cache, userId } = useDataCache();

  return useCallback(
    async <T>({
      accountId,
      start,
      end,
      loader,
      force,
    }: {
      accountId: string;
      start: string;
      end: string;
      loader: () => Promise<T>;
      force?: boolean;
    }) => {
      if (!userId) return loader();
      return cache.getOrLoad(
        cacheKeys.transactionsRange(accountId, start, end),
        loader,
        CORE_5M,
        {
          userId,
          accountId,
          force,
          tags: [cacheTags.transactions],
        }
      );
    },
    [cache, userId]
  );
}

export function useCachedObligationsRange() {
  const { cache, userId } = useDataCache();

  return useCallback(
    async <T>({
      accountId,
      start,
      end,
      loader,
      force,
    }: {
      accountId: string;
      start: string;
      end: string;
      loader: () => Promise<T>;
      force?: boolean;
    }) => {
      if (!userId) return loader();
      return cache.getOrLoad(
        cacheKeys.obligationsRange(accountId, start, end),
        loader,
        CORE_5M,
        {
          userId,
          accountId,
          force,
          tags: [cacheTags.obligations],
        }
      );
    },
    [cache, userId]
  );
}

export function useCachedRecurringRange() {
  const { cache, userId } = useDataCache();

  return useCallback(
    async <T>({
      accountId,
      start,
      end,
      loader,
      force,
    }: {
      accountId: string;
      start: string;
      end: string;
      loader: () => Promise<T>;
      force?: boolean;
    }) => {
      if (!userId) return loader();
      return cache.getOrLoad(
        cacheKeys.recurrentsRange(accountId, start, end),
        loader,
        CORE_5M,
        {
          userId,
          accountId,
          force,
          tags: [cacheTags.recurrents],
        }
      );
    },
    [cache, userId]
  );
}

export function useCachedCategoriesAndSuggestions() {
  const { cache, userId } = useDataCache();

  return useCallback(
    async <TCategory>({
      accountId,
      force,
      loadCategories,
      loadTopCategories,
      loadMerchantSuggestions,
    }: {
      accountId: string;
      force?: boolean;
      loadCategories: () => Promise<TCategory[]>;
      loadTopCategories: (txType: "income" | "expense") => Promise<TopCategory[]>;
      loadMerchantSuggestions: (
        txType: "income" | "expense"
      ) => Promise<MerchantSuggestion[]>;
    }) => {
      if (!userId) {
        return {
          categories: await loadCategories(),
          topCategories: {
            expense: await loadTopCategories("expense"),
            income: await loadTopCategories("income"),
          },
          merchantSuggestions: {
            expense: await loadMerchantSuggestions("expense"),
            income: await loadMerchantSuggestions("income"),
          },
        };
      }

      const categories = await cache.getOrLoad(
        cacheKeys.categories(accountId),
        loadCategories,
        META_24H,
        {
          userId,
          accountId,
          force,
          tags: [cacheTags.categories],
        }
      );

      const [topExpense, topIncome, merchantExpense, merchantIncome] =
        await Promise.all([
          cache.getOrLoad(
            cacheKeys.topCategories(accountId, "expense"),
            () => loadTopCategories("expense"),
            META_24H,
            {
              userId,
              accountId,
              force,
              tags: [cacheTags.topCategories],
            }
          ),
          cache.getOrLoad(
            cacheKeys.topCategories(accountId, "income"),
            () => loadTopCategories("income"),
            META_24H,
            {
              userId,
              accountId,
              force,
              tags: [cacheTags.topCategories],
            }
          ),
          cache.getOrLoad(
            cacheKeys.merchantSuggestions(accountId, "expense"),
            () => loadMerchantSuggestions("expense"),
            META_24H,
            {
              userId,
              accountId,
              force,
              tags: [cacheTags.merchants],
            }
          ),
          cache.getOrLoad(
            cacheKeys.merchantSuggestions(accountId, "income"),
            () => loadMerchantSuggestions("income"),
            META_24H,
            {
              userId,
              accountId,
              force,
              tags: [cacheTags.merchants],
            }
          ),
        ]);

      return {
        categories,
        topCategories: {
          expense: topExpense,
          income: topIncome,
        },
        merchantSuggestions: {
          expense: merchantExpense,
          income: merchantIncome,
        },
      };
    },
    [cache, userId]
  );
}

export function useCachedSavingsSummary() {
  const { cache, userId } = useDataCache();

  return useCallback(
    async <T>({
      accountId,
      period,
      loader,
      force,
    }: {
      accountId: string;
      period: string;
      loader: () => Promise<T>;
      force?: boolean;
    }) => {
      if (!userId) return loader();
      return cache.getOrLoad(
        cacheKeys.savingsSummary(accountId, period),
        loader,
        CORE_5M,
        {
          userId,
          accountId,
          force,
          tags: [cacheTags.savingsSummary],
        }
      );
    },
    [cache, userId]
  );
}

export function useCachedSavingsHistory() {
  const { cache, userId } = useDataCache();

  return useCallback(
    async <T>({
      accountId,
      loader,
      force,
    }: {
      accountId: string;
      loader: () => Promise<T>;
      force?: boolean;
    }) => {
      if (!userId) return loader();
      return cache.getOrLoad(cacheKeys.savingsHistory(accountId), loader, CORE_5M, {
        userId,
        accountId,
        force,
        tags: [cacheTags.savingsHistory],
      });
    },
    [cache, userId]
  );
}

export function useCachedSavingsGamification() {
  const { cache, userId } = useDataCache();

  return useCallback(
    async <T>({
      accountId,
      loader,
      force,
    }: {
      accountId: string;
      loader: () => Promise<T>;
      force?: boolean;
    }) => {
      if (!userId) return loader();
      return cache.getOrLoad(
        cacheKeys.savingsGamification(accountId),
        loader,
        CORE_5M,
        {
          userId,
          accountId,
          force,
          tags: [cacheTags.savingsGamification],
        }
      );
    },
    [cache, userId]
  );
}

export function useCachedHuchaAccumulated() {
  const { cache, userId } = useDataCache();

  return useCallback(
    async <T>({
      accountId,
      loader,
      force,
    }: {
      accountId: string;
      loader: () => Promise<T>;
      force?: boolean;
    }) => {
      if (!userId) return loader();
      return cache.getOrLoad(
        cacheKeys.huchaAccumulated(accountId),
        loader,
        CORE_5M,
        {
          userId,
          accountId,
          force,
          tags: [cacheTags.hucha],
        }
      );
    },
    [cache, userId]
  );
}

export function useCachedProjectsData() {
  const { cache, userId } = useDataCache();

  return useCallback(
    async <T>({
      accountId,
      loader,
      force,
    }: {
      accountId: string;
      loader: () => Promise<T>;
      force?: boolean;
    }) => {
      if (!userId) return loader();
      return cache.getOrLoad(cacheKeys.projects(accountId), loader, CORE_5M, {
        userId,
        accountId,
        force,
        tags: [cacheTags.projects],
      });
    },
    [cache, userId]
  );
}
