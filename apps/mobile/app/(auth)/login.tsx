import { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";
import * as Linking from "expo-linking";
import { useRouter } from "expo-router";
import { supabase } from "../../src/lib/supabase";
import { Card } from "../../src/components/Card";
import { Input } from "../../src/components/Input";
import { Button } from "../../src/components/Button";
import { useCopy, t } from "../../src/lib/i18n";
import { useAuth } from "../../src/contexts/AuthContext";
import { themeTokens } from "@poleursus/shared";

const colors = themeTokens.light.colors;
const OTP_MIN_LENGTH = 6;
const OTP_MAX_LENGTH = 8;

export default function LoginScreen() {
  const { session } = useAuth();
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [step, setStep] = useState<"email" | "otp" | "magicLinkSent">("email");
  const [loadingAction, setLoadingAction] = useState<
    "otp" | "magic" | "verify" | null
  >(null);
  const [cooldownSeconds, setCooldownSeconds] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const { dictionary } = useCopy();
  const isLoading = loadingAction !== null;
  const isCooldown = cooldownSeconds > 0;

  useEffect(() => {
    if (session) {
      router.replace("/");
    }
  }, [router, session]);

  useEffect(() => {
    if (cooldownSeconds <= 0) return;

    const timer = setInterval(() => {
      setCooldownSeconds((previous) => (previous <= 1 ? 0 : previous - 1));
    }, 1000);

    return () => clearInterval(timer);
  }, [cooldownSeconds]);

  const handleSendOtp = async () => {
    if (isLoading || isCooldown || !email.trim()) return;

    setLoadingAction("otp");
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
      setCooldownSeconds(60);
    } catch (err) {
      console.error("Send OTP error:", err);
      setError(err instanceof Error ? err.message : t(dictionary, "mobile.login.sendError"));
    } finally {
      setLoadingAction(null);
    }
  };

  const handleSendMagicLink = async () => {
    if (isLoading || isCooldown || !email.trim()) return;

    setLoadingAction("magic");
    setError(null);

    try {
      const redirectTo = Linking.createURL("/");
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: redirectTo,
          shouldCreateUser: true,
        },
      });

      if (error) throw error;
      setStep("magicLinkSent");
      setCooldownSeconds(60);
    } catch (err) {
      console.error("Send magic link error:", err);
      setError(
        err instanceof Error ? err.message : t(dictionary, "mobile.login.sendError")
      );
    } finally {
      setLoadingAction(null);
    }
  };

  const handleVerifyOtp = async () => {
    if (otp.length < OTP_MIN_LENGTH) return;

    setLoadingAction("verify");
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
      setLoadingAction(null);
    }
  };

  if (step === "magicLinkSent") {
    return (
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.container}
      >
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <Card
            title={t(dictionary, "mobile.login.magicLinkTitle")}
            description={t(dictionary, "mobile.login.magicLinkDescription", { email })}
          >
            <Text style={styles.helperText}>
              {t(dictionary, "mobile.login.magicLinkMessage")}
            </Text>
            {isCooldown && (
              <Text style={styles.cooldownText}>
                {t(dictionary, "mobile.login.cooldownMessage", { seconds: cooldownSeconds })}
              </Text>
            )}

            <View style={styles.buttonStack}>
              <Button
                title={t(dictionary, "mobile.login.backButton")}
                onPress={() => {
                  setStep("email");
                  setError(null);
                }}
                disabled={isLoading}
                variant="secondary"
              />
            </View>
          </Card>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

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
              maxLength={OTP_MAX_LENGTH}
              disabled={isLoading}
              error={error || undefined}
            />
            {isCooldown && (
              <Text style={styles.cooldownText}>
                {t(dictionary, "mobile.login.cooldownMessage", { seconds: cooldownSeconds })}
              </Text>
            )}

            <View style={styles.buttonGroup}>
              <View style={styles.buttonHalf}>
                <Button
                  title={t(dictionary, "mobile.login.backButton")}
                  onPress={() => {
                    setStep("email");
                    setOtp("");
                    setError(null);
                  }}
                  disabled={isLoading}
                  variant="secondary"
                />
              </View>
              <View style={styles.buttonHalf}>
                <Button
                  title={t(dictionary, "mobile.login.verifyButton")}
                  onPress={handleVerifyOtp}
                  disabled={isLoading || otp.length < OTP_MIN_LENGTH}
                  loading={loadingAction === "verify"}
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
            disabled={isLoading}
            error={error || undefined}
          />
          {isCooldown && (
            <Text style={styles.cooldownText}>
              {t(dictionary, "mobile.login.cooldownMessage", { seconds: cooldownSeconds })}
            </Text>
          )}

          <View style={styles.buttonStack}>
            <Button
              title={t(dictionary, "mobile.login.sendButton")}
              onPress={handleSendOtp}
              disabled={isLoading || isCooldown || !email}
              loading={loadingAction === "otp"}
            />
            <Button
              title={t(dictionary, "mobile.login.sendMagicLinkButton")}
              onPress={handleSendMagicLink}
              disabled={isLoading || isCooldown || !email}
              loading={loadingAction === "magic"}
              variant="secondary"
            />
          </View>
        </Card>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg.primary,
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
  buttonStack: {
    marginTop: 12,
    gap: 10,
  },
  helperText: {
    marginBottom: 12,
    fontSize: 13,
    color: "#555",
  },
  cooldownText: {
    marginBottom: 12,
    fontSize: 13,
    color: colors.text.secondary,
  },
});
