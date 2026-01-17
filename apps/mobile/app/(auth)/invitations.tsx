import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Stack, useRouter } from "expo-router";
import { useIsFocused } from "@react-navigation/native";
import { supabase } from "../../src/lib/supabase";
import { useAuth } from "../../src/contexts/AuthContext";
import { Button } from "../../src/components/Button";
import { useCopy, t } from "../../src/lib/i18n";
import {
  createTypographyStyles,
  humanizeRole,
  isExpired,
  themeTokens,
  type MemberRole,
} from "@poleursus/shared";

const tokens = themeTokens.light;
const colors = tokens.colors;
const typography = createTypographyStyles(tokens);

const API_URL = process.env.EXPO_PUBLIC_API_URL || "http://localhost:3000";

type InviteRow = {
  id: string;
  account_id: string;
  role: MemberRole;
  status: "pending" | "accepted" | "rejected" | "revoked" | "expired" | null;
  expires_at: string;
  created_at: string;
  created_by: string;
  invited_email: string | null;
  invitee_email?: string | null;
  accounts?: { name: string } | { name: string }[] | null;
  code: string | null;
};

type ProfileRow = {
  user_id: string;
  email: string | null;
  display_name: string | null;
};

export default function InvitationsScreen() {
  const { user, session } = useAuth();
  const { dictionary, locale } = useCopy();
  const isFocused = useIsFocused();
  const router = useRouter();
  const [invites, setInvites] = useState<InviteRow[]>([]);
  const [profiles, setProfiles] = useState<Record<string, ProfileRow>>({});
  const [loading, setLoading] = useState(true);
  const [joinCode, setJoinCode] = useState("");
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [noticeTone, setNoticeTone] = useState<"positive" | "negative" | null>(
    null
  );

  const authHeader = useMemo(() => {
    if (!session?.access_token) return undefined;
    return { Authorization: `Bearer ${session.access_token}` };
  }, [session?.access_token]);

  const loadInvites = useCallback(async () => {
    if (!user?.email) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setJoinError(null);
    setNotice(null);
    setNoticeTone(null);

    try {
      const { data, error } = await supabase
        .from("invites")
        .select(
          "id, account_id, role, status, expires_at, created_at, created_by, invited_email, invitee_email, code, accounts(name)"
        )
        .or(`invited_email.eq.${user.email},invitee_email.eq.${user.email}`)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error loading invites:", error);
        setInvites([]);
        setLoading(false);
        return;
      }

      const inviteRows = (data || []) as InviteRow[];
      setInvites(inviteRows);

      const creatorIds = Array.from(
        new Set(inviteRows.map((invite) => invite.created_by).filter(Boolean))
      );

      if (creatorIds.length > 0) {
        const { data: profileRows } = await supabase
          .from("profiles")
          .select("user_id, email, display_name")
          .in("user_id", creatorIds);

        const profileMap = (profileRows || []).reduce<Record<string, ProfileRow>>(
          (acc, profile) => {
            acc[profile.user_id] = profile as ProfileRow;
            return acc;
          },
          {}
        );

        setProfiles(profileMap);
      } else {
        setProfiles({});
      }
    } finally {
      setLoading(false);
    }
  }, [user?.email]);

  useEffect(() => {
    if (isFocused) {
      void loadInvites();
    }
  }, [isFocused, loadInvites]);

  const inviteList = useMemo(() => {
    return invites
      .map((invite) => {
        const expired = isExpired(invite.expires_at);
        const status = invite.status ?? "pending";
        const normalizedStatus = status === "pending" && expired ? "expired" : status;
        return { ...invite, status: normalizedStatus, expired };
      })
      .filter((invite) => invite.status === "pending" || invite.status === "expired");
  }, [invites]);

  async function acceptInvite(inviteId: string) {
    if (!authHeader) return;
    try {
      const response = await fetch(`${API_URL}/api/invites/accept`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...authHeader,
        },
        body: JSON.stringify({ inviteId }),
      });

      if (!response.ok) {
        const error = await response.json();
        setNotice(
          error.errorKey
            ? t(dictionary, error.errorKey, error.errorParams)
            : t(dictionary, "errors.internalServer")
        );
        setNoticeTone("negative");
        return;
      }

      setNotice(t(dictionary, "invitations.joinSuccess"));
      setNoticeTone("positive");
      await loadInvites();
    } catch (error) {
      console.error("Accept invite error:", error);
      setNotice(t(dictionary, "errors.internalServer"));
      setNoticeTone("negative");
    }
  }

  async function rejectInvite(inviteId: string) {
    if (!authHeader) return;
    try {
      const response = await fetch(`${API_URL}/api/invites/reject`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...authHeader,
        },
        body: JSON.stringify({ inviteId }),
      });

      if (!response.ok) {
        const error = await response.json();
        setNotice(
          error.errorKey
            ? t(dictionary, error.errorKey, error.errorParams)
            : t(dictionary, "errors.internalServer")
        );
        setNoticeTone("negative");
        return;
      }

      setNotice(t(dictionary, "common.successTitle"));
      setNoticeTone("positive");
      await loadInvites();
    } catch (error) {
      console.error("Reject invite error:", error);
      setNotice(t(dictionary, "errors.internalServer"));
      setNoticeTone("negative");
    }
  }

  async function joinByCode() {
    const trimmed = joinCode.trim();
    if (!trimmed || !authHeader) return;

    setJoining(true);
    setJoinError(null);
    setNotice(null);
    setNoticeTone(null);

    try {
      const response = await fetch(`${API_URL}/api/invites/join-by-code`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...authHeader,
        },
        body: JSON.stringify({ code: trimmed }),
      });

      if (!response.ok) {
        await response.json().catch(() => ({}));
        setJoinError(t(dictionary, "invitations.codeError"));
        return;
      }

      setJoinCode("");
      setNotice(t(dictionary, "invitations.joinSuccess"));
      setNoticeTone("positive");
      await loadInvites();
    } catch (error) {
      console.error("Join by code error:", error);
      setJoinError(t(dictionary, "invitations.codeError"));
    } finally {
      setJoining(false);
    }
  }

  return (
    <View style={styles.root}>
      <Stack.Screen
        options={{
          title: t(dictionary, "invitations.title"),
          headerShown: true,
        }}
      />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>
            {t(dictionary, "invitations.joinWithCodeTitle")}
          </Text>
          <Text style={styles.cardDescription}>
            {t(dictionary, "invitations.joinWithCodeDescription")}
          </Text>
          <View style={styles.codeRow}>
            <TextInput
              style={styles.codeInput}
              value={joinCode}
              onChangeText={setJoinCode}
              placeholder={t(dictionary, "invitations.codePlaceholder")}
              placeholderTextColor={colors.text.muted}
              autoCapitalize="characters"
            />
            <Button
              title={
                joining
                  ? t(dictionary, "common.loading")
                  : t(dictionary, "invitations.joinWithCodeButton")
              }
              onPress={joinByCode}
              disabled={joining || joinCode.trim().length === 0}
            />
          </View>
          {joinError && <Text style={styles.errorText}>{joinError}</Text>}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t(dictionary, "invitations.title")}</Text>
          {loading ? (
            <ActivityIndicator size="small" color={colors.text.muted} />
          ) : inviteList.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyTitle}>
                {t(dictionary, "invitations.emptyTitle")}
              </Text>
              <Text style={styles.emptyDescription}>
                {t(dictionary, "invitations.emptyDescription")}
              </Text>
            </View>
          ) : (
            <View style={styles.inviteList}>
              {inviteList.map((invite) => {
                const profile = profiles[invite.created_by];
                const inviterName =
                  profile?.display_name || profile?.email || t(dictionary, "invites.accountUnknown");
                const isPending = invite.status === "pending" && !invite.expired;

                return (
                  <View key={invite.id} style={styles.inviteCard}>
                    <View style={styles.inviteHeader}>
                      <Text style={styles.inviteAccount}>
                        {(Array.isArray(invite.accounts) ? invite.accounts[0]?.name : invite.accounts?.name) ?? t(dictionary, "invites.accountUnknown")}
                      </Text>
                      <Text style={styles.inviteStatus}>
                        {invite.status === "accepted"
                          ? t(dictionary, "invites.statusAccepted")
                          : invite.status === "rejected"
                          ? t(dictionary, "invites.statusRejected")
                          : invite.status === "revoked"
                          ? t(dictionary, "invites.statusRevoked")
                          : invite.status === "expired"
                          ? t(dictionary, "invites.statusExpired")
                          : t(dictionary, "invites.statusPending")}
                      </Text>
                    </View>
                    <Text style={styles.inviteSubhead}>
                      {t(dictionary, "invitations.pendingBadge")}
                    </Text>
                    <View style={styles.inviteMetaRow}>
                      <Text style={styles.inviteMetaText}>
                        {humanizeRole(invite.role, locale)}
                      </Text>
                      <Text style={styles.inviteMetaText}>
                        {t(dictionary, "invitations.expiresLabel", {
                          date: new Date(invite.expires_at).toLocaleDateString(locale),
                        })}
                      </Text>
                    </View>
                    <Text style={styles.inviteMetaText}>
                      {t(dictionary, "invitations.inviterLabel")}: {inviterName}
                    </Text>
                    {invite.code && (
                      <View style={styles.codeRow}>
                        <Text style={styles.inviteMetaText}>
                          {t(dictionary, "invites.codeLabel")}:
                        </Text>
                        <Text style={styles.codeText}>{invite.code}</Text>
                      </View>
                    )}
                    {isPending && (
                      <View style={styles.actionsRow}>
                        <Button
                          title={t(dictionary, "invitations.acceptButton")}
                          onPress={() => acceptInvite(invite.id)}
                        />
                        <Button
                          title={t(dictionary, "invitations.rejectButton")}
                          variant="secondary"
                          onPress={() => rejectInvite(invite.id)}
                        />
                      </View>
                    )}
                  </View>
                );
              })}
            </View>
          )}
        </View>

        {notice && (
          <Text
            style={[
              styles.noticeText,
              noticeTone === "negative" && styles.noticeTextNegative,
            ]}
          >
            {notice}
          </Text>
        )}
        <Button
          title={t(dictionary, "common.back")}
          variant="secondary"
          onPress={() => router.back()}
        />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg.primary,
  },
  content: {
    padding: tokens.spacing.lg,
    gap: tokens.spacing.lg,
  },
  card: {
    backgroundColor: colors.bg.surface,
    borderRadius: tokens.radii.lg,
    padding: tokens.spacing.lg,
    borderWidth: 1,
    borderColor: colors.state.neutral,
  },
  cardTitle: {
    ...typography.h3,
    color: colors.text.primary,
    marginBottom: tokens.spacing.sm,
  },
  cardDescription: {
    ...typography.body,
    color: colors.text.secondary,
    marginBottom: tokens.spacing.md,
  },
  codeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: tokens.spacing.sm,
  },
  codeInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.state.neutral,
    borderRadius: tokens.radii.md,
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: tokens.spacing.sm,
    color: colors.text.primary,
    backgroundColor: colors.bg.secondary,
  },
  errorText: {
    ...typography.meta,
    color: colors.state.negative,
    marginTop: tokens.spacing.sm,
  },
  emptyState: {
    gap: tokens.spacing.xs,
  },
  emptyTitle: {
    ...typography.body,
    color: colors.text.primary,
    fontWeight: "600",
  },
  emptyDescription: {
    ...typography.meta,
    color: colors.text.secondary,
  },
  inviteList: {
    gap: tokens.spacing.md,
  },
  inviteCard: {
    backgroundColor: colors.bg.secondary,
    borderRadius: tokens.radii.lg,
    padding: tokens.spacing.md,
    borderWidth: 1,
    borderColor: colors.state.neutral,
    gap: tokens.spacing.xs,
  },
  inviteHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  inviteAccount: {
    ...typography.body,
    color: colors.text.primary,
    fontWeight: "600",
  },
  inviteStatus: {
    ...typography.meta,
    color: colors.text.secondary,
  },
  inviteSubhead: {
    ...typography.meta,
    color: colors.text.secondary,
  },
  inviteMetaRow: {
    flexDirection: "row",
    gap: tokens.spacing.md,
  },
  inviteMetaText: {
    ...typography.meta,
    color: colors.text.secondary,
  },
  actionsRow: {
    flexDirection: "row",
    gap: tokens.spacing.sm,
    marginTop: tokens.spacing.sm,
  },
  codeText: {
    ...typography.meta,
    fontFamily: "monospace",
    color: colors.text.primary,
    backgroundColor: colors.bg.secondary,
    paddingHorizontal: tokens.spacing.sm,
    paddingVertical: tokens.spacing.xs,
    borderRadius: tokens.radii.sm,
    overflow: "hidden",
  },
  noticeText: {
    ...typography.meta,
    color: colors.state.positive,
    textAlign: "center",
  },
  noticeTextNegative: {
    color: colors.state.negative,
  },
});
