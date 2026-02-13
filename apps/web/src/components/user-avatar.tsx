"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  getAvatarInitials,
  getUserAvatarColor,
  resolveAvatarColor,
  resolveAvatarFallback,
  themeTokens,
  type AvatarColorToken,
  type UserAvatarColorId,
  USER_AVATAR_COLORS,
} from "@poleursus/shared";

type UserAvatarProps = {
  email?: string | null;
  userId?: string | null;
  avatarPath?: string | null;
  fallbackText?: string | null;
  fallbackBgToken?: AvatarColorToken | null;
  avatarColor?: UserAvatarColorId | null;
  size?: number;
  label?: string;
  className?: string;
  cacheKey?: string | number;
};

const tokens = themeTokens.light;
const colors = tokens.colors;
const avatarUrlCache = new Map<string, string>();

export function UserAvatar({
  email,
  userId,
  avatarPath,
  fallbackText,
  fallbackBgToken,
  avatarColor,
  size = 26,
  label,
  className,
  cacheKey,
}: UserAvatarProps) {
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);

  const fallback = useMemo(
    () =>
      resolveAvatarFallback(
        {
          avatar_fallback_text: fallbackText,
          avatar_fallback_bg_token: fallbackBgToken,
        },
        email,
        userId
      ),
    [fallbackBgToken, fallbackText, email, userId]
  );
  const background = useMemo(
    () => resolveAvatarColor(tokens, fallback.bgToken),
    [fallback.bgToken]
  );
  const avatarPalette = useMemo(
    () =>
      avatarColor ? USER_AVATAR_COLORS[getUserAvatarColor(avatarColor)] : null,
    [avatarColor]
  );
  const preferredFallbackText = useMemo(
    () => (avatarPalette ? getAvatarInitials(email) : fallback.text),
    [avatarPalette, email, fallback.text]
  );
  const fallbackFontSize = useMemo(
    () => Math.max(9, Math.round(size * 0.38)),
    [size]
  );

  useEffect(() => {
    let cancelled = false;
    const path = avatarPath?.trim() ?? "";
    const bypassCache = cacheKey !== undefined;

    setLoadFailed(false);

    if (!path) {
      setAvatarUrl(null);
      return () => {
        cancelled = true;
      };
    }

    if (bypassCache) {
      avatarUrlCache.delete(path);
    } else {
      const cached = avatarUrlCache.get(path);
      if (cached) {
        setAvatarUrl(cached);
        return () => {
          cancelled = true;
        };
      }
    }

    async function loadAvatarUrl() {
      const supabase = createClient();
      const { data, error } = await supabase.storage
        .from("avatars")
        .createSignedUrl(path, 60 * 60);
      if (cancelled) return;
      if (error || !data?.signedUrl) {
        setAvatarUrl(null);
        return;
      }
      avatarUrlCache.set(path, data.signedUrl);
      setAvatarUrl(data.signedUrl);
    }

    loadAvatarUrl();
    return () => {
      cancelled = true;
    };
  }, [avatarPath, cacheKey]);

  if (avatarUrl && !loadFailed) {
    return (
      <img
        src={avatarUrl}
        alt={label ?? preferredFallbackText}
        title={label}
        width={size}
        height={size}
        onError={() => setLoadFailed(true)}
        className={className}
        style={{ borderRadius: "999px", objectFit: "cover" }}
      />
    );
  }

  return (
    <div
      aria-label={label ?? preferredFallbackText}
      title={label}
      className={`flex items-center justify-center rounded-full font-semibold uppercase ${
        className ?? ""
      }`}
      style={{
        width: size,
        height: size,
        backgroundColor: avatarPalette?.bg ?? background,
        color: avatarPalette?.fg ?? colors.text.primary,
        fontSize: `${fallbackFontSize}px`,
        lineHeight: 1,
      }}
    >
      {preferredFallbackText}
    </div>
  );
}
