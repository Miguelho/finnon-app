import { useState, useEffect, useMemo, createContext, useContext, ReactNode } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getDictionary, t, pluralize, formatParticipantCount } from "@poleursus/shared";
import type { CopyDictionary } from "@poleursus/shared";

const LOCALE_KEY = "@finnon/locale";
const fallbackLocale = "es";

export const getDeviceLocale = () => {
  const resolved = Intl.DateTimeFormat().resolvedOptions().locale;
  return resolved || fallbackLocale;
};

type LocaleContextType = {
  locale: string;
  dictionary: CopyDictionary;
  setLocale: (locale: string) => Promise<void>;
  isLoading: boolean;
};

const LocaleContext = createContext<LocaleContextType | undefined>(undefined);

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<string>(fallbackLocale);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadLocale = async () => {
      try {
        const stored = await AsyncStorage.getItem(LOCALE_KEY);
        if (stored) {
          setLocaleState(stored);
        } else {
          // Use device locale as default
          const deviceLocale = getDeviceLocale();
          const normalizedLocale = deviceLocale.startsWith("en") ? "en" : "es";
          setLocaleState(normalizedLocale);
        }
      } catch (err) {
        console.error("[i18n] Error loading locale:", err);
      } finally {
        setIsLoading(false);
      }
    };
    loadLocale();
  }, []);

  const setLocale = async (newLocale: string) => {
    try {
      await AsyncStorage.setItem(LOCALE_KEY, newLocale);
      setLocaleState(newLocale);
    } catch (err) {
      console.error("[i18n] Error saving locale:", err);
    }
  };

  const dictionary = useMemo(() => getDictionary(locale), [locale]);

  return (
    <LocaleContext.Provider value={{ locale, dictionary, setLocale, isLoading }}>
      {children}
    </LocaleContext.Provider>
  );
}

export const useCopy = (): { locale: string; dictionary: CopyDictionary } => {
  const context = useContext(LocaleContext);
  // Fallback values for when outside provider (shouldn't happen but just in case)
  const fallbackLocale = useMemo(() => getDeviceLocale(), []);
  const fallbackDictionary = useMemo(() => getDictionary(fallbackLocale), [fallbackLocale]);

  if (context) {
    return { locale: context.locale, dictionary: context.dictionary };
  }
  return { locale: fallbackLocale, dictionary: fallbackDictionary };
};

export const useLocale = () => {
  const context = useContext(LocaleContext);
  if (!context) {
    throw new Error("useLocale must be used within a LocaleProvider");
  }
  return context;
};

export { t, pluralize, formatParticipantCount };
