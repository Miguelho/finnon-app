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
import { supabase } from "../../src/lib/supabase";
import { Card } from "../../src/components/Card";
import { Button } from "../../src/components/Button";
import { Picker } from "@react-native-picker/picker";
import { useCopy, t } from "../../src/lib/i18n";

type Invite = {
  id: string;
  account_id: string;
  role: "viewer" | "contributor" | "admin";
  expires_at: string;
  revoked_at: string | null;
  max_uses: number | null;
  uses_count: number;
  created_at: string;
  created_by: string;
  accounts?: {
    name: string;
  };
};

type FilterStatus = "all" | "active" | "expired" | "revoked";

export default function SettingsScreen() {
  const [invites, setInvites] = useState<Invite[]>([]);
  const [accounts, setAccounts] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<FilterStatus>("active");
  const [isCreateModalVisible, setIsCreateModalVisible] = useState(false);
  const [createdInviteUrl, setCreatedInviteUrl] = useState<string | null>(null);
  const { dictionary } = useCopy();

  // Form state
  const [selectedAccountId, setSelectedAccountId] = useState("");
  const [selectedRole, setSelectedRole] = useState<"viewer" | "contributor" | "admin">("viewer");
  const [expiresInHours, setExpiresInHours] = useState("24");
  const [maxUses, setMaxUses] = useState("");
  const [isCreating, setIsCreating] = useState(false);

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
    if (accountsList.length > 0 && !selectedAccountId) {
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

    setInvites(data || []);
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
      // Get current session to send auth token
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
          "Authorization": `Bearer ${session.access_token}`,
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
  }

  function getInviteStatus(invite: Invite): "active" | "expired" | "revoked" {
    if (invite.revoked_at) return "revoked";
    if (new Date(invite.expires_at) < new Date()) return "expired";
    if (invite.max_uses !== null && invite.uses_count >= invite.max_uses)
      return "expired";
    return "active";
  }

  const filteredInvites = invites.filter((invite) => {
    if (filter === "all") return true;
    return getInviteStatus(invite) === filter;
  });

  const statusCounts = {
    all: invites.length,
    active: invites.filter((i) => getInviteStatus(i) === "active").length,
    expired: invites.filter((i) => getInviteStatus(i) === "expired").length,
    revoked: invites.filter((i) => getInviteStatus(i) === "revoked").length,
  };

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={() => {
          setRefreshing(true);
          fetchInvites();
        }} />
      }
    >
      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title}>{t(dictionary, "invites.title")}</Text>
          <Text style={styles.subtitle}>{t(dictionary, "invites.subtitle")}</Text>
        </View>

        <Button
          title={t(dictionary, "invites.createButton")}
          onPress={() => setIsCreateModalVisible(true)}
        />

        {/* Filter buttons */}
        <View style={styles.filters}>
          <TouchableOpacity
            style={[styles.filterButton, filter === "all" && styles.filterButtonActive]}
            onPress={() => setFilter("all")}
          >
            <Text style={[styles.filterText, filter === "all" && styles.filterTextActive]}>
              {t(dictionary, "invites.filterAll", { count: statusCounts.all })}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.filterButton, filter === "active" && styles.filterButtonActive]}
            onPress={() => setFilter("active")}
          >
            <Text style={[styles.filterText, filter === "active" && styles.filterTextActive]}>
              {t(dictionary, "invites.filterActive", { count: statusCounts.active })}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.filterButton, filter === "expired" && styles.filterButtonActive]}
            onPress={() => setFilter("expired")}
          >
            <Text style={[styles.filterText, filter === "expired" && styles.filterTextActive]}>
              {t(dictionary, "invites.filterExpired", { count: statusCounts.expired })}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.filterButton, filter === "revoked" && styles.filterButtonActive]}
            onPress={() => setFilter("revoked")}
          >
            <Text style={[styles.filterText, filter === "revoked" && styles.filterTextActive]}>
              {t(dictionary, "invites.filterRevoked", { count: statusCounts.revoked })}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Invites list */}
        <Card
          title={t(dictionary, "invites.cardTitle")}
          description={t(dictionary, "invites.cardDescription", { count: filteredInvites.length })}
        >
          {loading ? (
            <ActivityIndicator size="large" color="#007AFF" />
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
            filteredInvites.map((invite) => {
              const status = getInviteStatus(invite);
              const isActive = status === "active";

              return (
                <View key={invite.id} style={styles.inviteCard}>
                  <View style={styles.inviteHeader}>
                    <Text style={styles.inviteAccount}>
                      {(invite.accounts as any)?.name || t(dictionary, "invites.accountUnknown")}
                    </Text>
                    <View style={styles.badges}>
                      <View
                        style={[
                          styles.badge,
                          status === "active"
                            ? styles.badgeActive
                            : status === "expired"
                            ? styles.badgeExpired
                            : styles.badgeRevoked,
                        ]}
                      >
                        <Text style={styles.badgeText}>
                          {status === "active"
                            ? t(dictionary, "invites.statusActive")
                            : status === "expired"
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
                    {t(dictionary, "invites.expiresLabel")}:{" \\"}
                    {new Date(invite.expires_at).toLocaleDateString()} •{" "}
                    {t(dictionary, "invites.usesLabel")}: {invite.uses_count}/{invite.max_uses || "∞\\"}
                  </Text>
                  {isActive && (
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
              );
            })
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
              {createdInviteUrl
                ? t(dictionary, "invites.createdTitle")
                : t(dictionary, "invites.createTitle")}
            </Text>
            <Text style={styles.modalDescription}>
              {createdInviteUrl
                ? t(dictionary, "invites.createdDescription")
                : t(dictionary, "invites.createDescription")}
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
                <Text style={styles.warning}>
                  {t(dictionary, "invites.warning")}
                </Text>
                <Button
                  title={t(dictionary, "invites.closeButton")}
                  onPress={closeCreateModal}
                  variant="secondary"
                />
              </View>
            ) : (
              <>
                <View style={styles.formField}>
                  <Text style={styles.label}>{t(dictionary, "invites.accountLabel")}</Text>
                  <Picker
                    selectedValue={selectedAccountId}
                    onValueChange={setSelectedAccountId}
                    style={styles.picker}
                  >
                    {accounts.map((account) => (
                      <Picker.Item
                        key={account.id}
                        label={account.name}
                        value={account.id}
                      />
                    ))}
                  </Picker>
                </View>

                <View style={styles.formField}>
                  <Text style={styles.label}>{t(dictionary, "invites.roleLabel")}</Text>
                  <Picker
                    selectedValue={selectedRole}
                    onValueChange={(v: any) => setSelectedRole(v)}
                    style={styles.picker}
                  >
                    <Picker.Item label={t(dictionary, "invites.roleViewer")} value="viewer" />
                    <Picker.Item
                      label={t(dictionary, "invites.roleContributor")}
                      value="contributor"
                    />
                    <Picker.Item label={t(dictionary, "invites.roleAdmin")} value="admin" />
                  </Picker>
                </View>

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
                  <TouchableOpacity
                    style={styles.cancelButton}
                    onPress={closeCreateModal}
                  >
                    <Text style={styles.cancelButtonText}>
                      {t(dictionary, "common.cancel")}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.createButton,
                      (isCreating || !selectedAccountId) && styles.createButtonDisabled,
                    ]}
                    onPress={createInvite}
                    disabled={isCreating || !selectedAccountId}
                  >
                    <Text style={styles.createButtonText}>
                      {isCreating
                        ? t(dictionary, "common.creating")
                        : t(dictionary, "common.create")}
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
    backgroundColor: "#f5f5f5",
  },
  content: {
    padding: 20,
  },
  header: {
    marginBottom: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: "#666",
    marginBottom: 16,
  },
  filters: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginVertical: 16,
  },
  filterButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#ddd",
    backgroundColor: "#fff",
  },
  filterButtonActive: {
    backgroundColor: "#007AFF",
    borderColor: "#007AFF",
  },
  filterText: {
    fontSize: 14,
    color: "#666",
  },
  filterTextActive: {
    color: "#fff",
  },
  emptyText: {
    textAlign: "center",
    color: "#666",
    paddingVertical: 20,
  },
  inviteCard: {
    padding: 12,
    borderWidth: 1,
    borderColor: "#e5e5e5",
    borderRadius: 8,
    marginBottom: 12,
    backgroundColor: "#fafafa",
  },
  inviteHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 8,
  },
  inviteAccount: {
    fontSize: 16,
    fontWeight: "600",
    flex: 1,
  },
  badges: {
    flexDirection: "row",
    gap: 4,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
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
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: "500",
  },
  inviteDetails: {
    fontSize: 14,
    color: "#666",
    marginBottom: 8,
  },
  inviteActions: {
    flexDirection: "row",
    gap: 8,
  },
  revokeButton: {
    backgroundColor: "#ef4444",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
  },
  revokeButtonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "500",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContent: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 24,
    width: "90%",
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 8,
  },
  modalDescription: {
    fontSize: 14,
    color: "#666",
    marginBottom: 20,
  },
  urlContainer: {
    gap: 12,
  },
  urlInput: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 6,
    padding: 12,
    fontSize: 12,
    fontFamily: "monospace",
    backgroundColor: "#f5f5f5",
  },
  warning: {
    fontSize: 12,
    color: "#666",
    fontStyle: "italic",
  },
  formField: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: "500",
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 6,
    padding: 12,
    fontSize: 16,
  },
  picker: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 6,
  },
  modalButtons: {
    flexDirection: "row",
    gap: 12,
    marginTop: 8,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#ddd",
    alignItems: "center",
  },
  cancelButtonText: {
    fontSize: 16,
    color: "#666",
  },
  createButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 6,
    backgroundColor: "#007AFF",
    alignItems: "center",
  },
  createButtonDisabled: {
    backgroundColor: "#ccc",
  },
  createButtonText: {
    fontSize: 16,
    color: "#fff",
    fontWeight: "500",
  },
});
