import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { Stack, useRouter, useSegments } from "expo-router";
import { themeTokens } from "@poleursus/shared";
import { useCopy, t } from "../../src/lib/i18n";
import { useAuth } from "../../src/contexts/AuthContext";
import { useStackScreenOptions } from "../../src/lib/navigation-presets";
import { SettingsHeaderBackButton } from "../../src/components/navigation/SettingsHeaderBackButton";
import { supabase } from "../../src/lib/supabase";

const tokens = themeTokens.light;
const DISPLAY_NAME_GATE_EXEMPT_SEGMENTS = new Set(["name-setup"]);
type DisplayNameGateStatus = "idle" | "checking" | "required" | "complete";

export default function AuthLayout() {
  const { dictionary } = useCopy();
  const { session, user, loading, isInitialized } = useAuth();
  const stackScreenOptions = useStackScreenOptions();
  const router = useRouter();
  const segments = useSegments();
  const [displayNameGateStatus, setDisplayNameGateStatus] =
    useState<DisplayNameGateStatus>("idle");
  const hasResolvedDisplayNameGateRef = useRef(false);

  useEffect(() => {
    let cancelled = false;

    async function resolveDisplayNameStatus() {
      if (!isInitialized || loading || !session || !user?.id) {
        if (!cancelled) {
          hasResolvedDisplayNameGateRef.current = false;
          setDisplayNameGateStatus("idle");
        }
        return;
      }

      if (!cancelled && !hasResolvedDisplayNameGateRef.current) {
        setDisplayNameGateStatus("checking");
      }

      const metadataDisplayName =
        (typeof user.user_metadata?.display_name === "string"
          ? user.user_metadata.display_name
          : typeof user.user_metadata?.full_name === "string"
            ? user.user_metadata.full_name
            : ""
        ).trim();

      const { data, error } = await supabase
        .from("profiles")
        .select("display_name")
        .eq("user_id", user.id)
        .maybeSingle();

      if (cancelled) return;

      const profileDisplayName =
        typeof data?.display_name === "string" ? data.display_name.trim() : "";
      const hasDisplayName = Boolean(profileDisplayName || metadataDisplayName);

      if (error) {
        console.error("[AuthLayout] display_name gate error:", error);
      }

      hasResolvedDisplayNameGateRef.current = true;
      setDisplayNameGateStatus(hasDisplayName ? "complete" : "required");
    }

    void resolveDisplayNameStatus();
    return () => {
      cancelled = true;
    };
  }, [
    isInitialized,
    loading,
    session?.access_token,
    user?.id,
    user?.user_metadata?.display_name,
    user?.user_metadata?.full_name,
  ]);

  useEffect(() => {
    if (!isInitialized || loading || !session || !user?.id) return;
    if (displayNameGateStatus === "idle" || displayNameGateStatus === "checking") {
      return;
    }

    const isNameSetupRoute = segments.some((segment) =>
      DISPLAY_NAME_GATE_EXEMPT_SEGMENTS.has(segment)
    );

    if (displayNameGateStatus === "required" && !isNameSetupRoute) {
      router.replace("/(auth)/name-setup");
      return;
    }

    if (displayNameGateStatus === "complete" && isNameSetupRoute) {
      router.replace("/");
    }
  }, [
    displayNameGateStatus,
    isInitialized,
    loading,
    router,
    segments,
    session?.access_token,
    user?.id,
  ]);

  const shouldShowGateLoader =
    session &&
    user?.id &&
    !hasResolvedDisplayNameGateRef.current &&
    (displayNameGateStatus === "idle" || displayNameGateStatus === "checking");

  if (shouldShowGateLoader) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color={tokens.colors.text.muted} />
      </View>
    );
  }

  return (
    <Stack screenOptions={stackScreenOptions}>
      <Stack.Screen
        name="login"
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="name-setup"
        options={{
          headerShown: false,
          gestureEnabled: false,
        }}
      />
      <Stack.Screen
        name="onboarding"
        options={{
          headerShown: false,
          gestureEnabled: false,
        }}
      />
      <Stack.Screen
        name="select-account"
        options={{
          headerShown: false,
          gestureEnabled: false,
        }}
      />
      <Stack.Screen
        name="(tabs)"
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="transactions"
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="account/[id]"
        options={{
          headerShown: true,
          title: t(dictionary, "account.labelAccount"),
        }}
      />
      <Stack.Screen
        name="settings/index"
        options={{
          headerShown: true,
          title: t(dictionary, "settings.title"),
          headerLeft: (props) => <SettingsHeaderBackButton {...props} />,
        }}
      />
      <Stack.Screen
        name="settings/account/index"
        options={{
          headerShown: true,
          title: t(dictionary, "settings.menu.sections.account.items.general.title"),
          headerLeft: (props) => <SettingsHeaderBackButton {...props} />,
        }}
      />
      <Stack.Screen
        name="settings/account/general"
        options={{
          headerShown: true,
          title: t(dictionary, "settings.menu.sections.account.items.general.title"),
          headerLeft: (props) => <SettingsHeaderBackButton {...props} />,
        }}
      />
      <Stack.Screen
        name="settings/account/members"
        options={{
          headerShown: true,
          title: t(dictionary, "settings.menu.sections.account.items.members.title"),
          headerLeft: (props) => <SettingsHeaderBackButton {...props} />,
        }}
      />
      <Stack.Screen
        name="settings/account/categories"
        options={{
          headerShown: true,
          title: t(dictionary, "settings.menu.sections.account.items.categories.title"),
          headerLeft: (props) => <SettingsHeaderBackButton {...props} />,
        }}
      />
      <Stack.Screen
        name="settings/user-details"
        options={{
          headerShown: true,
          title: t(dictionary, "settings.userProfile.title"),
          headerLeft: (props) => <SettingsHeaderBackButton {...props} />,
        }}
      />
      <Stack.Screen
        name="settings/invitations"
        options={{
          headerShown: true,
          title: t(dictionary, "invites.title"),
          headerLeft: (props) => <SettingsHeaderBackButton {...props} />,
        }}
      />
      <Stack.Screen
        name="invitations"
        options={{
          headerShown: true,
          title: t(dictionary, "invitations.title"),
        }}
      />
      <Stack.Screen
        name="settings/language"
        options={{
          headerShown: true,
          title: t(dictionary, "settings.language.title"),
          headerLeft: (props) => <SettingsHeaderBackButton {...props} />,
        }}
      />
      <Stack.Screen
        name="transaction/recurrent/index"
        options={{
          headerShown: true,
          title: t(dictionary, "recurrentes.title"),
        }}
      />
      <Stack.Screen
        name="transaction/recurrent/[id]"
        options={{
          headerShown: true,
          title: t(dictionary, "recurrentes.edit"),
        }}
      />
    </Stack>
  );
}

const styles = StyleSheet.create({
  loader: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: tokens.colors.bg.primary,
  },
});
