import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { supabase } from "../../../src/lib/supabase";
import { useAuth } from "../../../src/contexts/AuthContext";
import { Card } from "../../../src/components/Card";

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

export default function AccountDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user, setSelectedAccountId } = useAuth();

  const [account, setAccount] = useState<Account | null>(null);
  const [members, setMembers] = useState<MemberProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const accountId = useMemo(() => (typeof id === "string" ? id : ""), [id]);

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
          throw new Error("No hay sesión activa");
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
          throw new Error(errorBody.error || "Error cargando participantes");
        }

        const payload = await response.json();
        if (!cancelled) {
          setMembers((payload?.members ?? []) as MemberProfile[]);
        }
      } catch (err: any) {
        console.error("[AccountDetail] Error:", err);
        if (!cancelled) {
          setError(err?.message ?? "No se pudo cargar la cuenta");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [accountId]);

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
        <Card title="Error" description={error}>
          <Text style={styles.errorText}>No se pudo cargar el detalle</Text>
        </Card>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.scroll}>
      <Card
        title="Detalle de cuenta"
        description="Participantes y contexto de la cuenta"
      >
        <View style={styles.section}>
          <Text style={styles.label}>Cuenta</Text>
          <Text style={styles.value}>{account?.name ?? "-"}</Text>
          <Text style={styles.meta}>
            Moneda base: {account?.base_currency ?? "-"}
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Participantes ({members.length})</Text>
          {members.length === 0 ? (
            <Text style={styles.empty}>Sin participantes</Text>
          ) : (
            <View style={styles.memberList}>
              {members.map((member) => {
                const isCurrentUser = member.user_id === user?.id;
                const fallback = `Miembro ${member.user_id.slice(0, 6)}`;
                const displayName =
                  member.name ||
                  member.email ||
                  (isCurrentUser ? "Tú" : fallback);
                return (
                  <View
                    key={`${member.user_id}-${member.role}`}
                    style={styles.memberRow}
                  >
                    <View style={styles.memberInfo}>
                      <Text style={styles.memberName}>
                        {isCurrentUser ? "Tú" : displayName}
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
    padding: 16,
    backgroundColor: colors.bg.primary,
    justifyContent: "center",
  },
  scroll: {
    padding: 16,
    backgroundColor: colors.bg.primary,
  },
  section: {
    gap: 6,
    marginBottom: 16,
  },
  label: {
    fontSize: 13,
    color: colors.text.secondary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  value: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.text.primary,
  },
  meta: {
    fontSize: 14,
    color: colors.text.secondary,
  },
  empty: {
    fontSize: 13,
    color: colors.text.muted,
  },
  memberList: {
    gap: 10,
    marginTop: 4,
  },
  memberRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.bg.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.state.neutral,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  memberInfo: {
    flex: 1,
    gap: 2,
  },
  memberName: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.text.primary,
  },
  memberMeta: {
    fontSize: 12,
    color: colors.text.secondary,
  },
  memberRoleBadge: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: colors.action.secondary,
  },
  memberRoleText: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.action.primary,
    textTransform: "uppercase",
  },
  errorText: {
    color: colors.state.negative,
    marginTop: 8,
  },
});
