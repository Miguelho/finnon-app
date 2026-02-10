import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
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
import { useRouter } from "expo-router";
import {
  ALLOWED_AVATAR_BG_TOKENS,
  buildSettingsMenuVM,
  isExpired,
  mapUserToUserDetailsVM,
  signOutAndReset,
  themeTokens,
  type AvatarColorToken,
} from "@poleursus/shared";
import { useAuth } from "../../contexts/AuthContext";
import { useCopy, t } from "../../lib/i18n";
import { supabase } from "../../lib/supabase";
import { SettingsRow } from "../SettingsRow";
import { UserAvatar } from "../UserAvatar";

type Account = {
  id: string;
  name: string;
  base_currency: string;
};

type ProfileAvatarState = {
  avatarPath: string | null;
  fallbackText: string | null;
  fallbackBgToken: AvatarColorToken | null;
  email: string | null;
};

const tokens = themeTokens.light;
const colors = tokens.colors;

export function SettingsDrawerContent(props: DrawerContentComponentProps) {
  const { user, clearSelectedAccount, selectedAccountId, setSelectedAccountId } = useAuth();
  const { dictionary } = useCopy();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [profile, setProfile] = useState<ProfileAvatarState>({
    avatarPath: null,
    fallbackText: null,
    fallbackBgToken: null,
    email: null,
  });
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [inviteCount, setInviteCount] = useState(0);
  const [isSwitching, setIsSwitching] = useState(false);

  const viewModel = useMemo(() => buildSettingsMenuVM(dictionary, "mobile"), [
    dictionary,
  ]);
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
            email: null,
          });
        }
        return;
      }

      const { data, error } = await supabase
        .from("profiles")
        .select("avatar_path, email, avatar_fallback_text, avatar_fallback_bg_token")
        .eq("user_id", user.id)
        .maybeSingle();

      if (cancelled) return;

      if (error) {
        setProfile({
          avatarPath: null,
          fallbackText: null,
          fallbackBgToken: null,
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
        email: data?.email ?? user.email ?? null,
      });
    }

    void loadProfile();
    return () => {
      cancelled = true;
    };
  }, [user?.id, user?.email]);

  useEffect(() => {
    let cancelled = false;

    async function loadAccounts() {
      if (!user?.id) {
        if (!cancelled) setAccounts([]);
        return;
      }

      const { data: memberships, error } = await supabase
        .from("account_members")
        .select("account_id, accounts(id, name, base_currency)")
        .eq("user_id", user.id);

      if (cancelled) return;

      if (error) {
        setAccounts([]);
        return;
      }

      const accountsList =
        memberships
          ?.map((m: any) => m.accounts)
          .filter((a: any) => a !== null) || [];

      setAccounts(accountsList);
    }

    async function loadInviteCount() {
      if (!user) {
        if (!cancelled) setInviteCount(0);
        return;
      }

      const normalizedEmail = user.email?.trim().toLowerCase();
      const filters = [];

      if (normalizedEmail) {
        filters.push(
          `invited_email.ilike.${normalizedEmail}`,
          `invitee_email.ilike.${normalizedEmail}`
        );
      }

      if (user.id) {
        filters.push(`invitee_user_id.eq.${user.id}`);
      }

      if (filters.length === 0) {
        if (!cancelled) setInviteCount(0);
        return;
      }

      const { data, error } = await supabase
        .from("invites")
        .select("id, expires_at, status, invited_email, invitee_email, invitee_user_id")
        .or(filters.join(","))
        .eq("status", "pending");

      if (cancelled) return;

      if (error) {
        setInviteCount(0);
        return;
      }

      const count = (data ?? []).filter((invite) => !isExpired(invite.expires_at)).length;
      setInviteCount(count);
    }

    void loadAccounts();
    void loadInviteCount();

    return () => {
      cancelled = true;
    };
  }, [user?.id, user?.email]);

  const email = profile.email ?? user?.email ?? "";

  const handleNavigate = (route: string) => {
    props.navigation.closeDrawer();
    router.push(route as any);
  };

  const handleCloseDrawer = () => {
    props.navigation.closeDrawer();
  };

  const handleSelectAccount = async (accountId: string) => {
    if (isSwitching || accountId === selectedAccountId) return;
    setIsSwitching(true);
    try {
      await setSelectedAccountId(accountId);
      props.navigation.closeDrawer();
      router.replace("/(auth)/(tabs)/home");
    } catch (err) {
      console.error("[SettingsDrawer] Error switching account:", err);
    } finally {
      setIsSwitching(false);
    }
  };

  const handleConfirmSignOut = async () => {
    if (isSigningOut) return;
    setIsSigningOut(true);
    props.navigation.closeDrawer();

    try {
      await signOutAndReset({
        signOut: () => supabase.auth.signOut(),
        clearLocalSessionArtifacts: clearSelectedAccount,
        onNavigate: () => {
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

  const handleSignOut = () => {
    Alert.alert(
      t(dictionary, "settings.signOut.confirmTitle"),
      t(dictionary, "settings.signOut.confirmDescription"),
      [
        {
          text: t(dictionary, "settings.signOut.confirmCancel"),
          style: "cancel",
        },
        {
          text: t(dictionary, "settings.signOut.confirmAction"),
          onPress: () => {
            void handleConfirmSignOut();
          },
        },
      ]
    );
  };

  return (
    <DrawerContentScrollView
      {...props}
      style={styles.container}
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
            size={44}
            label={email}
          />
          <View style={styles.profileText}>
            {userDetails?.displayName ? (
              <Text style={styles.profileName}>{userDetails.displayName}</Text>
            ) : null}
            <Text style={styles.profileEmail}>{email}</Text>
          </View>
        </View>
        <TouchableOpacity
          onPress={handleCloseDrawer}
          accessibilityRole="button"
          accessibilityLabel={t(dictionary, "common.close")}
          hitSlop={8}
          style={styles.closeButton}
        >
          <MaterialCommunityIcons name="close" size={20} color={colors.text.secondary} />
        </TouchableOpacity>
      </View>

      {viewModel.sections.map((section) => {
        const isAccountSection = section.id === "account";
        // Filter out switch-account since we show the selector directly
        const filteredItems = section.items.filter(
          (item) => item.id !== "switch-account" && item.id !== "categories"
        );

        return (
          <View key={section.id} style={styles.section}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            <View style={styles.sectionContent}>
              {isAccountSection && accounts.length > 0 && (
                <View style={styles.accountSelector}>
                  <TouchableOpacity
                    style={styles.inviteRow}
                    onPress={() => handleNavigate("/(auth)/invitations")}
                  >
                    <View style={styles.inviteRowInfo}>
                      <Text style={styles.inviteRowTitle}>
                        {t(dictionary, "invitations.title")}
                      </Text>
                      <Text style={styles.inviteRowDescription}>
                        {t(dictionary, "invitations.subtitle")}
                      </Text>
                    </View>
                    <View
                      style={[
                        styles.inviteBadge,
                        inviteCount > 0 && styles.inviteBadgeActive,
                      ]}
                    >
                      <Text
                        style={[
                          styles.inviteBadgeText,
                          inviteCount > 0 && styles.inviteBadgeTextActive,
                        ]}
                      >
                        {inviteCount}
                      </Text>
                    </View>
                  </TouchableOpacity>
                  {accounts.map((account) => {
                    const isActive = account.id === selectedAccountId;
                    return (
                      <TouchableOpacity
                        key={account.id}
                        style={[
                          styles.accountRow,
                          isActive && styles.accountRowActive,
                          isSwitching && styles.accountRowDisabled,
                        ]}
                        onPress={() => handleSelectAccount(account.id)}
                        disabled={isSwitching}
                      >
                        <View style={styles.accountRowInfo}>
                          <Text style={styles.accountRowName}>{account.name}</Text>
                          <Text style={styles.accountRowCurrency}>
                            {account.base_currency}
                          </Text>
                        </View>
                        <View style={styles.accountRowRight}>
                          <View
                            style={[
                              styles.accountBadge,
                              isActive && styles.accountBadgeActive,
                            ]}
                          >
                            <Text
                              style={[
                                styles.accountBadgeText,
                                isActive && styles.accountBadgeTextActive,
                              ]}
                            >
                              {isActive
                                ? t(dictionary, "dashboard.accountsActiveBadge")
                                : t(dictionary, "dashboard.accountsSelectBadge")}
                            </Text>
                          </View>
                          {isSwitching && isActive && (
                            <ActivityIndicator
                              size="small"
                              color={colors.text.muted}
                            />
                          )}
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}
              {filteredItems.map((item) => (
                <SettingsRow
                  key={item.id}
                  title={item.title}
                  description={item.description}
                  onPress={() => handleNavigate(item.route)}
                />
              ))}
            </View>
          </View>
        );
      })}

      <View style={styles.signOutSection}>
        <View style={styles.signOutDivider} />
        <TouchableOpacity
          style={styles.signOutRow}
          onPress={handleSignOut}
          disabled={isSigningOut}
          accessibilityRole="button"
          accessibilityLabel={t(dictionary, "settings.signOut.label")}
        >
          <View style={styles.signOutContent}>
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
    </DrawerContentScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.bg.surface,
  },
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
    color: colors.text.primary,
  },
  profileEmail: {
    fontSize: tokens.typography.size.sm,
    color: colors.text.secondary,
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
    color: colors.text.muted,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    paddingHorizontal: tokens.spacing.lg,
  },
  sectionContent: {
    borderTopWidth: 1,
    borderTopColor: colors.state.neutral,
  },
  accountSelector: {
    paddingHorizontal: tokens.spacing.lg,
    paddingVertical: tokens.spacing.md,
    gap: tokens.spacing.sm,
  },
  inviteRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.bg.secondary,
    padding: tokens.spacing.md,
    borderRadius: tokens.radii.md,
    borderWidth: 1,
    borderColor: colors.state.neutral,
  },
  inviteRowInfo: {
    flex: 1,
  },
  inviteRowTitle: {
    fontSize: tokens.typography.size.sm,
    fontWeight: tokens.typography.weight.semibold,
    color: colors.text.primary,
  },
  inviteRowDescription: {
    fontSize: tokens.typography.size.xs,
    color: colors.text.secondary,
    marginTop: tokens.spacing.xs,
  },
  inviteBadge: {
    paddingHorizontal: tokens.spacing.sm,
    paddingVertical: tokens.spacing.xs,
    borderRadius: tokens.radii.pill,
    borderWidth: 1,
    borderColor: colors.state.neutral,
  },
  inviteBadgeActive: {
    backgroundColor: colors.action.primary,
    borderColor: colors.action.primary,
  },
  inviteBadgeText: {
    fontSize: tokens.typography.size.xs,
    fontWeight: tokens.typography.weight.semibold,
    color: colors.text.muted,
  },
  inviteBadgeTextActive: {
    color: colors.bg.primary,
  },
  accountRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.bg.secondary,
    padding: tokens.spacing.md,
    borderRadius: tokens.radii.md,
    borderWidth: 1,
    borderColor: colors.state.neutral,
  },
  accountRowActive: {
    borderColor: colors.action.primary,
    backgroundColor: colors.bg.surface,
  },
  accountRowDisabled: {
    opacity: 0.6,
  },
  accountRowInfo: {
    flex: 1,
  },
  accountRowName: {
    fontSize: tokens.typography.size.sm,
    fontWeight: tokens.typography.weight.semibold,
    color: colors.text.primary,
  },
  accountRowCurrency: {
    fontSize: tokens.typography.size.xs,
    color: colors.text.secondary,
    marginTop: tokens.spacing.xs,
  },
  accountRowRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: tokens.spacing.sm,
  },
  accountBadge: {
    paddingHorizontal: tokens.spacing.sm,
    paddingVertical: tokens.spacing.xs,
    borderRadius: tokens.radii.pill,
    borderWidth: 1,
    borderColor: colors.state.neutral,
  },
  accountBadgeActive: {
    backgroundColor: colors.action.primary,
    borderColor: colors.action.primary,
  },
  accountBadgeText: {
    fontSize: tokens.typography.size.xs,
    fontWeight: tokens.typography.weight.semibold,
    color: colors.text.muted,
  },
  accountBadgeTextActive: {
    color: colors.bg.primary,
  },
  signOutSection: {
    marginTop: tokens.spacing.md,
  },
  signOutDivider: {
    height: 1,
    backgroundColor: colors.state.neutral,
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
    color: colors.text.secondary,
    marginTop: tokens.spacing.xs,
  },
  signOutChevron: {
    fontSize: tokens.typography.size.xl,
    color: colors.text.muted,
    marginLeft: tokens.spacing.md,
  },
});
