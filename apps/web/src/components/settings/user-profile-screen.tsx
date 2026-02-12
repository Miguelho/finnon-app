"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { Mail } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { useWebUserTheme } from "@/components/theme/web-user-theme-provider";
import {
  DEFAULT_USER_THEME,
  DEFAULT_USER_THEME_MODE,
  getAvatarInitials,
  getSupportedUserLocale,
  getUserAvatarColor,
  getUserThemeId,
  getUserThemeMode,
  isExpired,
  resolveUserThemeTokens,
  signOutAndReset,
  USER_AVATAR_COLORS,
  USER_AVATAR_COLOR_ORDER,
  USER_THEME_DEFINITIONS,
  USER_THEME_MODE_ORDER,
  USER_THEME_ORDER,
  type UserAvatarColorId,
  type UserLocale,
  type UserThemeId,
  type UserThemeMode,
} from "@poleursus/shared";

type UserProfileScreenProps = {
  userId: string;
  userEmail: string;
};

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

const STORAGE_KEY = "finnon:activeAccountId";

export function UserProfileScreen({ userId, userEmail }: UserProfileScreenProps) {
  const t = useTranslations();
  const router = useRouter();
  const locale = useLocale();
  const supabase = useMemo(() => createClient(), []);
  const { primaryActionTextColor, resolvedMode, setThemePreferences } =
    useWebUserTheme();

  const runtimeLocale = locale.startsWith("en") ? "en" : "es";

  const [profile, setProfile] = useState<ProfileState>({
    email: userEmail,
    avatarColor: getUserAvatarColor(null),
    theme: DEFAULT_USER_THEME,
    colorMode: DEFAULT_USER_THEME_MODE,
    locale: runtimeLocale,
  });
  const [isProfileLoading, setIsProfileLoading] = useState(true);
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

  const activeTheme = useMemo(
    () => resolveUserThemeTokens(profile.theme, profile.colorMode, resolvedMode),
    [profile.colorMode, profile.theme, resolvedMode]
  );

  const loadProfile = useCallback(async () => {
    setIsProfileLoading(true);

    const { data, error } = await supabase
      .from("profiles")
      .select("email, avatar_color, theme, color_mode, locale")
      .eq("user_id", userId)
      .maybeSingle();

    if (error) {
      toast.error(t("settings.userProfile.errors.loadProfile"));
    }

    const row = (data ?? {}) as ProfileRow;
    const resolvedTheme = getUserThemeId(row.theme);
    const resolvedColorMode = getUserThemeMode(row.color_mode);

    setProfile({
      email: row.email ?? userEmail,
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
  }, [runtimeLocale, setThemePreferences, supabase, t, userEmail, userId]);

  const loadPendingInvites = useCallback(async () => {
    setIsInvitesLoading(true);

    const filters: string[] = [];
    const normalizedEmail = userEmail?.trim().toLowerCase();

    if (normalizedEmail) {
      filters.push(
        `invited_email.ilike.${normalizedEmail}`,
        `invitee_email.ilike.${normalizedEmail}`
      );
    }

    if (userId) {
      filters.push(`invitee_user_id.eq.${userId}`);
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
        accountName: accountName ?? t("settings.userProfile.invitations.unknownAccount"),
        inviterEmail:
          inviter?.email ?? t("settings.userProfile.invitations.unknownInviter"),
        inviterColor: getUserAvatarColor(inviter?.avatar_color),
      };
    });

    setPendingInvites(mapped);
    setIsInvitesLoading(false);
  }, [supabase, t, userEmail, userId]);

  useEffect(() => {
    void loadProfile();
    void loadPendingInvites();
  }, [loadPendingInvites, loadProfile]);

  const saveProfilePatch = useCallback(
    async (patch: Record<string, unknown>) => {
      const { error } = await supabase
        .from("profiles")
        .update(patch)
        .eq("user_id", userId);
      return !error;
    },
    [supabase, userId]
  );

  const updateAvatarColor = async (nextColor: UserAvatarColorId) => {
    if (nextColor === profile.avatarColor || savingField) return;

    const previous = profile.avatarColor;
    setSavingField("avatarColor");
    setProfile((current) => ({ ...current, avatarColor: nextColor }));

    const ok = await saveProfilePatch({ avatar_color: nextColor });
    if (!ok) {
      setProfile((current) => ({ ...current, avatarColor: previous }));
      toast.error(t("settings.userProfile.errors.saveAvatarColor"));
    }

    setSavingField(null);
  };

  const updateTheme = async (nextTheme: UserThemeId) => {
    if (nextTheme === profile.theme || savingField) return;

    const previous = profile.theme;
    setSavingField("theme");
    setProfile((current) => ({ ...current, theme: nextTheme }));
    setThemePreferences({ theme: nextTheme });

    const ok = await saveProfilePatch({ theme: nextTheme });
    if (!ok) {
      setProfile((current) => ({ ...current, theme: previous }));
      setThemePreferences({ theme: previous });
      toast.error(t("settings.userProfile.errors.saveTheme"));
    }

    setSavingField(null);
  };

  const updateColorMode = async (nextMode: UserThemeMode) => {
    if (nextMode === profile.colorMode || savingField) return;

    const previous = profile.colorMode;
    setSavingField("colorMode");
    setProfile((current) => ({ ...current, colorMode: nextMode }));
    setThemePreferences({ colorMode: nextMode });

    const ok = await saveProfilePatch({ color_mode: nextMode });
    if (!ok) {
      setProfile((current) => ({ ...current, colorMode: previous }));
      setThemePreferences({ colorMode: previous });
      toast.error(t("settings.userProfile.errors.saveColorMode"));
    }

    setSavingField(null);
  };

  const updateLanguage = async (nextLocale: UserLocale) => {
    if (nextLocale === profile.locale || savingField) return;

    const previous = profile.locale;
    setSavingField("locale");
    setProfile((current) => ({ ...current, locale: nextLocale }));

    const ok = await saveProfilePatch({ locale: nextLocale });
    if (!ok) {
      setProfile((current) => ({ ...current, locale: previous }));
      toast.error(t("settings.userProfile.errors.saveLocale"));
      setSavingField(null);
      return;
    }

    document.cookie = `NEXT_LOCALE=${nextLocale}; path=/; max-age=31536000`;
    window.location.reload();
  };

  const handleInviteAction = async (
    inviteId: string,
    action: Exclude<InviteAction, null>
  ) => {
    if (inviteActionId) return;
    setInviteActionId(inviteId);
    setInviteAction(action);
    setNotice(null);
    setNoticeTone(null);

    try {
      const response = await fetch(`/api/invites/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inviteId }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        const message =
          typeof payload?.errorKey === "string"
            ? t(payload.errorKey as any, payload.errorParams)
            : t("errors.internalServer");
        setNotice(message);
        setNoticeTone("negative");
        return;
      }

      setNotice(
        action === "accept" ? t("invitations.joinSuccess") : t("common.successTitle")
      );
      setNoticeTone("positive");
      await loadPendingInvites();
    } catch (error) {
      console.error("[UserProfileWeb] Invite action error:", error);
      setNotice(t("errors.internalServer"));
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
          const res = await fetch("/api/auth/signout", {
            method: "POST",
            credentials: "include",
          });
          if (!res.ok) {
            throw new Error("sign_out_failed");
          }
        },
        clearLocalSessionArtifacts: async () => {
          localStorage.removeItem(STORAGE_KEY);
        },
        onNavigate: () => router.replace("/login"),
      });
    } catch (error) {
      console.error("[UserProfileWeb] Sign out failed:", error);
      toast.error(t("settings.signOut.error"));
    } finally {
      setIsSigningOut(false);
    }
  };

  const mainAvatar = USER_AVATAR_COLORS[profile.avatarColor];

  return (
    <div className="space-y-3" style={{ color: activeTheme.textPrimary }}>
      <div className="space-y-1 px-1">
        <h1 className="text-3xl font-bold tracking-tight">
          {t("settings.userProfile.title")}
        </h1>
        <p style={{ color: activeTheme.textSecondary }}>
          {t("settings.userProfile.subtitle")}
        </p>
      </div>

      <section
        className="rounded-2xl border px-6 py-5"
        style={{ backgroundColor: activeTheme.surface, borderColor: activeTheme.border }}
      >
        <h2 className="mb-3 text-sm font-bold">{t("settings.userProfile.avatar.title")}</h2>

        <div className="flex items-center gap-3">
          <div
            className="flex h-[52px] w-[52px] items-center justify-center rounded-full text-[17px] font-bold"
            style={{ backgroundColor: mainAvatar.bg, color: mainAvatar.fg }}
          >
            {getAvatarInitials(profile.email)}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{profile.email}</p>
            <p className="text-xs" style={{ color: activeTheme.textTertiary }}>
              {t("settings.userProfile.avatar.hint")}
            </p>
          </div>
        </div>

        <p
          className="mb-2 mt-4 text-[11px] font-semibold uppercase tracking-wide"
          style={{ color: activeTheme.textTertiary }}
        >
          {t("settings.userProfile.avatar.colorLabel")}
        </p>
        <div className="flex flex-wrap gap-2">
          {USER_AVATAR_COLOR_ORDER.map((colorId) => {
            const color = USER_AVATAR_COLORS[colorId];
            const selected = profile.avatarColor === colorId;
            return (
              <button
                key={colorId}
                type="button"
                onClick={() => updateAvatarColor(colorId)}
                disabled={savingField !== null}
                className="flex h-8 w-8 items-center justify-center rounded-full border transition disabled:opacity-50"
                style={{
                  borderColor: selected ? color.fg : "transparent",
                  borderWidth: selected ? 2 : 1,
                }}
              >
                <span
                  className="h-[22px] w-[22px] rounded-full"
                  style={{ backgroundColor: color.fg }}
                />
              </button>
            );
          })}
        </div>
      </section>

      <section
        className="rounded-2xl border px-6 py-5"
        style={{ backgroundColor: activeTheme.surface, borderColor: activeTheme.border }}
      >
        <h2 className="mb-3 text-sm font-bold">
          {t("settings.userProfile.invitations.title")}
        </h2>

        {isInvitesLoading ? (
          <p className="text-sm" style={{ color: activeTheme.textSecondary }}>
            {t("common.loading")}
          </p>
        ) : pendingInvites.length === 0 ? (
          <div className="flex flex-col items-center gap-1 py-4 text-center">
            <Mail
              className="h-5 w-5"
              strokeWidth={1.8}
              style={{ color: activeTheme.textTertiary }}
            />
            <p className="text-sm" style={{ color: activeTheme.textTertiary }}>
              {t("settings.userProfile.invitations.empty")}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {pendingInvites.map((invite) => {
              const avatar = USER_AVATAR_COLORS[invite.inviterColor];
              const isActing = inviteActionId === invite.id;

              return (
                <div
                  key={invite.id}
                  className="flex items-center gap-3 rounded-xl px-3 py-2"
                  style={{ backgroundColor: activeTheme.surfaceAlt }}
                >
                  <div
                    className="flex h-[34px] w-[34px] items-center justify-center rounded-full text-xs font-bold"
                    style={{ backgroundColor: avatar.bg, color: avatar.fg }}
                  >
                    {getAvatarInitials(invite.inviterEmail)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{invite.accountName}</p>
                    <p className="truncate text-xs" style={{ color: activeTheme.textSecondary }}>
                      {t("settings.userProfile.invitations.from", {
                        email: invite.inviterEmail,
                      })}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => void handleInviteAction(invite.id, "reject")}
                      disabled={isActing}
                      className="rounded-md border px-3 py-[5px] text-xs font-semibold transition disabled:opacity-50"
                      style={{
                        borderColor: activeTheme.border,
                        color: activeTheme.textSecondary,
                      }}
                    >
                      {t("invitations.rejectButton")}
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleInviteAction(invite.id, "accept")}
                      disabled={isActing}
                      className="rounded-md px-3 py-[5px] text-xs font-semibold transition disabled:opacity-50"
                      style={{
                        backgroundColor: activeTheme.primary,
                        color: primaryActionTextColor,
                      }}
                    >
                      {t("invitations.acceptButton")}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section
        className="rounded-2xl border px-6 py-5"
        style={{ backgroundColor: activeTheme.surface, borderColor: activeTheme.border }}
      >
        <h2 className="mb-3 text-sm font-bold">{t("settings.userProfile.theme.title")}</h2>

        <div className="grid grid-cols-2 gap-2">
          {USER_THEME_ORDER.map((themeId) => {
            const definition = USER_THEME_DEFINITIONS[themeId];
            const selected = profile.theme === themeId;

            return (
              <button
                key={themeId}
                type="button"
                onClick={() => void updateTheme(themeId)}
                disabled={savingField !== null}
                className="rounded-xl border p-3 text-center transition disabled:opacity-50"
                style={{
                  borderColor: selected ? activeTheme.primary : activeTheme.border,
                  borderWidth: selected ? 2 : 1.5,
                  backgroundColor: activeTheme.surface,
                }}
              >
                <div className="mb-2 flex h-9 gap-1">
                  {definition.preview.map((swatch) => (
                    <div
                      key={`${themeId}-${swatch}`}
                      className="flex-1 rounded-md"
                      style={{ backgroundColor: swatch }}
                    />
                  ))}
                </div>
                <p className="text-[13px] font-semibold">
                  {t(`settings.userProfile.theme.options.${themeId}.name` as any)}
                </p>
                <p className="text-[11px]" style={{ color: activeTheme.textTertiary }}>
                  {t(`settings.userProfile.theme.options.${themeId}.description` as any)}
                </p>
              </button>
            );
          })}
        </div>

        <div
          className="mt-3 flex gap-[3px] rounded-md border p-[3px]"
          style={{
            backgroundColor: activeTheme.surfaceAlt,
            borderColor: activeTheme.border,
          }}
        >
          {USER_THEME_MODE_ORDER.map((mode) => {
            const selected = profile.colorMode === mode;
            return (
              <button
                key={mode}
                type="button"
                onClick={() => void updateColorMode(mode)}
                disabled={savingField !== null}
                className="flex-1 rounded-md border px-2 py-2 text-sm font-medium transition disabled:opacity-50"
                style={{
                  borderColor: selected ? activeTheme.border : "transparent",
                  backgroundColor: selected ? activeTheme.surface : "transparent",
                  color: selected ? activeTheme.textPrimary : activeTheme.textSecondary,
                }}
              >
                {t(`settings.userProfile.theme.modes.${mode}` as any)}
              </button>
            );
          })}
        </div>
      </section>

      <section
        className="rounded-2xl border px-6 py-5"
        style={{ backgroundColor: activeTheme.surface, borderColor: activeTheme.border }}
      >
        <h2 className="mb-3 text-sm font-bold">{t("settings.userProfile.language.title")}</h2>

        <div className="space-y-1">
          {([
            { code: "es", flag: "🇪🇸" },
            { code: "en", flag: "🇬🇧" },
          ] as const).map((item) => {
            const selected = profile.locale === item.code;
            return (
              <button
                key={item.code}
                type="button"
                onClick={() => void updateLanguage(item.code)}
                disabled={savingField !== null}
                className="flex w-full items-center gap-2 rounded-md border px-3 py-2 text-left transition disabled:opacity-50"
                style={{
                  borderColor: selected ? activeTheme.textPrimary : "transparent",
                  backgroundColor: selected ? activeTheme.surfaceAlt : "transparent",
                }}
              >
                <span className="inline-block w-6 text-center text-lg">{item.flag}</span>
                <span className="text-sm font-medium">
                  {t(`settings.language.options.${item.code}` as any)}
                </span>
                {selected ? <span className="ml-auto text-sm font-bold">✓</span> : null}
              </button>
            );
          })}
        </div>
      </section>

      {notice ? (
        <p
          className="px-1 text-center text-xs"
          style={{
            color:
              noticeTone === "negative"
                ? activeTheme.dangerText
                : activeTheme.textSecondary,
          }}
        >
          {notice}
        </p>
      ) : null}

      <button
        type="button"
        onClick={() => void handleSignOut()}
        disabled={isSigningOut}
        className="mt-2 flex w-full items-center justify-between rounded-xl border px-5 py-3 text-left transition disabled:opacity-60"
        style={{
          backgroundColor: activeTheme.surface,
          borderColor: activeTheme.border,
        }}
      >
        <div>
          <p className="text-sm font-semibold" style={{ color: activeTheme.dangerText }}>
            {t("settings.signOut.label")}
          </p>
          <p className="text-xs" style={{ color: activeTheme.textTertiary }}>
            {t("settings.signOut.description")}
          </p>
        </div>
        <span className="text-base" style={{ color: activeTheme.dangerText }}>
          {isSigningOut ? "…" : "→"}
        </span>
      </button>
    </div>
  );
}
