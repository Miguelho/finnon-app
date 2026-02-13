import type { MerchantSuggestion, TopCategory } from "@poleursus/shared";

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
};

type AddActionDataCacheEntry = {
  payload: AddActionDataPayload | null;
  updatedAt: number;
  inFlight?: Promise<AddActionDataPayload>;
};

type LoadAddActionDataOptions = {
  force?: boolean;
};

const addActionDataCache = new Map<string, AddActionDataCacheEntry>();

export const ADD_ACTION_DATA_TTL_MS = 7 * 60 * 1000;

function createEmptyPayload(): AddActionDataPayload {
  return {
    categories: [],
    topCategories: { expense: [], income: [] },
    merchantSuggestions: { expense: [], income: [] },
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
  };
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

  const entry = addActionDataCache.get(accountId);
  if (entry?.inFlight) {
    return entry.inFlight;
  }

  if (entry?.payload && !options.force) {
    const isFresh = Date.now() - entry.updatedAt < ADD_ACTION_DATA_TTL_MS;
    if (isFresh) {
      return entry.payload;
    }
  }

  const previousPayload = entry?.payload ?? null;
  const previousUpdatedAt = entry?.updatedAt ?? 0;

  const inFlight = (async () => {
    const response = await fetch(
      `/api/add-action-data?accountId=${encodeURIComponent(accountId)}`,
      { cache: "no-store" }
    );
    if (!response.ok) {
      throw new Error("Failed to load add action data");
    }

    const payload = normalizePayload(await response.json());
    addActionDataCache.set(accountId, {
      payload,
      updatedAt: Date.now(),
    });
    return payload;
  })();

  addActionDataCache.set(accountId, {
    payload: previousPayload,
    updatedAt: previousUpdatedAt,
    inFlight,
  });

  try {
    return await inFlight;
  } catch (error) {
    if (previousPayload) {
      addActionDataCache.set(accountId, {
        payload: previousPayload,
        updatedAt: previousUpdatedAt,
      });
    } else {
      addActionDataCache.delete(accountId);
    }
    throw error;
  }
}

export function primeAddActionData(
  accountId: string,
  payload: AddActionDataPayload
) {
  if (!accountId) return;
  const existing = addActionDataCache.get(accountId);
  addActionDataCache.set(accountId, {
    payload: normalizePayload(payload),
    updatedAt: Date.now(),
    inFlight: existing?.inFlight,
  });
}

export function clearAddActionDataCache(accountId?: string) {
  if (accountId) {
    addActionDataCache.delete(accountId);
    return;
  }
  addActionDataCache.clear();
}

export function getEmptyAddActionDataPayload(): AddActionDataPayload {
  return createEmptyPayload();
}
