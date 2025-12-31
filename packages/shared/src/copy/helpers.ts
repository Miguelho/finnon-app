import { en } from "./locales/en";
import { es } from "./locales/es";
import type { CopyParams, CopyRecord, LeafKeys, PluralForms } from "./types";

const dictionaries = { en, es } as const;
const fallbackLocale = "es";

const isPluralForms = (value: unknown): value is PluralForms => {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return typeof record.one === "string" && typeof record.other === "string";
};

const interpolate = (template: string, params?: CopyParams) => {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (match, key) => {
    const value = params[key];
    if (value === undefined || value === null) return match;
    return String(value);
  });
};

export function getDictionary(locale: string) {
  const normalized = (locale || "").toLowerCase();
  const base = normalized.split("-")[0] || fallbackLocale;
  return dictionaries[base as keyof typeof dictionaries] ?? dictionaries[fallbackLocale];
}

export function pluralize(locale: string, forms: PluralForms, count: number) {
  const safeCount = Number.isFinite(count) ? count : 0;
  if (safeCount === 0 && forms.zero) return forms.zero;
  if (safeCount === 1) return forms.one;
  return forms.other;
}

export function t<D extends CopyRecord, K extends LeafKeys<D>>(
  dict: D,
  key: K,
  params?: CopyParams & { locale?: string; count?: number }
) {
  const value = String(key)
    .split(".")
    .reduce<unknown>((acc, part) => {
      if (!acc || typeof acc !== "object") return undefined;
      return (acc as Record<string, unknown>)[part];
    }, dict as unknown);

  if (typeof value === "string") {
    return interpolate(value, params);
  }

  if (isPluralForms(value)) {
    const count = Number(params?.count ?? 0);
    const locale = params?.locale ?? fallbackLocale;
    const choice = pluralize(locale, value, count);
    return interpolate(choice, { ...params, count });
  }

  return String(key);
}

export function formatParticipantCount(locale: string, count: number) {
  const dict = getDictionary(locale);
  return t(dict, "home.participantsCount", { count, locale });
}
