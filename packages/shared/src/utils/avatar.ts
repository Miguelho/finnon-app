import type { ThemeTokens } from "../theme/tokens";

export type AvatarColorToken =
  | "bg.secondary"
  | "bg.surface"
  | "action.secondary"
  | "state.neutral";

export type AvatarFallbackProfile = {
  avatar_fallback_text?: string | null;
  avatar_fallback_bg_token?: AvatarColorToken | null;
};

export const ALLOWED_AVATAR_BG_TOKENS: AvatarColorToken[] = [
  "bg.secondary",
  "bg.surface",
  "action.secondary",
  "state.neutral",
];

export function getAvatarInitial(email?: string | null): string {
  const normalized = typeof email === "string" ? email.trim() : "";
  if (!normalized) return "?";

  const handle = normalized.split("@")[0]?.trim();
  const initial = (handle || normalized)[0];
  return initial ? initial.toUpperCase() : "?";
}

function hashSeed(seed: string): number {
  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash << 5) - hash + seed.charCodeAt(index);
    hash |= 0;
  }
  return Math.abs(hash);
}

export function getAvatarColorToken(seed?: string | null): AvatarColorToken {
  const normalized = typeof seed === "string" ? seed.trim().toLowerCase() : "";
  if (!normalized) return ALLOWED_AVATAR_BG_TOKENS[0];
  const hash = hashSeed(normalized);
  return ALLOWED_AVATAR_BG_TOKENS[hash % ALLOWED_AVATAR_BG_TOKENS.length];
}

export function getDefaultAvatarBgToken(
  seed?: string | null
): AvatarColorToken {
  return getAvatarColorToken(seed);
}

export function normalizeAvatarFallbackText(
  value?: string | null
): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const char = trimmed[0]?.toUpperCase() ?? "";
  return /^[A-Z0-9]$/.test(char) ? char : null;
}

export function resolveAvatarFallback(
  profile: AvatarFallbackProfile | null | undefined,
  email?: string | null,
  userId?: string | null
): { text: string; bgToken: AvatarColorToken } {
  const normalizedText = normalizeAvatarFallbackText(
    profile?.avatar_fallback_text
  );
  const text = normalizedText ?? getAvatarInitial(email);
  const preferredToken = profile?.avatar_fallback_bg_token;
  const bgToken = ALLOWED_AVATAR_BG_TOKENS.includes(
    preferredToken as AvatarColorToken
  )
    ? (preferredToken as AvatarColorToken)
    : getDefaultAvatarBgToken(userId ?? email ?? "");

  return { text, bgToken };
}

export function resolveAvatarColor(
  tokens: ThemeTokens,
  token: AvatarColorToken
): string {
  switch (token) {
    case "bg.surface":
      return tokens.colors.bg.surface;
    case "action.secondary":
      return tokens.colors.action.secondary;
    case "state.neutral":
      return tokens.colors.state.neutral;
    case "bg.secondary":
    default:
      return tokens.colors.bg.secondary;
  }
}
