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
import { themeTokens } from "@poleursus/shared";
import { useNetworkNotice } from "@/components/network/network-notice";

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
  invitee_user_id?: string | null;
  invitee_email?: string | null;
  account?: {
    name: string;
  };
};

type FilterStatus = "all" | "active" | "expired" | "revoked";
type InviteMode = "link" | "registered";
type ExpirationMode = "unlimited" | "custom";

export default function InvitesPage() {
  const t = useTranslations();
  const colors = themeTokens.light.colors;
  const { reportNetworkIssue } = useNetworkNotice();
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

  // New states for registered invite
  const [inviteMode, setInviteMode] = useState<InviteMode>("link");
  const [inviteEmail, setInviteEmail] = useState("");
  const [isInvitingRegistered, setIsInvitingRegistered] = useState(false);
  const [expirationMode, setExpirationMode] = useState<ExpirationMode>("unlimited");

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
        reportNetworkIssue();
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
      reportNetworkIssue();
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
      const body: Record<string, unknown> = {
        accountId: selectedAccountId,
        role: selectedRole,
        maxUses: maxUses ? parseInt(maxUses) : undefined,
      };

      // Only include expiresInHours if mode is custom
      if (expirationMode === "custom" && expiresInHours) {
        body.expiresInHours = parseInt(expiresInHours);
      }

      const response = await fetch("/api/invites/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
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
      reportNetworkIssue();
    } finally {
      setIsCreating(false);
    }
  }

  async function createRegisteredInvite() {
    if (!selectedAccountId) {
      toast.error(t("invites.selectAccountError"));
      return;
    }

    const trimmedEmail = inviteEmail.trim();
    if (!trimmedEmail) {
      toast.error(t("errors.invalidRequest"));
      return;
    }

    setIsInvitingRegistered(true);

    try {
      const body: Record<string, unknown> = {
        accountId: selectedAccountId,
        email: trimmedEmail,
        role: selectedRole,
        maxUses: maxUses ? parseInt(maxUses) : 1,
      };

      // Only include expiresInHours if mode is custom
      if (expirationMode === "custom" && expiresInHours) {
        body.expiresInHours = parseInt(expiresInHours);
      }

      const response = await fetch("/api/participants/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const error = await response.json();
        toast.error(
          error.errorKey
            ? t(error.errorKey, error.errorParams)
            : t("invites.registeredInviteError")
        );
        setIsInvitingRegistered(false);
        return;
      }

      const data = await response.json();

      if (data.status === "already_member") {
        toast.info(t("invites.registeredAlreadyMember"));
        closeCreateDialog();
        return;
      }

      if (data.status === "pending") {
        toast.info(t("invites.registeredPending"));
        closeCreateDialog();
        return;
      }

      // status === "created"
      if (data.inviteUrl) {
        setCreatedInviteUrl(data.inviteUrl);
      }
      fetchInvites();
    } catch (error) {
      console.error("Error inviting registered user:", error);
      toast.error(t("invites.registeredInviteError"));
      reportNetworkIssue();
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
        toast.error(t("invites.revokeError"));
        reportNetworkIssue();
        return;
      }

      toast.success(t("invites.revokeSuccess"));
      fetchInvites();
    } catch (error) {
      console.error("Error revoking invite:", error);
      toast.error(t("invites.revokeError"));
      reportNetworkIssue();
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
    setInviteMode("link");
    setInviteEmail("");
    setExpirationMode("unlimited");
  }

  function getInviteStatus(invite: Invite): "active" | "expired" | "revoked" {
    const isTargeted = Boolean(invite.invitee_user_id || invite.invitee_email);
    if (invite.revoked_at) return "revoked";
    if (!isTargeted && new Date(invite.expires_at) < new Date()) return "expired";
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
                  : inviteMode === "registered"
                  ? t("invites.registeredTitle")
                  : t("invites.createTitle")}
              </SlidePanelTitle>
              <SlidePanelDescription>
                {createdInviteUrl
                  ? t("invites.createdDescription")
                  : inviteMode === "registered"
                  ? t("invites.registeredDescription")
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
                {/* Invite type selector */}
                <div className="grid gap-2">
                  <Label>{t("invites.inviteTypeLabel")}</Label>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant={inviteMode === "link" ? "default" : "outline"}
                      className="flex-1"
                      onClick={() => setInviteMode("link")}
                    >
                      {t("invites.inviteTypeLink")}
                    </Button>
                    <Button
                      type="button"
                      variant={inviteMode === "registered" ? "default" : "outline"}
                      className="flex-1"
                      onClick={() => setInviteMode("registered")}
                    >
                      {t("invites.inviteTypeRegistered")}
                    </Button>
                  </div>
                </div>

                {/* Account selector */}
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

                {/* Email field - only for registered mode */}
                {inviteMode === "registered" && (
                  <div className="grid gap-2">
                    <Label htmlFor="email">{t("invites.registeredEmailLabel")}</Label>
                    <Input
                      id="email"
                      type="email"
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                      placeholder={t("login.emailPlaceholder")}
                    />
                  </div>
                )}

                {/* Role selector */}
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

                {/* Expiration mode selector */}
                <div className="grid gap-2">
                  <Label>{t("invites.expirationModeLabel")}</Label>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant={expirationMode === "unlimited" ? "default" : "outline"}
                      className="flex-1"
                      onClick={() => setExpirationMode("unlimited")}
                    >
                      {t("invites.expirationUnlimited")}
                    </Button>
                    <Button
                      type="button"
                      variant={expirationMode === "custom" ? "default" : "outline"}
                      className="flex-1"
                      onClick={() => setExpirationMode("custom")}
                    >
                      {t("invites.expirationCustom")}
                    </Button>
                  </div>
                </div>

                {/* Expires in hours - only show when custom expiration is selected */}
                {expirationMode === "custom" && (
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
                )}

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
                    if (inviteMode === "registered") {
                      createRegisteredInvite();
                    } else {
                      createInvite();
                    }
                  }}
                  disabled={
                    (inviteMode === "link" && isCreating) ||
                    (inviteMode === "registered" && isInvitingRegistered) ||
                    !selectedAccountId ||
                    accounts.length === 0 ||
                    (inviteMode === "registered" && inviteEmail.trim().length === 0)
                  }
                >
                  {(inviteMode === "link" ? isCreating : isInvitingRegistered)
                    ? t("common.creating")
                    : t("invites.createButton")}
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
                  const isTargeted = Boolean(
                    invite.invitee_user_id || invite.invitee_email
                  );
                  const statusStyle = {
                    active: {
                      borderColor: colors.state.positive,
                      backgroundColor: colors.bg.secondary,
                      color: colors.state.positive,
                    },
                    expired: {
                      borderColor: colors.state.warning,
                      backgroundColor: colors.bg.secondary,
                      color: colors.state.warning,
                    },
                    revoked: {
                      borderColor: colors.state.negative,
                      backgroundColor: colors.bg.secondary,
                      color: colors.state.negative,
                    },
                  }[status];

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
                            className="rounded border px-2 py-1 text-xs"
                            style={statusStyle}
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
                          {isTargeted
                            ? t("invites.expiresNone")
                            : new Date(invite.expires_at).toLocaleDateString()} •
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
