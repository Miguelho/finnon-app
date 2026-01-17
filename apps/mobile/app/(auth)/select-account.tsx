import { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { supabase } from "../../src/lib/supabase";
import { Card } from "../../src/components/Card";
import { Button } from "../../src/components/Button";
import { useAuth } from "../../src/contexts/AuthContext";
import { useRouter } from "expo-router";
import { useCopy, t } from "../../src/lib/i18n";
import { isExpired, themeTokens } from "@poleursus/shared";
import { useNetworkNotice } from "../../src/contexts/NetworkNoticeContext";

interface Account {
  id: string;
  name: string;
  base_currency: string;
}

const tokens = themeTokens.light;
const colors = tokens.colors;

export default function SelectAccountScreen() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSwitching, setIsSwitching] = useState(false);
  const [inviteCount, setInviteCount] = useState(0);
  const { user, setSelectedAccountId } = useAuth();
  const router = useRouter();
  const { dictionary } = useCopy();
  const { reportNetworkIssue } = useNetworkNotice();

  useEffect(() => {
    if (!user) return;
    loadAccounts();
    loadInviteCount();
  }, [user?.id]);

  const loadAccounts = async () => {
    if (!user) {
      setError(t(dictionary, "mobile.selectAccount.noSessionError"));
      setLoading(false);
      return;
    }

    try {
      // Get all accounts where user is a member
      const { data: memberships, error: membershipsError } = await supabase
        .from("account_members")
        .select("account_id, accounts(id, name, base_currency)")
        .eq("user_id", user.id);

      if (membershipsError) throw membershipsError;

      const accountsList =
        memberships
          ?.map((m: any) => m.accounts)
          .filter((a: any) => a !== null) || [];

      setAccounts(accountsList);
    } catch (err) {
      console.error("Error loading accounts:", err);
      setError(err instanceof Error ? err.message : t(dictionary, "mobile.selectAccount.loadError"));
      reportNetworkIssue({ onRetry: loadAccounts });
    } finally {
      setLoading(false);
    }
  };

  const loadInviteCount = async () => {
    if (!user?.email) return;

    const { data, error } = await supabase
      .from("invites")
      .select("id, expires_at, status, invited_email, invitee_email")
      .or(`invited_email.eq.${user.email},invitee_email.eq.${user.email}`)
      .eq("status", "pending");

    if (error) {
      setInviteCount(0);
      return;
    }

    const count = (data ?? []).filter((invite) => !isExpired(invite.expires_at))
      .length;
    setInviteCount(count);
  };

  const handleSelectAccount = async (accountId: string) => {
    console.log("[SelectAccount] Selected account:", accountId);
    setIsSwitching(true);
    try {
      await setSelectedAccountId(accountId);
      router.replace("/(auth)/(tabs)/home");
    } catch (err) {
      console.error("Error switching account:", err);
      reportNetworkIssue({ onRetry: () => handleSelectAccount(accountId) });
      setIsSwitching(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color={colors.text.muted} />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.container}>
        <Card title={t(dictionary, "mobile.selectAccount.errorTitle")} description={error}>
          <Text style={styles.errorText}>
            {t(dictionary, "mobile.selectAccount.errorDescription")}
          </Text>
        </Card>
      </View>
    );
  }

  if (accounts.length === 0) {
    return (
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Card
          title={t(dictionary, "mobile.selectAccount.emptyTitle")}
          description={t(dictionary, "mobile.selectAccount.emptyDescription")}
        >
          <Button
            title={t(dictionary, "mobile.selectAccount.createCta")}
            onPress={() => router.push("/(auth)/onboarding")}
          />
        </Card>
        {inviteCount > 0 && (
          <Card
            title={t(dictionary, "invitations.title")}
            description={t(dictionary, "invitations.pendingBadge")}
          >
            <Button
              title={`${t(dictionary, "invitations.viewCta")} (${inviteCount})`}
              variant="secondary"
              onPress={() => router.push("/(auth)/invitations")}
            />
          </Card>
        )}
      </ScrollView>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.scrollContent}>
      <Card
        title={t(dictionary, "mobile.selectAccount.title")}
        description={t(dictionary, "mobile.selectAccount.description")}
      >
        {isSwitching && (
          <Text style={styles.switchingText}>{t(dictionary, "common.loading")}</Text>
        )}
        <View style={styles.accountsList}>
          <TouchableOpacity
            style={styles.inviteRow}
            onPress={() => router.push("/(auth)/invitations")}
          >
            <View style={styles.inviteRowInfo}>
              <Text style={styles.inviteRowTitle}>
                {t(dictionary, "invitations.title")}
              </Text>
              <Text style={styles.inviteRowDescription}>
                {t(dictionary, "invitations.subtitle")}
              </Text>
            </View>
            <View style={styles.inviteBadge}>
              <Text style={styles.inviteBadgeText}>{inviteCount}</Text>
            </View>
          </TouchableOpacity>
          {accounts.map((account) => (
            <TouchableOpacity
              key={account.id}
              style={[
                styles.accountItem,
                isSwitching && styles.accountItemDisabled,
              ]}
              onPress={() => handleSelectAccount(account.id)}
              disabled={isSwitching}
            >
              <View style={styles.accountInfo}>
                <Text style={styles.accountName}>{account.name}</Text>
                <Text style={styles.accountCurrency}>
                  {account.base_currency}
                </Text>
              </View>
              <Text style={styles.arrow}>›</Text>
            </TouchableOpacity>
          ))}
        </View>
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: colors.bg.secondary,
    padding: tokens.spacing.lg,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: "center",
    padding: tokens.spacing.lg,
    backgroundColor: colors.bg.secondary,
  },
  accountsList: {
    gap: tokens.spacing.sm,
  },
  inviteRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.bg.surface,
    padding: tokens.spacing.md,
    borderRadius: tokens.radii.md,
    borderWidth: 1,
    borderColor: colors.state.neutral,
  },
  inviteRowInfo: {
    flex: 1,
  },
  inviteRowTitle: {
    fontSize: tokens.typography.size.md,
    fontWeight: tokens.typography.weight.semibold,
    color: colors.text.primary,
    marginBottom: tokens.spacing.xs,
  },
  inviteRowDescription: {
    fontSize: tokens.typography.size.sm,
    color: colors.text.secondary,
  },
  inviteBadge: {
    backgroundColor: colors.action.primary,
    paddingHorizontal: tokens.spacing.sm,
    paddingVertical: tokens.spacing.xs,
    borderRadius: tokens.radii.pill,
  },
  inviteBadgeText: {
    fontSize: tokens.typography.size.sm,
    color: colors.bg.primary,
    fontWeight: tokens.typography.weight.semibold,
  },
  accountItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: colors.bg.surface,
    padding: tokens.spacing.md,
    borderRadius: tokens.radii.md,
    borderWidth: 1,
    borderColor: colors.state.neutral,
  },
  accountItemDisabled: {
    opacity: 0.6,
  },
  accountInfo: {
    flex: 1,
  },
  accountName: {
    fontSize: tokens.typography.size.md,
    fontWeight: tokens.typography.weight.semibold,
    color: colors.text.primary,
    marginBottom: tokens.spacing.xs,
  },
  accountCurrency: {
    fontSize: tokens.typography.size.sm,
    color: colors.text.secondary,
  },
  arrow: {
    fontSize: 24,
    color: colors.action.primary,
    marginLeft: tokens.spacing.sm,
  },
  errorText: {
    color: colors.state.negative,
    fontSize: tokens.typography.size.sm,
    textAlign: "center",
  },
  switchingText: {
    fontSize: tokens.typography.size.sm,
    color: colors.text.secondary,
    marginBottom: tokens.spacing.sm,
  },
});
