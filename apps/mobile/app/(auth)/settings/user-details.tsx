import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useColorScheme,
  View,
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useIsFocused } from "@react-navigation/native";
import { useRouter } from "expo-router";
import {
  DEFAULT_USER_THEME,
  DEFAULT_USER_THEME_MODE,
  getAvatarInitials,
  getSupportedUserLocale,
  getUserAvatarColor,
  getUserThemeId,
  getUserThemeMode,
  isExpired,
  signOutAndReset,
  themeTokens,
  USER_AVATAR_COLORS,
  USER_AVATAR_COLOR_ORDER,
  USER_THEME_DEFINITIONS,
  USER_THEME_MODE_ORDER,
  USER_THEME_ORDER,
  resolveUserThemeTokens,
  type UserAvatarColorId,
  type UserLocale,
  type UserThemeId,
  type UserThemeMode,
} from "@poleursus/shared";
import { useAuth } from "../../../src/contexts/AuthContext";
import { useNetworkNotice } from "../../../src/contexts/NetworkNoticeContext";
import { useUserTheme } from "../../../src/contexts/UserThemeContext";
import { useCopy, useLocale, t } from "../../../src/lib/i18n";
import { supabase } from "../../../src/lib/supabase";

const tokens = themeTokens.light;
const API_URL = process.env.EXPO_PUBLIC_API_URL || "http://localhost:3000";

type ProfileRow = {
  email: string | null;
  avatar_color: string | null;
  theme: string | null;
  color_mode: string | null;
  locale: string | null;
};

type InviteRow = {
  id: string;
  status: "pending" | "accepted" | "rejected" | "revoked" | "expired" | null;
  expires_at: string;
  created_by: string;
  accounts?: { name: string } | { name: string }[] | null;
};

type InviterProfile = {
  user_id: string;
  email: string | null;
  avatar_color: string | null;
};

type PendingInvite = {
  id: string;
  accountName: string;
  inviterEmail: string;
  inviterColor: UserAvatarColorId;
};

type ProfileState = {
  email: string;
  avatarColor: UserAvatarColorId;
  theme: UserThemeId;
  colorMode: UserThemeMode;
  locale: UserLocale;
};

type SavingField = "avatarColor" | "theme" | "colorMode" | "locale" | null;
type InviteAction = "accept" | "reject" | null;

export default function UserProfileScreen() {
  const { user, loading, session, clearSelectedAccount } = useAuth();
  const { dictionary, locale } = useCopy();
  const { setLocale } = useLocale();
  const { reportNetworkIssue } = useNetworkNotice();
  const { primaryActionTextColor, setThemePreferences } = useUserTheme();
  const isFocused = useIsFocused();
  const router = useRouter();
  const colorScheme = useColorScheme();

  const runtimeLocale = locale.startsWith("en") ? "en" : "es";

  const [profile, setProfile] = useState<ProfileState>({
    email: "",
    avatarColor: getUserAvatarColor(null),
    theme: DEFAULT_USER_THEME,
    colorMode: DEFAULT_USER_THEME_MODE,
    locale: runtimeLocale,
  });
  const [isProfileLoading, setIsProfileLoading] = useState(true);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [savingField, setSavingField] = useState<SavingField>(null);

  const [pendingInvites, setPendingInvites] = useState<PendingInvite[]>([]);
  const [isInvitesLoading, setIsInvitesLoading] = useState(true);
  const [inviteActionId, setInviteActionId] = useState<string | null>(null);
  const [inviteAction, setInviteAction] = useState<InviteAction>(null);

  const [notice, setNotice] = useState<string | null>(null);
  const [noticeTone, setNoticeTone] = useState<"positive" | "negative" | null>(
    null
  );
  const [isSigningOut, setIsSigningOut] = useState(false);

  const systemMode = colorScheme === "dark" ? "dark" : "light";
  const activeTheme = useMemo(
    () => resolveUserThemeTokens(profile.theme, profile.colorMode, systemMode),
    [profile.colorMode, profile.theme, systemMode]
  );

  const loadProfile = useCallback(async () => {
    if (!user?.id) {
      setIsProfileLoading(false);
      return;
    }

    setIsProfileLoading(true);
    setProfileError(null);

    const { data, error } = await supabase
      .from("profiles")
      .select("email, avatar_color, theme, color_mode, locale")
      .eq("user_id", user.id)
      .maybeSingle();

    if (error) {
      setProfileError(t(dictionary, "settings.userProfile.errors.loadProfile"));
      reportNetworkIssue({
        message: t(dictionary, "settings.userProfile.errors.loadProfile"),
        onRetry: loadProfile,
      });
    }

    const row = (data ?? {}) as ProfileRow;
    const resolvedTheme = getUserThemeId(row.theme);
    const resolvedColorMode = getUserThemeMode(row.color_mode);

    setProfile({
      email: row.email ?? user.email ?? "",
      avatarColor: getUserAvatarColor(row.avatar_color),
      theme: resolvedTheme,
      colorMode: resolvedColorMode,
      locale: getSupportedUserLocale(row.locale, runtimeLocale),
    });
    setThemePreferences({
      theme: resolvedTheme,
      colorMode: resolvedColorMode,
    });

    setIsProfileLoading(false);
  }, [
    dictionary,
    reportNetworkIssue,
    runtimeLocale,
    setThemePreferences,
    user?.email,
    user?.id,
  ]);

  const loadPendingInvites = useCallback(async () => {
    if (!user) {
      setPendingInvites([]);
      setIsInvitesLoading(false);
      return;
    }

    setIsInvitesLoading(true);

    const normalizedEmail = user.email?.trim().toLowerCase();
    const filters: string[] = [];

    if (normalizedEmail) {
      filters.push(
        `invited_email.ilike.${normalizedEmail}`,
        `invitee_email.ilike.${normalizedEmail}`
      );
    }

    if (user.id) {
      filters.push(`invitee_user_id.eq.${user.id}`);
    }

    if (filters.length === 0) {
      setPendingInvites([]);
      setIsInvitesLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from("invites")
      .select("id, status, expires_at, created_by, accounts(name)")
      .or(filters.join(","))
      .eq("status", "pending")
      .order("created_at", { ascending: false });

    if (error) {
      setPendingInvites([]);
      setIsInvitesLoading(false);
      return;
    }

    const inviteRows = ((data ?? []) as InviteRow[]).filter(
      (invite) => !isExpired(invite.expires_at)
    );

    const creatorIds = Array.from(
      new Set(inviteRows.map((invite) => invite.created_by).filter(Boolean))
    );

    let creatorProfiles: Record<string, InviterProfile> = {};

    if (creatorIds.length > 0) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, email, avatar_color")
        .in("user_id", creatorIds);

      creatorProfiles = (profiles ?? []).reduce<Record<string, InviterProfile>>(
        (acc, item) => {
          acc[item.user_id] = item as InviterProfile;
          return acc;
        },
        {}
      );
    }

    const mapped = inviteRows.map((invite) => {
      const inviter = creatorProfiles[invite.created_by];
      const accountName = Array.isArray(invite.accounts)
        ? invite.accounts[0]?.name
        : invite.accounts?.name;

      return {
        id: invite.id,
        accountName:
          accountName ?? t(dictionary, "settings.userProfile.invitations.unknownAccount"),
        inviterEmail:
          inviter?.email ??
          t(dictionary, "settings.userProfile.invitations.unknownInviter"),
        inviterColor: getUserAvatarColor(inviter?.avatar_color),
      };
    });

    setPendingInvites(mapped);
    setIsInvitesLoading(false);
  }, [dictionary, user]);

  useEffect(() => {
    if (!user?.id) return;
    void loadProfile();
  }, [loadProfile, user?.id]);

  useEffect(() => {
    if (isFocused) {
      void loadPendingInvites();
    }
  }, [isFocused, loadPendingInvites]);

  const saveProfilePatch = useCallback(
    async (patch: Record<string, unknown>) => {
      if (!user?.id) return false;
      const { error } = await supabase
        .from("profiles")
        .update(patch)
        .eq("user_id", user.id);
      return !error;
    },
    [user?.id]
  );

  const updateAvatarColor = async (nextColor: UserAvatarColorId) => {
    if (!user?.id || nextColor === profile.avatarColor || savingField) return;

    const previous = profile.avatarColor;
    setSavingField("avatarColor");
    setProfile((current) => ({ ...current, avatarColor: nextColor }));

    const ok = await saveProfilePatch({ avatar_color: nextColor });
    if (!ok) {
      setProfile((current) => ({ ...current, avatarColor: previous }));
      reportNetworkIssue({
        message: t(dictionary, "settings.userProfile.errors.saveAvatarColor"),
        onRetry: () => {
          void updateAvatarColor(nextColor);
        },
      });
    }

    setSavingField(null);
  };

  const updateTheme = async (nextTheme: UserThemeId) => {
    if (!user?.id || nextTheme === profile.theme || savingField) return;

    const previous = profile.theme;
    setSavingField("theme");
    setProfile((current) => ({ ...current, theme: nextTheme }));
    setThemePreferences({ theme: nextTheme });

    const ok = await saveProfilePatch({ theme: nextTheme });
    if (!ok) {
      setProfile((current) => ({ ...current, theme: previous }));
      setThemePreferences({ theme: previous });
      reportNetworkIssue({
        message: t(dictionary, "settings.userProfile.errors.saveTheme"),
        onRetry: () => {
          void updateTheme(nextTheme);
        },
      });
    }

    setSavingField(null);
  };

  const updateColorMode = async (nextMode: UserThemeMode) => {
    if (!user?.id || nextMode === profile.colorMode || savingField) return;

    const previous = profile.colorMode;
    setSavingField("colorMode");
    setProfile((current) => ({ ...current, colorMode: nextMode }));
    setThemePreferences({ colorMode: nextMode });

    const ok = await saveProfilePatch({ color_mode: nextMode });
    if (!ok) {
      setProfile((current) => ({ ...current, colorMode: previous }));
      setThemePreferences({ colorMode: previous });
      reportNetworkIssue({
        message: t(dictionary, "settings.userProfile.errors.saveColorMode"),
        onRetry: () => {
          void updateColorMode(nextMode);
        },
      });
    }

    setSavingField(null);
  };

  const updateLanguage = async (nextLocale: UserLocale) => {
    if (!user?.id || nextLocale === profile.locale || savingField) return;

    const previous = profile.locale;
    setSavingField("locale");
    setProfile((current) => ({ ...current, locale: nextLocale }));
    await setLocale(nextLocale);

    const ok = await saveProfilePatch({ locale: nextLocale });
    if (!ok) {
      setProfile((current) => ({ ...current, locale: previous }));
      await setLocale(previous);
      reportNetworkIssue({
        message: t(dictionary, "settings.userProfile.errors.saveLocale"),
        onRetry: () => {
          void updateLanguage(nextLocale);
        },
      });
    }

    setSavingField(null);
  };

  const handleInviteAction = async (
    inviteId: string,
    action: Exclude<InviteAction, null>
  ) => {
    if (!session?.access_token || inviteActionId) return;

    setInviteActionId(inviteId);
    setInviteAction(action);
    setNotice(null);
    setNoticeTone(null);

    try {
      const response = await fetch(`${API_URL}/api/invites/${action}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ inviteId }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        const message =
          typeof payload?.errorKey === "string"
            ? t(dictionary, payload.errorKey as any, payload.errorParams)
            : t(dictionary, "errors.internalServer");
        setNotice(message);
        setNoticeTone("negative");
        return;
      }

      setNotice(
        action === "accept"
          ? t(dictionary, "invitations.joinSuccess")
          : t(dictionary, "common.successTitle")
      );
      setNoticeTone("positive");
      await loadPendingInvites();
    } catch (error) {
      console.error("[UserProfile] Invite action error:", error);
      setNotice(t(dictionary, "errors.internalServer"));
      setNoticeTone("negative");
    } finally {
      setInviteActionId(null);
      setInviteAction(null);
    }
  };

  const handleSignOut = async () => {
    if (isSigningOut) return;
    setIsSigningOut(true);

    try {
      await signOutAndReset({
        signOut: async () => {
          const { error } = await supabase.auth.signOut();
          if (error) throw error;
        },
        clearLocalSessionArtifacts: clearSelectedAccount,
        onNavigate: () => {
          router.replace("/(auth)/login");
        },
      });
    } catch (error) {
      console.error("[UserProfile] Sign out failed:", error);
      reportNetworkIssue({ message: t(dictionary, "settings.signOut.error") });
    } finally {
      setIsSigningOut(false);
    }
  };

  if (loading || isProfileLoading) {
    return (
      <View style={[styles.centered, { backgroundColor: activeTheme.background }]}>
        <ActivityIndicator size="large" color={activeTheme.primary} />
      </View>
    );
  }

  if (!user) {
    return (
      <View style={[styles.centered, { backgroundColor: activeTheme.background }]}>
        <Text style={[styles.errorText, { color: activeTheme.textSecondary }]}>
          {t(dictionary, "settings.userProfile.errors.notAuthenticated")}
        </Text>
      </View>
    );
  }

  const mainAvatar = USER_AVATAR_COLORS[profile.avatarColor];

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: activeTheme.background }]}
      contentContainerStyle={styles.content}
    >
      <View style={styles.pageHeader}>
        <Text style={[styles.pageTitle, { color: activeTheme.textPrimary }]}>
          {t(dictionary, "settings.userProfile.title")}
        </Text>
        <Text style={[styles.pageSubtitle, { color: activeTheme.textSecondary }]}>
          {t(dictionary, "settings.userProfile.subtitle")}
        </Text>
        {profileError ? (
          <Text style={[styles.errorLabel, { color: activeTheme.dangerText }]}>
            {profileError}
          </Text>
        ) : null}
      </View>

      <View
        style={[
          styles.sectionCard,
          { backgroundColor: activeTheme.surface, borderColor: activeTheme.border },
        ]}
      >
        <Text style={[styles.sectionTitle, { color: activeTheme.textPrimary }]}>
          {t(dictionary, "settings.userProfile.avatar.title")}
        </Text>
        <View style={styles.avatarRow}>
          <View
            style={[
              styles.mainAvatar,
              { backgroundColor: mainAvatar.bg },
            ]}
          >
            <Text style={[styles.mainAvatarText, { color: mainAvatar.fg }]}>
              {getAvatarInitials(profile.email)}
            </Text>
          </View>
          <View style={styles.avatarInfo}>
            <Text style={[styles.emailValue, { color: activeTheme.textPrimary }]}>
              {profile.email}
            </Text>
            <Text style={[styles.avatarHint, { color: activeTheme.textTertiary }]}>
              {t(dictionary, "settings.userProfile.avatar.hint")}
            </Text>
          </View>
        </View>

        <Text style={[styles.selectorLabel, { color: activeTheme.textTertiary }]}>
          {t(dictionary, "settings.userProfile.avatar.colorLabel")}
        </Text>

        <View style={styles.colorSelector}>
          {USER_AVATAR_COLOR_ORDER.map((colorId) => {
            const color = USER_AVATAR_COLORS[colorId];
            const selected = profile.avatarColor === colorId;
            return (
              <Pressable
                key={colorId}
                onPress={() => {
                  void updateAvatarColor(colorId);
                }}
                disabled={savingField !== null}
                style={[
                  styles.colorDotOuter,
                  selected && {
                    borderColor: color.fg,
                    borderWidth: 2,
                  },
                ]}
              >
                <View style={[styles.colorDot, { backgroundColor: color.fg }]} />
              </Pressable>
            );
          })}
        </View>
      </View>

      <View
        style={[
          styles.sectionCard,
          { backgroundColor: activeTheme.surface, borderColor: activeTheme.border },
        ]}
      >
        <Text style={[styles.sectionTitle, { color: activeTheme.textPrimary }]}>
          {t(dictionary, "settings.userProfile.invitations.title")}
        </Text>

        {isInvitesLoading ? (
          <ActivityIndicator
            size="small"
            color={activeTheme.textSecondary}
            style={styles.invitesLoading}
          />
        ) : pendingInvites.length === 0 ? (
          <View style={styles.emptyState}>
            <MaterialCommunityIcons
              name="email-outline"
              size={22}
              color={activeTheme.textTertiary}
            />
            <Text style={[styles.emptyStateText, { color: activeTheme.textTertiary }]}>
              {t(dictionary, "settings.userProfile.invitations.empty")}
            </Text>
          </View>
        ) : (
          <View style={styles.invitesList}>
            {pendingInvites.map((invite) => {
              const avatar = USER_AVATAR_COLORS[invite.inviterColor];
              const isActing = inviteActionId === invite.id;

              return (
                <View
                  key={invite.id}
                  style={[
                    styles.inviteCard,
                    { backgroundColor: activeTheme.surfaceAlt },
                  ]}
                >
                  <View style={[styles.inviteAvatar, { backgroundColor: avatar.bg }]}>
                    <Text style={[styles.inviteAvatarText, { color: avatar.fg }]}>
                      {getAvatarInitials(invite.inviterEmail)}
                    </Text>
                  </View>

                  <View style={styles.inviteInfo}>
                    <Text style={[styles.inviteTitle, { color: activeTheme.textPrimary }]}>
                      {invite.accountName}
                    </Text>
                    <Text style={[styles.inviteFrom, { color: activeTheme.textSecondary }]}>
                      {t(dictionary, "settings.userProfile.invitations.from", {
                        email: invite.inviterEmail,
                      })}
                    </Text>
                  </View>

                  <View style={styles.inviteActions}>
                    <Pressable
                      onPress={() => {
                        void handleInviteAction(invite.id, "reject");
                      }}
                      disabled={isActing}
                      style={[
                        styles.inviteButton,
                        styles.inviteButtonSecondary,
                        { borderColor: activeTheme.border },
                      ]}
                    >
                      {isActing && inviteAction === "reject" ? (
                        <ActivityIndicator size="small" color={activeTheme.textSecondary} />
                      ) : (
                        <Text
                          style={[
                            styles.inviteButtonTextSecondary,
                            { color: activeTheme.textSecondary },
                          ]}
                        >
                          {t(dictionary, "invitations.rejectButton")}
                        </Text>
                      )}
                    </Pressable>

                    <Pressable
                      onPress={() => {
                        void handleInviteAction(invite.id, "accept");
                      }}
                      disabled={isActing}
                      style={[
                        styles.inviteButton,
                        { backgroundColor: activeTheme.primary },
                      ]}
                    >
                      {isActing && inviteAction === "accept" ? (
                        <ActivityIndicator size="small" color={primaryActionTextColor} />
                      ) : (
                        <Text
                          style={[
                            styles.inviteButtonTextPrimary,
                            { color: primaryActionTextColor },
                          ]}
                        >
                          {t(dictionary, "invitations.acceptButton")}
                        </Text>
                      )}
                    </Pressable>
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </View>

      <View
        style={[
          styles.sectionCard,
          { backgroundColor: activeTheme.surface, borderColor: activeTheme.border },
        ]}
      >
        <Text style={[styles.sectionTitle, { color: activeTheme.textPrimary }]}>
          {t(dictionary, "settings.userProfile.theme.title")}
        </Text>

        <View style={styles.themeGrid}>
          {USER_THEME_ORDER.map((themeId) => {
            const definition = USER_THEME_DEFINITIONS[themeId];
            const selected = profile.theme === themeId;

            return (
              <Pressable
                key={themeId}
                onPress={() => {
                  void updateTheme(themeId);
                }}
                disabled={savingField !== null}
                style={[
                  styles.themeCard,
                  { borderColor: activeTheme.border, backgroundColor: activeTheme.surface },
                  selected && { borderColor: activeTheme.primary, borderWidth: 2 },
                ]}
              >
                <View style={styles.themePreview}>
                  {definition.preview.map((swatch) => (
                    <View
                      key={`${themeId}-${swatch}`}
                      style={[styles.themeSwatch, { backgroundColor: swatch }]}
                    />
                  ))}
                </View>
                <Text style={[styles.themeName, { color: activeTheme.textPrimary }]}>
                  {t(dictionary, `settings.userProfile.theme.options.${themeId}.name` as any)}
                </Text>
                <Text style={[styles.themeDescription, { color: activeTheme.textTertiary }]}>
                  {t(dictionary, `settings.userProfile.theme.options.${themeId}.description` as any)}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <View
          style={[
            styles.modeToggle,
            { backgroundColor: activeTheme.surfaceAlt, borderColor: activeTheme.border },
          ]}
        >
          {USER_THEME_MODE_ORDER.map((mode) => {
            const selected = profile.colorMode === mode;
            return (
              <Pressable
                key={mode}
                onPress={() => {
                  void updateColorMode(mode);
                }}
                disabled={savingField !== null}
                style={[
                  styles.modeButton,
                  selected && {
                    backgroundColor: activeTheme.surface,
                    borderColor: activeTheme.border,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.modeButtonText,
                    { color: selected ? activeTheme.textPrimary : activeTheme.textSecondary },
                  ]}
                >
                  {t(dictionary, `settings.userProfile.theme.modes.${mode}` as any)}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View
        style={[
          styles.sectionCard,
          { backgroundColor: activeTheme.surface, borderColor: activeTheme.border },
        ]}
      >
        <Text style={[styles.sectionTitle, { color: activeTheme.textPrimary }]}>
          {t(dictionary, "settings.userProfile.language.title")}
        </Text>

        <View style={styles.languageList}>
          {([{ code: "es" }, { code: "en" }] as const).map((item) => {
            const selected = profile.locale === item.code;

            return (
              <Pressable
                key={item.code}
                onPress={() => {
                  void updateLanguage(item.code);
                }}
                disabled={savingField !== null}
                style={[
                  styles.languageOption,
                  selected && {
                    borderColor: activeTheme.textPrimary,
                    backgroundColor: activeTheme.surfaceAlt,
                  },
                ]}
              >
                <Text style={[styles.languageLabel, { color: activeTheme.textPrimary }]}>
                  {t(dictionary, `settings.language.options.${item.code}` as any)}
                </Text>
                {selected ? (
                  <Text style={[styles.languageCheck, { color: activeTheme.textPrimary }]}>
                    ✓
                  </Text>
                ) : null}
              </Pressable>
            );
          })}
        </View>
      </View>

      {notice ? (
        <Text
          style={[
            styles.notice,
            {
              color:
                noticeTone === "negative"
                  ? activeTheme.dangerText
                  : activeTheme.textSecondary,
            },
          ]}
        >
          {notice}
        </Text>
      ) : null}

      <Pressable
        onPress={() => {
          void handleSignOut();
        }}
        disabled={isSigningOut}
        style={({ pressed }) => [
          styles.signOutButton,
          {
            backgroundColor: pressed ? activeTheme.dangerBackground : activeTheme.surface,
            borderColor: pressed ? activeTheme.dangerBorder : activeTheme.border,
          },
        ]}
      >
        <View style={styles.signOutCopy}>
          <Text style={[styles.signOutTitle, { color: activeTheme.dangerText }]}>
            {t(dictionary, "settings.signOut.label")}
          </Text>
          <Text style={[styles.signOutSubtitle, { color: activeTheme.textTertiary }]}>
            {t(dictionary, "settings.signOut.description")}
          </Text>
        </View>
        {isSigningOut ? (
          <ActivityIndicator size="small" color={activeTheme.dangerText} />
        ) : (
          <Text style={[styles.signOutArrow, { color: activeTheme.dangerText }]}>→</Text>
        )}
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    paddingHorizontal: tokens.spacing.lg,
    paddingTop: tokens.spacing.lg,
    paddingBottom: tokens.spacing.xxxl,
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  pageHeader: {
    marginBottom: tokens.spacing.xl,
    gap: tokens.spacing.xs,
  },
  pageTitle: {
    fontSize: 24,
    fontWeight: tokens.typography.weight.bold,
  },
  pageSubtitle: {
    fontSize: tokens.typography.size.sm,
  },
  errorLabel: {
    marginTop: tokens.spacing.xs,
    fontSize: tokens.typography.size.xs,
  },
  errorText: {
    fontSize: tokens.typography.size.md,
    textAlign: "center",
  },
  sectionCard: {
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: tokens.spacing.lg,
    paddingVertical: tokens.spacing.lg,
    marginBottom: tokens.spacing.md,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: tokens.typography.weight.bold,
    marginBottom: tokens.spacing.md,
  },
  avatarRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: tokens.spacing.md,
  },
  mainAvatar: {
    width: 52,
    height: 52,
    borderRadius: tokens.radii.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  mainAvatarText: {
    fontSize: 17,
    fontWeight: tokens.typography.weight.bold,
    letterSpacing: 0.3,
  },
  avatarInfo: {
    flex: 1,
  },
  emailValue: {
    fontSize: tokens.typography.size.sm,
    fontWeight: tokens.typography.weight.medium,
  },
  avatarHint: {
    marginTop: 2,
    fontSize: tokens.typography.size.xs,
  },
  selectorLabel: {
    marginTop: tokens.spacing.lg,
    marginBottom: tokens.spacing.sm,
    fontSize: 11,
    fontWeight: tokens.typography.weight.semibold,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  colorSelector: {
    flexDirection: "row",
    gap: tokens.spacing.sm,
    flexWrap: "wrap",
  },
  colorDotOuter: {
    width: 30,
    height: 30,
    borderRadius: tokens.radii.pill,
    alignItems: "center",
    justifyContent: "center",
    borderColor: "transparent",
    borderWidth: 1,
  },
  colorDot: {
    width: 22,
    height: 22,
    borderRadius: tokens.radii.pill,
  },
  invitesLoading: {
    marginVertical: tokens.spacing.md,
  },
  invitesList: {
    gap: tokens.spacing.sm,
  },
  inviteCard: {
    borderRadius: tokens.radii.md,
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: tokens.spacing.sm,
    flexDirection: "row",
    alignItems: "center",
    gap: tokens.spacing.sm,
  },
  inviteAvatar: {
    width: 34,
    height: 34,
    borderRadius: tokens.radii.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  inviteAvatarText: {
    fontSize: tokens.typography.size.xs,
    fontWeight: tokens.typography.weight.bold,
  },
  inviteInfo: {
    flex: 1,
    minWidth: 0,
  },
  inviteTitle: {
    fontSize: tokens.typography.size.sm,
    fontWeight: tokens.typography.weight.semibold,
  },
  inviteFrom: {
    marginTop: 2,
    fontSize: tokens.typography.size.xs,
  },
  inviteActions: {
    flexDirection: "row",
    gap: tokens.spacing.xs,
  },
  inviteButton: {
    minWidth: 80,
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  inviteButtonSecondary: {
    borderWidth: 1,
    backgroundColor: "transparent",
  },
  inviteButtonTextPrimary: {
    fontSize: 12,
    fontWeight: tokens.typography.weight.semibold,
  },
  inviteButtonTextSecondary: {
    fontSize: 12,
    fontWeight: tokens.typography.weight.semibold,
  },
  emptyState: {
    paddingVertical: tokens.spacing.lg,
    alignItems: "center",
    justifyContent: "center",
    gap: tokens.spacing.xs,
  },
  emptyStateText: {
    fontSize: 13,
  },
  themeGrid: {
    flexDirection: "row",
    gap: tokens.spacing.sm,
  },
  themeCard: {
    flex: 1,
    borderWidth: 1.5,
    borderRadius: tokens.radii.md,
    padding: tokens.spacing.md,
  },
  themePreview: {
    flexDirection: "row",
    gap: 4,
    height: 36,
    marginBottom: tokens.spacing.sm,
  },
  themeSwatch: {
    flex: 1,
    borderRadius: tokens.radii.sm,
  },
  themeName: {
    fontSize: 13,
    fontWeight: tokens.typography.weight.semibold,
    textAlign: "center",
  },
  themeDescription: {
    marginTop: 2,
    fontSize: 11,
    textAlign: "center",
  },
  modeToggle: {
    marginTop: tokens.spacing.md,
    borderRadius: tokens.radii.sm,
    borderWidth: 1,
    padding: 3,
    flexDirection: "row",
    gap: 3,
  },
  modeButton: {
    flex: 1,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "transparent",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: tokens.spacing.sm,
  },
  modeButtonText: {
    fontSize: 13,
    fontWeight: tokens.typography.weight.medium,
  },
  languageList: {
    gap: tokens.spacing.xs,
  },
  languageOption: {
    flexDirection: "row",
    alignItems: "center",
    gap: tokens.spacing.xs,
    borderRadius: tokens.radii.sm,
    borderWidth: 1.5,
    borderColor: "transparent",
    paddingHorizontal: tokens.spacing.sm,
    paddingVertical: tokens.spacing.sm,
  },
  languageLabel: {
    fontSize: tokens.typography.size.sm,
    fontWeight: tokens.typography.weight.medium,
  },
  languageCheck: {
    marginLeft: "auto",
    fontSize: tokens.typography.size.sm,
    fontWeight: tokens.typography.weight.bold,
  },
  notice: {
    marginTop: tokens.spacing.xs,
    marginBottom: tokens.spacing.sm,
    fontSize: tokens.typography.size.xs,
    textAlign: "center",
  },
  signOutButton: {
    marginTop: tokens.spacing.sm,
    borderWidth: 1,
    borderRadius: tokens.radii.md,
    paddingHorizontal: tokens.spacing.lg,
    paddingVertical: tokens.spacing.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  signOutCopy: {
    flex: 1,
  },
  signOutTitle: {
    fontSize: tokens.typography.size.sm,
    fontWeight: tokens.typography.weight.semibold,
  },
  signOutSubtitle: {
    fontSize: tokens.typography.size.xs,
    marginTop: 2,
  },
  signOutArrow: {
    fontSize: 16,
    marginLeft: tokens.spacing.sm,
  },
});
