import type {
  CacheClient,
  CacheEnvelope,
  CacheEvent,
  CacheKey,
  CacheLoadOptions,
  CachePolicy,
  CacheStorageAdapter,
  CacheTag,
} from "./types";

type CreateDataCacheClientOptions = {
  storage: CacheStorageAdapter;
  version?: number;
  gcWriteInterval?: number;
  debug?: boolean;
};

const DEFAULT_VERSION = 1;
const DEFAULT_GC_WRITE_INTERVAL = 50;

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const isCacheEnvelope = <T>(
  value: unknown,
  version: number
): value is CacheEnvelope<T> => {
  if (!isObject(value)) return false;
  if (value.version !== version) return false;
  if (typeof value.userId !== "string") return false;
  if (typeof value.key !== "string") return false;
  if (typeof value.updatedAt !== "number") return false;
  if (typeof value.staleAt !== "number") return false;
  if (typeof value.expiresAt !== "number") return false;
  if (!Array.isArray(value.tags)) return false;
  return true;
};

const dedupeTags = (tags: CacheTag[] | undefined) =>
  Array.from(new Set((tags ?? []).filter(Boolean)));

function shouldDebug(optionsDebug: boolean | undefined): boolean {
  if (typeof optionsDebug === "boolean") return optionsDebug;
  try {
    const env = (globalThis as { process?: { env?: Record<string, string> } })
      .process?.env;
    return env?.FINNON_CACHE_DEBUG === "1";
  } catch {
    return false;
  }
}

export function createDataCacheClient({
  storage,
  version = DEFAULT_VERSION,
  gcWriteInterval = DEFAULT_GC_WRITE_INTERVAL,
  debug,
}: CreateDataCacheClientOptions): CacheClient {
  const memory = new Map<CacheKey, CacheEnvelope<unknown>>();
  const listeners = new Set<(event: CacheEvent) => void>();
  const inFlight = new Map<CacheKey, Promise<unknown>>();
  const backgroundRevalidating = new Set<CacheKey>();
  const isDebug = shouldDebug(debug);
  let hydrated = false;
  let gcWriteCounter = 0;

  const log = (...args: unknown[]) => {
    if (!isDebug) return;
    // eslint-disable-next-line no-console
    console.log("[DataCache]", ...args);
  };

  const emit = (event: CacheEvent) => {
    listeners.forEach((listener) => {
      try {
        listener(event);
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error("[DataCache] subscriber error", error);
      }
    });
  };

  const persistEnvelope = async (entry: CacheEnvelope<unknown>) => {
    await storage.setItem(entry.key, JSON.stringify(entry));
    gcWriteCounter += 1;
    if (gcWriteCounter >= gcWriteInterval) {
      gcWriteCounter = 0;
      await gcExpiredEntries();
    }
  };

  const gcExpiredEntries = async () => {
    const now = Date.now();
    const expiredKeys = Array.from(memory.entries())
      .filter(([, entry]) => entry.expiresAt <= now)
      .map(([key]) => key);

    if (expiredKeys.length > 0) {
      expiredKeys.forEach((key) => memory.delete(key));
      await storage.multiRemove(expiredKeys);
      log("gc expired keys", expiredKeys.length);
    }
  };

  const ensureHydrated = async () => {
    if (hydrated) return;
    hydrated = true;

    const keys = await storage.getAllKeys();
    if (keys.length === 0) return;

    const now = Date.now();
    const rows = await storage.multiGet(keys);
    const expired: string[] = [];

    rows.forEach(([key, raw]) => {
      if (!raw) return;

      try {
        const parsed = JSON.parse(raw);
        if (!isCacheEnvelope(parsed, version)) {
          expired.push(key);
          return;
        }

        if (parsed.expiresAt <= now) {
          expired.push(key);
          return;
        }

        memory.set(parsed.key, parsed);
      } catch {
        expired.push(key);
      }
    });

    if (expired.length > 0) {
      await storage.multiRemove(expired);
    }

    log("hydrated keys", memory.size);
  };

  const writeLoadedEntry = async <T>(
    key: CacheKey,
    data: T,
    policy: CachePolicy,
    options: CacheLoadOptions
  ) => {
    const now = Date.now();
    const entry: CacheEnvelope<T> = {
      version,
      userId: options.userId,
      accountId: options.accountId,
      key,
      data,
      updatedAt: now,
      staleAt: now + policy.staleMs,
      expiresAt: now + policy.expireMs,
      tags: dedupeTags(options.tags),
    };

    memory.set(key, entry as CacheEnvelope<unknown>);
    await persistEnvelope(entry as CacheEnvelope<unknown>);
    emit({ type: "prime", key, tags: entry.tags });
    return data;
  };

  const loadFresh = async <T>(
    key: CacheKey,
    loader: () => Promise<T>,
    policy: CachePolicy,
    options: CacheLoadOptions
  ): Promise<T> => {
    const existing = inFlight.get(key) as Promise<T> | undefined;
    if (existing) {
      return existing;
    }

    const run = (async () => {
      const data = await loader();
      return writeLoadedEntry(key, data, policy, options);
    })();

    inFlight.set(key, run as Promise<unknown>);

    try {
      return await run;
    } finally {
      inFlight.delete(key);
    }
  };

  const removeKeys = async (keys: CacheKey[]) => {
    if (keys.length === 0) return;
    keys.forEach((key) => memory.delete(key));
    await storage.multiRemove(keys);
  };

  return {
    async getOrLoad<T>(
      key: CacheKey,
      loader: () => Promise<T>,
      policy: CachePolicy,
      options: CacheLoadOptions
    ): Promise<T> {
      await ensureHydrated();

      const staleWhileRevalidate = options.staleWhileRevalidate ?? true;
      const now = Date.now();
      const cached = memory.get(key) as CacheEnvelope<T> | undefined;

      if (!options.force && cached) {
        if (cached.expiresAt <= now) {
          await removeKeys([key]);
        } else if (cached.staleAt > now) {
          log("hit", key);
          return cached.data;
        } else if (staleWhileRevalidate) {
          log("stale-hit", key);
          if (!backgroundRevalidating.has(key)) {
            backgroundRevalidating.add(key);
            void loadFresh(key, loader, policy, options)
              .catch((error) => {
                // eslint-disable-next-line no-console
                console.warn("[DataCache] background revalidate failed", key, error);
              })
              .finally(() => {
                backgroundRevalidating.delete(key);
              });
          }
          return cached.data;
        }
      }

      log("miss", key);
      return loadFresh(key, loader, policy, options);
    },

    async prime<T>(entry: CacheEnvelope<T>) {
      await ensureHydrated();
      if (!isCacheEnvelope(entry, version)) return;
      if (entry.expiresAt <= Date.now()) return;

      const normalized: CacheEnvelope<T> = {
        ...entry,
        version,
        tags: dedupeTags(entry.tags),
      };

      memory.set(normalized.key, normalized as CacheEnvelope<unknown>);
      await persistEnvelope(normalized as CacheEnvelope<unknown>);
      emit({ type: "prime", key: normalized.key, tags: normalized.tags });
    },

    async peek<T>(key: CacheKey): Promise<CacheEnvelope<T> | null> {
      await ensureHydrated();
      const entry = memory.get(key) as CacheEnvelope<T> | undefined;
      if (!entry) return null;
      if (entry.expiresAt <= Date.now()) {
        await removeKeys([key]);
        return null;
      }
      return entry;
    },

    async invalidateByKeys(keys: CacheKey[]) {
      await ensureHydrated();
      const uniqueKeys = Array.from(new Set(keys.filter(Boolean)));
      if (uniqueKeys.length === 0) return;

      await removeKeys(uniqueKeys);
      emit({ type: "invalidate", keys: uniqueKeys, tags: [] });
    },

    async invalidateByTags(tags: CacheTag[]) {
      await ensureHydrated();
      const uniqueTags = dedupeTags(tags);
      if (uniqueTags.length === 0) return;

      const keys = Array.from(memory.entries())
        .filter(([, entry]) => entry.tags.some((tag) => uniqueTags.includes(tag)))
        .map(([key]) => key);

      await removeKeys(keys);
      emit({ type: "invalidate", keys, tags: uniqueTags });
    },

    async clearByUser(userId: string) {
      await ensureHydrated();
      const keys = Array.from(memory.entries())
        .filter(([, entry]) => entry.userId === userId)
        .map(([key]) => key);
      await removeKeys(keys);
      emit({ type: "clear", userId });
    },

    async clearAll() {
      await ensureHydrated();
      const keys = Array.from(memory.keys());
      memory.clear();
      await storage.multiRemove(keys);
      emit({ type: "clear" });
    },

    subscribe(listener: (event: CacheEvent) => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
