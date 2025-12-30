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
      Alert.alert("Error", "Selecciona una cuenta");
      return;
    }

    setIsCreating(true);

    try {
      // Get current session to send auth token
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        Alert.alert("Error", "No hay sesión activa");
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
        Alert.alert("Error", error.error || "Error creando invitación");
        setIsCreating(false);
        return;
      }

      const data = await response.json();
      setCreatedInviteUrl(data.inviteUrl);
      fetchInvites();
    } catch (error) {
      console.error("Error creating invite:", error);
      Alert.alert("Error", "Error creando invitación");
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
        Alert.alert("Error", "Error revocando invitación");
        return;
      }

      Alert.alert("Éxito", "Invitación revocada exitosamente");
      fetchInvites();
    } catch (error) {
      console.error("Error revoking invite:", error);
      Alert.alert("Error", "Error revocando invitación");
    }
  }

  async function shareInviteUrl(url: string) {
    try {
      await Share.share({
        message: `Te invito a unirte a mi cuenta en Finnon: ${url}`,
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
          <Text style={styles.title}>Invitaciones</Text>
          <Text style={styles.subtitle}>
            Gestiona los links de invitación a tus cuentas
          </Text>
        </View>

        <Button title="Crear Invitación" onPress={() => setIsCreateModalVisible(true)} />

        {/* Filter buttons */}
        <View style={styles.filters}>
          <TouchableOpacity
            style={[styles.filterButton, filter === "all" && styles.filterButtonActive]}
            onPress={() => setFilter("all")}
          >
            <Text style={[styles.filterText, filter === "all" && styles.filterTextActive]}>
              Todas ({statusCounts.all})
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.filterButton, filter === "active" && styles.filterButtonActive]}
            onPress={() => setFilter("active")}
          >
            <Text style={[styles.filterText, filter === "active" && styles.filterTextActive]}>
              Activas ({statusCounts.active})
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.filterButton, filter === "expired" && styles.filterButtonActive]}
            onPress={() => setFilter("expired")}
          >
            <Text style={[styles.filterText, filter === "expired" && styles.filterTextActive]}>
              Expiradas ({statusCounts.expired})
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.filterButton, filter === "revoked" && styles.filterButtonActive]}
            onPress={() => setFilter("revoked")}
          >
            <Text style={[styles.filterText, filter === "revoked" && styles.filterTextActive]}>
              Revocadas ({statusCounts.revoked})
            </Text>
          </TouchableOpacity>
        </View>

        {/* Invites list */}
        <Card title="Invitaciones" description={`${filteredInvites.length} encontradas`}>
          {loading ? (
            <ActivityIndicator size="large" color="#007AFF" />
          ) : filteredInvites.length === 0 ? (
            <Text style={styles.emptyText}>
              No hay invitaciones {filter !== "all" && filter + "s"}
            </Text>
          ) : (
            filteredInvites.map((invite) => {
              const status = getInviteStatus(invite);
              const isActive = status === "active";

              return (
                <View key={invite.id} style={styles.inviteCard}>
                  <View style={styles.inviteHeader}>
                    <Text style={styles.inviteAccount}>
                      {(invite.accounts as any)?.name || "Cuenta desconocida"}
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
                            ? "Activa"
                            : status === "expired"
                            ? "Expirada"
                            : "Revocada"}
                        </Text>
                      </View>
                      <View style={styles.badgeRole}>
                        <Text style={styles.badgeText}>{invite.role}</Text>
                      </View>
                    </View>
                  </View>
                  <Text style={styles.inviteDetails}>
                    Expira: {new Date(invite.expires_at).toLocaleDateString()} •
                    Usos: {invite.uses_count}/{invite.max_uses || "∞"}
                  </Text>
                  {isActive && (
                    <View style={styles.inviteActions}>
                      <TouchableOpacity
                        style={styles.revokeButton}
                        onPress={() => {
                          Alert.alert(
                            "¿Revocar invitación?",
                            "El link dejará de funcionar inmediatamente",
                            [
                              { text: "Cancelar", style: "cancel" },
                              {
                                text: "Revocar",
                                style: "destructive",
                                onPress: () => revokeInvite(invite.id),
                              },
                            ]
                          );
                        }}
                      >
                        <Text style={styles.revokeButtonText}>Revocar</Text>
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
              {createdInviteUrl ? "Invitación creada" : "Crear nueva invitación"}
            </Text>
            <Text style={styles.modalDescription}>
              {createdInviteUrl
                ? "Comparte este link. No podrás verlo de nuevo."
                : "Genera un link de invitación"}
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
                  title="Compartir"
                  onPress={() => shareInviteUrl(createdInviteUrl)}
                />
                <Text style={styles.warning}>
                  ⚠️ Guarda este link ahora. Por seguridad, no podrás verlo de nuevo.
                </Text>
                <Button title="Cerrar" onPress={closeCreateModal} variant="secondary" />
              </View>
            ) : (
              <>
                <View style={styles.formField}>
                  <Text style={styles.label}>Cuenta</Text>
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
                  <Text style={styles.label}>Rol</Text>
                  <Picker
                    selectedValue={selectedRole}
                    onValueChange={(v: any) => setSelectedRole(v)}
                    style={styles.picker}
                  >
                    <Picker.Item label="Viewer (Solo lectura)" value="viewer" />
                    <Picker.Item label="Contributor (Lectura + Edición)" value="contributor" />
                    <Picker.Item label="Admin (Acceso completo)" value="admin" />
                  </Picker>
                </View>

                <View style={styles.formField}>
                  <Text style={styles.label}>Expira en (horas)</Text>
                  <TextInput
                    style={styles.input}
                    value={expiresInHours}
                    onChangeText={setExpiresInHours}
                    keyboardType="number-pad"
                    placeholder="24"
                  />
                </View>

                <View style={styles.formField}>
                  <Text style={styles.label}>Usos máximos (opcional)</Text>
                  <TextInput
                    style={styles.input}
                    value={maxUses}
                    onChangeText={setMaxUses}
                    keyboardType="number-pad"
                    placeholder="Ilimitado"
                  />
                </View>

                <View style={styles.modalButtons}>
                  <TouchableOpacity
                    style={styles.cancelButton}
                    onPress={closeCreateModal}
                  >
                    <Text style={styles.cancelButtonText}>Cancelar</Text>
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
                      {isCreating ? "Creando..." : "Crear"}
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
