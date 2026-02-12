import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useColorScheme } from "react-native";
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
import { useAuth } from "./AuthContext";
import { supabase } from "../lib/supabase";

type ThemePreferences = {
  theme: UserThemeId;
  colorMode: UserThemeMode;
};

type UserThemeContextValue = {
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

const fallbackTokens = resolveUserThemeTokens(
  DEFAULT_USER_THEME,
  DEFAULT_USER_THEME_MODE,
  "light"
);

const fallbackValue: UserThemeContextValue = {
  theme: DEFAULT_USER_THEME,
  colorMode: DEFAULT_USER_THEME_MODE,
  resolvedMode: "light",
  tokens: fallbackTokens,
  primaryActionColor: fallbackTokens.primary,
  primaryActionTextColor: "#FFFFFF",
  setThemePreferences: () => {},
  reloadThemePreferences: async () => {},
};

const UserThemeContext = createContext<UserThemeContextValue>(fallbackValue);

function getReadableTextColor(hexColor: string): string {
  const normalized = hexColor.replace("#", "");
  const expanded =
    normalized.length === 3
      ? normalized
          .split("")
          .map((chunk) => chunk + chunk)
          .join("")
      : normalized;

  if (expanded.length !== 6) {
    return "#FFFFFF";
  }

  const red = parseInt(expanded.slice(0, 2), 16);
  const green = parseInt(expanded.slice(2, 4), 16);
  const blue = parseInt(expanded.slice(4, 6), 16);

  const luminance = (red * 299 + green * 587 + blue * 114) / 1000;
  return luminance > 160 ? "#111111" : "#FFFFFF";
}

export function UserThemeProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const colorScheme = useColorScheme();
  const [preferences, setPreferences] = useState<ThemePreferences>(
    defaultThemePreferences
  );
  const isAuthenticated = Boolean(user?.id);
  const effectiveColorMode: UserThemeMode = isAuthenticated
    ? preferences.colorMode
    : "light";

  const resolvedMode: ResolvedThemeMode =
    effectiveColorMode === "system"
      ? colorScheme === "dark"
        ? "dark"
        : "light"
      : effectiveColorMode;

  const reloadThemePreferences = useCallback(async () => {
    if (!user?.id) {
      setPreferences(defaultThemePreferences);
      return;
    }

    const { data } = await supabase
      .from("profiles")
      .select("theme, color_mode")
      .eq("user_id", user.id)
      .maybeSingle();

    setPreferences({
      theme: getUserThemeId(data?.theme),
      colorMode: getUserThemeMode(data?.color_mode),
    });
  }, [user?.id]);

  useEffect(() => {
    void reloadThemePreferences();
  }, [reloadThemePreferences]);

  const setThemePreferences = useCallback(
    (next: Partial<ThemePreferences>) => {
      setPreferences((current) => ({
        ...current,
        ...next,
      }));
    },
    []
  );

  const resolvedTokens = useMemo(
    () =>
      resolveUserThemeTokens(
        preferences.theme,
        effectiveColorMode,
        resolvedMode
      ),
    [effectiveColorMode, preferences.theme, resolvedMode]
  );

  const primaryActionTextColor = useMemo(
    () => getReadableTextColor(resolvedTokens.primary),
    [resolvedTokens.primary]
  );

  const value = useMemo<UserThemeContextValue>(
    () => ({
      theme: preferences.theme,
      colorMode: effectiveColorMode,
      resolvedMode,
      tokens: resolvedTokens,
      primaryActionColor: resolvedTokens.primary,
      primaryActionTextColor,
      setThemePreferences,
      reloadThemePreferences,
    }),
    [
      effectiveColorMode,
      preferences.theme,
      primaryActionTextColor,
      reloadThemePreferences,
      resolvedMode,
      resolvedTokens,
      setThemePreferences,
    ]
  );

  return (
    <UserThemeContext.Provider value={value}>
      {children}
    </UserThemeContext.Provider>
  );
}

export function useUserTheme() {
  return useContext(UserThemeContext);
}
