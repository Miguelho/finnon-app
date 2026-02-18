import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useColorScheme,
  View,
} from "react-native";
import { Mail } from "lucide-react-native";
import { useIsFocused } from "@react-navigation/native";
import {
  DEFAULT_USER_THEME,
  DEFAULT_USER_THEME_MODE,
  getAvatarInitials,
  getSupportedUserLocale,
  getUserAvatarColor,
  getUserThemeId,
  getUserThemeMode,
  isExpired,
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
  display_name: string | null;
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
  display_name: string | null;
  avatar_color: string | null;
};

type PendingInvite = {
  id: string;
  accountName: string;
  inviterEmail: string;
  inviterDisplayName: string | null;
  inviterColor: UserAvatarColorId;
};

type ProfileState = {
  email: string;
  displayName: string;
  avatarColor: UserAvatarColorId;
  theme: UserThemeId;
  colorMode: UserThemeMode;
  locale: UserLocale;
};

type SavingField =
  | "displayName"
  | "avatarColor"
  | "theme"
  | "colorMode"
  | "locale"
  | null;
type InviteAction = "accept" | "reject" | null;

export default function UserProfileScreen() {
  const { user, loading, session, signOut } = useAuth();
  const { dictionary, locale } = useCopy();
  const { setLocale } = useLocale();
  const { reportNetworkIssue } = useNetworkNotice();
  const { primaryActionTextColor, setThemePreferences } = useUserTheme();
  const isFocused = useIsFocused();
  const colorScheme = useColorScheme();

  const runtimeLocale = locale.startsWith("en") ? "en" : "es";

  const [profile, setProfile] = useState<ProfileState>({
    email: "",
    displayName: "",
    avatarColor: getUserAvatarColor(null),
    theme: DEFAULT_USER_THEME,
    colorMode: DEFAULT_USER_THEME_MODE,
    locale: runtimeLocale,
  });
  const [displayNameInput, setDisplayNameInput] = useState("");
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
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [deleteEmailInput, setDeleteEmailInput] = useState("");
  const [deleteKeywordInput, setDeleteKeywordInput] = useState("");
  const [isDeletingUser, setIsDeletingUser] = useState(false);


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
      .select("email, display_name, avatar_color, theme, color_mode, locale")
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
    const resolvedDisplayName =
      row.display_name?.trim() ||
      (typeof user.user_metadata?.display_name === "string"
        ? user.user_metadata.display_name.trim()
        : typeof user.user_metadata?.full_name === "string"
          ? user.user_metadata.full_name.trim()
          : "");

    setProfile({
      email: row.email ?? user.email ?? "",
      displayName: resolvedDisplayName,
      avatarColor: getUserAvatarColor(row.avatar_color),
      theme: resolvedTheme,
      colorMode: resolvedColorMode,
      locale: getSupportedUserLocale(row.locale, runtimeLocale),
    });
    setDisplayNameInput(resolvedDisplayName);
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
        .select("user_id, email, display_name, avatar_color")
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
        inviterDisplayName: inviter?.display_name ?? null,
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

  const updateDisplayName = async () => {
    if (!session || !user?.id || savingField) return;

    const normalizedName = displayNameInput.trim();
    if (!normalizedName || normalizedName === profile.displayName) return;

    const previous = profile.displayName;
    setSavingField("displayName");
    setProfile((current) => ({ ...current, displayName: normalizedName }));

    const { error } = await supabase.auth.updateUser({
      data: {
        display_name: normalizedName,
        full_name: normalizedName,
      },
    });

    if (error) {
      console.error("[UserProfile] Failed to save display_name:", error);
      setProfile((current) => ({ ...current, displayName: previous }));
      setDisplayNameInput(previous);
      reportNetworkIssue({
        message: t(dictionary, "settings.userProfile.errors.saveDisplayName"),
        onRetry: () => {
          void updateDisplayName();
        },
      });
    } else {
      setDisplayNameInput(normalizedName);
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

  const closeDeleteDialog = () => {
    if (isDeletingUser) return;
    setIsDeleteDialogOpen(false);
    setDeleteEmailInput("");
    setDeleteKeywordInput("");
  };

  const forceCloseDeleteDialog = () => {
    setIsDeleteDialogOpen(false);
    setDeleteEmailInput("");
    setDeleteKeywordInput("");
  };

  const handleDeleteUser = async () => {
    if (!session?.access_token || !canDeleteUser || isDeletingUser) return;

    setIsDeletingUser(true);
    setNotice(null);
    setNoticeTone(null);

    try {
      const response = await fetch(`${API_URL}/api/auth/delete-user`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          email: deleteEmailInput.trim(),
          confirmation: deleteKeywordInput.trim(),
        }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        const message =
          typeof payload?.errorKey === "string"
            ? t(dictionary, payload.errorKey as any, payload.errorParams)
            : t(dictionary, "settings.userProfile.errors.deleteUser");
        setNotice(message);
        setNoticeTone("negative");
        return;
      }

      forceCloseDeleteDialog();
      await signOut();
    } catch (error) {
      console.error("[UserProfile] Delete user error:", error);
      const message = t(dictionary, "settings.userProfile.errors.deleteUser");
      setNotice(message);
      setNoticeTone("negative");
      reportNetworkIssue({
        message,
        onRetry: () => {
          void handleDeleteUser();
        },
      });
    } finally {
      setIsDeletingUser(false);
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
  const normalizedDisplayNameInput = displayNameInput.trim();
  const hasDisplayNameChanges =
    normalizedDisplayNameInput !== profile.displayName.trim();
  const deleteKeywordValue = t(dictionary, "settings.userProfile.deleteUser.keywordValue")
    .trim()
    .toLowerCase();
  const emailMatches =
    deleteEmailInput.trim().toLowerCase() === profile.email.trim().toLowerCase();
  const keywordMatches =
    deleteKeywordInput.trim().toLowerCase() === deleteKeywordValue;
  const canDeleteUser = emailMatches && keywordMatches && !isDeletingUser;

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
              {getAvatarInitials(profile.email, profile.displayName)}
            </Text>
          </View>
          <View style={styles.avatarInfo}>
            <Text style={[styles.emailValue, { color: activeTheme.textPrimary }]}>
              {profile.email}
            </Text>
            <Text style={[styles.displayNameLabel, { color: activeTheme.textTertiary }]}>
              {t(dictionary, "settings.userProfile.displayName.label")}
            </Text>
            <View style={styles.displayNameRow}>
              <TextInput
                value={displayNameInput}
                onChangeText={setDisplayNameInput}
                placeholder={t(dictionary, "settings.userProfile.displayName.placeholder")}
                placeholderTextColor={activeTheme.textTertiary}
                editable={savingField !== "displayName"}
                maxLength={80}
                autoCapitalize="words"
                autoCorrect={false}
                style={[
                  styles.displayNameInput,
                  {
                    color: activeTheme.textPrimary,
                    borderColor: activeTheme.border,
                    backgroundColor: activeTheme.surfaceAlt,
                  },
                ]}
              />
              <Pressable
                onPress={() => {
                  void updateDisplayName();
                }}
                disabled={!normalizedDisplayNameInput || !hasDisplayNameChanges || savingField !== null}
                style={[
                  styles.displayNameSaveButton,
                  {
                    borderColor: activeTheme.border,
                    backgroundColor: activeTheme.surface,
                  },
                  (!normalizedDisplayNameInput || !hasDisplayNameChanges || savingField !== null) &&
                    styles.displayNameSaveButtonDisabled,
                ]}
              >
                {savingField === "displayName" ? (
                  <ActivityIndicator size="small" color={activeTheme.textSecondary} />
                ) : (
                  <Text
                    style={[
                      styles.displayNameSaveButtonText,
                      { color: activeTheme.textSecondary },
                    ]}
                  >
                    {t(dictionary, "common.save")}
                  </Text>
                )}
              </Pressable>
            </View>
            <Text style={[styles.displayNameHint, { color: activeTheme.textTertiary }]}>
              {t(dictionary, "settings.userProfile.displayName.hint")}
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
            <Mail
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
                      {getAvatarInitials(invite.inviterEmail, invite.inviterDisplayName)}
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

      <View style={[styles.dangerSection, { borderTopColor: activeTheme.border }]}>
        <Text style={styles.dangerTitle}>
          {t(dictionary, "settings.userProfile.deleteUser.dangerTitle")}
        </Text>
        <View
          style={[
            styles.dangerCard,
            {
              borderColor: activeTheme.border,
              backgroundColor: activeTheme.surface,
            },
          ]}
        >
          <View style={styles.dangerInfo}>
            <Text style={[styles.dangerActionTitle, { color: activeTheme.textPrimary }]}>
              {t(dictionary, "settings.userProfile.deleteUser.title")}
            </Text>
            <Text style={[styles.dangerDescription, { color: activeTheme.textSecondary }]}>
              {t(dictionary, "settings.userProfile.deleteUser.description")}
            </Text>
          </View>
          <Pressable
            onPress={() => setIsDeleteDialogOpen(true)}
            disabled={isDeletingUser}
            style={[styles.dangerButton, { borderColor: activeTheme.border }]}
          >
            <Text style={styles.dangerButtonText}>
              {isDeletingUser
                ? t(dictionary, "common.deleting")
                : t(dictionary, "settings.userProfile.deleteUser.button")}
            </Text>
          </Pressable>
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

      <Modal
        transparent
        visible={isDeleteDialogOpen}
        animationType="fade"
        onRequestClose={closeDeleteDialog}
      >
        <View style={styles.deleteModalOverlay}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={closeDeleteDialog}
            disabled={isDeletingUser}
          />

          <View
            style={[
              styles.deleteModalCard,
              {
                backgroundColor: activeTheme.surface,
                borderColor: activeTheme.border,
              },
            ]}
          >
            <Text style={[styles.deleteModalTitle, { color: activeTheme.textPrimary }]}>
              {t(dictionary, "settings.userProfile.deleteUser.dialogTitle")}
            </Text>
            <Text style={[styles.deleteModalDescription, { color: activeTheme.textSecondary }]}>
              {t(dictionary, "settings.userProfile.deleteUser.dialogDescription", {
                keyword: deleteKeywordValue,
              })}
            </Text>

            <View style={styles.deleteFieldGroup}>
              <Text style={[styles.deleteFieldLabel, { color: activeTheme.textTertiary }]}>
                {t(dictionary, "settings.userProfile.deleteUser.emailLabel")}
              </Text>
              <TextInput
                value={deleteEmailInput}
                onChangeText={setDeleteEmailInput}
                editable={!isDeletingUser}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                placeholder={t(dictionary, "settings.userProfile.deleteUser.emailPlaceholder")}
                placeholderTextColor={activeTheme.textTertiary}
                style={[
                  styles.deleteInput,
                  {
                    borderColor: activeTheme.border,
                    color: activeTheme.textPrimary,
                    backgroundColor: activeTheme.background,
                  },
                ]}
              />
            </View>

            <View style={styles.deleteFieldGroup}>
              <Text style={[styles.deleteFieldLabel, { color: activeTheme.textTertiary }]}>
                {t(dictionary, "settings.userProfile.deleteUser.keywordLabel", {
                  keyword: deleteKeywordValue,
                })}
              </Text>
              <TextInput
                value={deleteKeywordInput}
                onChangeText={setDeleteKeywordInput}
                editable={!isDeletingUser}
                autoCapitalize="none"
                autoCorrect={false}
                placeholder={t(dictionary, "settings.userProfile.deleteUser.keywordPlaceholder")}
                placeholderTextColor={activeTheme.textTertiary}
                style={[
                  styles.deleteInput,
                  {
                    borderColor: activeTheme.border,
                    color: activeTheme.textPrimary,
                    backgroundColor: activeTheme.background,
                  },
                ]}
              />
            </View>

            <View style={styles.deleteModalActions}>
              <Pressable
                onPress={closeDeleteDialog}
                disabled={isDeletingUser}
                style={styles.deleteCancelButton}
              >
                <Text
                  style={[
                    styles.deleteCancelText,
                    { color: isDeletingUser ? activeTheme.textTertiary : activeTheme.textSecondary },
                  ]}
                >
                  {t(dictionary, "common.cancel")}
                </Text>
              </Pressable>

              <Pressable
                onPress={() => {
                  void handleDeleteUser();
                }}
                disabled={!canDeleteUser}
                style={[
                  styles.deleteConfirmButton,
                  {
                    borderColor: activeTheme.dangerText,
                    opacity: canDeleteUser ? 1 : 0.55,
                  },
                ]}
              >
                {isDeletingUser ? (
                  <ActivityIndicator size="small" color={activeTheme.dangerText} />
                ) : (
                  <Text style={[styles.deleteConfirmText, { color: activeTheme.dangerText }]}>
                    {t(dictionary, "settings.userProfile.deleteUser.confirmAction")}
                  </Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

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
  displayNameLabel: {
    marginTop: tokens.spacing.xs,
    marginBottom: 4,
    fontSize: 11,
    fontWeight: tokens.typography.weight.semibold,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  displayNameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: tokens.spacing.xs,
  },
  displayNameInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: tokens.radii.sm,
    paddingHorizontal: tokens.spacing.sm,
    paddingVertical: 10,
    fontSize: tokens.typography.size.sm,
  },
  displayNameHint: {
    marginTop: 6,
    fontSize: 11,
  },
  displayNameSaveButton: {
    borderWidth: 1,
    borderRadius: tokens.radii.sm,
    paddingHorizontal: tokens.spacing.sm,
    paddingVertical: 10,
    minWidth: 72,
    alignItems: "center",
    justifyContent: "center",
  },
  displayNameSaveButtonDisabled: {
    opacity: 0.55,
  },
  displayNameSaveButtonText: {
    fontSize: 12,
    fontWeight: tokens.typography.weight.semibold,
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
  dangerSection: {
    borderTopWidth: 1,
    paddingTop: tokens.spacing.xl,
    marginBottom: tokens.spacing.md,
  },
  dangerTitle: {
    fontSize: tokens.typography.size.xs,
    fontWeight: tokens.typography.weight.semibold,
    color: tokens.colors.state.negative,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: tokens.spacing.md,
  },
  dangerCard: {
    borderWidth: 1,
    borderRadius: tokens.radii.lg,
    padding: tokens.spacing.lg,
    gap: tokens.spacing.md,
  },
  dangerInfo: {
    gap: tokens.spacing.xs,
  },
  dangerActionTitle: {
    fontSize: tokens.typography.size.sm,
    fontWeight: tokens.typography.weight.semibold,
  },
  dangerDescription: {
    fontSize: tokens.typography.size.xs,
  },
  dangerButton: {
    borderWidth: 1,
    borderRadius: tokens.radii.sm,
    paddingHorizontal: tokens.spacing.lg,
    paddingVertical: 8,
    alignSelf: "flex-start",
  },
  dangerButtonText: {
    color: tokens.colors.state.negative,
    fontSize: tokens.typography.size.sm,
    fontWeight: tokens.typography.weight.semibold,
  },
  deleteModalOverlay: {
    flex: 1,
    justifyContent: "center",
    padding: tokens.spacing.lg,
    backgroundColor: "rgba(0, 0, 0, 0.32)",
  },
  deleteModalCard: {
    borderWidth: 1,
    borderRadius: tokens.radii.lg,
    padding: tokens.spacing.lg,
  },
  deleteModalTitle: {
    fontSize: tokens.typography.size.lg,
    fontWeight: tokens.typography.weight.semibold,
    marginBottom: tokens.spacing.xs,
  },
  deleteModalDescription: {
    fontSize: tokens.typography.size.sm,
    marginBottom: tokens.spacing.lg,
  },
  deleteFieldGroup: {
    marginBottom: tokens.spacing.md,
  },
  deleteFieldLabel: {
    fontSize: tokens.typography.size.xs,
    fontWeight: tokens.typography.weight.semibold,
    marginBottom: tokens.spacing.xs,
  },
  deleteInput: {
    borderWidth: 1,
    borderRadius: tokens.radii.sm,
    fontSize: tokens.typography.size.sm,
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: 10,
  },
  deleteModalActions: {
    marginTop: tokens.spacing.xs,
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: tokens.spacing.sm,
  },
  deleteCancelButton: {
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: tokens.spacing.sm,
  },
  deleteCancelText: {
    fontSize: tokens.typography.size.sm,
    fontWeight: tokens.typography.weight.medium,
  },
  deleteConfirmButton: {
    borderWidth: 1,
    borderRadius: tokens.radii.md,
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: tokens.spacing.sm,
    alignItems: "center",
    justifyContent: "center",
    minWidth: 134,
  },
  deleteConfirmText: {
    fontSize: tokens.typography.size.sm,
    fontWeight: tokens.typography.weight.semibold,
  },
});
