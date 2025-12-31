"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
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
  const t = useTranslations();
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
        toast.error(t("invites.loadAccountsError"));
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
      toast.error(t("invites.loadInvitesError"));
      setLoading(false);
      return;
    }

    setInvites(data || []);
    setLoading(false);
  }

  async function createInvite() {
    if (!selectedAccountId) {
      toast.error(t("invites.selectAccountError"));
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
        toast.error(
          error.errorKey
            ? t(error.errorKey, error.errorParams)
            : t("invites.createError")
        );
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
      toast.error(t("invites.createError"));
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
        toast.error(t("invites.revokeError"));
        return;
      }

      toast.success(t("invites.revokeSuccess"));
      fetchInvites();
    } catch (error) {
      console.error("Error revoking invite:", error);
      toast.error(t("invites.revokeError"));
    }
  }

  function copyInviteUrl(url: string) {
    navigator.clipboard.writeText(url).then(
      () => {
        toast.success(t("invites.copySuccess"));
      },
      () => {
        toast.error(t("invites.copyError"));
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
            <h1 className="text-3xl font-bold tracking-tight">
              {t("invites.title")}
            </h1>
            <p className="text-muted-foreground">
              {t("invites.subtitle")}
            </p>
          </div>

          <Button onClick={() => setIsCreateDialogOpen(true)}>
            {t("invites.createButton")}
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
                {createdInviteUrl
                  ? t("invites.createdTitle")
                  : t("invites.createTitle")}
              </SlidePanelTitle>
              <SlidePanelDescription>
                {createdInviteUrl
                  ? t("invites.createdDescription")
                  : t("invites.createDescription")}
              </SlidePanelDescription>
            </SlidePanelHeader>
            <SlidePanelBody>
              {createdInviteUrl ? (
                <div className="grid gap-4 py-4">
                  <div className="grid gap-2">
                    <Label>{t("invites.linkLabel")}</Label>
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
                        {t("common.copy")}
                      </Button>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {t("invites.warning")}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="grid gap-4 py-4">
                {accounts.length === 0 ? (
                  <div className="text-center py-4 text-muted-foreground">
                    {t("invites.noAdminAccounts")}
                  </div>
                ) : (
                  <>
                <div className="grid gap-2">
                  <Label htmlFor="account">{t("invites.accountLabel")}</Label>
                  <Select value={selectedAccountId} onValueChange={setSelectedAccountId}>
                    <SelectTrigger>
                      <SelectValue placeholder={t("invites.selectAccountPlaceholder")} />
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
                  <Label htmlFor="role">{t("invites.roleLabel")}</Label>
                  <Select
                    value={selectedRole}
                    onValueChange={(v: any) => setSelectedRole(v)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="viewer">
                        {t("invites.roleViewer")}
                      </SelectItem>
                      <SelectItem value="contributor">
                        {t("invites.roleContributor")}
                      </SelectItem>
                      <SelectItem value="admin">
                        {t("invites.roleAdmin")}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="expires">{t("invites.expiresInLabel")}</Label>
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
                    {t("invites.maxUsesLabel")}
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    {t("invites.maxUsesHelper")}
                  </p>
                  <Input
                    id="maxUses"
                    type="number"
                    value={maxUses}
                    onChange={(e) => setMaxUses(e.target.value)}
                    min="1"
                    placeholder={t("invites.maxUsesPlaceholder")}
                  />
                </div>
                </>
                )}
              </div>
              )}
            </SlidePanelBody>
            <SlidePanelFooter>
              {createdInviteUrl ? (
                <Button onClick={closeCreateDialog}>
                  {t("invites.closeButton")}
                </Button>
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
                  {isCreating ? t("common.creating") : t("invites.createButton")}
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
            {t("invites.filterAll", { count: invites.length })}
          </Button>
          <Button
            variant={filter === "active" ? "default" : "outline"}
            size="sm"
            onClick={() => setFilter("active")}
          >
            {t("invites.filterActive", {
              count: invites.filter((i) => getInviteStatus(i) === "active").length,
            })}
          </Button>
          <Button
            variant={filter === "expired" ? "default" : "outline"}
            size="sm"
            onClick={() => setFilter("expired")}
          >
            {t("invites.filterExpired", {
              count: invites.filter((i) => getInviteStatus(i) === "expired").length,
            })}
          </Button>
          <Button
            variant={filter === "revoked" ? "default" : "outline"}
            size="sm"
            onClick={() => setFilter("revoked")}
          >
            {t("invites.filterRevoked", {
              count: invites.filter((i) => getInviteStatus(i) === "revoked").length,
            })}
          </Button>
        </div>

        {/* Invites list */}
        <Card>
          <CardHeader>
            <CardTitle>{t("invites.cardTitle")}</CardTitle>
            <CardDescription>
              {t("invites.cardDescription", { count: filteredInvites.length })}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8 text-muted-foreground">
                {t("common.loading")}
              </div>
            ) : filteredInvites.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                {filter === "all"
                  ? t("invites.emptyAll")
                  : filter === "active"
                  ? t("invites.emptyActive")
                  : filter === "expired"
                  ? t("invites.emptyExpired")
                  : t("invites.emptyRevoked")}
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
                            {(invite.account as any)?.name ||
                              t("invites.accountUnknown")}
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
                              ? t("invites.statusActive")
                              : status === "expired"
                              ? t("invites.statusExpired")
                              : t("invites.statusRevoked")}
                          </span>
                          <span className="px-2 py-1 text-xs rounded bg-blue-100 text-blue-700">
                            {invite.role}
                          </span>
                        </div>
                        <div className="text-sm text-muted-foreground mt-1">
                          {t("invites.expiresLabel")}:{" "}
                          {new Date(invite.expires_at).toLocaleDateString()} •
                          {t("invites.usesLabel")}: {invite.uses_count}/
                          {invite.max_uses || "∞"}
                        </div>
                      </div>

                      <div className="flex gap-2">
                        {isActive && (
                          <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button size="sm" variant="destructive">
                                  {t("invites.revokeButton")}
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>
                                    {t("invites.revokePromptTitle")}
                                  </AlertDialogTitle>
                                  <AlertDialogDescription>
                                    {t("invites.revokeDialogDescription")}
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>
                                    {t("common.cancel")}
                                  </AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => revokeInvite(invite.id)}
                                  >
                                    {t("invites.revokeButton")}
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
