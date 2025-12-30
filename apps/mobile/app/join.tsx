import { useEffect, useState } from "react";
import { View, Text, StyleSheet, ActivityIndicator } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { supabase } from "../src/lib/supabase";
import { useAuth } from "../src/contexts/AuthContext";
import { Card } from "../src/components/Card";
import { Button } from "../src/components/Button";

type JoinState =
  | { status: "loading" }
  | { status: "processing" }
  | { status: "success"; accountId: string }
  | { status: "error"; message: string };

export default function JoinScreen() {
  const router = useRouter();
  const { token } = useLocalSearchParams<{ token: string }>();
  const { setSelectedAccountId } = useAuth();
  const [state, setState] = useState<JoinState>({ status: "loading" });

  useEffect(() => {
    if (!token) {
      setState({
        status: "error",
        message: "No se proporcionó token de invitación",
      });
      return;
    }

    async function processInvite(token: string) {
      setState({ status: "processing" });

      try {
        // 1. Check if user has a session
        const {
          data: { session },
          error: sessionError,
        } = await supabase.auth.getSession();

        // 2. If no session, create anonymous session
        if (!session) {
          console.log("[Join] No session found, signing in anonymously...");
          const { data: anonData, error: anonError } =
            await supabase.auth.signInAnonymously();

          if (anonError || !anonData.session) {
            console.error("[Join] Anonymous auth failed:", anonError);
            setState({
              status: "error",
              message:
                "No se pudo crear sesión de invitado. Por favor intenta de nuevo.",
            });
            return;
          }

          console.log(
            "[Join] Anonymous session created:",
            anonData.session.user.id
          );
        }

        // 3. Call web API to accept invite
        const apiUrl =
          process.env.EXPO_PUBLIC_API_URL || "http://localhost:3000";
        const response = await fetch(`${apiUrl}/api/invites/accept`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          setState({
            status: "error",
            message: errorData.error || "No se pudo aceptar la invitación",
          });
          return;
        }

        const data = await response.json();

        // 4. Save active account to AsyncStorage via AuthContext
        await setSelectedAccountId(data.accountId);

        // 5. Show success state
        setState({ status: "success", accountId: data.accountId });

        // 6. Redirect to home after 2 seconds
        setTimeout(() => {
          router.replace("/(auth)/home");
        }, 2000);
      } catch (error) {
        console.error("[Join] Error:", error);
        setState({
          status: "error",
          message: "Ocurrió un error inesperado",
        });
      }
    }

    processInvite(token);
  }, [token, router, setSelectedAccountId]);

  if (state.status === "loading" || state.status === "processing") {
    return (
      <View style={styles.container}>
        <Card
          title="Uniéndote a la cuenta..."
          description="Por favor espera mientras procesamos tu invitación"
        >
          <View style={styles.loading}>
            <ActivityIndicator size="large" color="#007AFF" />
          </View>
        </Card>
      </View>
    );
  }

  if (state.status === "error") {
    return (
      <View style={styles.container}>
        <Card title="Error de invitación" description={state.message}>
          <Button
            title="Ir al inicio de sesión"
            onPress={() => router.replace("/(auth)/login")}
          />
        </Card>
      </View>
    );
  }

  if (state.status === "success") {
    return (
      <View style={styles.container}>
        <Card
          title="¡Éxito!"
          description="Te has unido a la cuenta exitosamente"
        >
          <Text style={styles.text}>Redirigiendo a inicio...</Text>
          <View style={styles.loading}>
            <ActivityIndicator size="large" color="#007AFF" />
          </View>
        </Card>
      </View>
    );
  }

  return null;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
    justifyContent: "center",
    padding: 20,
  },
  loading: {
    paddingVertical: 32,
    alignItems: "center",
  },
  text: {
    fontSize: 14,
    color: "#666",
    marginBottom: 16,
    textAlign: "center",
  },
});
