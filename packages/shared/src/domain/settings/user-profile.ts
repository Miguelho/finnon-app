export type UserAvatarColorId =
  | "blue"
  | "green"
  | "coral"
  | "purple"
  | "amber"
  | "slate";

export type UserAvatarColor = {
  id: UserAvatarColorId;
  bg: string;
  fg: string;
};

export const USER_AVATAR_COLORS: Record<UserAvatarColorId, UserAvatarColor> = {
  blue: { id: "blue", bg: "#D4E4F7", fg: "#3A6EA5" },
  green: { id: "green", bg: "#D4EDDA", fg: "#2D7A3F" },
  coral: { id: "coral", bg: "#FAD9D4", fg: "#B85450" },
  purple: { id: "purple", bg: "#E8D8F0", fg: "#7B4F9E" },
  amber: { id: "amber", bg: "#F5E6CC", fg: "#9A7030" },
  slate: { id: "slate", bg: "#DDE1E8", fg: "#4A5568" },
};

export const USER_AVATAR_COLOR_ORDER: UserAvatarColorId[] = [
  "blue",
  "green",
  "coral",
  "purple",
  "amber",
  "slate",
];

export const DEFAULT_USER_AVATAR_COLOR: UserAvatarColorId = "blue";

const USER_AVATAR_COLOR_SET = new Set(USER_AVATAR_COLOR_ORDER);

export function isUserAvatarColorId(
  value: string | null | undefined
): value is UserAvatarColorId {
  return typeof value === "string" && USER_AVATAR_COLOR_SET.has(value as UserAvatarColorId);
}

export function getUserAvatarColor(
  value: string | null | undefined
): UserAvatarColorId {
  return isUserAvatarColorId(value) ? value : DEFAULT_USER_AVATAR_COLOR;
}

export function getAvatarInitials(
  email: string | null | undefined,
  displayName?: string | null
): string {
  const normalizedDisplayName =
    typeof displayName === "string" ? displayName.trim() : "";

  if (normalizedDisplayName) {
    const words = normalizedDisplayName.split(/\s+/).filter(Boolean);
    if (words.length >= 2) {
      const firstInitial = words[0]?.charAt(0) ?? "";
      const lastInitial = words[words.length - 1]?.charAt(0) ?? "";
      const initials = `${firstInitial}${lastInitial}`.toUpperCase();
      if (initials) return initials;
    }

    const compactName = words[0] ?? normalizedDisplayName;
    const initials = compactName.slice(0, 2).toUpperCase();
    if (initials) return initials;
  }

  const normalized = typeof email === "string" ? email.trim() : "";
  if (!normalized) return "??";
  const local = normalized.split("@")[0] ?? "";
  if (!local) return "??";
  return local.substring(0, 2).toUpperCase();
}

export type UserLocale = "es" | "en";

const SUPPORTED_USER_LOCALES: UserLocale[] = ["es", "en"];
const SUPPORTED_USER_LOCALE_SET = new Set(SUPPORTED_USER_LOCALES);

export function isSupportedUserLocale(
  value: string | null | undefined
): value is UserLocale {
  return (
    typeof value === "string" &&
    SUPPORTED_USER_LOCALE_SET.has(value as UserLocale)
  );
}

export function getSupportedUserLocale(
  value: string | null | undefined,
  fallback: UserLocale = "es"
): UserLocale {
  return isSupportedUserLocale(value) ? value : fallback;
}

export type UserThemeMode = "light" | "dark" | "system";
export type UserThemeId = "grafito" | "oceano";
export type ResolvedThemeMode = "light" | "dark";

export type UserThemeTokens = {
  primary: string;
  background: string;
  surface: string;
  surfaceAlt: string;
  border: string;
  textPrimary: string;
  textSecondary: string;
  textTertiary: string;
  dangerBackground: string;
  dangerBorder: string;
  dangerText: string;
};

export type UserThemeDefinition = {
  id: UserThemeId;
  name: string;
  description: string;
  preview: [string, string, string];
  light: UserThemeTokens;
  dark: UserThemeTokens;
};

export const USER_THEME_DEFINITIONS: Record<UserThemeId, UserThemeDefinition> = {
  grafito: {
    id: "grafito",
    name: "Grafito",
    description: "Neutro y sobrio",
    preview: ["#1A1A1A", "#F7F7F5", "#E5E4E0"],
    light: {
      primary: "#1A1A1A",
      background: "#F7F7F5",
      surface: "#FFFFFF",
      surfaceAlt: "#F0EFEC",
      border: "#E5E4E0",
      textPrimary: "#1A1A1A",
      textSecondary: "#6B6B6B",
      textTertiary: "#9A9A9A",
      dangerBackground: "#FEF2F2",
      dangerBorder: "#FCA5A5",
      dangerText: "#DC2626",
    },
    dark: {
      primary: "#E8E8E8",
      background: "#141413",
      surface: "#1C1C1B",
      surfaceAlt: "#2A2A28",
      border: "#31312F",
      textPrimary: "#F4F4F2",
      textSecondary: "#B1B1AD",
      textTertiary: "#8A8A85",
      dangerBackground: "#3B1D1D",
      dangerBorder: "#7F1D1D",
      dangerText: "#FCA5A5",
    },
  },
  oceano: {
    id: "oceano",
    name: "Océano",
    description: "Calma y confianza",
    preview: ["#4A6FA5", "#EBF0F7", "#C8D8E8"],
    light: {
      primary: "#4A6FA5",
      background: "#EBF0F7",
      surface: "#FFFFFF",
      surfaceAlt: "#DDE8F3",
      border: "#C8D8E8",
      textPrimary: "#1A3554",
      textSecondary: "#4F647A",
      textTertiary: "#75879A",
      dangerBackground: "#FEECEC",
      dangerBorder: "#F8B4B4",
      dangerText: "#DC2626",
    },
    dark: {
      primary: "#8BA8D1",
      background: "#0E1A27",
      surface: "#152334",
      surfaceAlt: "#1F3046",
      border: "#2A415E",
      textPrimary: "#E7EEF8",
      textSecondary: "#AFC2D9",
      textTertiary: "#8197B1",
      dangerBackground: "#3A1F24",
      dangerBorder: "#7F1D1D",
      dangerText: "#FCA5A5",
    },
  },
};

export const USER_THEME_ORDER: UserThemeId[] = ["grafito", "oceano"];

export const USER_THEME_MODE_ORDER: UserThemeMode[] = [
  "light",
  "dark",
  "system",
];

export const DEFAULT_USER_THEME: UserThemeId = "grafito";
export const DEFAULT_USER_THEME_MODE: UserThemeMode = "system";

const USER_THEME_SET = new Set(USER_THEME_ORDER);
const USER_THEME_MODE_SET = new Set(USER_THEME_MODE_ORDER);

export function isUserThemeId(
  value: string | null | undefined
): value is UserThemeId {
  return typeof value === "string" && USER_THEME_SET.has(value as UserThemeId);
}

export function getUserThemeId(
  value: string | null | undefined
): UserThemeId {
  return isUserThemeId(value) ? value : DEFAULT_USER_THEME;
}

export function isUserThemeMode(
  value: string | null | undefined
): value is UserThemeMode {
  return (
    typeof value === "string" &&
    USER_THEME_MODE_SET.has(value as UserThemeMode)
  );
}

export function getUserThemeMode(
  value: string | null | undefined
): UserThemeMode {
  return isUserThemeMode(value) ? value : DEFAULT_USER_THEME_MODE;
}

export function resolveThemeMode(
  mode: UserThemeMode,
  systemMode: ResolvedThemeMode = "light"
): ResolvedThemeMode {
  return mode === "system" ? systemMode : mode;
}

export function resolveUserThemeTokens(
  themeId: UserThemeId,
  mode: UserThemeMode,
  systemMode: ResolvedThemeMode = "light"
): UserThemeTokens {
  const definition = USER_THEME_DEFINITIONS[getUserThemeId(themeId)];
  const resolvedMode = resolveThemeMode(mode, systemMode);
  return resolvedMode === "dark" ? definition.dark : definition.light;
}
