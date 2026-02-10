"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, Pencil, Plus, RefreshCw, X } from "lucide-react";
import { humanizeRole, type MemberRole } from "@poleursus/shared";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import styles from "../settings-panels.module.css";

type MemberProfile = {
  user_id: string;
  role: MemberRole;
  name: string | null;
  email: string | null;
};

type InviteRow = {
  id: string;
  account_id: string;
  role: MemberRole;
  status: "pending" | "accepted" | "rejected" | "revoked" | "expired" | null;
  created_at: string;
  invited_email: string | null;
  invitee_email?: string | null;
};

type AccountSettingsMembersPanelProps = {
  accountId: string;
  currentUserId: string;
  canManageMembers: boolean;
};

const AVATAR_BACKGROUNDS = [
  "hsl(var(--accent))",
  "hsl(var(--muted))",
  "hsl(var(--secondary))",
  "hsl(var(--state-positive) / 0.15)",
  "hsl(var(--destructive) / 0.13)",
  "hsl(var(--primary) / 0.14)",
];

function getInitials(value: string): string {
  const tokens = value
    .split(" ")
    .map((part) => part.trim())
    .filter(Boolean);

  if (tokens.length === 0) return "?";
  if (tokens.length === 1) {
    return (tokens[0] ?? "?").slice(0, 2).toUpperCase();
  }

  const first = tokens[0] ?? "";
  const second = tokens[1] ?? "";
  return `${first.slice(0, 1)}${second.slice(0, 1)}`.toUpperCase();
}

function getSentAgo(createdAt: string, locale: string): string {
  const diffMs = Date.now() - new Date(createdAt).getTime();
  const diffDays = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
  const formatter = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
  return formatter.format(-diffDays, "day");
}

export function AccountSettingsMembersPanel({
  accountId,
  currentUserId,
  canManageMembers,
}: AccountSettingsMembersPanelProps) {
  const t = useTranslations();
  const locale = useLocale();
  const roleLocale = locale.startsWith("en") ? "en" : "es";
  const supabase = useMemo(() => createClient(), []);

  const [members, setMembers] = useState<MemberProfile[]>([]);
  const [invites, setInvites] = useState<InviteRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingMemberId, setEditingMemberId] = useState<string | null>(null);
  const [editingRole, setEditingRole] = useState<MemberRole>("viewer");
  const [isUpdatingMember, setIsUpdatingMember] = useState(false);

  const [isInviteComposerOpen, setIsInviteComposerOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<MemberRole>("viewer");
  const [isSendingInvite, setIsSendingInvite] = useState(false);

  const loadMembers = useCallback(async () => {
    const response = await fetch("/api/profiles", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accountId }),
    });

    if (!response.ok) {
      throw new Error("members_load_error");
    }

    const payload = await response.json();
    setMembers((payload?.members ?? []) as MemberProfile[]);
  }, [accountId]);

  const loadInvites = useCallback(async () => {
    const { data, error } = await supabase
      .from("invites")
      .select(
        "id, account_id, role, status, created_at, invited_email, invitee_email"
      )
      .eq("account_id", accountId)
      .eq("status", "pending")
      .order("created_at", { ascending: false });

    if (error) {
      throw error;
    }

    setInvites((data ?? []) as InviteRow[]);
  }, [accountId, supabase]);

  const reload = useCallback(async () => {
    setIsLoading(true);
    try {
      await Promise.all([loadMembers(), loadInvites()]);
    } catch (error) {
      console.error("[AccountSettingsMembersPanel] load error:", error);
      toast.error(t("errors.internalServer"));
    } finally {
      setIsLoading(false);
    }
  }, [loadInvites, loadMembers, t]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const startEditRole = (member: MemberProfile) => {
    setEditingMemberId(member.user_id);
    setEditingRole(member.role);
  };

  const cancelEditRole = () => {
    setEditingMemberId(null);
    setEditingRole("viewer");
  };

  const saveMemberRole = async () => {
    if (!editingMemberId || !canManageMembers || isUpdatingMember) return;

    setIsUpdatingMember(true);
    const { error } = await supabase
      .from("account_members")
      .update({ role: editingRole })
      .eq("account_id", accountId)
      .eq("user_id", editingMemberId);

    if (error) {
      toast.error(t("accountSettings.members.updateRoleError"));
      setIsUpdatingMember(false);
      return;
    }

    toast.success(t("accountSettings.members.updateRoleSuccess"));
    cancelEditRole();
    await reload();
    setIsUpdatingMember(false);
  };

  const removeMember = async (member: MemberProfile) => {
    if (!canManageMembers || member.user_id === currentUserId) return;

    const confirmed = window.confirm(t("accountSettings.members.removeMemberConfirm"));
    if (!confirmed) return;

    const { error } = await supabase
      .from("account_members")
      .delete()
      .eq("account_id", accountId)
      .eq("user_id", member.user_id);

    if (error) {
      toast.error(t("accountSettings.members.removeMemberError"));
      return;
    }

    toast.success(t("accountSettings.members.removeMemberSuccess"));
    await reload();
  };

  const sendInvite = async (email: string, role: MemberRole, isResend = false) => {
    const trimmedEmail = email.trim();
    if (!trimmedEmail) return;

    setIsSendingInvite(true);

    try {
      const response = await fetch("/api/invites/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountId, email: trimmedEmail, role }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        if (typeof payload?.errorKey === "string") {
          toast.error(t(payload.errorKey));
        } else {
          toast.error(t("invites.sendError"));
        }
        return;
      }

      const payload = await response.json();
      if (payload?.status === "already_member") {
        toast.info(t("invites.registeredAlreadyMember"));
        return;
      }

      if (payload?.status === "pending") {
        toast.info(t("invites.registeredPending"));
        return;
      }

      toast.success(isResend ? t("accountSettings.members.resendSuccess") : t("invites.sendSuccess"));
      setInviteEmail("");
      setInviteRole("viewer");
      setIsInviteComposerOpen(false);
      await loadInvites();
    } catch (error) {
      console.error("[AccountSettingsMembersPanel] send invite error:", error);
      toast.error(t("invites.sendError"));
    } finally {
      setIsSendingInvite(false);
    }
  };

  const revokeInvite = async (inviteId: string) => {
    const { error } = await supabase
      .from("invites")
      .update({ status: "revoked", responded_at: new Date().toISOString() })
      .eq("id", inviteId);

    if (error) {
      toast.error(t("invites.revokeError"));
      return;
    }

    toast.success(t("invites.revokeSuccess"));
    await loadInvites();
  };

  if (isLoading) {
    return <p className={styles.pageDescription}>{t("common.loading")}</p>;
  }

  return (
    <div>
      <section>
        <h2 className={styles.subsectionTitle}>{t("accountSettings.members.activeMembers")}</h2>

        <div className={styles.membersCard}>
          {members.length === 0 ? (
            <p className={styles.emptyState}>{t("account.participantsEmpty")}</p>
          ) : (
            members.map((member, index) => {
              const isCurrentUser = member.user_id === currentUserId;
              const isEditing = editingMemberId === member.user_id;
              const fallbackName =
                member.name || member.email || t("account.memberFallback", { id: member.user_id.slice(0, 6) });
              const displayName = isCurrentUser ? t("account.youLabel") : fallbackName;
              const avatarInitials = getInitials(member.name || member.email || "?");

              return (
                <div
                  key={`${member.user_id}-${member.role}`}
                  className={cn(styles.memberRow, isEditing && styles.memberRowEditing)}
                >
                  <div className={styles.memberMain}>
                    <div
                      className={cn(styles.memberAvatar, isCurrentUser && styles.memberAvatarYou)}
                      style={
                        isCurrentUser
                          ? undefined
                          : {
                              backgroundColor:
                                AVATAR_BACKGROUNDS[index % AVATAR_BACKGROUNDS.length],
                            }
                      }
                    >
                      {avatarInitials}
                    </div>
                    <div className={styles.memberInfo}>
                      <p className={styles.memberName}>{displayName}</p>
                      {!isCurrentUser && member.email ? (
                        <p className={styles.memberEmail}>{member.email}</p>
                      ) : null}
                    </div>
                  </div>

                  <div className={styles.memberAside}>
                    <span
                      className={cn(
                        styles.roleBadge,
                        member.role === "admin" ? styles.roleBadgeAdmin : styles.roleBadgeDefault
                      )}
                    >
                      {member.role}
                    </span>

                    {canManageMembers && !isCurrentUser ? (
                      isEditing ? (
                        <div className={styles.roleEditor}>
                          <select
                            className={styles.roleSelect}
                            value={editingRole}
                            onChange={(event) => setEditingRole(event.target.value as MemberRole)}
                            disabled={isUpdatingMember}
                          >
                            <option value="admin">{humanizeRole("admin", roleLocale)}</option>
                            <option value="contributor">
                              {humanizeRole("contributor", roleLocale)}
                            </option>
                            <option value="viewer">{humanizeRole("viewer", roleLocale)}</option>
                          </select>
                          <button
                            type="button"
                            className={styles.iconButton}
                            onClick={saveMemberRole}
                            disabled={isUpdatingMember}
                            aria-label={t("common.save")}
                          >
                            <Check size={14} />
                          </button>
                          <button
                            type="button"
                            className={styles.iconButton}
                            onClick={cancelEditRole}
                            disabled={isUpdatingMember}
                            aria-label={t("common.cancel")}
                          >
                            <X size={14} />
                          </button>
                        </div>
                      ) : (
                        <div className={styles.memberActions}>
                          <button
                            type="button"
                            className={styles.iconButton}
                            onClick={() => startEditRole(member)}
                            aria-label={t("common.edit")}
                          >
                            <Pencil size={14} />
                          </button>
                          <button
                            type="button"
                            className={cn(styles.iconButton, styles.iconButtonDanger)}
                            onClick={() => {
                              void removeMember(member);
                            }}
                            aria-label={t("common.delete")}
                          >
                            <X size={14} />
                          </button>
                        </div>
                      )
                    ) : null}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </section>

      <section className={styles.invitesSection}>
        <div className={styles.invitesHeader}>
          <h2 className={styles.invitesTitle}>
            {t("accountSettings.members.invitations")}
            <span className={styles.invitesPending}>
              · {t("accountSettings.members.pendingInvites", { count: invites.length })}
            </span>
          </h2>

          {canManageMembers ? (
            <button
              type="button"
              className={styles.inviteButton}
              onClick={() => setIsInviteComposerOpen((current) => !current)}
            >
              <Plus size={14} />
              {t("accountSettings.members.inviteButton")}
            </button>
          ) : null}
        </div>

        {isInviteComposerOpen ? (
          <div className={styles.inviteComposer}>
            <div className={styles.inviteComposerRow}>
              <input
                type="email"
                value={inviteEmail}
                onChange={(event) => setInviteEmail(event.target.value)}
                placeholder={t("login.emailPlaceholder")}
                className={styles.input}
              />
              <select
                className={styles.select}
                value={inviteRole}
                onChange={(event) => setInviteRole(event.target.value as MemberRole)}
              >
                <option value="viewer">{humanizeRole("viewer", roleLocale)}</option>
                <option value="contributor">{humanizeRole("contributor", roleLocale)}</option>
                <option value="admin">{humanizeRole("admin", roleLocale)}</option>
              </select>
              <button
                type="button"
                className={styles.inviteSendButton}
                disabled={isSendingInvite || inviteEmail.trim().length === 0}
                onClick={() => {
                  void sendInvite(inviteEmail, inviteRole);
                }}
              >
                {isSendingInvite ? t("common.saving") : t("invites.createButton")}
              </button>
            </div>
          </div>
        ) : null}

        <div className={styles.invitesCard}>
          {invites.length === 0 ? (
            <p className={styles.emptyState}>{t("accountSettings.members.emptyInvites")}</p>
          ) : (
            invites.map((invite) => {
              const inviteEmailValue = invite.invited_email || invite.invitee_email || "";
              const sentAgo = getSentAgo(invite.created_at, locale);

              return (
                <div key={invite.id} className={styles.inviteRow}>
                  <div className={styles.inviteMain}>
                    <div className={styles.inviteIcon}>✉️</div>
                    <div className={styles.inviteInfo}>
                      <p className={styles.inviteEmail}>{inviteEmailValue}</p>
                      <p className={styles.inviteMeta}>
                        {t("accountSettings.members.inviteMeta", {
                          sentAgo,
                          role: humanizeRole(invite.role, roleLocale),
                        })}
                      </p>
                    </div>
                  </div>

                  <div className={styles.inviteAside}>
                    <span className={styles.pendingBadge}>
                      {t("accountSettings.members.pendingStatus")}
                    </span>
                    <div className={styles.inviteActions}>
                      <button
                        type="button"
                        className={styles.inviteAction}
                        onClick={() => {
                          void sendInvite(inviteEmailValue, invite.role, true);
                        }}
                      >
                        <RefreshCw size={12} />
                        {t("accountSettings.members.resendButton")}
                      </button>
                      <button
                        type="button"
                        className={cn(styles.inviteAction, styles.inviteActionDanger)}
                        onClick={() => {
                          void revokeInvite(invite.id);
                        }}
                        aria-label={t("common.delete")}
                      >
                        <X size={12} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </section>
    </div>
  );
}
