"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { createClient } from "@/lib/supabase/client";
import {
  DEFAULT_USER_THEME,
  DEFAULT_USER_THEME_MODE,
  getUserThemeId,
  getUserThemeMode,
  resolveUserThemeTokens,
  type ResolvedThemeMode,
  type UserThemeId,
  type UserThemeMode,
  type UserThemeTokens,
} from "@poleursus/shared";
import {
  USER_THEME_PREFERENCES_STORAGE_KEY,
  USER_THEME_PREHYDRATE_STYLE_ID,
} from "./user-theme-storage";

type ThemePreferences = {
  theme: UserThemeId;
  colorMode: UserThemeMode;
};

type WebUserThemeContextValue = {
  theme: UserThemeId;
  colorMode: UserThemeMode;
  resolvedMode: ResolvedThemeMode;
  tokens: UserThemeTokens;
  primaryActionColor: string;
  primaryActionTextColor: string;
  setThemePreferences: (next: Partial<ThemePreferences>) => void;
  reloadThemePreferences: () => Promise<void>;
};

const defaultThemePreferences: ThemePreferences = {
  theme: DEFAULT_USER_THEME,
  colorMode: DEFAULT_USER_THEME_MODE,
};

type CachedThemePreferences = {
  theme?: unknown;
  colorMode?: unknown;
};

const fallbackTokens = resolveUserThemeTokens(
  DEFAULT_USER_THEME,
  DEFAULT_USER_THEME_MODE,
  "light"
);

const fallbackValue: WebUserThemeContextValue = {
  theme: DEFAULT_USER_THEME,
  colorMode: DEFAULT_USER_THEME_MODE,
  resolvedMode: "light",
  tokens: fallbackTokens,
  primaryActionColor: fallbackTokens.primary,
  primaryActionTextColor: "#FFFFFF",
  setThemePreferences: () => {},
  reloadThemePreferences: async () => {},
};

const WebUserThemeContext =
  createContext<WebUserThemeContextValue>(fallbackValue);

function writeCachedThemePreferences(preferences: ThemePreferences) {
  if (typeof window === "undefined") return;

  window.localStorage.setItem(
    USER_THEME_PREFERENCES_STORAGE_KEY,
    JSON.stringify(preferences)
  );
}

function clearCachedThemePreferences() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(USER_THEME_PREFERENCES_STORAGE_KEY);
}

function clearPrehydrateThemeStyle() {
  if (typeof document === "undefined") return;
  const styleElement = document.getElementById(USER_THEME_PREHYDRATE_STYLE_ID);
  if (!(styleElement instanceof HTMLStyleElement)) return;
  styleElement.textContent = "";
}

function getReadableTextColor(hexColor: string): string {
  const normalized = hexColor.replace("#", "");
  const expanded =
    normalized.length === 3
      ? normalized
          .split("")
          .map((chunk) => chunk + chunk)
          .join("")
      : normalized;

  if (expanded.length !== 6) return "#FFFFFF";

  const red = parseInt(expanded.slice(0, 2), 16);
  const green = parseInt(expanded.slice(2, 4), 16);
  const blue = parseInt(expanded.slice(4, 6), 16);

  if ([red, green, blue].some((value) => Number.isNaN(value))) {
    return "#FFFFFF";
  }

  const luminance = (red * 299 + green * 587 + blue * 114) / 1000;
  return luminance > 160 ? "#111111" : "#FFFFFF";
}

function hexToHslToken(hexColor: string): string {
  const normalized = hexColor.replace("#", "");
  const expanded =
    normalized.length === 3
      ? normalized
          .split("")
          .map((chunk) => chunk + chunk)
          .join("")
      : normalized;

  if (expanded.length !== 6) return "0 0% 100%";

  const red = parseInt(expanded.slice(0, 2), 16) / 255;
  const green = parseInt(expanded.slice(2, 4), 16) / 255;
  const blue = parseInt(expanded.slice(4, 6), 16) / 255;

  if ([red, green, blue].some((value) => Number.isNaN(value))) {
    return "0 0% 100%";
  }

  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  const delta = max - min;

  let hue = 0;
  if (delta !== 0) {
    if (max === red) hue = ((green - blue) / delta) % 6;
    else if (max === green) hue = (blue - red) / delta + 2;
    else hue = (red - green) / delta + 4;
  }

  hue = Math.round((hue * 60 + 360) % 360);
  const lightness = (max + min) / 2;
  const saturation =
    delta === 0 ? 0 : delta / (1 - Math.abs(2 * lightness - 1));

  const satPct = Math.round(saturation * 1000) / 10;
  const lightPct = Math.round(lightness * 1000) / 10;
  return `${hue} ${satPct}% ${lightPct}%`;
}

type AccountSemanticColors = {
  income: string;
  incomeBg: string;
  incomeLight: string;
  expense: string;
  expenseBg: string;
  expenseLight: string;
  categoryCasa: string;
  categoryFamilia: string;
  categoryOcio: string;
  categoryRestaurantes: string;
  categoryInterests: string;
  categoryLottery: string;
  categoryDefault: string;
  categoryIcon: string;
};

function getAccountSemanticColors(mode: ResolvedThemeMode): AccountSemanticColors {
  if (mode === "dark") {
    return {
      income: "#22A06B",
      incomeBg: "#183026",
      incomeLight: "#24513F",
      expense: "#DE350B",
      expenseBg: "#382022",
      expenseLight: "#5A2E32",
      categoryCasa: "#3A3420",
      categoryFamilia: "#392633",
      categoryOcio: "#233148",
      categoryRestaurantes: "#3A2C1F",
      categoryInterests: "#1E3932",
      categoryLottery: "#2D2943",
      categoryDefault: "#2A2D34",
      categoryIcon: "#FFFFFF",
    };
  }

  return {
    income: "#22A06B",
    incomeBg: "#E6F9F0",
    incomeLight: "#C8E6CD",
    expense: "#DE350B",
    expenseBg: "#FFF0E6",
    expenseLight: "#F8D7CF",
    categoryCasa: "#FEF3C7",
    categoryFamilia: "#FCE7F3",
    categoryOcio: "#E0E7FF",
    categoryRestaurantes: "#FFEDD5",
    categoryInterests: "#D1FAE5",
    categoryLottery: "#EDE9FE",
    categoryDefault: "#F3F4F6",
    categoryIcon: "#1A1A18",
  };
}

function applyThemeCssVariables(
  tokens: UserThemeTokens,
  primaryTextHex: string,
  resolvedMode: ResolvedThemeMode,
  withDarkClass: boolean
) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  const accountColors = getAccountSemanticColors(resolvedMode);

  root.style.setProperty("--background", hexToHslToken(tokens.background));
  root.style.setProperty("--foreground", hexToHslToken(tokens.textPrimary));
  root.style.setProperty("--card", hexToHslToken(tokens.surface));
  root.style.setProperty("--card-foreground", hexToHslToken(tokens.textPrimary));
  root.style.setProperty("--popover", hexToHslToken(tokens.surface));
  root.style.setProperty("--popover-foreground", hexToHslToken(tokens.textPrimary));
  root.style.setProperty("--secondary", hexToHslToken(tokens.surfaceAlt));
  root.style.setProperty(
    "--secondary-foreground",
    hexToHslToken(tokens.textPrimary)
  );
  root.style.setProperty("--muted", hexToHslToken(tokens.surfaceAlt));
  root.style.setProperty(
    "--muted-foreground",
    hexToHslToken(tokens.textSecondary)
  );
  root.style.setProperty("--accent", hexToHslToken(tokens.surfaceAlt));
  root.style.setProperty("--accent-foreground", hexToHslToken(tokens.textPrimary));
  root.style.setProperty("--border", hexToHslToken(tokens.border));
  root.style.setProperty("--input", hexToHslToken(tokens.border));
  root.style.setProperty("--primary", hexToHslToken(tokens.primary));
  root.style.setProperty("--primary-foreground", hexToHslToken(primaryTextHex));
  root.style.setProperty("--ring", hexToHslToken(tokens.primary));
  root.style.setProperty("--account-bg", tokens.background);
  root.style.setProperty("--account-surface", tokens.surface);
  root.style.setProperty("--account-surface-alt", tokens.surfaceAlt);
  root.style.setProperty("--account-border", tokens.border);
  root.style.setProperty("--account-border-light", tokens.border);
  root.style.setProperty("--account-text-primary", tokens.textPrimary);
  root.style.setProperty("--account-text-secondary", tokens.textSecondary);
  root.style.setProperty("--account-text-tertiary", tokens.textSecondary);
  root.style.setProperty("--account-income", accountColors.income);
  root.style.setProperty("--account-income-bg", accountColors.incomeBg);
  root.style.setProperty("--account-income-light", accountColors.incomeLight);
  root.style.setProperty("--account-expense", accountColors.expense);
  root.style.setProperty("--account-expense-bg", accountColors.expenseBg);
  root.style.setProperty("--account-expense-light", accountColors.expenseLight);
  root.style.setProperty("--account-accent", tokens.primary);
  root.style.setProperty("--account-accent-bg", tokens.surfaceAlt);
  root.style.setProperty("--account-category-casa", accountColors.categoryCasa);
  root.style.setProperty("--account-category-familia", accountColors.categoryFamilia);
  root.style.setProperty("--account-category-ocio", accountColors.categoryOcio);
  root.style.setProperty(
    "--account-category-restaurantes",
    accountColors.categoryRestaurantes
  );
  root.style.setProperty("--account-category-interests", accountColors.categoryInterests);
  root.style.setProperty("--account-category-lottery", accountColors.categoryLottery);
  root.style.setProperty("--account-category-default", accountColors.categoryDefault);
  root.style.setProperty("--account-category-icon", accountColors.categoryIcon);
  root.style.setProperty("--period-text-tertiary", tokens.textSecondary);
  root.style.setProperty("color-scheme", resolvedMode);
  root.classList.toggle("dark", withDarkClass && resolvedMode === "dark");
  clearPrehydrateThemeStyle();
}

function resetThemeCssVariables() {
  if (typeof document === "undefined") return;
  const root = document.documentElement;

  root.style.removeProperty("--background");
  root.style.removeProperty("--foreground");
  root.style.removeProperty("--card");
  root.style.removeProperty("--card-foreground");
  root.style.removeProperty("--popover");
  root.style.removeProperty("--popover-foreground");
  root.style.removeProperty("--secondary");
  root.style.removeProperty("--secondary-foreground");
  root.style.removeProperty("--muted");
  root.style.removeProperty("--muted-foreground");
  root.style.removeProperty("--accent");
  root.style.removeProperty("--accent-foreground");
  root.style.removeProperty("--border");
  root.style.removeProperty("--input");
  root.style.removeProperty("--primary");
  root.style.removeProperty("--primary-foreground");
  root.style.removeProperty("--ring");
  root.style.removeProperty("--account-bg");
  root.style.removeProperty("--account-surface");
  root.style.removeProperty("--account-surface-alt");
  root.style.removeProperty("--account-border");
  root.style.removeProperty("--account-border-light");
  root.style.removeProperty("--account-text-primary");
  root.style.removeProperty("--account-text-secondary");
  root.style.removeProperty("--account-text-tertiary");
  root.style.removeProperty("--account-income");
  root.style.removeProperty("--account-income-bg");
  root.style.removeProperty("--account-income-light");
  root.style.removeProperty("--account-expense");
  root.style.removeProperty("--account-expense-bg");
  root.style.removeProperty("--account-expense-light");
  root.style.removeProperty("--account-accent");
  root.style.removeProperty("--account-accent-bg");
  root.style.removeProperty("--account-category-casa");
  root.style.removeProperty("--account-category-familia");
  root.style.removeProperty("--account-category-ocio");
  root.style.removeProperty("--account-category-restaurantes");
  root.style.removeProperty("--account-category-interests");
  root.style.removeProperty("--account-category-lottery");
  root.style.removeProperty("--account-category-default");
  root.style.removeProperty("--account-category-icon");
  root.style.removeProperty("--period-text-tertiary");
  root.style.removeProperty("color-scheme");
  root.classList.remove("dark");
  clearPrehydrateThemeStyle();
}

export function WebUserThemeProvider({ children }: { children: ReactNode }) {
  const supabase = useMemo(() => createClient(), []);
  const [preferences, setPreferences] = useState<ThemePreferences>(
    defaultThemePreferences
  );
  const [systemMode, setSystemMode] = useState<ResolvedThemeMode>("light");
  const [hasAuthenticatedTheme, setHasAuthenticatedTheme] = useState(false);
  const [hasResolvedInitialAuth, setHasResolvedInitialAuth] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const syncSystemMode = () => {
      setSystemMode(media.matches ? "dark" : "light");
    };

    syncSystemMode();
    media.addEventListener("change", syncSystemMode);
    return () => media.removeEventListener("change", syncSystemMode);
  }, []);

  const reloadThemePreferences = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user?.id) {
      setPreferences(defaultThemePreferences);
      setHasAuthenticatedTheme(false);
      clearCachedThemePreferences();
      setHasResolvedInitialAuth(true);
      return;
    }

    const { data } = await supabase
      .from("profiles")
      .select("theme, color_mode")
      .eq("user_id", user.id)
      .maybeSingle();

    const nextPreferences: ThemePreferences = {
      theme: getUserThemeId(data?.theme),
      colorMode: getUserThemeMode(data?.color_mode),
    };

    setPreferences(nextPreferences);
    setHasAuthenticatedTheme(true);
    writeCachedThemePreferences(nextPreferences);
    setHasResolvedInitialAuth(true);
  }, [supabase]);

  useEffect(() => {
    void reloadThemePreferences();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      void reloadThemePreferences();
    });

    return () => subscription.unsubscribe();
  }, [reloadThemePreferences, supabase]);

  const setThemePreferences = useCallback(
    (next: Partial<ThemePreferences>) => {
      setPreferences((current) => {
        const merged = { ...current, ...next };
        if (hasAuthenticatedTheme) {
          writeCachedThemePreferences(merged);
        }
        return merged;
      });
    },
    [hasAuthenticatedTheme]
  );

  const resolvedMode: ResolvedThemeMode =
    preferences.colorMode === "system" ? systemMode : preferences.colorMode;

  const tokens = useMemo(
    () =>
      resolveUserThemeTokens(preferences.theme, preferences.colorMode, systemMode),
    [preferences.colorMode, preferences.theme, systemMode]
  );

  const primaryActionTextColor = useMemo(
    () => getReadableTextColor(tokens.primary),
    [tokens.primary]
  );

  useEffect(() => {
    if (!hasAuthenticatedTheme) {
      if (!hasResolvedInitialAuth) return;
      resetThemeCssVariables();
      return;
    }

    applyThemeCssVariables(
      tokens,
      primaryActionTextColor,
      resolvedMode,
      hasAuthenticatedTheme
    );
  }, [
    hasAuthenticatedTheme,
    hasResolvedInitialAuth,
    primaryActionTextColor,
    resolvedMode,
    tokens,
  ]);

  const value = useMemo<WebUserThemeContextValue>(
    () => ({
      theme: preferences.theme,
      colorMode: preferences.colorMode,
      resolvedMode,
      tokens,
      primaryActionColor: tokens.primary,
      primaryActionTextColor,
      setThemePreferences,
      reloadThemePreferences,
    }),
    [
      preferences.colorMode,
      preferences.theme,
      primaryActionTextColor,
      reloadThemePreferences,
      resolvedMode,
      setThemePreferences,
      tokens,
    ]
  );

  return (
    <WebUserThemeContext.Provider value={value}>
      {children}
    </WebUserThemeContext.Provider>
  );
}

export function useWebUserTheme() {
  return useContext(WebUserThemeContext);
}
