import { useEffect, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from "react-native";
import { supabase } from "../lib/supabase";
import { useAuth } from "../contexts/AuthContext";
import { Card } from "./Card";
import { useCopy, t } from "../lib/i18n";

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
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [accountId, dictionary]);

  if (!accountId) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.container}>
        <Card title={t(dictionary, "account.errorTitle")} description={error}>
          <Text style={styles.errorText}>{t(dictionary, "account.errorDescription")}</Text>
        </Card>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.scroll}>
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

const colors = {
  bg: {
    primary: "#FFFFFF",
    secondary: "#F7F8FA",
    surface: "#FFFFFF",
  },
  text: {
    primary: "#1C1E21",
    secondary: "#5F6368",
    muted: "#9AA0A6",
  },
  action: {
    primary: "#5B8DFF",
    secondary: "#E8EEFF",
    disabled: "#C7D2FE",
  },
  state: {
    positive: "#2E7D65",
    negative: "#B23B3B",
    neutral: "#DADCE0",
  },
};

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: colors.bg.secondary,
    padding: 20,
  },
  scroll: {
    flexGrow: 1,
    backgroundColor: colors.bg.secondary,
    padding: 20,
  },
  section: {
    marginBottom: 20,
  },
  label: {
    fontSize: 12,
    color: colors.text.muted,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  value: {
    fontSize: 20,
    fontWeight: "600",
    color: colors.text.primary,
    marginBottom: 4,
  },
  meta: {
    fontSize: 14,
    color: colors.text.secondary,
  },
  memberList: {
    gap: 12,
  },
  memberRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 12,
    borderWidth: 1,
    borderColor: colors.state.neutral,
    borderRadius: 8,
    backgroundColor: colors.bg.surface,
  },
  memberInfo: {
    flex: 1,
  },
  memberName: {
    fontSize: 16,
    fontWeight: "500",
    color: colors.text.primary,
  },
  memberMeta: {
    fontSize: 12,
    color: colors.text.secondary,
    marginTop: 2,
  },
  memberRoleBadge: {
    backgroundColor: colors.action.secondary,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  memberRoleText: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.text.primary,
    textTransform: "capitalize",
  },
  empty: {
    fontSize: 14,
    color: colors.text.secondary,
  },
  errorText: {
    color: colors.state.negative,
    fontSize: 14,
    textAlign: "center",
  },
});
