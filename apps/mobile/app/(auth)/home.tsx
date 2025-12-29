import { useEffect, useMemo, useState } from "react";
import { View, Text, StyleSheet, ActivityIndicator, ScrollView } from "react-native";
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

export default function HomeScreen() {
  const router = useRouter();
  const { user, session, signOut, selectedAccountId } = useAuth();

  const [accounts, setAccounts] = useState<Account[] | null>(null);
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

        if (!cancelled) {
          setAccounts((data as any) ?? []);
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
        <View style={styles.gridItem}>
          <Card title="Transacciones" description="Registra ingresos y gastos con detalle." ><Text>a</Text></Card>
        </View>
        <View style={styles.gridItem}>
          <Card title="Categorías" description="Organiza tus gastos para entender hábitos." ><Text>a</Text></Card>
        </View>
        <View style={styles.gridItem}>
          <Card title="Resumen" description="Vista rápida de tu mes y obligaciones." ><Text>a</Text></Card>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  scroll: {
    padding: 16,
    backgroundColor: "#fff",
    gap: 16,
  },
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: "#fff",
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
  },
  tagline: {
    marginTop: 4,
    fontSize: 14,
    color: "#666",
  },
  kv: {
    gap: 6,
  },
  kvRow: {
    fontSize: 14,
    color: "#333",
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
    color: "#b00020",
    marginTop: 8,
  },
});
