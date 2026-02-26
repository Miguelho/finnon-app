import type { CacheStorageAdapter } from "@poleursus/shared";

const getStorage = () => {
  if (typeof window === "undefined") return null;
  return window.localStorage;
};

export function clearLocalStorageCachePrefixes(prefixes: string[]) {
  const storage = getStorage();
  if (!storage || prefixes.length === 0) return;
  const keysToRemove: string[] = [];
  for (let i = 0; i < storage.length; i += 1) {
    const key = storage.key(i);
    if (!key) continue;
    if (prefixes.some((prefix) => key.startsWith(prefix))) {
      keysToRemove.push(key);
    }
  }
  keysToRemove.forEach((key) => storage.removeItem(key));
}

export function createLocalStorageCacheAdapter(prefix: string): CacheStorageAdapter {
  const toStorageKey = (key: string) => `${prefix}${key}`;
  const fromStorageKey = (key: string) => key.slice(prefix.length);

  return {
    async getItem(key) {
      const storage = getStorage();
      if (!storage) return null;
      return storage.getItem(toStorageKey(key));
    },
    async setItem(key, value) {
      const storage = getStorage();
      if (!storage) return;
      storage.setItem(toStorageKey(key), value);
    },
    async removeItem(key) {
      const storage = getStorage();
      if (!storage) return;
      storage.removeItem(toStorageKey(key));
    },
    async getAllKeys() {
      const storage = getStorage();
      if (!storage) return [];
      const keys: string[] = [];
      for (let i = 0; i < storage.length; i += 1) {
        const key = storage.key(i);
        if (!key || !key.startsWith(prefix)) continue;
        keys.push(fromStorageKey(key));
      }
      return keys;
    },
    async multiGet(keys) {
      const storage = getStorage();
      if (!storage) return keys.map((key) => [key, null]);
      return keys.map((key) => [key, storage.getItem(toStorageKey(key))]);
    },
    async multiSet(entries) {
      const storage = getStorage();
      if (!storage) return;
      entries.forEach(([key, value]) => {
        storage.setItem(toStorageKey(key), value);
      });
    },
    async multiRemove(keys) {
      const storage = getStorage();
      if (!storage) return;
      keys.forEach((key) => {
        storage.removeItem(toStorageKey(key));
      });
    },
  };
}
