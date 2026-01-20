import { useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet } from "react-native";
import { DrawerActions, useNavigation } from "@react-navigation/native";
import {
  ALLOWED_AVATAR_BG_TOKENS,
  themeTokens,
  type AvatarColorToken,
} from "@poleursus/shared";
import { useAuth } from "../../contexts/AuthContext";
import { useCopy, t } from "../../lib/i18n";
import { supabase } from "../../lib/supabase";
import { UserAvatar } from "../UserAvatar";

type ProfileAvatarState = {
  avatarPath: string | null;
  fallbackText: string | null;
  fallbackBgToken: AvatarColorToken | null;
  email: string | null;
};

const tokens = themeTokens.light;

export function AppHeaderAvatar() {
  const navigation = useNavigation();
  const { user } = useAuth();
  const { dictionary } = useCopy();
  const [profile, setProfile] = useState<ProfileAvatarState>({
    avatarPath: null,
    fallbackText: null,
    fallbackBgToken: null,
    email: null,
  });

  useEffect(() => {
    let cancelled = false;

    async function loadProfile() {
      if (!user?.id) {
        if (!cancelled) {
          setProfile({
            avatarPath: null,
            fallbackText: null,
            fallbackBgToken: null,
            email: null,
          });
        }
        return;
      }

      const { data, error } = await supabase
        .from("profiles")
        .select("avatar_path, email, avatar_fallback_text, avatar_fallback_bg_token")
        .eq("user_id", user.id)
        .maybeSingle();

      if (cancelled) return;

      if (error) {
        setProfile({
          avatarPath: null,
          fallbackText: null,
          fallbackBgToken: null,
          email: user.email ?? null,
        });
        return;
      }

      const bgToken = ALLOWED_AVATAR_BG_TOKENS.includes(
        data?.avatar_fallback_bg_token as AvatarColorToken
      )
        ? (data?.avatar_fallback_bg_token as AvatarColorToken)
        : null;

      setProfile({
        avatarPath: data?.avatar_path ?? null,
        fallbackText: data?.avatar_fallback_text ?? null,
        fallbackBgToken: bgToken,
        email: data?.email ?? user.email ?? null,
      });
    }

    void loadProfile();
    return () => {
      cancelled = true;
    };
  }, [user?.id, user?.email]);

  const email = profile.email ?? user?.email ?? null;
  const accessibilityLabel = useMemo(
    () => t(dictionary, "settings.title"),
    [dictionary]
  );

  return (
    <Pressable
      onPress={() => navigation.dispatch(DrawerActions.openDrawer())}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      style={styles.button}
    >
      <UserAvatar
        email={email}
        userId={user?.id ?? null}
        avatarPath={profile.avatarPath}
        fallbackText={profile.fallbackText}
        fallbackBgToken={profile.fallbackBgToken}
        size={30}
        label={email ?? accessibilityLabel}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    marginLeft: tokens.spacing.lg,
  },
});
