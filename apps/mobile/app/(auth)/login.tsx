import { useState } from "react";
import {
  View,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";
import { useRouter } from "expo-router";
import { supabase } from "../../src/lib/supabase";
import { Card } from "../../src/components/Card";
import { Input } from "../../src/components/Input";
import { Button } from "../../src/components/Button";
import { useCopy, t } from "../../src/lib/i18n";

export default function LoginScreen() {
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [step, setStep] = useState<"email" | "otp">("email");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const { dictionary } = useCopy();

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
      setError(err instanceof Error ? err.message : t(dictionary, "mobile.login.sendError"));
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
        console.log("[Login] Session created, navigating to trigger account check");
        // Navigate to root to trigger account verification in _layout
        // This will redirect to onboarding (no account), select-account (multiple), or home (single account)
        router.replace("/");
      } else {
        console.warn("[Login] No session in response");
        setError(t(dictionary, "mobile.login.sessionError"));
      }
    } catch (err) {
      console.error("[Login] Verify OTP error:", err);
      setError(
        err instanceof Error ? err.message : t(dictionary, "mobile.login.invalidOtp")
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
            title={t(dictionary, "mobile.login.otpTitle")}
            description={t(dictionary, "mobile.login.otpDescription", { email })}
          >
            <Input
              label={t(dictionary, "mobile.login.otpLabel")}
              value={otp}
              onChangeText={(text) => setOtp(text.replace(/\D/g, ""))}
              placeholder={t(dictionary, "mobile.login.otpPlaceholder")}
              keyboardType="numeric"
              maxLength={6}
              disabled={loading}
              error={error || undefined}
            />

            <View style={styles.buttonGroup}>
              <View style={styles.buttonHalf}>
                <Button
                  title={t(dictionary, "mobile.login.backButton")}
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
                  title={t(dictionary, "mobile.login.verifyButton")}
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
          title={t(dictionary, "mobile.login.title")}
          description={t(dictionary, "mobile.login.description")}
        >
          <Input
            label={t(dictionary, "mobile.login.emailLabel")}
            value={email}
            onChangeText={setEmail}
            placeholder={t(dictionary, "mobile.login.emailPlaceholder")}
            keyboardType="email-address"
            disabled={loading}
            error={error || undefined}
          />

          <Button
            title={t(dictionary, "mobile.login.sendButton")}
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
