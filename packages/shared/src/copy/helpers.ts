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

const parseIcuPluralForms = (body: string): Record<string, string> => {
  const forms: Record<string, string> = {};
  const selectorRegex = /^(=\d+|zero|one|two|few|many|other)/;
  let cursor = 0;

  while (cursor < body.length) {
    while (cursor < body.length && /\s/.test(body.charAt(cursor))) {
      cursor += 1;
    }

    const selectorMatch = selectorRegex.exec(body.slice(cursor));
    if (!selectorMatch) {
      cursor += 1;
      continue;
    }

    const selector = selectorMatch[1];
    if (!selector) {
      cursor += 1;
      continue;
    }
    cursor += selectorMatch[0].length;

    while (cursor < body.length && /\s/.test(body.charAt(cursor))) {
      cursor += 1;
    }

    if (body.charAt(cursor) !== "{") {
      continue;
    }

    cursor += 1;
    const valueStart = cursor;
    let depth = 1;

    while (cursor < body.length && depth > 0) {
      const char = body.charAt(cursor);
      if (char === "{") depth += 1;
      if (char === "}") depth -= 1;
      cursor += 1;
    }

    if (depth === 0) {
      forms[selector] = body.slice(valueStart, cursor - 1).trim();
    }
  }

  return forms;
};

const resolveIcuPlural = (template: string, params?: CopyParams) => {
  const match = template.match(
    /^\{\s*(\w+)\s*,\s*plural\s*,([\s\S]+)\}$/
  );
  if (!match) return null;

  const countKey = match[1];
  const body = match[2];
  if (!countKey || !body) return null;
  const forms = parseIcuPluralForms(body);

  if (!Object.keys(forms).length) return null;

  const rawCount = params?.[countKey];
  const count = Number.isFinite(Number(rawCount)) ? Number(rawCount) : 0;
  const exactKey = `=${count}`;
  let choice =
    forms[exactKey] ??
    (count === 0 ? forms.zero : undefined) ??
    (count === 1 ? forms.one : undefined) ??
    forms.other;

  if (!choice) return null;

  const withCount = choice.replace(/#/g, String(count));
  return interpolate(withCount, { ...params, [countKey]: count });
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
    const resolvedPlural = resolveIcuPlural(value, params);
    if (resolvedPlural) return resolvedPlural;
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
