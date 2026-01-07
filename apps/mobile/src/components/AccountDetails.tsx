import { useEffect, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { supabase } from "../lib/supabase";
import { useAuth } from "../contexts/AuthContext";
import { Card } from "./Card";
import { useNetworkNotice } from "../contexts/NetworkNoticeContext";
import { useCopy, t } from "../lib/i18n";
import { themeTokens } from "@poleursus/shared";

type Account = {
  id: string;
  name: string;
  base_currency: string;
};

type MemberProfile = {
  user_id: string;
  role: "viewer" | "contributor" | "admin";
  name: string | null;
  email: string | null;
};

type AccountDetailsProps = {
  accountId: string;
};

export function AccountDetails({ accountId }: AccountDetailsProps) {
  const { user, setSelectedAccountId } = useAuth();
  const { dictionary } = useCopy();
  const insets = useSafeAreaInsets();
  const { reportNetworkIssue } = useNetworkNotice();

  const [account, setAccount] = useState<Account | null>(null);
  const [members, setMembers] = useState<MemberProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!accountId) return;
    setSelectedAccountId(accountId);
  }, [accountId, setSelectedAccountId]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!accountId) return;

      setLoading(true);
      setError(null);

      try {
        const { data: accountData, error: accountError } = await supabase
          .from("accounts")
          .select("id, name, base_currency")
          .eq("id", accountId)
          .single();

        if (accountError) throw accountError;

        if (!cancelled) {
          setAccount(accountData as Account);
        }

        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          throw new Error(t(dictionary, "account.noSessionError"));
        }

        const apiUrl = process.env.EXPO_PUBLIC_API_URL || "http://localhost:3000";
        const response = await fetch(`${apiUrl}/api/profiles`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ accountId }),
        });

        if (!response.ok) {
          const errorBody = await response.json().catch(() => ({}));
          throw new Error(errorBody.error || t(dictionary, "account.participantsLoadError"));
        }

        const payload = await response.json();
        if (!cancelled) {
          setMembers((payload?.members ?? []) as MemberProfile[]);
        }
      } catch (err: any) {
        console.error("[AccountDetail] Error:", err);
        if (!cancelled) {
          setError(err?.message ?? t(dictionary, "account.loadError"));
        }
        reportNetworkIssue({ onRetry: load });
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [accountId, dictionary, reportNetworkIssue]);

  if (!accountId) {
    return (
      <View style={[styles.loading, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={colors.text.muted} />
      </View>
    );
  }

  if (loading) {
    return (
      <View style={[styles.loading, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={colors.text.muted} />
      </View>
    );
  }

  if (error) {
    return (
      <View
        style={[
          styles.container,
          { paddingTop: tokens.spacing.lg + insets.top, paddingBottom: insets.bottom },
        ]}
      >
        <Card title={t(dictionary, "account.errorTitle")} description={error}>
          <Text style={styles.errorText}>{t(dictionary, "account.errorDescription")}</Text>
        </Card>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.scrollContainer}
      contentContainerStyle={[
        styles.scroll,
        {
          paddingTop: tokens.spacing.lg + insets.top,
          paddingBottom: tokens.spacing.lg + insets.bottom,
        },
      ]}
    >
      <Card
        title={t(dictionary, "account.title")}
        description={t(dictionary, "account.description")}
      >
        <View style={styles.section}>
          <Text style={styles.label}>{t(dictionary, "account.labelAccount")}</Text>
          <Text style={styles.value}>{account?.name ?? "-"}</Text>
          <Text style={styles.meta}>
            {t(dictionary, "account.baseCurrencyLabel", {
              currency: account?.base_currency ?? "-",
            })}
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>
            {t(dictionary, "account.participantsLabel", { count: members.length })}
          </Text>
          {members.length === 0 ? (
            <Text style={styles.empty}>{t(dictionary, "account.participantsEmpty")}</Text>
          ) : (
            <View style={styles.memberList}>
              {members.map((member) => {
                const isCurrentUser = member.user_id === user?.id;
                const fallback = t(dictionary, "account.memberFallback", {
                  id: member.user_id.slice(0, 6),
                });
                const displayName =
                  member.name ||
                  member.email ||
                  (isCurrentUser ? t(dictionary, "account.youLabel") : fallback);
                return (
                  <View
                    key={`${member.user_id}-${member.role}`}
                    style={styles.memberRow}
                  >
                    <View style={styles.memberInfo}>
                      <Text style={styles.memberName}>
                        {isCurrentUser ? t(dictionary, "account.youLabel") : displayName}
                      </Text>
                      {member.email && !isCurrentUser && (
                        <Text style={styles.memberMeta}>{member.email}</Text>
                      )}
                    </View>
                    <View style={styles.memberRoleBadge}>
                      <Text style={styles.memberRoleText}>{member.role}</Text>
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </View>
      </Card>
    </ScrollView>
  );
}

const tokens = themeTokens.light;
const colors = tokens.colors;

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: colors.bg.secondary,
  },
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: colors.bg.secondary,
    padding: tokens.spacing.lg,
  },
  scrollContainer: {
    flex: 1,
    backgroundColor: colors.bg.secondary,
  },
  scroll: {
    flexGrow: 1,
    backgroundColor: colors.bg.secondary,
    paddingHorizontal: tokens.spacing.lg,
    paddingBottom: tokens.spacing.lg,
  },
  section: {
    marginBottom: tokens.spacing.lg,
  },
  label: {
    fontSize: tokens.typography.size.xs,
    color: colors.text.muted,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: tokens.spacing.xs,
  },
  value: {
    fontSize: tokens.typography.size.xl,
    fontWeight: tokens.typography.weight.semibold,
    color: colors.text.primary,
    marginBottom: tokens.spacing.xs,
  },
  meta: {
    fontSize: tokens.typography.size.sm,
    color: colors.text.secondary,
  },
  memberList: {
    gap: tokens.spacing.sm,
  },
  memberRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: tokens.spacing.md,
    borderWidth: 1,
    borderColor: colors.state.neutral,
    borderRadius: tokens.radii.md,
    backgroundColor: colors.bg.surface,
  },
  memberInfo: {
    flex: 1,
  },
  memberName: {
    fontSize: tokens.typography.size.md,
    fontWeight: tokens.typography.weight.medium,
    color: colors.text.primary,
  },
  memberMeta: {
    fontSize: tokens.typography.size.xs,
    color: colors.text.secondary,
    marginTop: tokens.spacing.xs,
  },
  memberRoleBadge: {
    backgroundColor: colors.action.secondary,
    paddingHorizontal: tokens.spacing.sm,
    paddingVertical: tokens.spacing.xs,
    borderRadius: tokens.radii.pill,
  },
  memberRoleText: {
    fontSize: tokens.typography.size.xs,
    fontWeight: tokens.typography.weight.semibold,
    color: colors.text.primary,
    textTransform: "capitalize",
  },
  empty: {
    fontSize: tokens.typography.size.sm,
    color: colors.text.secondary,
  },
  errorText: {
    color: colors.state.negative,
    fontSize: tokens.typography.size.sm,
    textAlign: "center",
  },
});
