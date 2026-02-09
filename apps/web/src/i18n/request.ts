import { getRequestConfig } from "next-intl/server";
import { cookies, headers } from "next/headers";
import { getDictionary } from "@poleursus/shared";

export const locales = ["en", "es"] as const;
export type Locale = (typeof locales)[number];

export default getRequestConfig(async () => {
  // Get locale from cookie or detect from browser language
  const cookieStore = await cookies();
  const cookieLocale = cookieStore.get("NEXT_LOCALE")?.value as Locale | undefined;
  if (cookieLocale) {
    return {
      locale: cookieLocale,
      messages: getDictionary(cookieLocale),
    };
  }

  const acceptLanguage = (await headers()).get("accept-language") ?? "";
  const normalized = acceptLanguage.toLowerCase();
  const locale: Locale = normalized.includes("es")
    ? "es"
    : normalized.includes("en")
      ? "en"
      : "es";

  return {
    locale,
    messages: getDictionary(locale),
  };
});
