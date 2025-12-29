import { useState } from "react";
import {
  View,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";
import { supabase } from "../../src/lib/supabase";
import { Card } from "../../src/components/Card";
import { Input } from "../../src/components/Input";
import { Button } from "../../src/components/Button";

export default function LoginScreen() {
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [step, setStep] = useState<"email" | "otp">("email");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSendOtp = async () => {
    setLoading(true);
    setError(null);

    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          shouldCreateUser: true,
        },
      });

      if (error) throw error;
      setStep("otp");
    } catch (err) {
      console.error("Send OTP error:", err);
      setError(err instanceof Error ? err.message : "Error al enviar el código");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (otp.length !== 6) return;

    setLoading(true);
    setError(null);

    try {
      console.log("[Login] Verifying OTP for:", email);
      const { data, error } = await supabase.auth.verifyOtp({
        email,
        token: otp,
        type: "email",
      });

      if (error) {
        console.error("[Login] Verify OTP error:", error);
        throw error;
      }

      console.log("[Login] OTP verified successfully:", {
        hasSession: !!data.session,
        hasUser: !!data.user,
        userId: data.user?.id,
      });

      if (data.session) {
        console.log("[Login] Session created, AuthContext should redirect");
        // Auth context will handle redirect
        // Either to onboarding (no account) or home (has account)
      } else {
        console.warn("[Login] No session in response");
        setError("No se pudo crear la sesión");
      }
    } catch (err) {
      console.error("[Login] Verify OTP error:", err);
      setError(
        err instanceof Error ? err.message : "Código inválido o expirado"
      );
    } finally {
      setLoading(false);
    }
  };

  if (step === "otp") {
    return (
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.container}
      >
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <Card
            title="Ingresa el código"
            description={`Hemos enviado un código de 6 dígitos a ${email}`}
          >
            <Input
              label="Código de verificación"
              value={otp}
              onChangeText={(text) => setOtp(text.replace(/\D/g, ""))}
              placeholder="123456"
              keyboardType="numeric"
              maxLength={6}
              disabled={loading}
              error={error || undefined}
            />

            <View style={styles.buttonGroup}>
              <View style={styles.buttonHalf}>
                <Button
                  title="Volver"
                  onPress={() => {
                    setStep("email");
                    setOtp("");
                    setError(null);
                  }}
                  disabled={loading}
                  variant="secondary"
                />
              </View>
              <View style={styles.buttonHalf}>
                <Button
                  title="Verificar"
                  onPress={handleVerifyOtp}
                  disabled={loading || otp.length !== 6}
                  loading={loading}
                />
              </View>
            </View>
          </Card>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Card
          title="Bienvenido a Finnon"
          description="Ingresa tu email para recibir un código de verificación"
        >
          <Input
            label="Email"
            value={email}
            onChangeText={setEmail}
            placeholder="tu@email.com"
            keyboardType="email-address"
            disabled={loading}
            error={error || undefined}
          />

          <Button
            title="Enviar código"
            onPress={handleSendOtp}
            disabled={loading || !email}
            loading={loading}
          />
        </Card>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: "center",
    padding: 20,
  },
  buttonGroup: {
    flexDirection: "row",
    gap: 12,
    marginTop: 8,
  },
  buttonHalf: {
    flex: 1,
  },
});
