import { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Share,
} from "react-native";
import { supabase } from "../../../src/lib/supabase";
import { Card } from "../../../src/components/Card";
import { Button } from "../../../src/components/Button";
import { Picker } from "@react-native-picker/picker";
import { useCopy, t } from "../../../src/lib/i18n";
import { mapInvitesToInvitesVM, themeTokens, type InviteItemVM } from "@poleursus/shared";

const tokens = themeTokens.light;

type RawInvite = {
  id: string;
  account_id: string;
  role: "viewer" | "contributor" | "admin";
  expires_at: string;
  revoked_at: string | null;
  max_uses: number | null;
  uses_count: number;
  created_at: string;
  created_by: string;
  invitee_user_id?: string | null;
  invitee_email?: string | null;
  accounts?: {
    name: string;
  };
};

type FilterStatus = "all" | "active" | "expired" | "revoked";
type InviteMode = "link" | "registered";
type ExpirationMode = "unlimited" | "custom";

export default function InvitationsScreen() {
  const [invites, setInvites] = useState<InviteItemVM[]>([]);
  const [rawInvites, setRawInvites] = useState<RawInvite[]>([]);
  const [accounts, setAccounts] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<FilterStatus>("active");
  const [isCreateModalVisible, setIsCreateModalVisible] = useState(false);
  const [createdInviteUrl, setCreatedInviteUrl] = useState<string | null>(null);
  const [inviteMode, setInviteMode] = useState<InviteMode>("link");
  const [inviteEmail, setInviteEmail] = useState("");
  const [expirationMode, setExpirationMode] = useState<ExpirationMode>("unlimited");
  const { dictionary } = useCopy();

  // Form state
  const [selectedAccountId, setSelectedAccountId] = useState("");
  const [selectedRole, setSelectedRole] = useState<"viewer" | "contributor" | "admin">("viewer");
  const [expiresInHours, setExpiresInHours] = useState("24");
  const [maxUses, setMaxUses] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [isInvitingRegistered, setIsInvitingRegistered] = useState(false);

  useEffect(() => {
    fetchAccounts();
    fetchInvites();
  }, []);

  async function fetchAccounts() {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const { data, error } = await supabase
      .from("account_members")
      .select("account_id, role, accounts(id, name)")
      .eq("user_id", user.id)
      .eq("role", "admin");

    if (error) {
      console.error("Error fetching accounts:", error);
      return;
    }

    const accountsList = data
      .filter((m) => m.accounts)
      .map((m) => ({
        id: m.account_id,
        name: (m.accounts as any).name,
      }));

    setAccounts(accountsList);
    if (accountsList.length > 0 && accountsList[0] && !selectedAccountId) {
      setSelectedAccountId(accountsList[0].id);
    }
  }

  async function fetchInvites() {
    setLoading(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from("invites")
      .select("*, accounts(name)")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching invites:", error);
      setLoading(false);
      return;
    }

    setRawInvites(data || []);
    setInvites(mapInvitesToInvitesVM(data || []));
    setLoading(false);
    setRefreshing(false);
  }

  async function createInvite() {
    if (!selectedAccountId) {
      Alert.alert(
        t(dictionary, "common.errorTitle"),
        t(dictionary, "invites.selectAccountError")
      );
      return;
    }

    setIsCreating(true);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        Alert.alert(
          t(dictionary, "common.errorTitle"),
          t(dictionary, "invites.noSessionError")
        );
        setIsCreating(false);
        return;
      }

      const apiUrl = process.env.EXPO_PUBLIC_API_URL || "http://localhost:3000";

      const response = await fetch(`${apiUrl}/api/invites/create`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          accountId: selectedAccountId,
          role: selectedRole,
          expiresInHours: parseInt(expiresInHours),
          maxUses: maxUses ? parseInt(maxUses) : undefined,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        Alert.alert(
          t(dictionary, "common.errorTitle"),
          error.error || t(dictionary, "invites.createError")
        );
        setIsCreating(false);
        return;
      }

      const data = await response.json();
      setCreatedInviteUrl(data.inviteUrl);
      fetchInvites();
    } catch (error) {
      console.error("Error creating invite:", error);
      Alert.alert(
        t(dictionary, "common.errorTitle"),
        t(dictionary, "invites.createError")
      );
    } finally {
      setIsCreating(false);
    }
  }

  async function createRegisteredInvite() {
    if (!selectedAccountId) {
      Alert.alert(
        t(dictionary, "common.errorTitle"),
        t(dictionary, "invites.selectAccountError")
      );
      return;
    }

    const trimmedEmail = inviteEmail.trim();
    if (!trimmedEmail) {
      Alert.alert(
        t(dictionary, "common.errorTitle"),
        t(dictionary, "errors.invalidRequest")
      );
      return;
    }

    setIsInvitingRegistered(true);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        Alert.alert(
          t(dictionary, "common.errorTitle"),
          t(dictionary, "invites.noSessionError")
        );
        setIsInvitingRegistered(false);
        return;
      }

      const apiUrl = process.env.EXPO_PUBLIC_API_URL || "http://localhost:3000";
      const maxUsesValue = maxUses ? parseInt(maxUses) : 1;

      const body: Record<string, unknown> = {
        accountId: selectedAccountId,
        role: selectedRole,
        email: trimmedEmail,
        maxUses: Number.isNaN(maxUsesValue) ? 1 : maxUsesValue,
      };

      // Only include expiresInHours if mode is custom
      if (expirationMode === "custom" && expiresInHours) {
        body.expiresInHours = parseInt(expiresInHours);
      }

      const response = await fetch(`${apiUrl}/api/participants/invite`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        const message = error.errorKey
          ? t(dictionary, error.errorKey, error.errorParams)
          : t(dictionary, "invites.registeredInviteError");
        Alert.alert(t(dictionary, "common.errorTitle"), message);
        return;
      }

      const data = await response.json();
      if (data.status === "already_member") {
        Alert.alert(
          t(dictionary, "common.successTitle"),
          t(dictionary, "invites.registeredAlreadyMember")
        );
        return;
      }

      if (data.status === "pending") {
        Alert.alert(
          t(dictionary, "common.successTitle"),
          t(dictionary, "invites.registeredPending")
        );
        return;
      }

      if (data.inviteUrl) {
        setCreatedInviteUrl(data.inviteUrl);
      }

      fetchInvites();
    } catch (error) {
      console.error("Error inviting registered user:", error);
      Alert.alert(
        t(dictionary, "common.errorTitle"),
        t(dictionary, "invites.registeredInviteError")
      );
    } finally {
      setIsInvitingRegistered(false);
    }
  }

  async function revokeInvite(inviteId: string) {
    try {
      const { error } = await supabase
        .from("invites")
        .update({ revoked_at: new Date().toISOString() })
        .eq("id", inviteId);

      if (error) {
        Alert.alert(
          t(dictionary, "common.errorTitle"),
          t(dictionary, "invites.revokeError")
        );
        return;
      }

      Alert.alert(
        t(dictionary, "common.successTitle"),
        t(dictionary, "invites.revokeSuccess")
      );
      fetchInvites();
    } catch (error) {
      console.error("Error revoking invite:", error);
      Alert.alert(
        t(dictionary, "common.errorTitle"),
        t(dictionary, "invites.revokeError")
      );
    }
  }

  async function shareInviteUrl(url: string) {
    try {
      await Share.share({
        message: t(dictionary, "invites.shareMessage", { url }),
      });
    } catch (error) {
      console.error("Error sharing:", error);
    }
  }

  function closeCreateModal() {
    setIsCreateModalVisible(false);
    setCreatedInviteUrl(null);
    setSelectedRole("viewer");
    setExpiresInHours("24");
    setMaxUses("");
    setInviteMode("link");
    setInviteEmail("");
    setExpirationMode("unlimited");
  }

  const filteredInvites = invites.filter((invite) => {
    if (filter === "all") return true;
    return invite.status === filter;
  });

  const statusCounts = {
    all: invites.length,
    active: invites.filter((i) => i.status === "active").length,
    expired: invites.filter((i) => i.status === "expired").length,
    revoked: invites.filter((i) => i.status === "revoked").length,
  };
  const isRegisteredMode = inviteMode === "registered";
  const modalTitle = createdInviteUrl
    ? t(dictionary, "invites.createdTitle")
    : isRegisteredMode
    ? t(dictionary, "invites.registeredTitle")
    : t(dictionary, "invites.createTitle");
  const modalDescription = createdInviteUrl
    ? t(dictionary, "invites.createdDescription")
    : isRegisteredMode
    ? t(dictionary, "invites.registeredDescription")
    : t(dictionary, "invites.createDescription");
  const isSubmitting = isRegisteredMode ? isInvitingRegistered : isCreating;
  const isCreateDisabled =
    isSubmitting ||
    !selectedAccountId ||
    (isRegisteredMode && inviteEmail.trim().length === 0);

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => {
            setRefreshing(true);
            fetchInvites();
          }}
        />
      }
    >
      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.subtitle}>{t(dictionary, "invites.subtitle")}</Text>
        </View>

        <Button
          title={t(dictionary, "invites.createButton")}
          onPress={() => setIsCreateModalVisible(true)}
        />

        {/* Filter buttons */}
        <View style={styles.filters}>
          {(["all", "active", "expired", "revoked"] as FilterStatus[]).map((status) => (
            <TouchableOpacity
              key={status}
              style={[styles.filterButton, filter === status && styles.filterButtonActive]}
              onPress={() => setFilter(status)}
            >
              <Text style={[styles.filterText, filter === status && styles.filterTextActive]}>
                {t(dictionary, `invites.filter${status.charAt(0).toUpperCase() + status.slice(1)}` as any, {
                  count: statusCounts[status],
                })}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Invites list */}
        <Card
          title={t(dictionary, "invites.cardTitle")}
          description={t(dictionary, "invites.cardDescription", { count: filteredInvites.length })}
        >
          {loading ? (
            <ActivityIndicator size="large" color={tokens.colors.text.muted} />
          ) : filteredInvites.length === 0 ? (
            <Text style={styles.emptyText}>
              {filter === "all"
                ? t(dictionary, "invites.emptyAll")
                : filter === "active"
                ? t(dictionary, "invites.emptyActive")
                : filter === "expired"
                ? t(dictionary, "invites.emptyExpired")
                : t(dictionary, "invites.emptyRevoked")}
            </Text>
          ) : (
            filteredInvites.map((invite) => (
              <View key={invite.id} style={styles.inviteCard}>
                <View style={styles.inviteHeader}>
                  <Text style={styles.inviteAccount}>{invite.accountName}</Text>
                  <View style={styles.badges}>
                    <View
                      style={[
                        styles.badge,
                        invite.status === "active"
                          ? styles.badgeActive
                          : invite.status === "expired"
                          ? styles.badgeExpired
                          : styles.badgeRevoked,
                      ]}
                    >
                      <Text style={styles.badgeText}>
                        {invite.status === "active"
                          ? t(dictionary, "invites.statusActive")
                          : invite.status === "expired"
                          ? t(dictionary, "invites.statusExpired")
                          : t(dictionary, "invites.statusRevoked")}
                      </Text>
                    </View>
                    <View style={styles.badgeRole}>
                      <Text style={styles.badgeText}>{invite.role}</Text>
                    </View>
                  </View>
                </View>
                <Text style={styles.inviteDetails}>
                  {t(dictionary, "invites.expiresLabel")}:{" "}
                  {(invite.expiresAt
                    ? invite.expiresAt.toLocaleDateString()
                    : t(dictionary, "invites.expiresNone"))} •{" "}
                  {t(dictionary, "invites.usesLabel")}: {invite.usesCount}/
                  {invite.maxUses || "∞"}
                </Text>
                {invite.isActive && (
                  <View style={styles.inviteActions}>
                    <TouchableOpacity
                      style={styles.revokeButton}
                      onPress={() => {
                        Alert.alert(
                          t(dictionary, "invites.revokePromptTitle"),
                          t(dictionary, "invites.revokePromptDescription"),
                          [
                            { text: t(dictionary, "common.cancel"), style: "cancel" },
                            {
                              text: t(dictionary, "invites.revokeButton"),
                              style: "destructive",
                              onPress: () => revokeInvite(invite.id),
                            },
                          ]
                        );
                      }}
                    >
                      <Text style={styles.revokeButtonText}>
                        {t(dictionary, "invites.revokeButton")}
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            ))
          )}
        </Card>
      </View>

      {/* Create Invite Modal */}
      <Modal
        visible={isCreateModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={closeCreateModal}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>
              {modalTitle}
            </Text>
            <Text style={styles.modalDescription}>
              {modalDescription}
            </Text>

            {createdInviteUrl ? (
              <View style={styles.urlContainer}>
                <TextInput
                  style={styles.urlInput}
                  value={createdInviteUrl}
                  editable={false}
                  multiline
                />
                <Button
                  title={t(dictionary, "invites.shareButton")}
                  onPress={() => shareInviteUrl(createdInviteUrl)}
                />
                <Text style={styles.warning}>{t(dictionary, "invites.warning")}</Text>
                <Button
                  title={t(dictionary, "invites.closeButton")}
                  onPress={closeCreateModal}
                  variant="secondary"
                />
              </View>
            ) : accounts.length === 0 ? (
              <View style={styles.noAdminAccountsContainer}>
                <Text style={styles.noAdminAccountsText}>
                  {t(dictionary, "invites.noAdminAccounts")}
                </Text>
              </View>
            ) : (
              <>
                <View style={styles.formField}>
                  <Text style={styles.label}>{t(dictionary, "invites.inviteTypeLabel")}</Text>
                  <View style={styles.inviteTypeButtons}>
                    <TouchableOpacity
                      style={[
                        styles.inviteTypeButton,
                        inviteMode === "link" && styles.inviteTypeButtonActive,
                      ]}
                      onPress={() => setInviteMode("link")}
                    >
                      <Text
                        style={[
                          styles.inviteTypeButtonText,
                          inviteMode === "link" && styles.inviteTypeButtonTextActive,
                        ]}
                      >
                        {t(dictionary, "invites.inviteTypeLink")}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        styles.inviteTypeButton,
                        inviteMode === "registered" && styles.inviteTypeButtonActive,
                      ]}
                      onPress={() => setInviteMode("registered")}
                    >
                      <Text
                        style={[
                          styles.inviteTypeButtonText,
                          inviteMode === "registered" && styles.inviteTypeButtonTextActive,
                        ]}
                      >
                        {t(dictionary, "invites.inviteTypeRegistered")}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>

                <View style={styles.formField}>
                  <Text style={styles.label}>{t(dictionary, "invites.accountLabel")}</Text>
                  <Picker
                    selectedValue={selectedAccountId}
                    onValueChange={setSelectedAccountId}
                    style={styles.picker}
                  >
                    {accounts.map((account) => (
                      <Picker.Item key={account.id} label={account.name} value={account.id} />
                    ))}
                  </Picker>
                </View>

                {inviteMode === "registered" && (
                  <View style={styles.formField}>
                    <Text style={styles.label}>
                      {t(dictionary, "invites.registeredEmailLabel")}
                    </Text>
                    <TextInput
                      style={styles.input}
                      value={inviteEmail}
                      onChangeText={setInviteEmail}
                      autoCapitalize="none"
                      keyboardType="email-address"
                      placeholder={t(dictionary, "login.emailPlaceholder")}
                    />
                  </View>
                )}

                <View style={styles.formField}>
                  <Text style={styles.label}>{t(dictionary, "invites.roleLabel")}</Text>
                  <Picker
                    selectedValue={selectedRole}
                    onValueChange={(v: any) => setSelectedRole(v)}
                    style={styles.picker}
                  >
                    <Picker.Item label={t(dictionary, "invites.roleViewer")} value="viewer" />
                    <Picker.Item label={t(dictionary, "invites.roleContributor")} value="contributor" />
                    <Picker.Item label={t(dictionary, "invites.roleAdmin")} value="admin" />
                  </Picker>
                </View>

                {isRegisteredMode && (
                  <View style={styles.formField}>
                    <Text style={styles.label}>{t(dictionary, "invites.expirationModeLabel")}</Text>
                    <View style={styles.inviteTypeButtons}>
                      <TouchableOpacity
                        style={[
                          styles.inviteTypeButton,
                          expirationMode === "unlimited" && styles.inviteTypeButtonActive,
                        ]}
                        onPress={() => setExpirationMode("unlimited")}
                      >
                        <Text
                          style={[
                            styles.inviteTypeButtonText,
                            expirationMode === "unlimited" && styles.inviteTypeButtonTextActive,
                          ]}
                        >
                          {t(dictionary, "invites.expirationUnlimited")}
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[
                          styles.inviteTypeButton,
                          expirationMode === "custom" && styles.inviteTypeButtonActive,
                        ]}
                        onPress={() => setExpirationMode("custom")}
                      >
                        <Text
                          style={[
                            styles.inviteTypeButtonText,
                            expirationMode === "custom" && styles.inviteTypeButtonTextActive,
                          ]}
                        >
                          {t(dictionary, "invites.expirationCustom")}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}

                {(!isRegisteredMode || expirationMode === "custom") && (
                  <View style={styles.formField}>
                    <Text style={styles.label}>{t(dictionary, "invites.expiresInLabel")}</Text>
                    <TextInput
                      style={styles.input}
                      value={expiresInHours}
                      onChangeText={setExpiresInHours}
                      keyboardType="number-pad"
                      placeholder={expiresInHours || "24"}
                    />
                  </View>
                )}

                <View style={styles.formField}>
                  <Text style={styles.label}>{t(dictionary, "invites.maxUsesLabel")}</Text>
                  <TextInput
                    style={styles.input}
                    value={maxUses}
                    onChangeText={setMaxUses}
                    keyboardType="number-pad"
                    placeholder={t(dictionary, "invites.maxUsesPlaceholder")}
                  />
                </View>

                <View style={styles.modalButtons}>
                  <TouchableOpacity style={styles.cancelButton} onPress={closeCreateModal}>
                    <Text style={styles.cancelButtonText}>{t(dictionary, "common.cancel")}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.createButton,
                      isCreateDisabled && styles.createButtonDisabled,
                    ]}
                    onPress={isRegisteredMode ? createRegisteredInvite : createInvite}
                    disabled={isCreateDisabled}
                  >
                    <Text style={styles.createButtonText}>
                      {isSubmitting ? t(dictionary, "common.creating") : t(dictionary, "common.create")}
                    </Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: tokens.colors.bg.secondary,
  },
  content: {
    padding: tokens.spacing.xl,
  },
  header: {
    marginBottom: tokens.spacing.xl,
  },
  subtitle: {
    fontSize: tokens.typography.size.md,
    color: tokens.colors.text.secondary,
    marginBottom: tokens.spacing.lg,
  },
  filters: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: tokens.spacing.sm,
    marginVertical: tokens.spacing.lg,
  },
  filterButton: {
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: tokens.spacing.sm,
    borderRadius: tokens.radii.sm,
    borderWidth: 1,
    borderColor: tokens.colors.state.neutral,
    backgroundColor: tokens.colors.bg.surface,
  },
  filterButtonActive: {
    backgroundColor: tokens.colors.text.primary,
    borderColor: tokens.colors.text.primary,
  },
  filterText: {
    fontSize: tokens.typography.size.sm,
    color: tokens.colors.text.secondary,
  },
  filterTextActive: {
    color: tokens.colors.bg.primary,
  },
  emptyText: {
    textAlign: "center",
    color: tokens.colors.text.secondary,
    paddingVertical: tokens.spacing.xl,
  },
  inviteCard: {
    padding: tokens.spacing.md,
    borderWidth: 1,
    borderColor: tokens.colors.state.neutral,
    borderRadius: tokens.radii.sm,
    marginBottom: tokens.spacing.md,
    backgroundColor: tokens.colors.bg.secondary,
  },
  inviteHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: tokens.spacing.sm,
  },
  inviteAccount: {
    fontSize: tokens.typography.size.md,
    fontWeight: tokens.typography.weight.semibold,
    color: tokens.colors.text.primary,
    flex: 1,
  },
  badges: {
    flexDirection: "row",
    gap: tokens.spacing.xs,
  },
  badge: {
    paddingHorizontal: tokens.spacing.sm,
    paddingVertical: tokens.spacing.xs,
    borderRadius: tokens.radii.sm,
  },
  badgeActive: {
    backgroundColor: "#d1fae5",
  },
  badgeExpired: {
    backgroundColor: "#fed7aa",
  },
  badgeRevoked: {
    backgroundColor: "#fecaca",
  },
  badgeRole: {
    backgroundColor: "#dbeafe",
    paddingHorizontal: tokens.spacing.sm,
    paddingVertical: tokens.spacing.xs,
    borderRadius: tokens.radii.sm,
  },
  badgeText: {
    fontSize: tokens.typography.size.xs,
    fontWeight: tokens.typography.weight.medium,
    color: tokens.colors.text.primary,
  },
  inviteDetails: {
    fontSize: tokens.typography.size.sm,
    color: tokens.colors.text.secondary,
    marginBottom: tokens.spacing.sm,
  },
  inviteActions: {
    flexDirection: "row",
    gap: tokens.spacing.sm,
  },
  revokeButton: {
    backgroundColor: tokens.colors.state.negative,
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: tokens.spacing.sm,
    borderRadius: tokens.radii.sm,
  },
  revokeButtonText: {
    color: tokens.colors.bg.primary,
    fontSize: tokens.typography.size.sm,
    fontWeight: tokens.typography.weight.medium,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContent: {
    backgroundColor: tokens.colors.bg.surface,
    borderRadius: tokens.radii.md,
    padding: tokens.spacing.xxl,
    width: "90%",
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: tokens.typography.size.xl,
    fontWeight: tokens.typography.weight.bold,
    color: tokens.colors.text.primary,
    marginBottom: tokens.spacing.sm,
  },
  modalDescription: {
    fontSize: tokens.typography.size.sm,
    color: tokens.colors.text.secondary,
    marginBottom: tokens.spacing.xl,
  },
  urlContainer: {
    gap: tokens.spacing.md,
  },
  urlInput: {
    borderWidth: 1,
    borderColor: tokens.colors.state.neutral,
    borderRadius: tokens.radii.sm,
    padding: tokens.spacing.md,
    fontSize: tokens.typography.size.xs,
    fontFamily: "monospace",
    backgroundColor: tokens.colors.bg.secondary,
    color: tokens.colors.text.primary,
  },
  warning: {
    fontSize: tokens.typography.size.xs,
    color: tokens.colors.text.secondary,
    fontStyle: "italic",
  },
  formField: {
    marginBottom: tokens.spacing.lg,
  },
  inviteTypeButtons: {
    flexDirection: "row",
    gap: tokens.spacing.sm,
  },
  inviteTypeButton: {
    flex: 1,
    paddingVertical: tokens.spacing.sm,
    borderRadius: tokens.radii.sm,
    borderWidth: 1,
    borderColor: tokens.colors.state.neutral,
    backgroundColor: tokens.colors.bg.surface,
    alignItems: "center",
  },
  inviteTypeButtonActive: {
    borderColor: tokens.colors.text.primary,
    backgroundColor: tokens.colors.bg.secondary,
  },
  inviteTypeButtonText: {
    fontSize: tokens.typography.size.sm,
    fontWeight: tokens.typography.weight.medium,
    color: tokens.colors.text.secondary,
  },
  inviteTypeButtonTextActive: {
    color: tokens.colors.text.primary,
  },
  label: {
    fontSize: tokens.typography.size.sm,
    fontWeight: tokens.typography.weight.medium,
    color: tokens.colors.text.primary,
    marginBottom: tokens.spacing.sm,
  },
  input: {
    borderWidth: 1,
    borderColor: tokens.colors.state.neutral,
    borderRadius: tokens.radii.sm,
    padding: tokens.spacing.md,
    fontSize: tokens.typography.size.md,
    backgroundColor: tokens.colors.bg.surface,
    color: tokens.colors.text.primary,
  },
  picker: {
    borderWidth: 1,
    borderColor: tokens.colors.state.neutral,
    borderRadius: tokens.radii.sm,
  },
  modalButtons: {
    flexDirection: "row",
    gap: tokens.spacing.md,
    marginTop: tokens.spacing.sm,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: tokens.spacing.md,
    borderRadius: tokens.radii.sm,
    borderWidth: 1,
    borderColor: tokens.colors.state.neutral,
    alignItems: "center",
  },
  cancelButtonText: {
    fontSize: tokens.typography.size.md,
    color: tokens.colors.text.secondary,
  },
  createButton: {
    flex: 1,
    paddingVertical: tokens.spacing.md,
    borderRadius: tokens.radii.sm,
    backgroundColor: tokens.colors.text.primary,
    alignItems: "center",
  },
  createButtonDisabled: {
    backgroundColor: tokens.colors.action.disabled,
  },
  createButtonText: {
    fontSize: tokens.typography.size.md,
    color: tokens.colors.bg.primary,
    fontWeight: tokens.typography.weight.medium,
  },
  noAdminAccountsContainer: {
    padding: tokens.spacing.lg,
    alignItems: "center",
  },
  noAdminAccountsText: {
    fontSize: tokens.typography.size.md,
    color: tokens.colors.text.secondary,
    textAlign: "center",
  },
});
