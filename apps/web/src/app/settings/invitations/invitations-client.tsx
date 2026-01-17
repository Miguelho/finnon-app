"use client";

import { useEffect, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { supabase } from "@/lib/supabaseClient";
import { humanizeRole, isExpired, themeTokens } from "@poleursus/shared";

const colors = themeTokens.light.colors;

type InviteRow = {
  id: string;
  account_id: string;
  role: "viewer" | "contributor" | "admin";
  status: "pending" | "accepted" | "rejected" | "revoked" | "expired" | null;
  expires_at: string;
  created_at: string;
  invited_email: string | null;
  invitee_email?: string | null;
  code: string | null;
};

type AccountOption = {
  id: string;
  name: string;
};

export default function InvitationsClient({ userId }: { userId: string }) {
  const t = useTranslations();
  const locale = useLocale();
  const [accounts, setAccounts] = useState<AccountOption[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState("");
  const [invites, setInvites] = useState<InviteRow[]>([]);
  const [loadingInvites, setLoadingInvites] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [selectedRole, setSelectedRole] = useState<
    "viewer" | "contributor" | "admin"
  >("viewer");
  const [generateCode, setGenerateCode] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [confirmRevokeId, setConfirmRevokeId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadAccounts() {
      const { data, error } = await supabase
        .from("account_members")
        .select("account_id, role, accounts(id, name)")
        .eq("user_id", userId)
        .eq("role", "admin");

      if (error) {
        console.error("Error fetching accounts:", error);
        toast.error(t("invites.loadAccountsError"));
        return;
      }

      const options = (data || [])
        .filter((member) => member.accounts)
        .map((member) => ({
          id: member.account_id,
          name: (member.accounts as any).name,
        }));

      if (!cancelled) {
        setAccounts(options);
        if (options.length > 0 && !selectedAccountId) {
          setSelectedAccountId(options[0].id);
        }
      }
    }

    void loadAccounts();

    return () => {
      cancelled = true;
    };
  }, [selectedAccountId, t, userId]);

  useEffect(() => {
    if (!selectedAccountId) return;
    void loadInvites(selectedAccountId);
  }, [selectedAccountId]);

  async function loadInvites(accountId: string) {
    setLoadingInvites(true);
    try {
      const { data, error } = await supabase
        .from("invites")
        .select("id, account_id, role, status, expires_at, created_at, invited_email, invitee_email, code")
        .eq("account_id", accountId)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error loading invites:", error);
        toast.error(t("invites.loadInvitesError"));
        return;
      }

      setInvites((data || []) as InviteRow[]);
    } finally {
      setLoadingInvites(false);
    }
  }

  async function sendInvite() {
    if (!selectedAccountId) {
      toast.error(t("invites.selectAccountError"));
      return;
    }

    const trimmedEmail = inviteEmail.trim();
    if (!trimmedEmail) {
      toast.error(t("errors.invalidRequest"));
      return;
    }

    setIsSending(true);
    try {
      const response = await fetch("/api/invites/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accountId: selectedAccountId,
          email: trimmedEmail,
          role: selectedRole,
          generateCode,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        toast.error(
          error.errorKey
            ? t(error.errorKey, error.errorParams)
            : t("invites.sendError")
        );
        return;
      }

      const data = await response.json();

      if (data.status === "already_member") {
        toast.info(t("invites.registeredAlreadyMember"));
        return;
      }

      if (data.status === "pending") {
        toast.info(t("invites.registeredPending"));
        return;
      }

      toast.success(t("invites.sendSuccess"));
      setInviteEmail("");
      setGenerateCode(false);
      setInviteCode(data.code ?? null);
      await loadInvites(selectedAccountId);
    } catch (error) {
      console.error("Error sending invite:", error);
      toast.error(t("invites.sendError"));
    } finally {
      setIsSending(false);
    }
  }

  async function revokeInvite(inviteId: string) {
    const { error } = await supabase
      .from("invites")
      .update({ status: "revoked", responded_at: new Date().toISOString() })
      .eq("id", inviteId);

    if (error) {
      console.error("Error revoking invite:", error);
      toast.error(t("invites.revokeError"));
      return;
    }

    toast.success(t("invites.revokeSuccess"));
    setConfirmRevokeId(null);
    await loadInvites(selectedAccountId);
  }

  function copyCode(code: string) {
    navigator.clipboard.writeText(code).then(
      () => toast.success(t("invites.codeCopied")),
      () => toast.error(t("invites.codeCopyError"))
    );
  }

  const inviteList = useMemo(() => {
    return invites.map((invite) => {
      const expired = isExpired(invite.expires_at);
      const status = invite.status ?? "pending";
      const normalizedStatus = status === "pending" && expired ? "expired" : status;
      return { ...invite, status: normalizedStatus, expired };
    });
  }, [invites]);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{t("invites.title")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          {accounts.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {t("invites.noAdminAccounts")}
            </p>
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
                <Label htmlFor="email">{t("invites.emailLabel")}</Label>
                <Input
                  id="email"
                  type="email"
                  value={inviteEmail}
                  onChange={(event) => setInviteEmail(event.target.value)}
                  placeholder={t("login.emailPlaceholder")}
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="role">{t("invites.roleLabel")}</Label>
                <Select
                  value={selectedRole}
                  onValueChange={(value) => setSelectedRole(value as InviteRow["role"])}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="viewer">{t("invites.roleViewer")}</SelectItem>
                    <SelectItem value="contributor">
                      {t("invites.roleContributor")}
                    </SelectItem>
                    <SelectItem value="admin">{t("invites.roleAdmin")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <Button
                  type="button"
                  variant={generateCode ? "default" : "outline"}
                  onClick={() => setGenerateCode((prev) => !prev)}
                >
                  {t("invites.generateCodeLabel")}
                </Button>
                <Button
                  type="button"
                  onClick={sendInvite}
                  disabled={isSending || inviteEmail.trim().length === 0}
                >
                  {isSending ? t("common.creating") : t("invites.createButton")}
                </Button>
              </div>
              {inviteCode && (
                <div
                  className="rounded-lg border p-4"
                  style={{ borderColor: colors.state.neutral }}
                >
                  <p className="text-sm font-semibold">{t("invites.codeLabel")}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <span className="rounded-md bg-muted px-3 py-2 font-mono text-sm">
                      {inviteCode}
                    </span>
                    <Button variant="outline" onClick={() => copyCode(inviteCode)}>
                      {t("invites.codeCopy")}
                    </Button>
                  </div>
                  <p className="mt-2 text-xs" style={{ color: colors.text.secondary }}>
                    {t("invites.codeHint")}
                  </p>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("invites.listTitle")}</CardTitle>
        </CardHeader>
        <CardContent>
          {loadingInvites ? (
            <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
          ) : inviteList.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("invites.listEmpty")}</p>
          ) : (
            <div className="space-y-3">
              {inviteList.map((invite) => {
                const invitedEmail = invite.invited_email || invite.invitee_email || "";
                const statusLabel =
                  invite.status === "accepted"
                    ? t("invites.statusAccepted")
                    : invite.status === "rejected"
                    ? t("invites.statusRejected")
                    : invite.status === "revoked"
                    ? t("invites.statusRevoked")
                    : invite.status === "expired"
                    ? t("invites.statusExpired")
                    : t("invites.statusPending");

                return (
                  <div
                    key={invite.id}
                    className="rounded-xl border p-4"
                    style={{ borderColor: colors.state.neutral }}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="space-y-1">
                        <p className="text-sm font-semibold">
                          {invitedEmail || t("invites.accountUnknown")}
                        </p>
                        <div
                          className="flex flex-wrap gap-3 text-xs"
                          style={{ color: colors.text.secondary }}
                        >
                          <span>{humanizeRole(invite.role, locale)}</span>
                          <span>
                            {t("invites.expiresLabel")} {" "}
                            {new Date(invite.expires_at).toLocaleDateString(locale)}
                          </span>
                        </div>
                        {invite.code && (
                          <div className="flex items-center gap-2 mt-1">
                            <span
                              className="text-xs"
                              style={{ color: colors.text.secondary }}
                            >
                              {t("invites.codeLabel")}:
                            </span>
                            <span className="rounded bg-muted px-2 py-0.5 font-mono text-xs">
                              {invite.code}
                            </span>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 px-2 text-xs"
                              onClick={() => copyCode(invite.code!)}
                            >
                              {t("invites.codeCopy")}
                            </Button>
                          </div>
                        )}
                      </div>
                      <span
                        className="rounded-full border px-3 py-1 text-xs font-semibold"
                        style={{ borderColor: colors.state.neutral }}
                      >
                        {statusLabel}
                      </span>
                    </div>

                    {invite.status === "pending" && !invite.expired && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {confirmRevokeId === invite.id ? (
                          <>
                            <Button
                              variant="outline"
                              onClick={() => setConfirmRevokeId(null)}
                            >
                              {t("common.cancel")}
                            </Button>
                            <Button
                              variant="destructive"
                              onClick={() => revokeInvite(invite.id)}
                            >
                              {t("invites.revokeButton")}
                            </Button>
                          </>
                        ) : (
                          <Button
                            variant="outline"
                            onClick={() => setConfirmRevokeId(invite.id)}
                          >
                            {t("invites.revokeButton")}
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
