import { useEffect, useRef, useState } from "react";
import {
  Animated,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from "react-native";
import { useRouter } from "expo-router";
import Constants from "expo-constants";
import { supabase } from "../../src/lib/supabase";
import { useAuth } from "../../src/contexts/AuthContext";
import { isDemoEmail, parseDemoEmails } from "@poleursus/shared";

const OTP_LENGTH = 8;
const demoEmails = parseDemoEmails(
  Constants.expoConfig?.extra?.demoEmails as string | undefined
);
const API_URL = process.env.EXPO_PUBLIC_API_URL || "http://localhost:3000";

const loginColors = {
  bg: "#F6F5F1",
  surface: "#FFFFFF",
  textPrimary: "#1A1A1A",
  textSecondary: "#6B6B6B",
  textTertiary: "#9A9A9A",
  border: "#E5E3DE",
  accent: "#2D2D2D",
  blueMuted: "#B0BEC5",
  brandPanel: "#1A1A1A",
  error: "#B54848",
  success: "#2A7B57",
};

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const finnonLogo = require("../../assets/icon.png");

function getFadeUpStyle(value: Animated.Value) {
  return {
    opacity: value,
    transform: [
      {
        translateY: value.interpolate({
          inputRange: [0, 1],
          outputRange: [16, 0],
        }),
      },
    ],
  };
}

export default function LoginScreen() {
  const { session, setSelectedAccountId } = useAuth();
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [step, setStep] = useState<"email" | "otp">("email");
  const [loadingAction, setLoadingAction] = useState<
    "otp" | "verify" | null
  >(null);
  const [cooldownSeconds, setCooldownSeconds] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [emailFocused, setEmailFocused] = useState(false);
  const [otpFocused, setOtpFocused] = useState(false);

  const router = useRouter();
  const { width } = useWindowDimensions();
  const isWideWeb = Platform.OS === "web" && width >= 1024;
  const isLoading = loadingAction !== null;
  const isCooldown = cooldownSeconds > 0;

  const logoAnim = useRef(new Animated.Value(0)).current;
  const formAnim = useRef(new Animated.Value(0)).current;
  const brandAnim = useRef(new Animated.Value(0)).current;
  const panelAnim = useRef(new Animated.Value(0)).current;

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

  useEffect(() => {
    [logoAnim, formAnim, brandAnim, panelAnim].forEach((value) =>
      value.setValue(0)
    );

    Animated.stagger(120, [
      Animated.timing(logoAnim, {
        toValue: 1,
        duration: 420,
        useNativeDriver: true,
      }),
      Animated.timing(formAnim, {
        toValue: 1,
        duration: 420,
        useNativeDriver: true,
      }),
      Animated.timing(brandAnim, {
        toValue: 1,
        duration: 420,
        useNativeDriver: true,
      }),
      Animated.timing(panelAnim, {
        toValue: 1,
        duration: 420,
        useNativeDriver: true,
      }),
    ]).start();
  }, [brandAnim, formAnim, logoAnim, panelAnim]);

  const primaryButtonTitle = loadingAction === "otp" ? "Enviando..." : "Enviar código";

  const validateEmail = () => {
    const trimmedEmail = email.trim();

    if (!trimmedEmail) {
      setError("Ingresa tu correo electrónico.");
      return null;
    }

    if (!emailRegex.test(trimmedEmail)) {
      setError("Ingresa un correo electrónico válido.");
      return null;
    }

    return trimmedEmail;
  };

  const handleSendOtp = async () => {
    if (isLoading || isCooldown) return;

    const normalizedEmail = validateEmail();
    if (!normalizedEmail) return;

    if (isDemoEmail(normalizedEmail, demoEmails)) {
      console.warn("[Demo] Skipping OTP send for demo account");
      setStep("otp");
      return;
    }

    setLoadingAction("otp");
    setError(null);

    try {
      const { error: otpError } = await supabase.auth.signInWithOtp({
        email: normalizedEmail,
        options: {
          shouldCreateUser: true,
        },
      });

      if (otpError) throw otpError;

      setStep("otp");
      setCooldownSeconds(60);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "No pudimos enviar el código. Inténtalo de nuevo."
      );
    } finally {
      setLoadingAction(null);
    }
  };


  const handleVerifyOtp = async () => {
    if (isLoading || otp.length < OTP_LENGTH) return;

    const normalizedEmail = validateEmail();
    if (!normalizedEmail) return;

    setLoadingAction("verify");
    setError(null);

    try {
      if (isDemoEmail(normalizedEmail, demoEmails)) {
        console.warn("[Demo] Using demo login API");
        const response = await fetch(`${API_URL}/api/auth/demo-login`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-client-type": "mobile",
          },
          body: JSON.stringify({ email: normalizedEmail, otp }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || "Demo login failed");
        }

        const sessionData = await response.json();
        const { error: setSessionError } = await supabase.auth.setSession({
          access_token: sessionData.access_token,
          refresh_token: sessionData.refresh_token,
        });

        if (setSessionError) throw setSessionError;

        // Auto-select the demo user's account
        const { data: memberships } = await supabase
          .from("account_members")
          .select("account_id")
          .eq("user_id", sessionData.user.id)
          .limit(1);

        if (memberships && memberships.length > 0) {
          await setSelectedAccountId(memberships[0]!.account_id as string);
        }

        router.replace("/");
        return;
      }

      const { data, error: verifyError } = await supabase.auth.verifyOtp({
        email: normalizedEmail,
        token: otp,
        type: "email",
      });

      if (verifyError) throw verifyError;

      if (data.session) {
        router.replace("/");
      } else {
        setError("No se pudo iniciar la sesión. Inténtalo de nuevo.");
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Código inválido. Revisa e inténtalo de nuevo."
      );
    } finally {
      setLoadingAction(null);
    }
  };

  const handleBackToEmail = () => {
    setStep("email");
    setOtp("");
    setError(null);
  };

  const renderEmailForm = () => {
    return (
      <>
        <Text style={styles.inputLabel}>Correo electrónico</Text>
        <TextInput
          style={[
            styles.input,
            emailFocused && styles.inputFocused,
            error && styles.inputError,
          ]}
          value={email}
          onChangeText={(text) => {
            setEmail(text);
            setError(null);
          }}
          onFocus={() => setEmailFocused(true)}
          onBlur={() => setEmailFocused(false)}
          placeholder="tu@email.com"
          placeholderTextColor={loginColors.textTertiary}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          editable={!isLoading}
          onSubmitEditing={() => {
            void handleSendOtp();
          }}
        />

        <Pressable
          style={[
            styles.primaryButton,
            (isLoading || isCooldown) && styles.primaryButtonDisabled,
          ]}
          onPress={() => {
            void handleSendOtp();
          }}
          disabled={isLoading || isCooldown}
        >
          <Text style={styles.primaryButtonText}>{primaryButtonTitle}</Text>
        </Pressable>

        <Text style={styles.helperText}>
          Te enviaremos un código de verificación.{"\n"}Sin contraseñas, sin complicaciones.
        </Text>

        {isCooldown && (
          <Text style={styles.cooldownText}>Podrás reenviar en {cooldownSeconds}s.</Text>
        )}

        {error && <Text style={styles.errorText}>{error}</Text>}
      </>
    );
  };

  const renderOtpForm = () => {
    return (
      <>
        <Text style={styles.otpTitle}>Verifica tu código</Text>
        <Text style={styles.otpDescription}>
          Introduce el código que enviamos a {email.trim()}.
        </Text>

        <Text style={styles.inputLabel}>Código de verificación</Text>
        <TextInput
          style={[
            styles.input,
            otpFocused && styles.inputFocused,
            error && styles.inputError,
          ]}
          value={otp}
          onChangeText={(text) => {
            setOtp(text.replace(/\D/g, ""));
            setError(null);
          }}
          onFocus={() => setOtpFocused(true)}
          onBlur={() => setOtpFocused(false)}
          placeholder="12345678"
          placeholderTextColor={loginColors.textTertiary}
          keyboardType="numeric"
          autoCapitalize="none"
          autoCorrect={false}
          maxLength={OTP_LENGTH}
          editable={!isLoading}
          onSubmitEditing={() => {
            void handleVerifyOtp();
          }}
        />

        {isCooldown && (
          <Text style={styles.cooldownText}>Podrás reenviar en {cooldownSeconds}s.</Text>
        )}

        {error && <Text style={styles.errorText}>{error}</Text>}

        <View style={styles.otpActions}>
          <Pressable
            style={[styles.secondaryButton, isLoading && styles.secondaryButtonDisabled]}
            onPress={handleBackToEmail}
            disabled={isLoading}
          >
            <Text style={styles.secondaryButtonText}>Volver</Text>
          </Pressable>

          <Pressable
            style={[
              styles.primaryButton,
              styles.otpVerifyButton,
              (isLoading || otp.length < OTP_LENGTH) && styles.primaryButtonDisabled,
            ]}
            onPress={() => {
              void handleVerifyOtp();
            }}
            disabled={isLoading || otp.length < OTP_LENGTH}
          >
            <Text style={styles.primaryButtonText}>
              {loadingAction === "verify" ? "Verificando..." : "Verificar"}
            </Text>
          </Pressable>
        </View>
      </>
    );
  };

  const renderFormBody = () => {
    if (step === "otp") {
      return renderOtpForm();
    }

    return renderEmailForm();
  };

  const renderMobile = () => {
    return (
      <ScrollView
        contentContainerStyle={styles.mobileScrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.mobileShell}>
          <Animated.View style={[styles.mobileBrandPanel, getFadeUpStyle(logoAnim)]}>
            <View style={styles.mobileBrandHeader}>
              <View style={styles.mobileBrandLogoWrap}>
                <Animated.Image source={finnonLogo} style={styles.mobileBrandLogoImage} />
              </View>
              <Text style={styles.mobileBrandWordmark}>Finnon</Text>
            </View>

            <Text style={styles.mobileBrandHeadline}>Tus finanzas en equipo.</Text>
            <Text style={styles.mobileBrandDescription}>
              Gestiona gastos, ahorros y objetivos junto a quien compartes tu vida.
            </Text>

            <View style={styles.mobileBrandCircles}>
              <View style={styles.mobileBrandCircleLight} />
              <View style={styles.mobileBrandCircleBlue} />
            </View>
          </Animated.View>

          <Animated.View style={[styles.mobileFormArea, getFadeUpStyle(formAnim)]}>
            {step === "email" && (
              <View style={styles.mobileWelcomeBlock}>
                <Text style={styles.mobileWelcomeTitle}>Bienvenido</Text>
                <Text style={styles.mobileWelcomeSubtitle}>
                  Empieza directamente con tu correo electrónico.
                </Text>
              </View>
            )}
            {renderFormBody()}
          </Animated.View>
        </View>
      </ScrollView>
    );
  };

  const renderDesktop = () => {
    return (
      <View style={styles.desktopRoot}>
        <Animated.View style={[styles.brandPanel, getFadeUpStyle(brandAnim)]}>
          <View style={styles.brandTop}>
            <View style={styles.brandLogoWrap}>
              <Animated.Image source={finnonLogo} style={styles.brandLogo} />
            </View>
            <Text style={styles.brandWordmark}>Finnon</Text>
          </View>

          <View style={styles.brandCenter}>
            <Text style={styles.brandHeadline}>Tus finanzas en equipo.</Text>
            <Text style={styles.brandSub}>
              Gestiona gastos, ahorros y objetivos junto a quien compartes tu vida.
            </Text>

            <View style={styles.brandFeatureList}>
              <View style={styles.brandFeatureItem}>
                <View style={styles.brandFeatureDot} />
                <Text style={styles.brandFeatureText}>
                  Cuentas compartidas con control individual
                </Text>
              </View>

              <View style={styles.brandFeatureItem}>
                <View style={styles.brandFeatureDot} />
                <Text style={styles.brandFeatureText}>Objetivos de ahorro en equipo</Text>
              </View>

              <View style={styles.brandFeatureItem}>
                <View style={styles.brandFeatureDot} />
                <Text style={styles.brandFeatureText}>
                  Insights que motivan, no que venden
                </Text>
              </View>
            </View>
          </View>
        </Animated.View>

        <Animated.View style={[styles.formPanel, getFadeUpStyle(panelAnim)]}>
          <View style={styles.formPanelInner}>
            <Text style={styles.webTitle}>{step === "otp" ? "Verifica tu código" : "Bienvenido"}</Text>
            <Text style={styles.webSubtitle}>
              {step === "otp"
                ? `Introduce el código enviado a ${email.trim()}.`
                : "Empieza directamente con tu correo electrónico."}
            </Text>

            {renderFormBody()}

            <View style={styles.webFooter}>
              <Text style={styles.webFooterText}>
                Finnon no se conecta a tu banco. Tú decides qué compartir.
              </Text>
            </View>
          </View>

          <View style={styles.webCircles}>
            <View style={styles.webCircleDark} />
            <View style={styles.webCircleBlue} />
          </View>
        </Animated.View>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={styles.root}
    >
      {isWideWeb ? renderDesktop() : renderMobile()}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: loginColors.bg,
  },
  mobileScrollContent: {
    flexGrow: 1,
  },
  mobileShell: {
    flex: 1,
    minHeight: 760,
    paddingHorizontal: 28,
    paddingTop: 0,
    paddingBottom: 34,
    backgroundColor: loginColors.bg,
    position: "relative",
    overflow: "hidden",
  },
  mobileBrandPanel: {
    marginHorizontal: -28,
    paddingHorizontal: 28,
    paddingTop: 56,
    paddingBottom: 30,
    backgroundColor: loginColors.brandPanel,
    position: "relative",
    alignItems: "center",
    overflow: "hidden",
  },
  mobileBrandHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    marginBottom: 20,
  },
  mobileBrandLogoWrap: {
    width: 52,
    height: 52,
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: loginColors.surface,
  },
  mobileBrandLogoImage: {
    width: "100%",
    height: "100%",
  },
  mobileBrandWordmark: {
    fontSize: 26,
    lineHeight: 30,
    color: "#FFFFFF",
    letterSpacing: -0.35,
    fontFamily: "DMSans-SemiBold",
  },
  mobileBrandHeadline: {
    maxWidth: 320,
    textAlign: "center",
    fontSize: 30,
    lineHeight: 36,
    color: "#FFFFFF",
    letterSpacing: -0.6,
    fontFamily: "DMSans-SemiBold",
    marginBottom: 8,
  },
  mobileBrandDescription: {
    maxWidth: 340,
    textAlign: "center",
    fontSize: 15,
    lineHeight: 24,
    color: "rgba(255,255,255,0.65)",
    fontFamily: "DMSans",
  },
  mobileBrandCircles: {
    position: "absolute",
    right: 18,
    bottom: 18,
    flexDirection: "row",
    alignItems: "flex-end",
    opacity: 0.2,
  },
  mobileBrandCircleLight: {
    width: 48,
    height: 48,
    borderRadius: 48,
    backgroundColor: "rgba(255,255,255,0.45)",
  },
  mobileBrandCircleBlue: {
    width: 48,
    height: 48,
    borderRadius: 48,
    backgroundColor: "rgba(176,190,197,0.62)",
    marginLeft: -12,
  },
  mobileFormArea: {
    flex: 1,
    paddingTop: 26,
  },
  mobileWelcomeBlock: {
    marginBottom: 22,
  },
  mobileWelcomeTitle: {
    fontSize: 26,
    lineHeight: 32,
    color: loginColors.textPrimary,
    letterSpacing: -0.3,
    fontFamily: "DMSans-SemiBold",
    marginBottom: 8,
  },
  mobileWelcomeSubtitle: {
    fontSize: 15,
    lineHeight: 22,
    color: loginColors.textSecondary,
    fontFamily: "DMSans",
  },
  inputLabel: {
    fontSize: 13,
    lineHeight: 20,
    color: loginColors.textSecondary,
    marginBottom: 8,
    fontFamily: "DMSans-Medium",
  },
  input: {
    width: "100%",
    borderWidth: 1.5,
    borderColor: loginColors.border,
    borderRadius: 14,
    paddingVertical: 15,
    paddingHorizontal: 18,
    fontSize: 16,
    lineHeight: 22,
    color: loginColors.textPrimary,
    backgroundColor: loginColors.surface,
    fontFamily: "DMSans",
  },
  inputFocused: {
    borderColor: loginColors.accent,
    shadowColor: loginColors.accent,
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  inputError: {
    borderColor: loginColors.error,
  },
  primaryButton: {
    width: "100%",
    marginTop: 16,
    paddingVertical: 16,
    borderRadius: 14,
    backgroundColor: loginColors.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  otpVerifyButton: {
    marginTop: 0,
    flex: 1,
  },
  primaryButtonDisabled: {
    opacity: 0.58,
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    lineHeight: 22,
    fontFamily: "DMSans-Medium",
  },
  helperText: {
    marginTop: 20,
    fontSize: 13,
    lineHeight: 20,
    color: loginColors.textTertiary,
    textAlign: "center",
    fontFamily: "DMSans",
  },
  cooldownText: {
    marginTop: 10,
    fontSize: 12.5,
    lineHeight: 18,
    color: loginColors.textSecondary,
    textAlign: "center",
    fontFamily: "DMSans",
  },
  errorText: {
    marginTop: 10,
    fontSize: 12.5,
    lineHeight: 18,
    color: loginColors.error,
    textAlign: "center",
    fontFamily: "DMSans-Medium",
  },
  otpTitle: {
    fontSize: 26,
    lineHeight: 32,
    color: loginColors.textPrimary,
    letterSpacing: -0.3,
    fontFamily: "DMSans-SemiBold",
    marginBottom: 8,
  },
  otpDescription: {
    fontSize: 15,
    lineHeight: 22,
    color: loginColors.textSecondary,
    fontFamily: "DMSans",
    marginBottom: 22,
  },
  otpActions: {
    marginTop: 16,
    flexDirection: "row",
    gap: 12,
  },
  secondaryButton: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: loginColors.border,
    backgroundColor: loginColors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryButtonDisabled: {
    opacity: 0.65,
  },
  secondaryButtonText: {
    color: loginColors.textPrimary,
    fontSize: 16,
    lineHeight: 22,
    fontFamily: "DMSans-Medium",
  },
  desktopRoot: {
    flex: 1,
    flexDirection: "row",
  },
  brandPanel: {
    flex: 1,
    minHeight: "100%",
    backgroundColor: loginColors.brandPanel,
    paddingVertical: 48,
    paddingHorizontal: 56,
    justifyContent: "space-between",
  },
  brandTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  brandLogoWrap: {
    width: 48,
    height: 48,
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: loginColors.surface,
  },
  brandLogo: {
    width: "100%",
    height: "100%",
  },
  brandWordmark: {
    fontSize: 22,
    lineHeight: 28,
    color: "#FFFFFF",
    letterSpacing: -0.3,
    fontFamily: "DMSans-SemiBold",
  },
  brandCenter: {
    flex: 1,
    justifyContent: "center",
    maxWidth: 460,
  },
  brandHeadline: {
    fontSize: 44,
    lineHeight: 50,
    color: "#FFFFFF",
    letterSpacing: -1,
    fontFamily: "DMSans-SemiBold",
    marginBottom: 20,
  },
  brandSub: {
    fontSize: 17,
    lineHeight: 27,
    color: "rgba(255,255,255,0.58)",
    fontFamily: "DMSans",
    maxWidth: 400,
  },
  brandFeatureList: {
    marginTop: 42,
    gap: 15,
  },
  brandFeatureItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  brandFeatureDot: {
    width: 8,
    height: 8,
    borderRadius: 8,
    backgroundColor: loginColors.blueMuted,
    flexShrink: 0,
  },
  brandFeatureText: {
    fontSize: 14,
    lineHeight: 20,
    color: "rgba(255,255,255,0.56)",
    fontFamily: "DMSans",
  },
  formPanel: {
    width: 440,
    maxWidth: 440,
    minHeight: "100%",
    backgroundColor: loginColors.bg,
    paddingHorizontal: 48,
    paddingVertical: 48,
    justifyContent: "center",
    position: "relative",
    overflow: "hidden",
  },
  formPanelInner: {
    width: "100%",
    maxWidth: 380,
    alignSelf: "center",
  },
  webTitle: {
    fontSize: 26,
    lineHeight: 32,
    color: loginColors.textPrimary,
    letterSpacing: -0.3,
    fontFamily: "DMSans-SemiBold",
    marginBottom: 8,
  },
  webSubtitle: {
    fontSize: 15,
    lineHeight: 22,
    color: loginColors.textSecondary,
    fontFamily: "DMSans",
    marginBottom: 34,
  },
  webFooter: {
    marginTop: 30,
    paddingTop: 24,
    borderTopWidth: 1,
    borderTopColor: loginColors.border,
  },
  webFooterText: {
    fontSize: 12,
    lineHeight: 19,
    color: loginColors.textTertiary,
    textAlign: "center",
    fontFamily: "DMSans",
  },
  webCircles: {
    position: "absolute",
    right: 48,
    bottom: 48,
    flexDirection: "row",
    alignItems: "flex-end",
    opacity: 0.12,
  },
  webCircleDark: {
    width: 72,
    height: 72,
    borderRadius: 72,
    backgroundColor: loginColors.textPrimary,
    zIndex: 1,
  },
  webCircleBlue: {
    width: 72,
    height: 72,
    borderRadius: 72,
    backgroundColor: loginColors.blueMuted,
    marginLeft: -18,
  },
});
