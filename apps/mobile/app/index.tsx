import { useEffect, useState } from "react";
import { View, Text, StyleSheet, ActivityIndicator } from "react-native";
import { Redirect } from "expo-router";
import { supabase } from "../src/lib/supabase";
import { useAuth } from "../src/contexts/AuthContext";
import { Button } from "../src/components/Button";
import { useCopy, t } from "../src/lib/i18n";

export default function IndexGateAndHome() {
  const { session, user, signOut, loading: authLoading, isInitialized, selectedAccountId } = useAuth();
  const { dictionary } = useCopy();

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
        <ActivityIndicator size="large" color="#007AFF" />
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
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  // 3) 0 cuentas -> onboarding
  if (accountCount === 0) {
    return <Redirect href="/(auth)/onboarding" />;
  }

  // 4) +1 cuenta y no seleccionada -> select-account
  if (accountCount > 1 && !selectedAccountId) {
    return <Redirect href="/(auth)/select-account" />;
  }

   // 4) +1 cuenta y no seleccionada -> select-account
  if (accountCount == 1) {
    return <Redirect href="/(auth)/(tabs)/home" />;
  }
  console.log("accountCount:", accountCount);
  console.log("selectedAccountId:", selectedAccountId);
  if (selectedAccountId) {
    return <Redirect href="/(auth)/select-account" />;
  }
  // 5) OK: render Home (tu pantalla actual)
  const handleSignOut = async () => {
    await signOut();
    // No router.replace aquí: al quedar session=null, este mismo gate redirige a login.
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{t(dictionary, "mobile.index.title")}</Text>
      <Text style={styles.text}>
        {t(dictionary, "mobile.index.emailLabel")} {user?.email}
      </Text>
      <Text style={styles.text}>
        {t(dictionary, "mobile.index.idLabel")} {user?.id}
      </Text>

      <View style={styles.buttonContainer}>
        <Button
          title={t(dictionary, "dashboard.signOut")}
          onPress={handleSignOut}
          variant="secondary"
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#fff",
  },
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#fff",
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 16,
  },
  text: {
    fontSize: 16,
    marginVertical: 4,
    color: "#666",
  },
  buttonContainer: {
    marginTop: 32,
    width: "100%",
  },
});
