import { useEffect, useMemo, useState } from "react";
import { View, Text, StyleSheet, ActivityIndicator, ScrollView, TouchableOpacity } from "react-native";
import { useRouter } from "expo-router";
import { supabase } from "../../src/lib/supabase";
import { useAuth } from "../../src/contexts/AuthContext";
import { Button } from "../../src/components/Button";
import { Card } from "../../src/components/Card";

type Account = {
  id: string;
  name: string;
  base_currency: string;
};

type AccountMember = {
  account_id: string;
  user_id: string;
  role: "viewer" | "contributor" | "admin";
};

export default function HomeScreen() {
  const router = useRouter();
  const { user, session, signOut, selectedAccountId, setSelectedAccountId } = useAuth();

  const [accounts, setAccounts] = useState<Account[] | null>(null);
  const [membersByAccountId, setMembersByAccountId] = useState<Record<string, AccountMember[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const mainAccount = useMemo(() => {
    if (!accounts || accounts.length === 0) return null;

    // Si tienes selectedAccountId, úsalo como “cuenta activa”
    if (selectedAccountId) {
      const selected = accounts.find((a) => a.id === selectedAccountId);
      if (selected) return selected;
    }

    // Fallback: primera cuenta
    return accounts[0];
  }, [accounts, selectedAccountId]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      // Si tu gate está bien, normalmente no entras aquí sin sesión,
      // pero lo dejamos robusto.
      if (!session || !user) {
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);
      try {
        // Equivalente RN del query de web: accounts + join membership
        // En mobile normalmente basta con listar accounts del usuario
        const { data, error: qErr } = await supabase
          .from("accounts")
          .select("id, name, base_currency, account_members!inner(role)")
          .eq("account_members.user_id", user.id);

        if (qErr) throw qErr;

        const accountsList = (data as Account[]) ?? [];

        if (!cancelled) {
          setAccounts(accountsList);
        }

        if (accountsList.length > 0) {
          try {
            const { data: members, error: membersErr } = await supabase
              .from("account_members")
              .select("account_id, user_id, role")
              .in("account_id", accountsList.map((account) => account.id));

            if (membersErr) throw membersErr;

            const groupedMembers = (members as AccountMember[]).reduce<Record<string, AccountMember[]>>(
              (acc, member) => {
                if (!acc[member.account_id]) acc[member.account_id] = [];
                acc[member.account_id].push(member);
                return acc;
              },
              {}
            );

            if (!cancelled) setMembersByAccountId(groupedMembers);
          } catch (membersLoadError: any) {
            console.error("[Home] Error loading members:", membersLoadError);
            if (!cancelled) {
              setMembersByAccountId({});
            }
          } finally {
            if (!cancelled) {
              // no-op; kept for future loading UI if needed
            }
          }
        } else if (!cancelled) {
          setMembersByAccountId({});
        }
      } catch (e: any) {
        console.error("[Home] Error loading accounts:", e);
        if (!cancelled) setError(e?.message ?? "Error loading accounts");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [session?.user?.id]);

  // Auto-select first account if none is selected
  useEffect(() => {
    if (accounts && accounts.length > 0 && !selectedAccountId) {
      const firstAccount = accounts[0];
      if (firstAccount) {
        console.log("[Home] Auto-selecting first account:", firstAccount.id);
        setSelectedAccountId(firstAccount.id);
      }
    }
  }, [accounts, selectedAccountId, setSelectedAccountId]);

  const handleSignOut = async () => {
    await signOut(); // limpia selectedAccountId + supabase.signOut :contentReference[oaicite:5]{index=5}
    // Si tienes gate en index.tsx, no hace falta replace manual.
    router.replace("/(auth)/login");
  };

  // UI states
  if (!session || !user) {
    // si has entrado aquí sin sesión, te mando a login
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
        <Card title="Error" description={error}>
          <Text style={styles.errorText}>No se pudieron cargar las cuentas</Text>
          <View style={{ height: 12 }} />
          <Button title="Reintentar" onPress={() => {
            setAccounts(null);
            setError(null);
            setLoading(true);
            // fuerza reload con pequeño truco: push a misma ruta
            router.replace("/home");
          }} />
        </Card>
      </View>
    );
  }

  // Si no hay cuentas, normalmente tu gate debería mandarte a onboarding
  if (!accounts || accounts.length === 0) {
    router.replace("/(auth)/onboarding");
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.scroll}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.appName}>Finnon</Text>
          <Text style={styles.tagline}>Gestiona tus finanzas sin fricción</Text>
        </View>

        <View style={styles.headerActions}>
          {/* Si luego quieres LocaleSwitcher, lo metemos aquí */}
          <Button title="Salir" onPress={handleSignOut} variant="secondary" />
        </View>
      </View>

      {/* Accounts Menu */}
      <Card
        title="Cuentas"
        description="Selecciona la cuenta activa y revisa participantes"
      >
        <View style={styles.accountList}>
          {accounts.map((account) => {
            const isActive = account.id === mainAccount?.id;
            const memberCount = membersByAccountId[account.id]?.length ?? 0;

            return (
              <TouchableOpacity
                key={account.id}
                style={[styles.accountRow, isActive && styles.accountRowActive]}
                onPress={async () => {
                  await setSelectedAccountId(account.id);
                  router.push(`/(auth)/account/${account.id}`);
                }}
              >
                <View style={styles.accountRowInfo}>
                  <Text style={styles.accountRowName}>{account.name}</Text>
                  <Text style={styles.accountRowMeta}>
                    {account.base_currency} • {memberCount} participantes
                  </Text>
                </View>
                <View style={[styles.accountBadge, isActive && styles.accountBadgeActive]}>
                  <Text style={[styles.accountBadgeText, isActive && styles.accountBadgeTextActive]}>
                    {isActive ? "Activa" : "Elegir"}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      </Card>

      {/* Welcome Card */}
      <Card
        title="Bienvenido"
        description="Tu panel está listo. Aquí verás tu cuenta activa y un resumen rápido."
      >
        <View style={styles.kv}>
          <Text style={styles.kvRow}>
            <Text style={styles.kvLabel}>Email: </Text>
            {user.email ?? "-"}
          </Text>

          <Text style={styles.kvRow}>
            <Text style={styles.kvLabel}>Cuenta activa: </Text>
            {mainAccount?.name ?? "-"}
          </Text>

          <Text style={styles.kvRow}>
            <Text style={styles.kvLabel}>Moneda base: </Text>
            {mainAccount?.base_currency ?? "-"}
          </Text>
        </View>
      </Card>

      {/* Feature cards (grid aproximado en RN) */}
      <View style={styles.grid}>
        <TouchableOpacity
          style={styles.gridItem}
          onPress={() => router.push("/(auth)/transactions")}
        >
          <Card title="Transacciones" description="Registra ingresos y gastos con detalle." ><Text>a</Text></Card>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.gridItem}
          onPress={() => router.push("/(auth)/categories")}
        >
          <Card title="Categorías" description="Organiza tus gastos para entender hábitos." ><Text>a</Text></Card>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.gridItem}
          onPress={() => router.push("/(auth)/settings")}
        >
          <Card title="Invitaciones" description="Gestiona invitaciones a tu cuenta." ><Text>a</Text></Card>
        </TouchableOpacity>
        <View style={styles.gridItem}>
          <Card title="Resumen" description="Vista rápida de tu mes y obligaciones." ><Text>a</Text></Card>
        </View>
      </View>
    </ScrollView>
  );
}

// Finnon Color Tokens (color-guide.md)
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
  scroll: {
    padding: 16,
    backgroundColor: colors.bg.primary,
    gap: 16,
  },
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: colors.bg.primary,
    justifyContent: "center",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
  },
  headerActions: {
    flexDirection: "row",
    gap: 8,
  },
  appName: {
    fontSize: 28,
    fontWeight: "800",
    color: colors.text.primary,
  },
  tagline: {
    marginTop: 4,
    fontSize: 14,
    color: colors.text.secondary,
  },
  kv: {
    gap: 6,
  },
  kvRow: {
    fontSize: 14,
    color: colors.text.primary,
  },
  kvLabel: {
    fontWeight: "700",
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  gridItem: {
    width: "48%",
  },
  errorText: {
    color: colors.state.negative,
    marginTop: 8,
  },
  accountList: {
    gap: 10,
  },
  accountRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    borderColor: colors.state.neutral,
    backgroundColor: colors.bg.secondary,
    borderRadius: 10,
    padding: 12,
  },
  accountRowActive: {
    borderColor: colors.action.primary,
    backgroundColor: colors.action.secondary,
  },
  accountRowInfo: {
    flex: 1,
    gap: 4,
  },
  accountRowName: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.text.primary,
  },
  accountRowMeta: {
    fontSize: 13,
    color: colors.text.secondary,
  },
  accountBadge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: colors.bg.surface,
    borderWidth: 1,
    borderColor: colors.state.neutral,
  },
  accountBadgeActive: {
    backgroundColor: colors.action.primary,
    borderColor: colors.action.primary,
  },
  accountBadgeText: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.text.secondary,
  },
  accountBadgeTextActive: {
    color: colors.bg.primary,
  },
});
