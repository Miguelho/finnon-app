import type { CachePolicy } from "./types";

export const CORE_5M: CachePolicy = {
  staleMs: 5 * 60 * 1000,
  expireMs: 24 * 60 * 60 * 1000,
};

export const META_24H: CachePolicy = {
  staleMs: 24 * 60 * 60 * 1000,
  expireMs: 7 * 24 * 60 * 60 * 1000,
};
