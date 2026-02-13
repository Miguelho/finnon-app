import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Picker } from "@react-native-picker/picker";
import { Redirect } from "expo-router";
import { PencilSimple, X } from "phosphor-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "../../../../src/contexts/AuthContext";
import { useNetworkNotice } from "../../../../src/contexts/NetworkNoticeContext";
import { useUserTheme } from "../../../../src/contexts/UserThemeContext";
import { useCopy, t } from "../../../../src/lib/i18n";
import { supabase } from "../../../../src/lib/supabase";
import { getSessionAccessToken } from "../../../../src/lib/auth";
import {
  humanizeRole,
  themeTokens,
  type MemberRole,
} from "@poleursus/shared";

type MemberProfile = {
  user_id: string;
  role: MemberRole;
  name: string | null;
  email: string | null;
};

type InviteRow = {
  id: string;
  account_id: string;
  role: MemberRole;
  status: "pending" | "accepted" | "rejected" | "revoked" | "expired" | null;
  created_at: string;
  invited_email: string | null;
  invitee_email?: string | null;
};

type AccountMembershipRecord = {
  account_members?: Array<{ user_id: string; role: MemberRole }>;
};

const tokens = themeTokens.light;
const colors = tokens.colors;
const API_URL = process.env.EXPO_PUBLIC_API_URL || "http://localhost:3000";
const ui = {
  surface: colors.bg.surface,
  surfaceHover: "#F7F7F5",
  expenseBg: "#FFF5F3",
  dangerHover: "#FDEAE4",
};
const AVATAR_BACKGROUNDS = [
  "#1C1E21",
  "#E8EEFF",
  "#DADCE0",
  "#EAF5EE",
  "#FEF0EE",
  "#F4F0FF",
] as const;

function getInitials(value: string): string {
  const chunks = value
    .split(" ")
    .map((part) => part.trim())
    .filter(Boolean);

  if (chunks.length === 0) return "?";
  if (chunks.length === 1) {
    return (chunks[0] ?? "?").slice(0, 2).toUpperCase();
  }

  const first = chunks[0] ?? "";
  const second = chunks[1] ?? "";
  return `${first.slice(0, 1)}${second.slice(0, 1)}`.toUpperCase();
}

function getSentAgo(createdAt: string, locale: string): string {
  const elapsedMs = Date.now() - new Date(createdAt).getTime();
  const days = Math.max(0, Math.floor(elapsedMs / (1000 * 60 * 60 * 24)));
  const formatter = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
  return formatter.format(-days, "day");
}

export default function AccountMembersSettingsScreen() {
  const { selectedAccountId, isInitialized, user } = useAuth();
  const { dictionary, locale } = useCopy();
  const insets = useSafeAreaInsets();
  const { reportNetworkIssue } = useNetworkNotice();
  const {
    tokens: userThemeTokens,
    primaryActionColor,
    primaryActionTextColor,
  } = useUserTheme();
  const roleLocale = locale.startsWith("en") ? "en" : "es";

  const [accountRole, setAccountRole] = useState<MemberRole>("viewer");
  const [members, setMembers] = useState<MemberProfile[]>([]);
  const [invites, setInvites] = useState<InviteRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [editingMemberId, setEditingMemberId] = useState<string | null>(null);
  const [editingRole, setEditingRole] = useState<MemberRole>("viewer");
  const [isUpdatingMember, setIsUpdatingMember] = useState(false);

  const [isInviteComposerOpen, setIsInviteComposerOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<MemberRole>("viewer");
  const [isSendingInvite, setIsSendingInvite] = useState(false);
  const [pendingInviteId, setPendingInviteId] = useState<string | null>(null);

  const [notice, setNotice] = useState<string | null>(null);
  const [noticeTone, setNoticeTone] = useState<"positive" | "negative" | null>(
    null
  );

  const canManageMembers = accountRole === "admin";

  const pendingInvites = useMemo(
    () => invites.filter((invite) => invite.status === "pending"),
    [invites]
  );

  const setNegativeNotice = (message: string) => {
    setNotice(message);
    setNoticeTone("negative");
  };

  const setPositiveNotice = (message: string) => {
    setNotice(message);
    setNoticeTone("positive");
  };

  const loadAccountRole = async (accountId: string, userId: string) => {
    const { data, error: accountError } = await supabase
      .from("accounts")
      .select("account_members!inner(user_id, role)")
      .eq("id", accountId)
      .eq("account_members.user_id", userId)
      .maybeSingle();

    if (accountError) {
      throw accountError;
    }

    if (!data) {
      throw new Error(t(dictionary, "errors.accountNotFoundOrDenied"));
    }

    const record = data as AccountMembershipRecord;
    const role =
      record.account_members?.find((member) => member.user_id === userId)?.role ??
      "viewer";
    setAccountRole(role);
  };

  const loadMembers = async (accountId: string) => {
    const token = await getSessionAccessToken();
    if (!token) {
      throw new Error(t(dictionary, "errors.noSession"));
    }

    const response = await fetch(`${API_URL}/api/profiles`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ accountId }),
    });

    if (!response.ok) {
      throw new Error(t(dictionary, "errors.membersLoadFailed"));
    }

    const payload = await response.json();
    setMembers((payload?.members ?? []) as MemberProfile[]);
  };

  const loadInvites = async (accountId: string) => {
    const { data, error: inviteError } = await supabase
      .from("invites")
      .select(
        "id, account_id, role, status, created_at, invited_email, invitee_email"
      )
      .eq("account_id", accountId)
      .eq("status", "pending")
      .order("created_at", { ascending: false });

    if (inviteError) {
      throw inviteError;
    }

    setInvites((data ?? []) as InviteRow[]);
  };

  const reloadData = async () => {
    if (!selectedAccountId || !user?.id) return;

    try {
      await Promise.all([
        loadMembers(selectedAccountId),
        loadInvites(selectedAccountId),
      ]);
    } catch (err: any) {
      console.error("[AccountMembersSettings] Reload error:", err);
      setNegativeNotice(err?.message ?? t(dictionary, "errors.internalServer"));
    }
  };

  useEffect(() => {
    let cancelled = false;

    async function loadInitialData() {
      if (!selectedAccountId || !user?.id) {
        if (!cancelled) {
          setIsLoading(false);
        }
        return;
      }

      setIsLoading(true);
      setError(null);
      setNotice(null);
      setNoticeTone(null);

      try {
        await loadAccountRole(selectedAccountId, user.id);
        await Promise.all([
          loadMembers(selectedAccountId),
          loadInvites(selectedAccountId),
        ]);
      } catch (err: any) {
        console.error("[AccountMembersSettings] Load error:", err);
        if (!cancelled) {
          setError(err?.message ?? t(dictionary, "errors.internalServer"));
        }
        reportNetworkIssue({
          message: t(dictionary, "errors.internalServer"),
          onRetry: () => {
            void loadInitialData();
          },
        });
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void loadInitialData();

    return () => {
      cancelled = true;
    };
  }, [dictionary, reportNetworkIssue, selectedAccountId, user?.id]);

  const startEditRole = (member: MemberProfile) => {
    setEditingMemberId(member.user_id);
    setEditingRole(member.role);
  };

  const cancelEditRole = () => {
    setEditingMemberId(null);
    setEditingRole("viewer");
  };

  const saveMemberRole = async () => {
    if (!selectedAccountId || !editingMemberId || !canManageMembers || isUpdatingMember) {
      return;
    }

    setIsUpdatingMember(true);
    try {
      const { error: updateError } = await supabase
        .from("account_members")
        .update({ role: editingRole })
        .eq("account_id", selectedAccountId)
        .eq("user_id", editingMemberId);

      if (updateError) {
        throw updateError;
      }

      setPositiveNotice(t(dictionary, "accountSettings.members.updateRoleSuccess"));
      cancelEditRole();
      await reloadData();
    } catch (err) {
      console.error("[AccountMembersSettings] Update role error:", err);
      setNegativeNotice(t(dictionary, "accountSettings.members.updateRoleError"));
    } finally {
      setIsUpdatingMember(false);
    }
  };

  const confirmRemoveMember = async (member: MemberProfile) => {
    if (!selectedAccountId || !canManageMembers || member.user_id === user?.id) return;

    try {
      const { error: removeError } = await supabase
        .from("account_members")
        .delete()
        .eq("account_id", selectedAccountId)
        .eq("user_id", member.user_id);

      if (removeError) {
        throw removeError;
      }

      setPositiveNotice(t(dictionary, "accountSettings.members.removeMemberSuccess"));
      await reloadData();
    } catch (err) {
      console.error("[AccountMembersSettings] Remove member error:", err);
      setNegativeNotice(t(dictionary, "accountSettings.members.removeMemberError"));
    }
  };

  const removeMember = (member: MemberProfile) => {
    Alert.alert(
      t(dictionary, "common.delete"),
      t(dictionary, "accountSettings.members.removeMemberConfirm"),
      [
        {
          text: t(dictionary, "common.cancel"),
          style: "cancel",
        },
        {
          text: t(dictionary, "common.delete"),
          style: "destructive",
          onPress: () => {
            void confirmRemoveMember(member);
          },
        },
      ]
    );
  };

  const sendInvite = async (
    email: string,
    role: MemberRole,
    options?: { isResend?: boolean; inviteId?: string }
  ) => {
    if (!selectedAccountId || !canManageMembers) return;

    const trimmedEmail = email.trim();
    if (!trimmedEmail) return;

    const isResend = options?.isResend ?? false;
    const inviteId = options?.inviteId ?? null;

    setIsSendingInvite(true);
    setPendingInviteId(inviteId);

    try {
      const token = await getSessionAccessToken();
      if (!token) {
        setNegativeNotice(t(dictionary, "errors.noSession"));
        return;
      }

      const response = await fetch(`${API_URL}/api/invites/send`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          accountId: selectedAccountId,
          email: trimmedEmail,
          role,
        }),
      });

      if (!response.ok) {
        setNegativeNotice(t(dictionary, "invites.sendError"));
        return;
      }

      const payload = await response.json();
      if (payload?.status === "already_member") {
        setNegativeNotice(t(dictionary, "invites.registeredAlreadyMember"));
        return;
      }

      if (payload?.status === "pending") {
        setNegativeNotice(t(dictionary, "invites.registeredPending"));
        return;
      }

      setPositiveNotice(
        isResend
          ? t(dictionary, "accountSettings.members.resendSuccess")
          : t(dictionary, "invites.sendSuccess")
      );

      if (!isResend) {
        setInviteEmail("");
        setInviteRole("viewer");
        setIsInviteComposerOpen(false);
      }

      await loadInvites(selectedAccountId);
    } catch (err) {
      console.error("[AccountMembersSettings] Send invite error:", err);
      setNegativeNotice(t(dictionary, "invites.sendError"));
    } finally {
      setIsSendingInvite(false);
      setPendingInviteId(null);
    }
  };

  const revokeInvite = async (inviteId: string) => {
    if (!selectedAccountId || !canManageMembers) return;

    setPendingInviteId(inviteId);
    try {
      const { error: revokeError } = await supabase
        .from("invites")
        .update({ status: "revoked", responded_at: new Date().toISOString() })
        .eq("id", inviteId);

      if (revokeError) {
        throw revokeError;
      }

      setPositiveNotice(t(dictionary, "invites.revokeSuccess"));
      await loadInvites(selectedAccountId);
    } catch (err) {
      console.error("[AccountMembersSettings] Revoke invite error:", err);
      setNegativeNotice(t(dictionary, "invites.revokeError"));
    } finally {
      setPendingInviteId(null);
    }
  };

  if (!isInitialized) {
    return (
      <View style={[styles.loading, { backgroundColor: userThemeTokens.background }]}>
        <ActivityIndicator size="large" color={colors.text.muted} />
      </View>
    );
  }

  if (!selectedAccountId) {
    return <Redirect href="/(auth)/select-account" />;
  }

  if (isLoading) {
    return (
      <View style={[styles.loading, { backgroundColor: userThemeTokens.background }]}>
        <ActivityIndicator size="large" color={colors.text.muted} />
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.errorContainer, { backgroundColor: userThemeTokens.background }]}>
        <Text style={styles.errorTitle}>{t(dictionary, "common.errorTitle")}</Text>
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={[styles.scrollContainer, { backgroundColor: userThemeTokens.background }]}
      contentContainerStyle={[
        styles.scrollContent,
        { paddingBottom: insets.bottom + tokens.spacing.xxl },
      ]}
    >
      <View style={styles.pageHeader}>
        <Text style={styles.pageSubtitle}>
          {t(dictionary, "accountSettings.members.subtitle")}
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>
          {t(dictionary, "accountSettings.members.activeMembers")}
        </Text>
        <View style={styles.card}>
          {members.length === 0 ? (
            <Text style={styles.emptyText}>{t(dictionary, "account.participantsEmpty")}</Text>
          ) : (
            members.map((member, index) => {
              const isCurrentUser = member.user_id === user?.id;
              const isEditing = editingMemberId === member.user_id;
              const fallback = t(dictionary, "account.memberFallback", {
                id: member.user_id.slice(0, 6),
              });
              const displayName =
                member.name ||
                member.email ||
                (isCurrentUser ? t(dictionary, "account.youLabel") : fallback);
              const avatarText = getInitials(member.name || member.email || "?");

              return (
                <View key={`${member.user_id}-${member.role}`} style={styles.memberRow}>
                  <View style={styles.memberMain}>
                    <View
                      style={[
                        styles.memberAvatar,
                        isCurrentUser
                          ? styles.memberAvatarCurrentUser
                          : {
                              backgroundColor:
                                AVATAR_BACKGROUNDS[index % AVATAR_BACKGROUNDS.length],
                            },
                      ]}
                    >
                      <Text
                        style={[
                          styles.memberAvatarText,
                          isCurrentUser && styles.memberAvatarTextCurrentUser,
                        ]}
                      >
                        {avatarText}
                      </Text>
                    </View>

                    <View style={styles.memberInfo}>
                      <Text style={styles.memberName} numberOfLines={1}>
                        {isCurrentUser ? t(dictionary, "account.youLabel") : displayName}
                      </Text>
                      {!isCurrentUser && member.email ? (
                        <Text style={styles.memberEmail} numberOfLines={1}>
                          {member.email}
                        </Text>
                      ) : null}
                    </View>
                  </View>

                  <View style={styles.memberAside}>
                    <View
                      style={[
                        styles.roleBadge,
                        member.role === "admin"
                          ? styles.roleBadgeAdmin
                          : styles.roleBadgeDefault,
                      ]}
                    >
                      <Text
                        style={[
                          styles.roleBadgeText,
                          member.role === "admin"
                            ? styles.roleBadgeTextAdmin
                            : styles.roleBadgeTextDefault,
                        ]}
                      >
                        {humanizeRole(member.role, roleLocale)}
                      </Text>
                    </View>

                    {canManageMembers && !isCurrentUser ? (
                      isEditing ? (
                        <View style={styles.roleEditor}>
                          <View style={styles.rolePickerWrapper}>
                            <Picker
                              selectedValue={editingRole}
                              onValueChange={(value) =>
                                setEditingRole(String(value) as MemberRole)
                              }
                              enabled={!isUpdatingMember}
                              style={styles.rolePicker}
                            >
                              <Picker.Item
                                label={humanizeRole("admin", roleLocale)}
                                value="admin"
                              />
                              <Picker.Item
                                label={humanizeRole("contributor", roleLocale)}
                                value="contributor"
                              />
                              <Picker.Item
                                label={humanizeRole("viewer", roleLocale)}
                                value="viewer"
                              />
                            </Picker>
                          </View>
                          <View style={styles.roleEditorActions}>
                            <Pressable
                              onPress={() => {
                                void saveMemberRole();
                              }}
                              disabled={isUpdatingMember}
                              style={[
                                styles.smallActionButton,
                                { backgroundColor: primaryActionColor },
                                isUpdatingMember && styles.smallActionButtonDisabled,
                              ]}
                            >
                              <Text
                                style={[
                                  styles.smallActionButtonText,
                                  { color: primaryActionTextColor },
                                ]}
                              >
                                {t(dictionary, "common.save")}
                              </Text>
                            </Pressable>
                            <Pressable
                              onPress={cancelEditRole}
                              disabled={isUpdatingMember}
                              style={styles.smallActionGhost}
                            >
                              <Text style={styles.smallActionGhostText}>
                                {t(dictionary, "common.cancel")}
                              </Text>
                            </Pressable>
                          </View>
                        </View>
                      ) : (
                        <View style={styles.memberActions}>
                          <Pressable
                            onPress={() => startEditRole(member)}
                            style={({ pressed }) => [
                              styles.iconActionButton,
                              pressed && styles.iconActionButtonPressed,
                            ]}
                            accessibilityRole="button"
                            accessibilityLabel={t(dictionary, "common.edit")}
                          >
                            <PencilSimple size={14} color={colors.text.secondary} />
                          </Pressable>
                          <Pressable
                            onPress={() => removeMember(member)}
                            style={({ pressed }) => [
                              styles.iconActionButtonDanger,
                              pressed && styles.iconActionButtonDangerPressed,
                            ]}
                            accessibilityRole="button"
                            accessibilityLabel={t(dictionary, "common.delete")}
                          >
                            <X size={14} color={colors.state.negative} />
                          </Pressable>
                        </View>
                      )
                    ) : null}
                  </View>
                </View>
              );
            })
          )}
        </View>
      </View>

      <View style={styles.section}>
        <View style={styles.inviteHeader}>
          <View style={styles.inviteHeaderText}>
            <Text style={styles.sectionTitle}>
              {t(dictionary, "accountSettings.members.invitations")}
            </Text>
            <Text style={styles.pendingCount}>
              {t(dictionary, "accountSettings.members.pendingInvites", {
                count: pendingInvites.length,
              })}
            </Text>
          </View>

          {canManageMembers ? (
            <Pressable
              onPress={() => setIsInviteComposerOpen((current) => !current)}
              style={[styles.inviteButton, { backgroundColor: primaryActionColor }]}
            >
              <Text
                style={[
                  styles.inviteButtonText,
                  { color: primaryActionTextColor },
                ]}
              >
                + {t(dictionary, "accountSettings.members.inviteButton")}
              </Text>
            </Pressable>
          ) : null}
        </View>

        {isInviteComposerOpen && canManageMembers ? (
          <View style={styles.inviteComposer}>
            <TextInput
              value={inviteEmail}
              onChangeText={setInviteEmail}
              placeholder={t(dictionary, "login.emailPlaceholder")}
              placeholderTextColor={colors.text.muted}
              autoCapitalize="none"
              keyboardType="email-address"
              style={styles.input}
            />
            <View style={styles.inviteRolePickerWrapper}>
              <Picker
                selectedValue={inviteRole}
                onValueChange={(value) => setInviteRole(String(value) as MemberRole)}
                enabled={!isSendingInvite}
                style={styles.inviteRolePicker}
              >
                <Picker.Item label={humanizeRole("viewer", roleLocale)} value="viewer" />
                <Picker.Item
                  label={humanizeRole("contributor", roleLocale)}
                  value="contributor"
                />
                <Picker.Item label={humanizeRole("admin", roleLocale)} value="admin" />
              </Picker>
            </View>
            <Pressable
              onPress={() => {
                void sendInvite(inviteEmail, inviteRole);
              }}
              disabled={isSendingInvite || inviteEmail.trim().length === 0}
              style={[
                styles.sendInviteButton,
                { backgroundColor: primaryActionColor },
                (isSendingInvite || inviteEmail.trim().length === 0) &&
                  styles.sendInviteButtonDisabled,
              ]}
            >
              <Text
                style={[
                  styles.sendInviteButtonText,
                  { color: primaryActionTextColor },
                ]}
              >
                {isSendingInvite
                  ? t(dictionary, "common.saving")
                  : t(dictionary, "invites.createButton")}
              </Text>
            </Pressable>
          </View>
        ) : null}

        <View style={styles.card}>
          {pendingInvites.length === 0 ? (
            <Text style={styles.emptyText}>
              {t(dictionary, "accountSettings.members.emptyInvites")}
            </Text>
          ) : (
            pendingInvites.map((invite) => {
              const inviteEmailValue = invite.invited_email || invite.invitee_email || "";
              const inviteBusy = pendingInviteId === invite.id;
              return (
                <View key={invite.id} style={styles.inviteRow}>
                  <View style={styles.inviteMain}>
                    <View style={styles.inviteIcon}>
                      <Text style={styles.inviteIconText}>@</Text>
                    </View>
                    <View style={styles.inviteInfo}>
                      <Text style={styles.inviteEmail} numberOfLines={1}>
                        {inviteEmailValue}
                      </Text>
                      <Text style={styles.inviteMeta} numberOfLines={1}>
                        {t(dictionary, "accountSettings.members.inviteMeta", {
                          sentAgo: getSentAgo(invite.created_at, locale),
                          role: humanizeRole(invite.role, roleLocale),
                        })}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.inviteAside}>
                    <View style={styles.pendingBadge}>
                      <Text style={styles.pendingBadgeText}>
                        {t(dictionary, "accountSettings.members.pendingStatus")}
                      </Text>
                    </View>

                    {canManageMembers ? (
                      <View style={styles.inviteActions}>
                        <Pressable
                          onPress={() => {
                            void sendInvite(inviteEmailValue, invite.role, {
                              isResend: true,
                              inviteId: invite.id,
                            });
                          }}
                          disabled={inviteBusy}
                          style={[
                            styles.resendButton,
                            inviteBusy && styles.smallActionButtonDisabled,
                          ]}
                        >
                          <Text style={styles.resendButtonText}>
                            {t(dictionary, "accountSettings.members.resendButton")}
                          </Text>
                        </Pressable>
                        <Pressable
                          onPress={() => {
                            void revokeInvite(invite.id);
                          }}
                          disabled={inviteBusy}
                          style={styles.linkActionDanger}
                        >
                          <Text style={styles.linkActionDangerText}>
                            {t(dictionary, "common.delete")}
                          </Text>
                        </Pressable>
                      </View>
                    ) : null}
                  </View>
                </View>
              );
            })
          )}
        </View>
      </View>

      {notice ? (
        <Text
          style={[
            styles.noticeText,
            noticeTone === "negative" && styles.noticeTextNegative,
          ]}
        >
          {notice}
        </Text>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  scrollContainer: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: tokens.spacing.lg,
    paddingHorizontal: tokens.spacing.lg,
    gap: tokens.spacing.lg,
  },
  errorContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: tokens.spacing.xl,
  },
  errorTitle: {
    fontSize: tokens.typography.size.lg,
    fontWeight: tokens.typography.weight.bold,
    color: colors.text.primary,
    marginBottom: tokens.spacing.xs,
  },
  errorText: {
    fontSize: tokens.typography.size.sm,
    color: colors.state.negative,
    textAlign: "center",
  },
  pageHeader: {
    marginBottom: tokens.spacing.sm,
  },
  pageSubtitle: {
    fontSize: tokens.typography.size.sm,
    color: colors.text.muted,
  },
  section: {
    gap: tokens.spacing.sm,
  },
  sectionTitle: {
    fontSize: tokens.typography.size.sm,
    fontWeight: tokens.typography.weight.semibold,
    color: colors.text.primary,
  },
  card: {
    backgroundColor: colors.bg.surface,
    borderWidth: 1,
    borderColor: colors.state.neutral,
    borderRadius: tokens.radii.lg,
    overflow: "hidden",
  },
  emptyText: {
    fontSize: tokens.typography.size.sm,
    color: colors.text.secondary,
    paddingHorizontal: tokens.spacing.lg,
    paddingVertical: tokens.spacing.lg,
  },
  memberRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: tokens.spacing.lg,
    paddingVertical: tokens.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: "#EEF0F4",
    gap: tokens.spacing.sm,
  },
  memberMain: {
    flexDirection: "row",
    alignItems: "center",
    gap: tokens.spacing.sm,
    flex: 1,
    minWidth: 0,
  },
  memberAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
  },
  memberAvatarCurrentUser: {
    backgroundColor: colors.text.primary,
  },
  memberAvatarText: {
    fontSize: tokens.typography.size.xs,
    fontWeight: tokens.typography.weight.bold,
    color: colors.text.primary,
  },
  memberAvatarTextCurrentUser: {
    color: colors.bg.primary,
  },
  memberInfo: {
    flex: 1,
    minWidth: 0,
  },
  memberName: {
    fontSize: tokens.typography.size.sm,
    fontWeight: tokens.typography.weight.semibold,
    color: colors.text.primary,
  },
  memberEmail: {
    fontSize: tokens.typography.size.xs,
    color: colors.text.secondary,
    marginTop: 2,
  },
  memberAside: {
    flexDirection: "row",
    alignItems: "center",
    gap: tokens.spacing.sm,
    marginLeft: tokens.spacing.sm,
  },
  roleBadge: {
    paddingHorizontal: tokens.spacing.sm,
    paddingVertical: 4,
    borderRadius: tokens.radii.pill,
  },
  roleBadgeAdmin: {
    backgroundColor: "#EEF3FF",
  },
  roleBadgeDefault: {
    backgroundColor: colors.bg.secondary,
  },
  roleBadgeText: {
    fontSize: 11,
    fontWeight: tokens.typography.weight.semibold,
    textTransform: "uppercase",
  },
  roleBadgeTextAdmin: {
    color: "#4A6CF7",
  },
  roleBadgeTextDefault: {
    color: colors.text.secondary,
  },
  memberActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: tokens.spacing.xs,
  },
  iconActionButton: {
    width: 30,
    height: 30,
    borderRadius: tokens.radii.sm,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: ui.surface,
  },
  iconActionButtonPressed: {
    backgroundColor: ui.surfaceHover,
  },
  iconActionButtonDanger: {
    width: 30,
    height: 30,
    borderRadius: tokens.radii.sm,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: ui.expenseBg,
  },
  iconActionButtonDangerPressed: {
    backgroundColor: ui.dangerHover,
  },
  linkActionDanger: {
    paddingVertical: 2,
  },
  linkActionDangerText: {
    fontSize: tokens.typography.size.xs,
    fontWeight: tokens.typography.weight.semibold,
    color: colors.state.negative,
  },
  roleEditor: {
    flexDirection: "row",
    alignItems: "center",
    gap: tokens.spacing.xs,
  },
  rolePickerWrapper: {
    borderWidth: 1,
    borderColor: colors.state.neutral,
    borderRadius: tokens.radii.sm,
    overflow: "hidden",
    backgroundColor: colors.bg.secondary,
    minWidth: 136,
  },
  rolePicker: {
    height: 38,
    color: colors.text.primary,
  },
  roleEditorActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: tokens.spacing.sm,
  },
  smallActionButton: {
    borderRadius: tokens.radii.sm,
    paddingHorizontal: tokens.spacing.sm,
    paddingVertical: 6,
  },
  smallActionButtonDisabled: {
    opacity: 0.6,
  },
  smallActionButtonText: {
    fontSize: tokens.typography.size.xs,
    fontWeight: tokens.typography.weight.semibold,
  },
  smallActionGhost: {
    paddingHorizontal: tokens.spacing.xs,
    paddingVertical: 6,
  },
  smallActionGhostText: {
    fontSize: tokens.typography.size.xs,
    fontWeight: tokens.typography.weight.semibold,
    color: colors.text.secondary,
  },
  inviteHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: tokens.spacing.sm,
  },
  inviteHeaderText: {
    gap: 2,
    flex: 1,
  },
  pendingCount: {
    fontSize: tokens.typography.size.xs,
    color: colors.text.secondary,
  },
  inviteButton: {
    borderRadius: tokens.radii.sm,
    paddingHorizontal: tokens.spacing.sm,
    paddingVertical: 7,
  },
  inviteButtonText: {
    fontSize: tokens.typography.size.xs,
    fontWeight: tokens.typography.weight.semibold,
  },
  inviteComposer: {
    backgroundColor: colors.bg.surface,
    borderWidth: 1,
    borderColor: colors.state.neutral,
    borderRadius: tokens.radii.lg,
    padding: tokens.spacing.md,
    gap: tokens.spacing.sm,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.state.neutral,
    borderRadius: tokens.radii.sm,
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: 10,
    backgroundColor: colors.bg.secondary,
    color: colors.text.primary,
    fontSize: tokens.typography.size.sm,
  },
  inviteRolePickerWrapper: {
    borderWidth: 1,
    borderColor: colors.state.neutral,
    borderRadius: tokens.radii.sm,
    overflow: "hidden",
    backgroundColor: colors.bg.secondary,
  },
  inviteRolePicker: {
    height: 44,
    color: colors.text.primary,
  },
  sendInviteButton: {
    borderRadius: tokens.radii.sm,
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: 10,
    alignItems: "center",
  },
  sendInviteButtonDisabled: {
    opacity: 0.55,
  },
  sendInviteButtonText: {
    fontSize: tokens.typography.size.sm,
    fontWeight: tokens.typography.weight.semibold,
  },
  inviteRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: tokens.spacing.lg,
    paddingVertical: tokens.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: "#EEF0F4",
    gap: tokens.spacing.xs,
  },
  inviteMain: {
    flexDirection: "row",
    alignItems: "center",
    gap: tokens.spacing.sm,
    flex: 1,
    minWidth: 0,
  },
  inviteIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFF8EB",
  },
  inviteIconText: {
    fontSize: tokens.typography.size.md,
    fontWeight: tokens.typography.weight.semibold,
    color: "#A16207",
  },
  inviteInfo: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  inviteEmail: {
    fontSize: tokens.typography.size.sm,
    fontWeight: tokens.typography.weight.semibold,
    color: colors.text.primary,
  },
  inviteMeta: {
    fontSize: tokens.typography.size.xs,
    color: colors.text.secondary,
  },
  inviteAside: {
    flexDirection: "row",
    alignItems: "center",
    gap: tokens.spacing.sm,
    marginLeft: tokens.spacing.sm,
  },
  pendingBadge: {
    backgroundColor: "#FFF8EB",
    borderRadius: tokens.radii.pill,
    paddingHorizontal: tokens.spacing.sm,
    paddingVertical: 4,
  },
  pendingBadgeText: {
    fontSize: 11,
    fontWeight: tokens.typography.weight.semibold,
    color: "#A16207",
    textTransform: "uppercase",
  },
  inviteActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: tokens.spacing.md,
  },
  resendButton: {
    borderWidth: 1,
    borderColor: colors.state.neutral,
    borderRadius: tokens.radii.sm,
    paddingHorizontal: tokens.spacing.sm,
    paddingVertical: 6,
  },
  resendButtonText: {
    fontSize: tokens.typography.size.xs,
    fontWeight: tokens.typography.weight.medium,
    color: colors.text.primary,
  },
  noticeText: {
    textAlign: "center",
    fontSize: tokens.typography.size.sm,
    color: colors.state.positive,
    paddingBottom: tokens.spacing.sm,
  },
  noticeTextNegative: {
    color: colors.state.negative,
  },
});
