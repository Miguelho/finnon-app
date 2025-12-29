import { Stack, useRouter, useSegments } from "expo-router";
import { useEffect, useState, useRef } from "react";
import { View, ActivityIndicator, StyleSheet } from "react-native";
import { AuthProvider, useAuth } from "../src/contexts/AuthContext";
import { supabase } from "../src/lib/supabase";

function RootLayoutNav() {
  const { session, loading: authLoading, isInitialized } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const [checkingAccount, setCheckingAccount] = useState(false);
  const hasCheckedSessionRef = useRef<string | null>(null);

  useEffect(() => {
    const sessionId = session?.user?.id || null;

    console.log("[RootLayout] Effect triggered:", {
      isInitialized,
      hasSession: !!session,
      sessionId,
      hasChecked: hasCheckedSessionRef.current === sessionId,
    });

    // GATE 1: Wait for auth to be initialized
    if (!isInitialized) {
      console.log("[RootLayout] Waiting for auth initialization...");
      return;
    }

    // CASE 1: No session → go to login
    if (!session) {
      console.log("[RootLayout] No session, redirecting to login");
      hasCheckedSessionRef.current = null; // Reset check when logged out
      router.replace("/(auth)/login");
      return;
    }

    // CASE 2: Has session and haven't checked this session yet → verify account
    if (hasCheckedSessionRef.current !== sessionId) {
      console.log("[RootLayout] New session detected, checking account status");
      hasCheckedSessionRef.current = sessionId;
      setCheckingAccount(true);
      checkAccountAndRedirect();
    }
  }, [session, isInitialized]);

  const checkAccountAndRedirect = async () => {
    if (!session) {
      console.log("[RootLayout] checkAccountAndRedirect: No session");
      setCheckingAccount(false);
      return;
    }

    console.log("[RootLayout] Checking accounts for user:", session.user.id);

    try {
      const { data: accounts, error } = await supabase
        .from("accounts")
        .select("id")
        .eq("owner_user_id", session.user.id)
        .limit(1);

      if (error) throw error;

      const hasAccount = accounts && accounts.length > 0;
      const inAuthGroup = segments[0] === "(auth)";

      console.log("[RootLayout] Account check result:", {
        hasAccount,
        inAuthGroup,
        segments: segments.join("/"),
      });

      // User with session but no account → onboarding (if not already there)
      if (!hasAccount && segments.join("/") !== "(auth)/onboarding") {
        console.log("[RootLayout] No account, redirecting to onboarding");
        router.replace("/(auth)/onboarding");
      }
      // User with session AND account but in auth group → redirect to home
      else if (hasAccount && inAuthGroup) {
        console.log("[RootLayout] Has account but in auth group, redirecting to home");
        router.replace("/");
      }
      // Already in correct place
      else {
        console.log("[RootLayout] User is in the correct location");
      }
    } catch (err) {
      console.error("[RootLayout] Error checking account:", err);
    } finally {
      setCheckingAccount(false);
    }
  };

  // Loading Gate: Show spinner until everything is ready
  if (!isInitialized || authLoading || checkingAccount) {
    console.log("[RootLayout] Showing loading spinner:", {
      isInitialized,
      authLoading,
      checkingAccount,
    });
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  console.log("[RootLayout] Rendering Stack navigator, current segments:", segments);

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" options={{ headerShown: true, title: "Finnon" }} />
      <Stack.Screen name="(auth)" options={{ headerShown: false }} />
    </Stack>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#fff",
  },
});

export default function RootLayout() {
  return (
    <AuthProvider>
      <RootLayoutNav />
    </AuthProvider>
  );
}
