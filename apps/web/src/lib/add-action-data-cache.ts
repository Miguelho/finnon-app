import {
  CORE_5M,
  cacheTags,
  type MerchantSuggestion,
  type TopCategory,
  type CacheEnvelope,
} from "@poleursus/shared";
import { webDataCacheClient } from "@/cache/client";

export type AddActionCategory = {
  id: string;
  name: string;
  icon_id: string;
  type: "income" | "expense";
};

export type AddActionDataPayload = {
  categories: AddActionCategory[];
  topCategories: {
    expense: TopCategory[];
    income: TopCategory[];
  };
  merchantSuggestions: {
    expense: MerchantSuggestion[];
    income: MerchantSuggestion[];
  };
  participants: Array<{
    userId: string;
    name: string;
    role: "viewer" | "contributor" | "admin";
  }>;
  currentUserId: string | null;
};

type AddActionDataCacheEntry = {
  payload: AddActionDataPayload | null;
  updatedAt: number;
};

type LoadAddActionDataOptions = {
  force?: boolean;
};

const addActionDataCache = new Map<string, AddActionDataCacheEntry>();

export const ADD_ACTION_DATA_TTL_MS = 7 * 60 * 1000;

const getAddActionDataKey = (accountId: string) => `add_action_data:${accountId}`;

function createEmptyPayload(): AddActionDataPayload {
  return {
    categories: [],
    topCategories: { expense: [], income: [] },
    merchantSuggestions: { expense: [], income: [] },
    participants: [],
    currentUserId: null,
  };
}

function normalizePayload(value: unknown): AddActionDataPayload {
  const raw = (value ?? {}) as Partial<AddActionDataPayload>;
  return {
    categories: Array.isArray(raw.categories) ? raw.categories : [],
    topCategories: {
      expense: Array.isArray(raw.topCategories?.expense)
        ? raw.topCategories.expense
        : [],
      income: Array.isArray(raw.topCategories?.income)
        ? raw.topCategories.income
        : [],
    },
    merchantSuggestions: {
      expense: Array.isArray(raw.merchantSuggestions?.expense)
        ? raw.merchantSuggestions.expense
        : [],
      income: Array.isArray(raw.merchantSuggestions?.income)
        ? raw.merchantSuggestions.income
        : [],
    },
    participants: Array.isArray(raw.participants) ? raw.participants : [],
    currentUserId:
      typeof raw.currentUserId === "string" ? raw.currentUserId : null,
  };
}

function cacheSnapshot(accountId: string, payload: AddActionDataPayload | null) {
  addActionDataCache.set(accountId, {
    payload,
    updatedAt: Date.now(),
  });
}

export function getAddActionDataSnapshot(accountId: string): {
  payload: AddActionDataPayload | null;
  isStale: boolean;
} {
  if (!accountId) return { payload: null, isStale: true };

  const entry = addActionDataCache.get(accountId);
  if (!entry?.payload) return { payload: null, isStale: true };

  const isStale = Date.now() - entry.updatedAt >= ADD_ACTION_DATA_TTL_MS;
  return { payload: entry.payload, isStale };
}

export async function loadAddActionData(
  accountId: string,
  options: LoadAddActionDataOptions = {}
): Promise<AddActionDataPayload> {
  if (!accountId) {
    throw new Error("Missing accountId");
  }

  const currentUserId =
    typeof window === "undefined"
      ? "unknown"
      : (window.localStorage.getItem("finnon:currentUserId") ?? "unknown");

  const payload = await webDataCacheClient.getOrLoad(
    getAddActionDataKey(accountId),
    async () => {
      const response = await fetch(
        `/api/add-action-data?accountId=${encodeURIComponent(accountId)}`,
        { cache: "no-store" }
      );
      if (!response.ok) {
        throw new Error("Failed to load add action data");
      }
      return normalizePayload(await response.json());
    },
    CORE_5M,
    {
      userId: currentUserId,
      accountId,
      force: options.force,
      tags: [cacheTags.categories, cacheTags.topCategories, cacheTags.merchants],
    }
  );

  cacheSnapshot(accountId, payload);

  if (payload.currentUserId) {
    try {
      window.localStorage.setItem("finnon:currentUserId", payload.currentUserId);
    } catch {
      // ignore storage write errors
    }
  }

  return payload;
}

export function primeAddActionData(
  accountId: string,
  payload: AddActionDataPayload
) {
  if (!accountId) return;
  const normalized = normalizePayload(payload);
  cacheSnapshot(accountId, normalized);

  const currentUserId =
    typeof window === "undefined"
      ? "unknown"
      : (window.localStorage.getItem("finnon:currentUserId") ?? "unknown");

  const now = Date.now();
  const entry: CacheEnvelope<AddActionDataPayload> = {
    version: 1,
    userId: currentUserId,
    accountId,
    key: getAddActionDataKey(accountId),
    data: normalized,
    updatedAt: now,
    staleAt: now + ADD_ACTION_DATA_TTL_MS,
    expiresAt: now + 24 * 60 * 60 * 1000,
    tags: [cacheTags.categories, cacheTags.topCategories, cacheTags.merchants],
  };

  void webDataCacheClient.prime(entry);
}

export function clearAddActionDataCache(accountId?: string) {
  if (accountId) {
    addActionDataCache.delete(accountId);
    void webDataCacheClient.invalidateByKeys([getAddActionDataKey(accountId)]);
    return;
  }

  addActionDataCache.clear();
  void webDataCacheClient.clearAll();
}

export function getEmptyAddActionDataPayload(): AddActionDataPayload {
  return createEmptyPayload();
}
