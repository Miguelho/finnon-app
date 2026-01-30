"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { humanizeRole, isExpired, themeTokens } from "@poleursus/shared";

type InviteRow = {
  id: string;
  account_id: string;
  role: "viewer" | "contributor" | "admin";
  status: "pending" | "accepted" | "rejected" | "revoked" | "expired" | null;
  expires_at: string;
  created_at: string;
  created_by: string;
  invited_email: string | null;
  invitee_email?: string | null;
  accounts?: { name: string } | null;
};

type ProfileRow = {
  user_id: string;
  email: string | null;
  display_name: string | null;
};

export function InvitationsClient() {
  const t = useTranslations();
  const locale = useLocale();
  const router = useRouter();
  const colors = themeTokens.light.colors;
  const [invites, setInvites] = useState<InviteRow[]>([]);
  const [profiles, setProfiles] = useState<Record<string, ProfileRow>>({});
  const [loading, setLoading] = useState(true);
  const [joinCode, setJoinCode] = useState("");
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [dismissedInvites, setDismissedInvites] = useState<string[]>([]);

  const loadInvites = useCallback(async () => {
    setLoading(true);
    setJoinError(null);
    try {
      const response = await fetch("/api/invites/list");
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        toast.error(
          error.errorKey ? t(error.errorKey) : t("invitations.loadError")
        );
        setLoading(false);
        return;
      }

      const payload = await response.json().catch(() => ({}));
      const inviteRows = (payload.invites || []) as InviteRow[];
      setInvites(inviteRows);
      setProfiles((payload.profiles || {}) as Record<string, ProfileRow>);
    } catch (error) {
      console.error("Error loading invites:", error);
      toast.error(t("invitations.loadError"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void loadInvites();
  }, [loadInvites]);

  const pendingInvites = useMemo(() => {
    return invites
      .map((invite) => {
        const expired = isExpired(invite.expires_at);
        const status = invite.status ?? "pending";
        const normalizedStatus = status === "pending" && expired ? "expired" : status;
        return { ...invite, status: normalizedStatus, expired };
      })
      .filter((invite) => invite.status === "pending" || invite.status === "expired")
      .filter((invite) => !dismissedInvites.includes(invite.id));
  }, [dismissedInvites, invites]);

  async function acceptInvite(inviteId: string) {
    try {
      const response = await fetch("/api/invites/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inviteId }),
      });

      if (!response.ok) {
        const error = await response.json();
        toast.error(
          error.errorKey
            ? t(error.errorKey, error.errorParams)
            : t("errors.internalServer")
        );
        return;
      }

      toast.success(t("invitations.joinSuccess"));
      router.push("/select-account");
    } catch (error) {
      console.error("Accept invite error:", error);
      toast.error(t("errors.internalServer"));
    }
  }

  function cancelInvite(inviteId: string) {
    setDismissedInvites((prev) =>
      prev.includes(inviteId) ? prev : [...prev, inviteId]
    );
  }

  async function rejectInvite(inviteId: string) {
    try {
      const response = await fetch("/api/invites/reject", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inviteId }),
      });

      if (!response.ok) {
        const error = await response.json();
        toast.error(
          error.errorKey
            ? t(error.errorKey, error.errorParams)
            : t("errors.internalServer")
        );
        return;
      }

      toast.success(t("common.successTitle"));
      await loadInvites();
    } catch (error) {
      console.error("Reject invite error:", error);
      toast.error(t("errors.internalServer"));
    }
  }

  async function joinByCode() {
    const trimmed = joinCode.trim();
    if (!trimmed) return;

    setJoining(true);
    setJoinError(null);

    try {
      const response = await fetch("/api/invites/join-by-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: trimmed }),
      });

      if (!response.ok) {
        await response.json().catch(() => ({}));
        setJoinError(t("invitations.codeError"));
        return;
      }

      setJoinCode("");
      toast.success(t("invitations.joinSuccess"));
      router.push("/select-account");
    } catch (error) {
      console.error("Join by code error:", error);
      setJoinError(t("invitations.codeError"));
    } finally {
      setJoining(false);
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{t("invitations.joinWithCodeTitle")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm" style={{ color: colors.text.secondary }}>
            {t("invitations.joinWithCodeDescription")}
          </p>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <Input
              value={joinCode}
              onChange={(event) => setJoinCode(event.target.value)}
              placeholder={t("invitations.codePlaceholder")}
              className="sm:max-w-xs"
            />
            <Button onClick={joinByCode} disabled={joining || joinCode.trim().length === 0}>
              {joining ? t("common.loading") : t("invitations.joinWithCodeButton")}
            </Button>
          </div>
          {joinError && (
            <p className="text-sm" style={{ color: colors.state.negative }}>
              {joinError}
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("invitations.title")}</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm" style={{ color: colors.text.secondary }}>
              {t("common.loading")}
            </p>
          ) : pendingInvites.length === 0 ? (
            <div className="space-y-2">
              <p className="text-sm font-semibold" style={{ color: colors.text.primary }}>
                {t("invitations.emptyTitle")}
              </p>
              <p className="text-sm" style={{ color: colors.text.secondary }}>
                {t("invitations.emptyDescription")}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {pendingInvites.map((invite) => {
                const profile = profiles[invite.created_by];
                const inviterName =
                  profile?.display_name || profile?.email || t("invites.accountUnknown");
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
                const showActions = invite.status === "pending" && !invite.expired;

                return (
                  <div
                    key={invite.id}
                    className="rounded-xl border p-4"
                    style={{
                      borderColor: colors.state.neutral,
                      backgroundColor: colors.bg.secondary,
                    }}
                  >
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <h3 className="text-base font-semibold">
                          {invite.accounts?.name ?? t("invites.accountUnknown")}
                        </h3>
                        <div className="flex items-center gap-2">
                          <span
                            className="rounded-full border px-3 py-1 text-xs font-semibold"
                            style={{
                              borderColor: colors.state.neutral,
                              color: colors.text.secondary,
                            }}
                          >
                            {statusLabel}
                          </span>
                          {showActions && (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <button
                                  type="button"
                                  aria-label={t("common.moreActions")}
                                  className="flex h-8 w-8 items-center justify-center rounded-md border border-transparent text-muted-foreground hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                                  onClick={(event) => event.stopPropagation()}
                                  onKeyDown={(event) => event.stopPropagation()}
                                >
                                  <MoreHorizontal className="h-4 w-4" />
                                </button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent
                                align="end"
                                onClick={(event) => event.stopPropagation()}
                              >
                                <DropdownMenuItem
                                  onSelect={(event) => {
                                    event.stopPropagation();
                                    rejectInvite(invite.id);
                                  }}
                                  style={{ color: colors.state.negative }}
                                >
                                  {t("invitations.rejectButton")}
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          )}
                        </div>
                      </div>
                      <p className="text-sm" style={{ color: colors.text.secondary }}>
                        {t("invitations.pendingBadge")}
                      </p>
                      <div
                        className="flex flex-wrap gap-4 text-sm"
                        style={{ color: colors.text.secondary }}
                      >
                        <span>{humanizeRole(invite.role, locale)}</span>
                        <span>
                          {t("invitations.expiresLabel", {
                            date: new Date(invite.expires_at).toLocaleDateString(locale),
                          })}
                        </span>
                        <span>
                          {t("invitations.inviterLabel")}: {inviterName}
                        </span>
                      </div>
                    </div>

                    {showActions && (
                      <div className="mt-4 flex flex-wrap gap-2">
                        <Button onClick={() => acceptInvite(invite.id)}>
                          {t("invitations.acceptButton")}
                        </Button>
                        <Button variant="outline" onClick={() => cancelInvite(invite.id)}>
                          {t("common.cancel")}
                        </Button>
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
