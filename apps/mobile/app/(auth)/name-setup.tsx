import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Redirect, useRouter } from "expo-router";
import { themeTokens } from "@poleursus/shared";
import { useAuth } from "../../src/contexts/AuthContext";
import { useUserTheme } from "../../src/contexts/UserThemeContext";
import { Button } from "../../src/components/Button";
import { Input } from "../../src/components/Input";
import { useCopy, t } from "../../src/lib/i18n";
import { supabase } from "../../src/lib/supabase";

const tokens = themeTokens.light;

export default function NameSetupScreen() {
  const router = useRouter();
  const { dictionary } = useCopy();
  const { session, user, loading, isInitialized } = useAuth();
  const effectiveUser = user ?? session?.user ?? null;
  const { tokens: userTokens } = useUserTheme();
  const [displayName, setDisplayName] = useState("");
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const normalizedName = useMemo(() => displayName.trim(), [displayName]);

  useEffect(() => {
    let cancelled = false;

    async function loadDisplayName() {
      if (!isInitialized || loading || !session || !effectiveUser?.id) {
        if (!cancelled) setIsLoadingProfile(false);
        return;
      }

      const metadataName =
        (typeof effectiveUser.user_metadata?.display_name === "string"
          ? effectiveUser.user_metadata.display_name
          : typeof effectiveUser.user_metadata?.full_name === "string"
            ? effectiveUser.user_metadata.full_name
            : ""
        ).trim();

      const { data, error } = await supabase
        .from("profiles")
        .select("display_name")
        .eq("user_id", effectiveUser.id)
        .maybeSingle();

      if (cancelled) return;

      if (error) {
        console.error("[NameSetup] Failed to load profile display_name:", error);
      }

      const profileName =
        typeof data?.display_name === "string" ? data.display_name.trim() : "";
      const resolvedName = profileName || metadataName;

      if (resolvedName) {
        router.replace("/");
        setIsLoadingProfile(false);
        return;
      }

      setDisplayName(metadataName);
      setIsLoadingProfile(false);
    }

    void loadDisplayName();
    return () => {
      cancelled = true;
    };
  }, [
    isInitialized,
    loading,
    router,
    session,
    effectiveUser?.id,
    effectiveUser?.user_metadata?.display_name,
    effectiveUser?.user_metadata?.full_name,
  ]);

  const handleContinue = async () => {
    if (!session || !effectiveUser?.id || isSaving || !normalizedName) return;

    setIsSaving(true);
    setError(null);

    const { error } = await supabase.auth.updateUser({
      data: {
        display_name: normalizedName,
        full_name: normalizedName,
      },
    });

    if (error) {
      console.error("[NameSetup] Failed to save display_name:", error);
      setError(t(dictionary, "settings.userProfile.errors.saveDisplayName"));
      setIsSaving(false);
      return;
    }

    setIsSaving(false);
    router.replace("/");
  };

  if (!isInitialized || loading || isLoadingProfile) {
    return (
      <View style={[styles.loader, { backgroundColor: userTokens.background }]}>
        <ActivityIndicator size="large" color={userTokens.textSecondary} />
      </View>
    );
  }

  if (!session || !effectiveUser) {
    return <Redirect href="/(auth)/login" />;
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={[styles.container, { backgroundColor: userTokens.background }]}
    >
      <ScrollView contentContainerStyle={styles.content}>
        <View
          style={[
            styles.card,
            { backgroundColor: userTokens.surface, borderColor: userTokens.border },
          ]}
        >
          <Text style={[styles.title, { color: userTokens.textPrimary }]}>
            {t(dictionary, "nameSetup.title")}
          </Text>
          <Text style={[styles.subtitle, { color: userTokens.textSecondary }]}>
            {t(dictionary, "nameSetup.subtitle")}
          </Text>

          <Input
            label={t(dictionary, "nameSetup.label")}
            value={displayName}
            onChangeText={setDisplayName}
            placeholder={t(dictionary, "nameSetup.placeholder")}
            maxLength={80}
            inputStyle={{ backgroundColor: userTokens.surfaceAlt }}
          />

          {error ? (
            <Text style={[styles.errorText, { color: userTokens.dangerText }]}>
              {error}
            </Text>
          ) : null}

          <Button
            title={
              isSaving ? t(dictionary, "common.saving") : t(dictionary, "nameSetup.continue")
            }
            onPress={handleContinue}
            disabled={!normalizedName || isSaving}
          />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loader: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  content: {
    flexGrow: 1,
    justifyContent: "center",
    padding: tokens.spacing.lg,
  },
  card: {
    borderWidth: 1,
    borderRadius: tokens.radii.lg,
    padding: tokens.spacing.lg,
  },
  title: {
    fontSize: tokens.typography.size.xl,
    fontWeight: tokens.typography.weight.bold,
    marginBottom: tokens.spacing.xs,
  },
  subtitle: {
    fontSize: tokens.typography.size.sm,
    marginBottom: tokens.spacing.lg,
  },
  errorText: {
    fontSize: tokens.typography.size.xs,
    marginBottom: tokens.spacing.md,
  },
});
