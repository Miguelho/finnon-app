import { useMemo } from "react";
import { getDictionary, t, pluralize, formatParticipantCount } from "@poleursus/shared";
import type { CopyDictionary } from "@poleursus/shared";

const fallbackLocale = "es";

export const getDeviceLocale = () => {
  const resolved = Intl.DateTimeFormat().resolvedOptions().locale;
  return resolved || fallbackLocale;
};

export const useCopy = (): { locale: string; dictionary: CopyDictionary } => {
  const locale = useMemo(() => getDeviceLocale(), []);
  const dictionary = useMemo(() => getDictionary(locale), [locale]);
  return { locale, dictionary };
};

export { t, pluralize, formatParticipantCount };
