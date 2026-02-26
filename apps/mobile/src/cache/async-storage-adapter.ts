import AsyncStorage from "@react-native-async-storage/async-storage";
import type { CacheStorageAdapter } from "@poleursus/shared";

export async function clearAsyncStorageCachePrefixes(prefixes: string[]) {
  if (prefixes.length === 0) return;
  const keys = await AsyncStorage.getAllKeys();
  const keysToRemove = keys.filter((key) =>
    prefixes.some((prefix) => key.startsWith(prefix))
  );
  if (keysToRemove.length > 0) {
    await AsyncStorage.multiRemove(keysToRemove);
  }
}

export function createAsyncStorageCacheAdapter(prefix: string): CacheStorageAdapter {
  const toStorageKey = (key: string) => `${prefix}${key}`;
  const fromStorageKey = (key: string) => key.slice(prefix.length);

  return {
    async getItem(key) {
      return AsyncStorage.getItem(toStorageKey(key));
    },
    async setItem(key, value) {
      await AsyncStorage.setItem(toStorageKey(key), value);
    },
    async removeItem(key) {
      await AsyncStorage.removeItem(toStorageKey(key));
    },
    async getAllKeys() {
      const keys = await AsyncStorage.getAllKeys();
      return keys
        .filter((key) => key.startsWith(prefix))
        .map((key) => fromStorageKey(key));
    },
    async multiGet(keys) {
      if (keys.length === 0) return [];
      const rows = await AsyncStorage.multiGet(keys.map(toStorageKey));
      return rows.map(([key, value]) => [fromStorageKey(key), value]);
    },
    async multiSet(entries) {
      if (entries.length === 0) return;
      await AsyncStorage.multiSet(
        entries.map(([key, value]) => [toStorageKey(key), value])
      );
    },
    async multiRemove(keys) {
      if (keys.length === 0) return;
      await AsyncStorage.multiRemove(keys.map(toStorageKey));
    },
  };
}
