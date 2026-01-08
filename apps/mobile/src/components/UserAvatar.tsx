import { useEffect, useMemo, useState } from "react";
import { Image, StyleSheet, Text, View } from "react-native";
import {
  resolveAvatarColor,
  resolveAvatarFallback,
  themeTokens,
  type AvatarColorToken,
} from "@poleursus/shared";
import { supabase } from "../lib/supabase";

type UserAvatarProps = {
  email?: string | null;
  userId?: string | null;
  avatarPath?: string | null;
  fallbackText?: string | null;
  fallbackBgToken?: AvatarColorToken | null;
  size?: number;
  label?: string;
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
  size = 26,
  label,
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
  const backgroundColor = useMemo(
    () => resolveAvatarColor(tokens, fallback.bgToken),
    [fallback.bgToken]
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
      <Image
        source={{ uri: avatarUrl }}
        style={[styles.image, { width: size, height: size }]}
        resizeMode="cover"
        accessibilityLabel={label ?? fallback.text}
        onError={() => setLoadFailed(true)}
      />
    );
  }

  return (
    <View
      style={[
        styles.fallback,
        { width: size, height: size, backgroundColor },
      ]}
      accessibilityLabel={label ?? fallback.text}
    >
      <Text style={styles.initial}>{fallback.text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  image: {
    borderRadius: 999,
  },
  fallback: {
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  initial: {
    color: colors.text.primary,
    fontSize: tokens.typography.size.xs,
    fontWeight: tokens.typography.weight.semibold,
    textTransform: "uppercase",
  },
});
