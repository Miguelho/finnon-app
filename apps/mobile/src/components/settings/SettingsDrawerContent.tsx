import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import {
  DrawerContentComponentProps,
  DrawerContentScrollView,
} from "@react-navigation/drawer";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { usePathname, useRouter } from "expo-router";
import {
  ALLOWED_AVATAR_BG_TOKENS,
  buildSettingsMenuVM,
  mapUserToUserDetailsVM,
  signOutAndReset,
  themeTokens,
  type AvatarColorToken,
  type UserAvatarColorId,
} from "@poleursus/shared";
import { useAuth } from "../../contexts/AuthContext";
import { useUserTheme } from "../../contexts/UserThemeContext";
import { useCopy, t } from "../../lib/i18n";
import { supabase } from "../../lib/supabase";
import { SettingsRow } from "../SettingsRow";
import { UserAvatar } from "../UserAvatar";

type ProfileAvatarState = {
  avatarPath: string | null;
  fallbackText: string | null;
  fallbackBgToken: AvatarColorToken | null;
  avatarColor: UserAvatarColorId | null;
  email: string | null;
};

const tokens = themeTokens.light;
const colors = tokens.colors;

export function SettingsDrawerContent(props: DrawerContentComponentProps) {
  const { user, clearSelectedAccount, selectedAccountId } = useAuth();
  const { tokens: userTokens } = useUserTheme();
  const { dictionary } = useCopy();
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const [profile, setProfile] = useState<ProfileAvatarState>({
    avatarPath: null,
    fallbackText: null,
    fallbackBgToken: null,
    avatarColor: null,
    email: null,
  });
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [isSignOutDialogOpen, setIsSignOutDialogOpen] = useState(false);

  const viewModel = useMemo(
    () =>
      buildSettingsMenuVM(dictionary, "mobile", {
        accountId: selectedAccountId,
      }),
    [dictionary, selectedAccountId]
  );
  const userDetails = useMemo(
    () => (user ? mapUserToUserDetailsVM(user) : null),
    [user]
  );

  useEffect(() => {
    let cancelled = false;

    async function loadProfile() {
      if (!user?.id) {
        if (!cancelled) {
          setProfile({
            avatarPath: null,
            fallbackText: null,
            fallbackBgToken: null,
            avatarColor: null,
            email: null,
          });
        }
        return;
      }

      const { data, error } = await supabase
        .from("profiles")
        .select(
          "avatar_path, email, avatar_fallback_text, avatar_fallback_bg_token, avatar_color"
        )
        .eq("user_id", user.id)
        .maybeSingle();

      if (cancelled) return;

      if (error) {
        setProfile({
          avatarPath: null,
          fallbackText: null,
          fallbackBgToken: null,
          avatarColor: null,
          email: user.email ?? null,
        });
        return;
      }

      const bgToken = ALLOWED_AVATAR_BG_TOKENS.includes(
        data?.avatar_fallback_bg_token as AvatarColorToken
      )
        ? (data?.avatar_fallback_bg_token as AvatarColorToken)
        : null;

      setProfile({
        avatarPath: data?.avatar_path ?? null,
        fallbackText: data?.avatar_fallback_text ?? null,
        fallbackBgToken: bgToken,
        avatarColor: (data?.avatar_color as UserAvatarColorId | null) ?? null,
        email: data?.email ?? user.email ?? null,
      });
    }

    void loadProfile();
    return () => {
      cancelled = true;
    };
  }, [user?.id, user?.email]);

  const email = profile.email ?? user?.email ?? "";

  const handleNavigate = (route: string) => {
    props.navigation.closeDrawer();
    router.push(route as any);
  };

  const resolveIcon = (itemId: string) => {
    switch (itemId) {
      case "user-details":
        return "account-circle-outline" as const;
      case "language":
        return "translate" as const;
      case "general":
        return "cog-outline" as const;
      case "members":
        return "account-group-outline" as const;
      case "categories":
        return "tag-outline" as const;
      default:
        return "chevron-right" as const;
    }
  };

  const handleCloseDrawer = () => {
    props.navigation.closeDrawer();
  };

  const handleSignOut = async () => {
    if (isSigningOut) return;
    setIsSigningOut(true);

    try {
      await signOutAndReset({
        signOut: async () => {
          await supabase.auth.signOut();
        },
        clearLocalSessionArtifacts: clearSelectedAccount,
        onReset: () => setIsSignOutDialogOpen(false),
        onNavigate: () => {
          props.navigation.closeDrawer();
          router.replace("/(auth)/login");
        },
      });
    } catch (error) {
      console.error("[SettingsDrawer] Sign out failed:", error);
      Alert.alert(t(dictionary, "settings.signOut.error"));
    } finally {
      setIsSigningOut(false);
    }
  };

  return (
    <DrawerContentScrollView
      {...props}
      style={[styles.container, { backgroundColor: userTokens.surface }]}
      contentContainerStyle={[
        styles.content,
        {
          paddingTop: insets.top + tokens.spacing.lg,
          paddingBottom: insets.bottom + tokens.spacing.lg,
        },
      ]}
    >
      <View style={styles.header}>
        <View style={styles.profileRow}>
          <UserAvatar
            email={email}
            userId={user?.id ?? null}
            avatarPath={profile.avatarPath}
            fallbackText={profile.fallbackText}
            fallbackBgToken={profile.fallbackBgToken}
            avatarColor={profile.avatarColor}
            size={44}
            label={email}
          />
          <View style={styles.profileText}>
            {userDetails?.displayName ? (
              <Text style={[styles.profileName, { color: userTokens.textPrimary }]}>
                {userDetails.displayName}
              </Text>
            ) : null}
            <Text style={[styles.profileEmail, { color: userTokens.textSecondary }]}>
              {email}
            </Text>
          </View>
        </View>
        <TouchableOpacity
          onPress={handleCloseDrawer}
          accessibilityRole="button"
          accessibilityLabel={t(dictionary, "common.close")}
          hitSlop={8}
          style={styles.closeButton}
        >
          <MaterialCommunityIcons
            name="close"
            size={20}
            color={userTokens.textSecondary}
          />
        </TouchableOpacity>
      </View>

      {viewModel.sections.map((section) => (
        <View key={section.id} style={styles.section}>
          <Text style={[styles.sectionTitle, { color: userTokens.textTertiary }]}>
            {section.title}
          </Text>
          <View style={[styles.sectionContent, { borderTopColor: userTokens.border }]}>
            {section.items.map((item) => (
              <SettingsRow
                key={item.id}
                title={item.title}
                description={item.description}
                onPress={() => handleNavigate(item.route)}
                iconName={resolveIcon(item.id)}
                isActive={
                  pathname === item.route ||
                  pathname.startsWith(`${item.route}/`)
                }
              />
            ))}
          </View>
        </View>
      ))}

      <View style={styles.signOutSection}>
        <View style={[styles.signOutDivider, { backgroundColor: userTokens.border }]} />
        <TouchableOpacity
          style={styles.signOutRow}
          onPress={() => setIsSignOutDialogOpen(true)}
          disabled={isSigningOut}
          accessibilityRole="button"
          accessibilityLabel={t(dictionary, "settings.signOut.label")}
        >
          <View style={styles.signOutContent}>
            <Text style={styles.signOutTitle}>
              {t(dictionary, "settings.signOut.label")}
            </Text>
            <Text
              style={[styles.signOutDescription, { color: userTokens.textSecondary }]}
            >
              {t(dictionary, "settings.signOut.description")}
            </Text>
          </View>
          <Text style={[styles.signOutChevron, { color: userTokens.textTertiary }]}>›</Text>
        </TouchableOpacity>
      </View>

      <Modal
        transparent
        visible={isSignOutDialogOpen}
        animationType="fade"
        onRequestClose={() => {
          if (!isSigningOut) setIsSignOutDialogOpen(false);
        }}
      >
        <View style={styles.modalOverlay}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => {
              if (!isSigningOut) setIsSignOutDialogOpen(false);
            }}
            disabled={isSigningOut}
          />

          <View
            style={[
              styles.modalCard,
              {
                backgroundColor: userTokens.surface,
                borderColor: userTokens.border,
              },
            ]}
          >
            <Text style={[styles.modalTitle, { color: userTokens.textPrimary }]}>
              {t(dictionary, "settings.signOut.confirmTitle")}
            </Text>
            <Text style={[styles.modalDescription, { color: userTokens.textSecondary }]}>
              {t(dictionary, "settings.signOut.confirmDescription")}
            </Text>

            <View style={styles.modalActions}>
              <Pressable
                onPress={() => {
                  if (!isSigningOut) setIsSignOutDialogOpen(false);
                }}
                disabled={isSigningOut}
                style={styles.modalCancelButton}
              >
                <Text
                  style={[
                    styles.modalCancelText,
                    { color: isSigningOut ? userTokens.textTertiary : userTokens.textSecondary },
                  ]}
                >
                  {t(dictionary, "settings.signOut.confirmCancel")}
                </Text>
              </Pressable>

              <Pressable
                onPress={() => {
                  void handleSignOut();
                }}
                disabled={isSigningOut}
                style={[
                  styles.modalConfirmButton,
                  {
                    borderColor: userTokens.dangerText,
                    opacity: isSigningOut ? 0.55 : 1,
                  },
                ]}
              >
                {isSigningOut ? (
                  <ActivityIndicator size="small" color={userTokens.dangerText} />
                ) : (
                  <Text style={[styles.modalConfirmText, { color: userTokens.dangerText }]}>
                    {t(dictionary, "settings.signOut.confirmAction")}
                  </Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </DrawerContentScrollView>
  );
}

const styles = StyleSheet.create({
  container: {},
  content: {
    gap: tokens.spacing.lg,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: tokens.spacing.md,
    paddingHorizontal: tokens.spacing.lg,
  },
  profileRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: tokens.spacing.md,
    flex: 1,
  },
  profileText: {
    gap: tokens.spacing.xs,
    flex: 1,
  },
  profileName: {
    fontSize: tokens.typography.size.md,
    fontWeight: tokens.typography.weight.semibold,
  },
  profileEmail: {
    fontSize: tokens.typography.size.sm,
  },
  closeButton: {
    padding: tokens.spacing.xs,
    borderRadius: tokens.radii.pill,
  },
  section: {
    gap: tokens.spacing.sm,
  },
  sectionTitle: {
    fontSize: tokens.typography.size.xs,
    fontWeight: tokens.typography.weight.semibold,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    paddingHorizontal: tokens.spacing.lg,
  },
  sectionContent: {
    borderTopWidth: 1,
  },
  signOutSection: {
    marginTop: tokens.spacing.md,
  },
  signOutDivider: {
    height: 1,
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
  signOutContent: {
    flex: 1,
  },
  signOutTitle: {
    fontSize: tokens.typography.size.md,
    fontWeight: tokens.typography.weight.semibold,
    color: colors.state.negative,
  },
  signOutDescription: {
    fontSize: tokens.typography.size.sm,
    marginTop: tokens.spacing.xs,
  },
  signOutChevron: {
    fontSize: tokens.typography.size.xl,
    marginLeft: tokens.spacing.md,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: "center",
    padding: tokens.spacing.lg,
    backgroundColor: "rgba(0, 0, 0, 0.32)",
  },
  modalCard: {
    borderWidth: 1,
    borderRadius: tokens.radii.lg,
    padding: tokens.spacing.lg,
  },
  modalTitle: {
    fontSize: tokens.typography.size.lg,
    fontWeight: tokens.typography.weight.semibold,
    marginBottom: tokens.spacing.xs,
  },
  modalDescription: {
    fontSize: tokens.typography.size.sm,
    marginBottom: tokens.spacing.lg,
  },
  modalActions: {
    marginTop: tokens.spacing.xs,
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: tokens.spacing.sm,
  },
  modalCancelButton: {
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: tokens.spacing.sm,
  },
  modalCancelText: {
    fontSize: tokens.typography.size.sm,
    fontWeight: tokens.typography.weight.medium,
  },
  modalConfirmButton: {
    borderWidth: 1,
    borderRadius: tokens.radii.md,
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: tokens.spacing.sm,
    alignItems: "center",
    justifyContent: "center",
    minWidth: 134,
  },
  modalConfirmText: {
    fontSize: tokens.typography.size.sm,
    fontWeight: tokens.typography.weight.semibold,
  },
});
