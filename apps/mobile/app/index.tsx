import { useEffect, useState } from "react";
import { View, StyleSheet, ActivityIndicator } from "react-native";
import { Redirect } from "expo-router";
import { supabase } from "../src/lib/supabase";
import { useAuth } from "../src/contexts/AuthContext";
import { themeTokens } from "@poleursus/shared";

const tokens = themeTokens.light;
const colors = tokens.colors;

export default function IndexGateAndHome() {
  const { session, loading: authLoading, isInitialized, selectedAccountId } = useAuth();

  const [accountCount, setAccountCount] = useState<number | null>(null);
  const [loadingAccounts, setLoadingAccounts] = useState(true);

  // Carga de cuentas (solo si hay sesión)
  useEffect(() => {
    let cancelled = false;

    async function run() {
      if (!isInitialized || !session) {
        if (!cancelled) {
          setAccountCount(null);
          setLoadingAccounts(false);
        }
        return;
      }

      if (!cancelled) setLoadingAccounts(true);

      try {
        const { data: memberships, error } = await supabase
          .from("account_members")
          .select("account_id")
          .eq("user_id", session.user.id);

        if (error) throw error;

        if (!cancelled) setAccountCount(memberships?.length ?? 0);
      } catch (e) {
        console.error("[IndexGate] Error loading accounts:", e);
        if (!cancelled) setAccountCount(0);
      } finally {
        if (!cancelled) setLoadingAccounts(false);
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [isInitialized, session?.user?.id]);

  // Loader estable (aquí sí tiene sentido)
  if (!isInitialized || authLoading || loadingAccounts) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={colors.text.muted} />
      </View>
    );
  }

  // 1) No sesión -> login
  if (!session) {
    return <Redirect href="/(auth)/login" />;
  }

  // 2) Sesión pero aún no sabemos cuentas (por seguridad)
  if (accountCount === null) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={colors.text.muted} />
      </View>
    );
  }

  // 3) 0 cuentas -> select-account
  if (accountCount === 0) {
    return <Redirect href="/(auth)/select-account" />;
  }

  if (!selectedAccountId) {
    return <Redirect href="/(auth)/select-account" />;
  }

  return <Redirect href="/(auth)/(tabs)/home" />;
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: colors.bg.primary,
  },
});
