export type CacheKey = string;

export type CacheTag = string;

export type CachePolicy = {
  staleMs: number;
  expireMs: number;
};

export type CacheEnvelope<T> = {
  version: number;
  userId: string;
  accountId?: string | null;
  key: CacheKey;
  data: T;
  updatedAt: number;
  staleAt: number;
  expiresAt: number;
  tags: CacheTag[];
};

export type CacheStorageAdapter = {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
  removeItem: (key: string) => Promise<void>;
  getAllKeys: () => Promise<string[]>;
  multiGet: (keys: string[]) => Promise<Array<[string, string | null]>>;
  multiSet: (entries: Array<[string, string]>) => Promise<void>;
  multiRemove: (keys: string[]) => Promise<void>;
};

export type CacheEvent =
  | {
      type: "prime";
      key: CacheKey;
      tags: CacheTag[];
    }
  | {
      type: "invalidate";
      keys: CacheKey[];
      tags: CacheTag[];
    }
  | {
      type: "clear";
      userId?: string;
    };

export type CacheLoadOptions = {
  userId: string;
  accountId?: string | null;
  tags?: CacheTag[];
  force?: boolean;
  staleWhileRevalidate?: boolean;
};

export type CacheClient = {
  getOrLoad: <T>(
    key: CacheKey,
    loader: () => Promise<T>,
    policy: CachePolicy,
    options: CacheLoadOptions
  ) => Promise<T>;
  prime: <T>(entry: CacheEnvelope<T>) => Promise<void>;
  peek: <T>(key: CacheKey) => Promise<CacheEnvelope<T> | null>;
  invalidateByKeys: (keys: CacheKey[]) => Promise<void>;
  invalidateByTags: (tags: CacheTag[]) => Promise<void>;
  clearByUser: (userId: string) => Promise<void>;
  clearAll: () => Promise<void>;
  subscribe: (listener: (event: CacheEvent) => void) => () => void;
};
