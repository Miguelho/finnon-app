import { useEffect, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Pressable,
  Modal,
  TouchableOpacity,
} from "react-native";
import {
  ALLOWED_AVATAR_BG_TOKENS,
  ConfirmationModal,
  mapUserToUserDetailsVM,
  normalizeAvatarFallbackText,
  resolveAvatarColor,
  resolveAvatarFallback,
  signOutAndReset,
  themeTokens,
  type AvatarColorToken,
} from "@poleursus/shared";
import * as ImagePicker from "expo-image-picker";
import { useAuth } from "../../../src/contexts/AuthContext";
import { useNetworkNotice } from "../../../src/contexts/NetworkNoticeContext";
import { useCopy, t } from "../../../src/lib/i18n";
import { Button } from "../../../src/components/Button";
import { Input } from "../../../src/components/Input";
import { UserAvatar } from "../../../src/components/UserAvatar";
import { supabase } from "../../../src/lib/supabase";
import { useRouter } from "expo-router";

const tokens = themeTokens.light;
const colors = tokens.colors;
const MAX_AVATAR_BYTES = 5 * 1024 * 1024;
const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"];

export default function UserDetailsScreen() {
  const { user, loading, clearSelectedAccount } = useAuth();
  const { dictionary } = useCopy();
  const { reportNetworkIssue } = useNetworkNotice();
  const [avatarPath, setAvatarPath] = useState<string | null>(null);
  const [profileEmail, setProfileEmail] = useState<string | null>(null);
  const [fallbackText, setFallbackText] = useState<string | null>(null);
  const [fallbackBgToken, setFallbackBgToken] =
    useState<AvatarColorToken | null>(null);
  const [isProfileLoading, setIsProfileLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [avatarVersion, setAvatarVersion] = useState(0);
  const [isFallbackEditorOpen, setIsFallbackEditorOpen] = useState(false);
  const [draftText, setDraftText] = useState("");
  const [draftBgToken, setDraftBgToken] =
    useState<AvatarColorToken | null>(null);
  const router = useRouter();
  const [isSignOutOpen, setIsSignOutOpen] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);

  const closeSignOutModal = () => {
    if (!isSigningOut) setIsSignOutOpen(false);
  };

  useEffect(() => {
    let cancelled = false;

    async function loadProfile() {
      if (!user?.id) return;
      setIsProfileLoading(true);
      const { data, error: profileError } = await supabase
        .from("profiles")
        .select(
          "avatar_path, email, avatar_fallback_text, avatar_fallback_bg_token"
        )
        .eq("user_id", user.id)
        .maybeSingle();

      if (cancelled) return;

      if (profileError) {
        setError(t(dictionary, "settings.userDetails.avatar.uploadError"));
        setIsProfileLoading(false);
        return;
      }

      setAvatarPath(data?.avatar_path ?? null);
      setFallbackText(data?.avatar_fallback_text ?? null);
      const bgToken = ALLOWED_AVATAR_BG_TOKENS.includes(
        data?.avatar_fallback_bg_token as AvatarColorToken
      )
        ? (data?.avatar_fallback_bg_token as AvatarColorToken)
        : null;
      setFallbackBgToken(bgToken);
      setProfileEmail(data?.email ?? null);
      setIsProfileLoading(false);
    }

    loadProfile();
    return () => {
      cancelled = true;
    };
  }, [dictionary, user?.id]);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={tokens.colors.text.muted} />
        <Text style={styles.loadingText}>
          {t(dictionary, "settings.userDetails.loading")}
        </Text>
      </View>
    );
  }

  if (!user) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>
          {t(dictionary, "settings.userDetails.error")}
        </Text>
      </View>
    );
  }

  const viewModel = mapUserToUserDetailsVM(user);
  const emailValue = profileEmail ?? viewModel.email;
  const fallbackPreview = resolveAvatarFallback(
    {
      avatar_fallback_text: draftText || null,
      avatar_fallback_bg_token: draftBgToken ?? null,
    },
    emailValue,
    user.id
  );

  const handlePickAvatar = async () => {
    if (!user?.id) return;
    setError(null);

    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (permission.status !== "granted") {
      Alert.alert(
        t(dictionary, "common.errorTitle"),
        t(dictionary, "settings.userDetails.avatar.permissionError")
      );
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.9,
    });

    if (result.canceled || result.assets.length === 0) return;

    const asset = result.assets[0];
    const mimeType = asset.mimeType || "image/jpeg";

    if (!ALLOWED_MIME_TYPES.includes(mimeType)) {
      setError(t(dictionary, "settings.userDetails.avatar.typeError"));
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch(asset.uri);
      const blob = await response.blob();

      if (blob.size > MAX_AVATAR_BYTES) {
        setError(t(dictionary, "settings.userDetails.avatar.sizeError"));
        setIsSubmitting(false);
        return;
      }

      const extension =
        asset.fileName?.split(".").pop()?.toLowerCase() ||
        asset.uri.split(".").pop()?.toLowerCase() ||
        "jpg";
      const path = `${user.id}/avatar.${extension}`;

      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(path, blob, { contentType: mimeType, upsert: true });

      if (uploadError) {
        throw uploadError;
      }

      const { error: updateError } = await supabase
        .from("profiles")
        .update({ avatar_path: path })
        .eq("user_id", user.id);

      if (updateError) {
        await supabase.storage.from("avatars").remove([path]);
        throw updateError;
      }

      setAvatarPath(path);
      setAvatarVersion(Date.now());
    } catch (err) {
      console.error("[UserDetails] Avatar upload error:", err);
      setError(t(dictionary, "settings.userDetails.avatar.uploadError"));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRemoveAvatar = async () => {
    if (!user?.id || !avatarPath) return;
    setError(null);
    setAvatarPath(null);
    setIsSubmitting(true);

    try {
      const previousPath = avatarPath;
      const { error: removeError } = await supabase.storage
        .from("avatars")
        .remove([previousPath]);

      const { error: updateError } = await supabase
        .from("profiles")
        .update({ avatar_path: null })
        .eq("user_id", user.id);

      if (updateError) {
        setAvatarPath(previousPath);
        throw updateError;
      }

      if (removeError) {
        setError(t(dictionary, "settings.userDetails.avatar.removeError"));
      }
    } catch (err) {
      console.error("[UserDetails] Avatar remove error:", err);
      setError(t(dictionary, "settings.userDetails.avatar.removeError"));
    } finally {
      setAvatarVersion(Date.now());
      setIsSubmitting(false);
    }
  };

  const handleOpenEditor = () => {
    setError(null);
    setDraftText(normalizeAvatarFallbackText(fallbackText) ?? "");
    setDraftBgToken(fallbackBgToken ?? null);
    setIsFallbackEditorOpen(true);
  };

  const handleDraftTextChange = (value: string) => {
    const normalized = normalizeAvatarFallbackText(value);
    setDraftText(normalized ?? "");
  };

  const handleRandomizeBg = () => {
    const options = ALLOWED_AVATAR_BG_TOKENS.filter(
      (token) => token !== draftBgToken
    );
    if (options.length === 0) return;
    const next = options[Math.floor(Math.random() * options.length)];
    setDraftBgToken(next);
  };

  const handleSaveFallback = async () => {
    if (!user?.id) return;
    setIsSubmitting(true);
    setError(null);

    const previousText = fallbackText;
    const previousToken = fallbackBgToken;
    const nextText = normalizeAvatarFallbackText(draftText);
    const nextToken = ALLOWED_AVATAR_BG_TOKENS.includes(
      draftBgToken as AvatarColorToken
    )
      ? draftBgToken
      : null;

    setFallbackText(nextText);
    setFallbackBgToken(nextToken);

    const { error: updateError } = await supabase
      .from("profiles")
      .update({
        avatar_fallback_text: nextText,
        avatar_fallback_bg_token: nextToken,
      })
      .eq("user_id", user.id);

    if (updateError) {
      setFallbackText(previousText);
      setFallbackBgToken(previousToken);
      setError(t(dictionary, "settings.userDetails.avatar.fallbackError"));
      setIsSubmitting(false);
      return;
    }

    setIsSubmitting(false);
    setIsFallbackEditorOpen(false);
  };

  const handleSignOut = async () => {
    setIsSigningOut(true);

    try {
      await signOutAndReset({
        signOut: () => supabase.auth.signOut(),
        clearLocalSessionArtifacts: clearSelectedAccount,
        onReset: () => {
          setIsSignOutOpen(false);
        },
        onNavigate: () => {
          router.replace("/(auth)/login");
        },
      });
    } catch (err) {
      console.error("[UserDetails] Sign out failed:", err);
      reportNetworkIssue({
        message: t(dictionary, "settings.signOut.error"),
        onRetry: handleSignOut,
      });
    } finally {
      setIsSigningOut(false);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.subtitle}>
          {t(dictionary, "settings.userDetails.subtitle")}
        </Text>
      </View>

      <View style={styles.card}>
        <View style={styles.avatarHeader}>
          <Text style={styles.avatarTitle}>
            {t(dictionary, "settings.userDetails.avatar.title")}
          </Text>
          <Text style={styles.avatarDescription}>
            {t(dictionary, "settings.userDetails.avatar.description")}
          </Text>
        </View>
        <View style={styles.avatarRow}>
          <UserAvatar
            email={emailValue}
            userId={user.id}
            avatarPath={avatarPath}
            fallbackText={fallbackText}
            fallbackBgToken={fallbackBgToken}
            size={72}
            label={emailValue}
            cacheKey={avatarVersion}
          />
          <View style={styles.avatarActions}>
            <Button
              title={t(dictionary, "settings.userDetails.avatar.edit")}
              onPress={handleOpenEditor}
              disabled={isProfileLoading || isSubmitting}
            />
          </View>
        </View>
        {error ? <Text style={styles.avatarError}>{error}</Text> : null}
      </View>

      <View style={styles.card}>
        <View style={styles.field}>
          <Text style={styles.label}>
            {t(dictionary, "settings.userDetails.fields.email")}
          </Text>
          <Text style={styles.value}>{emailValue}</Text>
        </View>

        <View style={styles.divider} />

        <View style={styles.field}>
          <Text style={styles.label}>
            {t(dictionary, "settings.userDetails.fields.id")}
          </Text>
          <Text style={styles.valueSmall}>{viewModel.userId}</Text>
        </View>
      </View>

      <View style={styles.signOutSection}>
        <View style={styles.signOutDivider} />
        <TouchableOpacity
          onPress={() => setIsSignOutOpen(true)}
          disabled={isSigningOut}
          style={styles.signOutRow}
        >
          <View>
            <Text style={styles.signOutTitle}>
              {t(dictionary, "settings.signOut.label")}
            </Text>
            <Text style={styles.signOutDescription}>
              {t(dictionary, "settings.signOut.description")}
            </Text>
          </View>
          <Text style={styles.signOutChevron}>›</Text>
        </TouchableOpacity>
      </View>

      <ConfirmationModal
        open={isSignOutOpen}
        title={t(dictionary, "settings.signOut.confirmTitle")}
        description={t(dictionary, "settings.signOut.confirmDescription")}
        confirmLabel={t(dictionary, "settings.signOut.confirmAction")}
        cancelLabel={t(dictionary, "settings.signOut.confirmCancel")}
        onConfirm={handleSignOut}
        onCancel={closeSignOutModal}
        confirmLoading={isSigningOut}
        confirmDisabled={isSigningOut}
        cancelDisabled={isSigningOut}
        dismissOnBackdrop={!isSigningOut}
        tone="destructive"
      />

      <Modal
        transparent
        visible={isFallbackEditorOpen}
        animationType="slide"
        onRequestClose={() => setIsFallbackEditorOpen(false)}
      >
        <View style={styles.sheetOverlay}>
          <Pressable
            style={styles.sheetBackdrop}
            onPress={() => setIsFallbackEditorOpen(false)}
          />
          <View style={styles.sheetContainer}>
            <View style={styles.sheetHandle} />
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>
                {t(dictionary, "settings.userDetails.avatar.editorTitle")}
              </Text>
              <Text style={styles.sheetSubtitle}>
                {t(dictionary, "settings.userDetails.avatar.editorDescription")}
              </Text>
            </View>

            <View style={styles.sheetSection}>
              <View style={styles.sheetRow}>
                <UserAvatar
                  email={emailValue}
                  userId={user.id}
                  avatarPath={null}
                  fallbackText={fallbackPreview.text}
                  fallbackBgToken={fallbackPreview.bgToken}
                  size={64}
                  label={emailValue}
                />
                <Text style={styles.sheetHint}>
                  {t(dictionary, "settings.userDetails.avatar.fallbackHint")}
                </Text>
              </View>

              <View style={styles.sheetField}>
                <View style={styles.inlineHeader}>
                  <Text style={styles.inlineLabel}>
                    {t(dictionary, "settings.userDetails.avatar.letterLabel")}
                  </Text>
                  <TouchableOpacity
                    onPress={() => setDraftText("")}
                    disabled={isSubmitting}
                  >
                    <Text style={styles.inlineAction}>
                      {t(dictionary, "settings.userDetails.avatar.letterReset")}
                    </Text>
                  </TouchableOpacity>
                </View>
                <Input
                  label=""
                  value={draftText}
                  onChangeText={handleDraftTextChange}
                  maxLength={1}
                  placeholder={fallbackPreview.text}
                  disabled={isSubmitting}
                />
              </View>

              <View style={styles.sheetField}>
                <View style={styles.inlineHeader}>
                  <Text style={styles.inlineLabel}>
                    {t(dictionary, "settings.userDetails.avatar.backgroundLabel")}
                  </Text>
                  <View style={styles.inlineActions}>
                    <TouchableOpacity
                      onPress={() => setDraftBgToken(null)}
                      disabled={isSubmitting}
                    >
                      <Text style={styles.inlineAction}>
                        {t(dictionary, "settings.userDetails.avatar.backgroundReset")}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={handleRandomizeBg}
                      disabled={isSubmitting}
                    >
                      <Text style={styles.inlineAction}>
                        {t(dictionary, "settings.userDetails.avatar.backgroundRandom")}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
                <View style={styles.swatchGrid}>
                  {ALLOWED_AVATAR_BG_TOKENS.map((token) => {
                    const color = resolveAvatarColor(tokens, token);
                    const isSelected = draftBgToken === token;
                    return (
                      <TouchableOpacity
                        key={token}
                        onPress={() =>
                          setDraftBgToken(isSelected ? null : token)
                        }
                        style={[
                          styles.swatch,
                          { backgroundColor: color },
                          isSelected && styles.swatchSelected,
                        ]}
                      />
                    );
                  })}
                </View>
              </View>

              {avatarPath ? (
                <View style={styles.photoActions}>
                  <Button
                    title={t(dictionary, "settings.userDetails.avatar.changePhoto")}
                    onPress={handlePickAvatar}
                    disabled={isSubmitting}
                  />
                  <Button
                    title={t(dictionary, "settings.userDetails.avatar.removePhoto")}
                    onPress={handleRemoveAvatar}
                    disabled={isSubmitting}
                    variant="secondary"
                  />
                </View>
              ) : (
                <Button
                  title={t(dictionary, "settings.userDetails.avatar.changePhoto")}
                  onPress={handlePickAvatar}
                  disabled={isSubmitting}
                />
              )}
            </View>

            {error ? <Text style={styles.sheetError}>{error}</Text> : null}

            <View style={styles.sheetActions}>
              <Button
                title={t(dictionary, "settings.userDetails.avatar.cancel")}
                onPress={() => setIsFallbackEditorOpen(false)}
                variant="secondary"
                disabled={isSubmitting}
              />
              <Button
                title={t(dictionary, "settings.userDetails.avatar.save")}
                onPress={handleSaveFallback}
                disabled={isSubmitting}
                loading={isSubmitting}
              />
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: tokens.colors.bg.primary,
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: tokens.colors.bg.primary,
    padding: tokens.spacing.lg,
  },
  loadingText: {
    marginTop: tokens.spacing.md,
    fontSize: tokens.typography.size.sm,
    color: tokens.colors.text.muted,
  },
  errorText: {
    fontSize: tokens.typography.size.md,
    color: tokens.colors.text.secondary,
    textAlign: "center",
  },
  header: {
    paddingHorizontal: tokens.spacing.lg,
    paddingTop: tokens.spacing.lg,
    paddingBottom: tokens.spacing.md,
  },
  subtitle: {
    fontSize: tokens.typography.size.sm,
    color: tokens.colors.text.secondary,
  },
  avatarHeader: {
    paddingHorizontal: tokens.spacing.lg,
    paddingTop: tokens.spacing.md,
  },
  avatarTitle: {
    fontSize: tokens.typography.size.md,
    fontWeight: tokens.typography.weight.semibold,
    color: tokens.colors.text.primary,
  },
  avatarDescription: {
    marginTop: tokens.spacing.xs,
    fontSize: tokens.typography.size.sm,
    color: tokens.colors.text.secondary,
  },
  avatarRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: tokens.spacing.lg,
    paddingHorizontal: tokens.spacing.lg,
    paddingVertical: tokens.spacing.md,
  },
  avatarActions: {
    flex: 1,
    gap: tokens.spacing.sm,
  },
  avatarError: {
    paddingHorizontal: tokens.spacing.lg,
    paddingBottom: tokens.spacing.md,
    fontSize: tokens.typography.size.sm,
    color: tokens.colors.state.negative,
  },
  sheetOverlay: {
    flex: 1,
    justifyContent: "flex-end",
  },
  sheetBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
  },
  sheetContainer: {
    backgroundColor: tokens.colors.bg.surface,
    borderTopLeftRadius: tokens.radii.lg,
    borderTopRightRadius: tokens.radii.lg,
    paddingBottom: tokens.spacing.lg,
    paddingHorizontal: tokens.spacing.lg,
  },
  sheetHandle: {
    width: 40,
    height: 4,
    borderRadius: tokens.radii.pill,
    backgroundColor: tokens.colors.state.neutral,
    alignSelf: "center",
    marginTop: tokens.spacing.sm,
  },
  sheetHeader: {
    paddingTop: tokens.spacing.lg,
    paddingBottom: tokens.spacing.sm,
  },
  sheetTitle: {
    fontSize: tokens.typography.size.lg,
    fontWeight: tokens.typography.weight.bold,
    color: tokens.colors.text.primary,
  },
  sheetSubtitle: {
    marginTop: tokens.spacing.xs,
    fontSize: tokens.typography.size.sm,
    color: tokens.colors.text.secondary,
  },
  sheetSection: {
    gap: tokens.spacing.md,
  },
  sheetRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: tokens.spacing.md,
  },
  sheetHint: {
    flex: 1,
    fontSize: tokens.typography.size.sm,
    color: tokens.colors.text.secondary,
  },
  sheetField: {
    gap: tokens.spacing.sm,
  },
  inlineHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  inlineLabel: {
    fontSize: tokens.typography.size.sm,
    fontWeight: tokens.typography.weight.semibold,
    color: tokens.colors.text.primary,
  },
  inlineActions: {
    flexDirection: "row",
    gap: tokens.spacing.md,
  },
  inlineAction: {
    fontSize: tokens.typography.size.sm,
    color: tokens.colors.text.secondary,
  },
  swatchGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: tokens.spacing.sm,
  },
  swatch: {
    width: 36,
    height: 36,
    borderRadius: tokens.radii.pill,
    borderWidth: 1,
    borderColor: tokens.colors.state.neutral,
  },
  swatchSelected: {
    borderColor: tokens.colors.text.primary,
    borderWidth: 2,
  },
  photoActions: {
    gap: tokens.spacing.sm,
  },
  sheetError: {
    marginTop: tokens.spacing.sm,
    fontSize: tokens.typography.size.sm,
    color: tokens.colors.state.negative,
  },
  sheetActions: {
    marginTop: tokens.spacing.md,
    gap: tokens.spacing.sm,
  },
  card: {
    backgroundColor: tokens.colors.bg.surface,
    marginTop: tokens.spacing.md,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: tokens.colors.state.neutral,
  },
  field: {
    paddingVertical: tokens.spacing.md,
    paddingHorizontal: tokens.spacing.lg,
  },
  label: {
    fontSize: tokens.typography.size.xs,
    fontWeight: tokens.typography.weight.medium,
    color: tokens.colors.text.muted,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: tokens.spacing.xs,
  },
  value: {
    fontSize: tokens.typography.size.md,
    color: tokens.colors.text.primary,
  },
  valueSmall: {
    fontSize: tokens.typography.size.sm,
    color: tokens.colors.text.secondary,
    fontFamily: "monospace",
  },
  divider: {
    height: 1,
    backgroundColor: tokens.colors.state.neutral,
    marginHorizontal: tokens.spacing.lg,
  },
  signOutSection: {
    marginTop: tokens.spacing.md,
  },
  signOutDivider: {
    height: 1,
    backgroundColor: tokens.colors.state.neutral,
    marginBottom: tokens.spacing.md,
    marginHorizontal: tokens.spacing.lg,
  },
  signOutRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: tokens.spacing.sm,
    paddingHorizontal: tokens.spacing.lg,
  },
  signOutTitle: {
    fontSize: tokens.typography.size.md,
    fontWeight: tokens.typography.weight.semibold,
    color: colors.state.negative,
  },
  signOutDescription: {
    fontSize: tokens.typography.size.sm,
    color: tokens.colors.text.secondary,
    marginTop: tokens.spacing.xs,
  },
  signOutChevron: {
    fontSize: tokens.typography.size.xl,
    color: tokens.colors.text.muted,
    marginLeft: tokens.spacing.md,
  },
});
