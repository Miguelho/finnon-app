"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  SlidePanel,
  SlidePanelContent,
  SlidePanelDescription,
  SlidePanelFooter,
  SlidePanelHeader,
  SlidePanelTitle,
  SlidePanelBody,
} from "@/components/ui/slide-panel";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/lib/supabaseClient";

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
  account?: {
    name: string;
  };
};

type FilterStatus = "all" | "active" | "expired" | "revoked";

export default function InvitesPage() {
  const [invites, setInvites] = useState<Invite[]>([]);
  const [accounts, setAccounts] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterStatus>("active");
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);

  // Form state for create invite
  const [selectedAccountId, setSelectedAccountId] = useState("");
  const [selectedRole, setSelectedRole] = useState<"viewer" | "contributor" | "admin">("viewer");
  const [expiresInHours, setExpiresInHours] = useState("24");
  const [maxUses, setMaxUses] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [createdInviteUrl, setCreatedInviteUrl] = useState<string | null>(null);

  // Fetch user's accounts
  useEffect(() => {
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
        toast.error("Error cargando cuentas");
        return;
      }

      const accountsList = data
        .filter((m) => m.accounts)
        .map((m) => ({
          id: m.account_id,
          name: (m.accounts as any).name,
        }));

      setAccounts(accountsList);
      if (accountsList.length > 0 && accountsList[0]) {
        setSelectedAccountId(accountsList[0].id);
      }
    }

    fetchAccounts();
  }, []);

  // Fetch invites
  useEffect(() => {
    fetchInvites();
  }, []);

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
      toast.error("Error cargando invitaciones");
      setLoading(false);
      return;
    }

    setInvites(data || []);
    setLoading(false);
  }

  async function createInvite() {
    if (!selectedAccountId) {
      toast.error("Selecciona una cuenta");
      return;
    }

    setIsCreating(true);

    try {
      const response = await fetch("/api/invites/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accountId: selectedAccountId,
          role: selectedRole,
          expiresInHours: parseInt(expiresInHours),
          maxUses: maxUses ? parseInt(maxUses) : undefined,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        toast.error(error.error || "Error creando invitación");
        setIsCreating(false);
        return;
      }

      const data = await response.json();

      // Show the invite URL
      setCreatedInviteUrl(data.inviteUrl);
      fetchInvites();

      // Don't close dialog yet - show the URL first
    } catch (error) {
      console.error("Error creating invite:", error);
      toast.error("Error creando invitación");
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
        toast.error("Error revocando invitación");
        return;
      }

      toast.success("Invitación revocada exitosamente");
      fetchInvites();
    } catch (error) {
      console.error("Error revoking invite:", error);
      toast.error("Error revocando invitación");
    }
  }

  function copyInviteUrl(url: string) {
    navigator.clipboard.writeText(url).then(
      () => {
        toast.success("Link copiado al portapapeles");
      },
      () => {
        toast.error("Error copiando link");
      }
    );
  }

  function closeCreateDialog() {
    setIsCreateDialogOpen(false);
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

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Invitaciones</h1>
            <p className="text-muted-foreground">
              Gestiona los links de invitación a tus cuentas
            </p>
          </div>

          <Button onClick={() => setIsCreateDialogOpen(true)}>
            Crear Invitación
          </Button>
        </div>

        <SlidePanel
          open={isCreateDialogOpen}
          onOpenChange={(open) => {
            if (open) {
              setIsCreateDialogOpen(true);
            } else {
              closeCreateDialog();
            }
          }}
        >
          <SlidePanelContent>
            <SlidePanelHeader>
              <SlidePanelTitle>
                {createdInviteUrl ? "Invitación creada" : "Crear nueva invitación"}
              </SlidePanelTitle>
              <SlidePanelDescription>
                {createdInviteUrl
                  ? "Copia este link y compártelo. No podrás verlo de nuevo."
                  : "Genera un link de invitación para compartir acceso a tu cuenta"}
              </SlidePanelDescription>
            </SlidePanelHeader>
            <SlidePanelBody>
              {createdInviteUrl ? (
                <div className="grid gap-4 py-4">
                  <div className="grid gap-2">
                    <Label>Link de Invitación</Label>
                    <div className="flex gap-2">
                      <Input
                        value={createdInviteUrl}
                        readOnly
                        className="font-mono text-sm"
                      />
                      <Button
                        onClick={() => copyInviteUrl(createdInviteUrl)}
                        variant="outline"
                      >
                        Copiar
                      </Button>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      ⚠️ Guarda este link ahora. Por seguridad, no podrás verlo de nuevo.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="grid gap-4 py-4">
                {accounts.length === 0 ? (
                  <div className="text-center py-4 text-muted-foreground">
                    No tienes cuentas con permisos de admin para crear invitaciones.
                  </div>
                ) : (
                  <>
                <div className="grid gap-2">
                  <Label htmlFor="account">Cuenta</Label>
                  <Select value={selectedAccountId} onValueChange={setSelectedAccountId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecciona una cuenta" />
                    </SelectTrigger>
                    <SelectContent>
                      {accounts.map((account) => (
                        <SelectItem key={account.id} value={account.id}>
                          {account.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="role">Rol</Label>
                  <Select
                    value={selectedRole}
                    onValueChange={(v: any) => setSelectedRole(v)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="viewer">Viewer (Solo lectura)</SelectItem>
                      <SelectItem value="contributor">
                        Contributor (Lectura + Edición)
                      </SelectItem>
                      <SelectItem value="admin">Admin (Acceso completo)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="expires">Expira en (horas)</Label>
                  <Input
                    id="expires"
                    type="number"
                    value={expiresInHours}
                    onChange={(e) => setExpiresInHours(e.target.value)}
                    min="1"
                    max="8760"
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="maxUses">
                    Usos máximos (opcional, dejar vacío para ilimitado)
                  </Label>
                  <Input
                    id="maxUses"
                    type="number"
                    value={maxUses}
                    onChange={(e) => setMaxUses(e.target.value)}
                    min="1"
                    placeholder="Ilimitado"
                  />
                </div>
                </>
                )}
              </div>
              )}
            </SlidePanelBody>
            <SlidePanelFooter>
              {createdInviteUrl ? (
                <Button onClick={closeCreateDialog}>Cerrar</Button>
              ) : (
                <Button
                  onClick={() => {
                    console.log("[CreateInvite] Button clicked!", {
                      isCreating,
                      selectedAccountId,
                      accounts: accounts.length,
                    });
                    createInvite();
                  }}
                  disabled={isCreating || !selectedAccountId || accounts.length === 0}
                >
                  {isCreating ? "Creando..." : "Crear Invitación"}
                </Button>
              )}
            </SlidePanelFooter>
          </SlidePanelContent>
        </SlidePanel>

        {/* Filter buttons */}
        <div className="flex gap-2">
          <Button
            variant={filter === "all" ? "default" : "outline"}
            size="sm"
            onClick={() => setFilter("all")}
          >
            Todas ({invites.length})
          </Button>
          <Button
            variant={filter === "active" ? "default" : "outline"}
            size="sm"
            onClick={() => setFilter("active")}
          >
            Activas (
            {invites.filter((i) => getInviteStatus(i) === "active").length})
          </Button>
          <Button
            variant={filter === "expired" ? "default" : "outline"}
            size="sm"
            onClick={() => setFilter("expired")}
          >
            Expiradas (
            {invites.filter((i) => getInviteStatus(i) === "expired").length})
          </Button>
          <Button
            variant={filter === "revoked" ? "default" : "outline"}
            size="sm"
            onClick={() => setFilter("revoked")}
          >
            Revocadas (
            {invites.filter((i) => getInviteStatus(i) === "revoked").length})
          </Button>
        </div>

        {/* Invites list */}
        <Card>
          <CardHeader>
            <CardTitle>Invitaciones</CardTitle>
            <CardDescription>
              {filteredInvites.length} invitaciones encontradas
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8 text-muted-foreground">
                Cargando...
              </div>
            ) : filteredInvites.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No hay invitaciones {filter !== "all" && filter + "s"}
              </div>
            ) : (
              <div className="space-y-4">
                {filteredInvites.map((invite) => {
                  const status = getInviteStatus(invite);
                  const isActive = status === "active";

                  return (
                    <div
                      key={invite.id}
                      className="flex items-center justify-between p-4 border rounded-lg"
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">
                            {(invite.account as any)?.name || "Cuenta desconocida"}
                          </span>
                          <span
                            className={`px-2 py-1 text-xs rounded ${
                              status === "active"
                                ? "bg-green-100 text-green-700"
                                : status === "expired"
                                ? "bg-orange-100 text-orange-700"
                                : "bg-red-100 text-red-700"
                            }`}
                          >
                            {status === "active"
                              ? "Activa"
                              : status === "expired"
                              ? "Expirada"
                              : "Revocada"}
                          </span>
                          <span className="px-2 py-1 text-xs rounded bg-blue-100 text-blue-700">
                            {invite.role}
                          </span>
                        </div>
                        <div className="text-sm text-muted-foreground mt-1">
                          Expira:{" "}
                          {new Date(invite.expires_at).toLocaleDateString()} •
                          Usos: {invite.uses_count}/
                          {invite.max_uses || "∞"}
                        </div>
                      </div>

                      <div className="flex gap-2">
                        {isActive && (
                          <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button size="sm" variant="destructive">
                                  Revocar
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>
                                    ¿Revocar invitación?
                                  </AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Esta acción no se puede deshacer. El link de
                                    invitación dejará de funcionar inmediatamente.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => revokeInvite(invite.id)}
                                  >
                                    Revocar
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
