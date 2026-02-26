import { createDataCacheClient } from "@poleursus/shared";
import {
  clearLocalStorageCachePrefixes,
  createLocalStorageCacheAdapter,
} from "./local-storage-adapter";

const PREFIX = "finnon:data-cache:v1:";
const LEGACY_PREFIXES = ["finnon:data-cache:v0:"];

clearLocalStorageCachePrefixes(LEGACY_PREFIXES);

export const webDataCacheClient = createDataCacheClient({
  storage: createLocalStorageCacheAdapter(PREFIX),
  version: 1,
});
