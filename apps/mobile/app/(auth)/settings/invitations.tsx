import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Picker } from "@react-native-picker/picker";
import { supabase } from "../../../src/lib/supabase";
import { useUserTheme } from "../../../src/contexts/UserThemeContext";
import { Button } from "../../../src/components/Button";
import { Card } from "../../../src/components/Card";
import { useCopy, t } from "../../../src/lib/i18n";
import {
  ConfirmationModal,
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
  invited_email: string | null;
  invitee_email?: string | null;
  accounts?: { name: string } | null;
};

type AccountOption = {
  id: string;
  name: string;
};

export default function InvitationsSettingsScreen() {
  const { dictionary, locale } = useCopy();
  const { tokens: userThemeTokens } = useUserTheme();
  const [accounts, setAccounts] = useState<AccountOption[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState("");
  const [invites, setInvites] = useState<InviteRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteEmail, setInviteEmail] = useState("");
  const selectedRole: MemberRole = "admin";
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [noticeTone, setNoticeTone] = useState<"positive" | "negative" | null>(
    null
  );
  const [errorModal, setErrorModal] = useState<{ open: boolean; message: string }>({
    open: false,
    message: "",
  });

  useEffect(() => {
    void loadAccounts();
  }, []);

  useEffect(() => {
    if (selectedAccountId) {
      void loadInvites(selectedAccountId);
    }
  }, [selectedAccountId]);

  async function loadAccounts() {
    setLoading(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from("account_members")
      .select("account_id, role, accounts(id, name)")
      .eq("user_id", user.id)
      .eq("role", "admin");

    if (error) {
      console.error("Error loading accounts:", error);
      setLoading(false);
      return;
    }

    const options = (data || [])
      .filter((member) => member.accounts)
      .map((member) => ({
        id: member.account_id,
        name: (member.accounts as any).name,
      }));

    setAccounts(options);
    if (options.length > 0) {
      setSelectedAccountId(options[0].id);
    }
    setLoading(false);
  }

  async function loadInvites(accountId: string) {
    const { data, error } = await supabase
      .from("invites")
      .select("id, account_id, role, status, expires_at, created_at, invited_email, invitee_email")
      .eq("account_id", accountId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error loading invites:", error);
      return;
    }

    setInvites((data || []) as InviteRow[]);
  }

  async function sendInvite() {
    if (!selectedAccountId || inviteEmail.trim().length === 0) return;

    setSending(true);
    setNotice(null);
    setNoticeTone(null);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        setNotice(t(dictionary, "errors.noSession"));
        setNoticeTone("negative");
        return;
      }

      const response = await fetch(`${API_URL}/api/invites/send`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          accountId: selectedAccountId,
          email: inviteEmail.trim(),
          role: selectedRole,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        const errorMessage = error.errorKey
          ? t(dictionary, error.errorKey, error.errorParams)
          : t(dictionary, "invites.sendError");
        setErrorModal({ open: true, message: errorMessage });
        return;
      }

      const data = await response.json();

      if (data.status === "already_member") {
        setNotice(t(dictionary, "invites.registeredAlreadyMember"));
        setNoticeTone("negative");
        return;
      }

      if (data.status === "pending") {
        setNotice(t(dictionary, "invites.registeredPending"));
        setNoticeTone("negative");
        return;
      }

      setInviteEmail("");
      setInviteCode(data.code ?? null);
      setNotice(t(dictionary, "invites.sendSuccess"));
      setNoticeTone("positive");
      await loadInvites(selectedAccountId);
    } catch (error) {
      console.error("Error sending invite:", error);
      setNotice(t(dictionary, "invites.sendError"));
      setNoticeTone("negative");
    } finally {
      setSending(false);
    }
  }

  async function revokeInvite(inviteId: string) {
    const { error } = await supabase
      .from("invites")
      .update({ status: "revoked", responded_at: new Date().toISOString() })
      .eq("id", inviteId);

    if (error) {
      console.error("Error revoking invite:", error);
      setNotice(t(dictionary, "invites.revokeError"));
      setNoticeTone("negative");
      return;
    }

    setNotice(t(dictionary, "invites.revokeSuccess"));
    setNoticeTone("positive");
    await loadInvites(selectedAccountId);
  }

  async function shareCode(code: string) {
    await Share.share({ message: code });
  }

  const inviteList = invites.map((invite) => {
    const expired = isExpired(invite.expires_at);
    const status = invite.status ?? "pending";
    return {
      ...invite,
      status: status === "pending" && expired ? "expired" : status,
      expired,
    };
  });

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: userThemeTokens.background }}
      contentContainerStyle={[
        styles.container,
        { backgroundColor: userThemeTokens.background },
      ]}
    >
      {loading ? (
        <ActivityIndicator size="large" color={colors.text.muted} />
      ) : accounts.length === 0 ? (
        <Card title={t(dictionary, "invites.title")} description={t(dictionary, "invites.noAdminAccounts")}> 
          <Text style={styles.helperText}>{t(dictionary, "invites.noAdminAccounts")}</Text>
        </Card>
      ) : (
        <>
          <Card title={t(dictionary, "invites.title")} description={t(dictionary, "invites.subtitle")}>
            <Text style={styles.label}>{t(dictionary, "invites.accountLabel")}</Text>
            <View style={styles.pickerWrapper}>
              <Picker
                selectedValue={selectedAccountId}
                onValueChange={(value) => setSelectedAccountId(String(value))}
              >
                {accounts.map((account) => (
                  <Picker.Item key={account.id} label={account.name} value={account.id} />
                ))}
              </Picker>
            </View>

            <Text style={styles.label}>{t(dictionary, "invites.emailLabel")}</Text>
            <TextInput
              style={styles.input}
              value={inviteEmail}
              onChangeText={setInviteEmail}
              placeholder={t(dictionary, "login.emailPlaceholder")}
              placeholderTextColor={colors.text.muted}
              autoCapitalize="none"
            />

            <View style={styles.sendButton}>
              <Button
                title={sending ? t(dictionary, "common.creating") : t(dictionary, "invites.createButton")}
                onPress={sendInvite}
                disabled={sending || inviteEmail.trim().length === 0}
              />
            </View>

            {inviteCode && (
              <TouchableOpacity
                style={styles.codeCard}
                onPress={() => shareCode(inviteCode)}
              >
                <Text style={styles.codeTitle}>{t(dictionary, "invites.inviteSentTitle")}</Text>
                <Text style={styles.codeFallbackHint}>{t(dictionary, "invites.codeFallbackHint")}</Text>
                <Text style={styles.codeValue}>{inviteCode}</Text>
                <Text style={styles.codeCopy}>{t(dictionary, "invites.codeCopy")}</Text>
              </TouchableOpacity>
            )}
          </Card>

          <Card title={t(dictionary, "invites.listTitle")} description={t(dictionary, "invites.listEmpty")}> 
            {inviteList.length === 0 ? (
              <Text style={styles.helperText}>{t(dictionary, "invites.listEmpty")}</Text>
            ) : (
              <View style={styles.inviteList}>
                {inviteList.map((invite) => (
                  <View key={invite.id} style={styles.inviteCard}>
                    <Text style={styles.inviteEmail}>
                      {invite.invited_email || invite.invitee_email || t(dictionary, "invites.accountUnknown")}
                    </Text>
                    <Text style={styles.inviteMeta}>
                      {humanizeRole(invite.role, locale)} · {t(dictionary, "invites.expiresLabel")} {new Date(invite.expires_at).toLocaleDateString(locale)}
                    </Text>
                    <View style={styles.inviteActions}>
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
                      {invite.status === "pending" && !invite.expired && (
                        <Button
                          title={t(dictionary, "invites.revokeButton")}
                          variant="secondary"
                          onPress={() => revokeInvite(invite.id)}
                        />
                      )}
                    </View>
                  </View>
                ))}
              </View>
            )}
          </Card>

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
        </>
      )}

      <ConfirmationModal
        open={errorModal.open}
        title={t(dictionary, "common.errorTitle")}
        description={errorModal.message}
        confirmLabel={t(dictionary, "common.ok")}
        onConfirm={() => setErrorModal({ open: false, message: "" })}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: tokens.spacing.lg,
    gap: tokens.spacing.lg,
  },
  label: {
    ...typography.meta,
    color: colors.text.secondary,
    marginTop: tokens.spacing.md,
    marginBottom: tokens.spacing.xs,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.state.neutral,
    borderRadius: tokens.radii.md,
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: tokens.spacing.sm,
    backgroundColor: colors.bg.surface,
    color: colors.text.primary,
  },
  pickerWrapper: {
    borderWidth: 1,
    borderColor: colors.state.neutral,
    borderRadius: tokens.radii.md,
    backgroundColor: colors.bg.surface,
    overflow: "hidden",
  },
  sendButton: {
    marginTop: tokens.spacing.md,
  },
  actionsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: tokens.spacing.sm,
    marginTop: tokens.spacing.md,
  },
  codeCard: {
    marginTop: tokens.spacing.md,
    padding: tokens.spacing.md,
    borderRadius: tokens.radii.md,
    borderWidth: 1,
    borderColor: colors.state.neutral,
    backgroundColor: colors.bg.surface,
  },
  codeTitle: {
    ...typography.body,
    fontWeight: tokens.typography.weight.semibold,
    color: colors.text.primary,
    marginBottom: tokens.spacing.xs,
  },
  codeFallbackHint: {
    ...typography.meta,
    color: colors.text.secondary,
    marginBottom: tokens.spacing.sm,
  },
  codeValue: {
    ...typography.h3,
    color: colors.text.primary,
    letterSpacing: 2,
  },
  codeCopy: {
    ...typography.meta,
    color: colors.action.primary,
    marginTop: tokens.spacing.sm,
  },
  inviteList: {
    gap: tokens.spacing.md,
  },
  inviteCard: {
    borderWidth: 1,
    borderColor: colors.state.neutral,
    borderRadius: tokens.radii.md,
    padding: tokens.spacing.md,
    backgroundColor: colors.bg.surface,
    gap: tokens.spacing.xs,
  },
  inviteEmail: {
    ...typography.body,
    color: colors.text.primary,
    fontWeight: tokens.typography.weight.semibold,
  },
  inviteMeta: {
    ...typography.meta,
    color: colors.text.secondary,
  },
  inviteActions: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: tokens.spacing.sm,
    marginTop: tokens.spacing.xs,
  },
  inviteStatus: {
    ...typography.meta,
    color: colors.text.secondary,
  },
  helperText: {
    ...typography.meta,
    color: colors.text.secondary,
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
