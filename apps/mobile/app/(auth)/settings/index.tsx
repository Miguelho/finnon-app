import { useState } from "react";
import { ActivityIndicator, Alert, Modal, Pressable, View, Text, ScrollView, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { buildSettingsMenuVM, themeTokens } from "@poleursus/shared";
import { useCopy, t } from "../../../src/lib/i18n";
import { SettingsRow } from "../../../src/components/SettingsRow";
import { useAuth } from "../../../src/contexts/AuthContext";
import { useUserTheme } from "../../../src/contexts/UserThemeContext";

const tokens = themeTokens.light;

export default function SettingsMenuScreen() {
  const router = useRouter();
  const { dictionary } = useCopy();
  const { selectedAccountId, signOut } = useAuth();
  const { tokens: userTokens } = useUserTheme();
  const [isSignOutDialogOpen, setIsSignOutDialogOpen] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);

  const viewModel = buildSettingsMenuVM(dictionary, "mobile", {
    accountId: selectedAccountId,
  });

  const handleSignOut = async () => {
    if (isSigningOut) return;
    setIsSigningOut(true);

    try {
      await signOut();
    } catch (error) {
      console.error("[Settings] Sign out failed:", error);
      Alert.alert(t(dictionary, "settings.signOut.error"));
    } finally {
      setIsSigningOut(false);
    }
  };

  const handleNavigate = (route: string) => {
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
        return undefined;
    }
  };

  return (
    <ScrollView style={[styles.container, { backgroundColor: userTokens.background }]}>
      <View style={styles.header}>
        <Text style={[styles.subtitle, { color: userTokens.textSecondary }]}>
          {viewModel.subtitle}
        </Text>
      </View>

      {viewModel.sections.map((section) => (
        <View key={section.id} style={styles.section}>
          <Text style={[styles.sectionTitle, { color: userTokens.textTertiary }]}>
            {section.title}
          </Text>
          <View
            style={[
              styles.sectionContent,
              { backgroundColor: userTokens.surface, borderTopColor: userTokens.border },
            ]}
          >
            {section.items.map((item) => (
              <SettingsRow
                key={item.id}
                title={item.title}
                description={item.description}
                onPress={() => handleNavigate(item.route)}
                iconName={resolveIcon(item.id)}
              />
            ))}
          </View>
        </View>
      ))}

      <View style={styles.signOutSection}>
        <Pressable
          onPress={() => setIsSignOutDialogOpen(true)}
          disabled={isSigningOut}
          style={({ pressed }) => [
            styles.signOutButton,
            {
              backgroundColor: pressed
                ? userTokens.dangerBackground
                : userTokens.surface,
              borderColor: pressed
                ? userTokens.dangerBorder
                : userTokens.border,
            },
          ]}
        >
          <View style={styles.signOutCopy}>
            <Text style={[styles.signOutTitle, { color: userTokens.dangerText }]}>
              {t(dictionary, "settings.signOut.label")}
            </Text>
            <Text style={[styles.signOutSubtitle, { color: userTokens.textTertiary }]}>
              {t(dictionary, "settings.signOut.description")}
            </Text>
          </View>
          <Text style={[styles.signOutArrow, { color: userTokens.dangerText }]}>
            →
          </Text>
        </Pressable>
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
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: tokens.spacing.lg,
    paddingTop: tokens.spacing.lg,
    paddingBottom: tokens.spacing.md,
  },
  subtitle: {
    fontSize: tokens.typography.size.sm,
  },
  section: {
    marginTop: tokens.spacing.xl,
  },
  sectionTitle: {
    fontSize: tokens.typography.size.xs,
    fontWeight: tokens.typography.weight.semibold,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    paddingHorizontal: tokens.spacing.lg,
    marginBottom: tokens.spacing.sm,
  },
  sectionContent: {
    borderTopWidth: 1,
  },
  signOutSection: {
    marginTop: tokens.spacing.xl,
    paddingHorizontal: tokens.spacing.lg,
    paddingBottom: tokens.spacing.xl,
  },
  signOutButton: {
    borderWidth: 1,
    borderRadius: tokens.radii.md,
    paddingHorizontal: tokens.spacing.lg,
    paddingVertical: tokens.spacing.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  signOutCopy: {
    flex: 1,
  },
  signOutTitle: {
    fontSize: tokens.typography.size.sm,
    fontWeight: tokens.typography.weight.semibold,
  },
  signOutSubtitle: {
    fontSize: tokens.typography.size.xs,
    marginTop: 2,
  },
  signOutArrow: {
    fontSize: 16,
    marginLeft: tokens.spacing.sm,
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
