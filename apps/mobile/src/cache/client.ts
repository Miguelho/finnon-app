import { createDataCacheClient } from "@poleursus/shared";
import {
  clearAsyncStorageCachePrefixes,
  createAsyncStorageCacheAdapter,
} from "./async-storage-adapter";

const PREFIX = "finnon:data-cache:v1:";
const LEGACY_PREFIXES = ["finnon:data-cache:v0:"];

void clearAsyncStorageCachePrefixes(LEGACY_PREFIXES);

export const mobileDataCacheClient = createDataCacheClient({
  storage: createAsyncStorageCacheAdapter(PREFIX),
  version: 1,
});
