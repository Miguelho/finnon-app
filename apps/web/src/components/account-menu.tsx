"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  SlidePanel,
  SlidePanelBody,
  SlidePanelContent,
  SlidePanelDescription,
  SlidePanelHeader,
  SlidePanelTitle,
} from "@/components/ui/slide-panel";
import { cn } from "@/lib/utils";

type Account = {
  id: string;
  name: string;
  base_currency: string;
  memberCount: number;
};

type MemberProfile = {
  user_id: string;
  role: "viewer" | "contributor" | "admin";
  name: string | null;
  email: string | null;
};

type AccountMenuLabels = {
  title: string;
  description: string;
  detailLabel: string;
  participantsLabel: string;
  participantsEmpty: string;
  participantsError: string;
  participantsLoading: string;
  memberFallbackLabel: string;
  activeBadge: string;
  selectBadge: string;
  youLabel: string;
};

type AccountMenuProps = {
  accounts: Account[];
  initialActiveAccountId: string;
  currentUserId: string;
  labels: AccountMenuLabels;
};

const STORAGE_KEY = "finnon:activeAccountId";

export function AccountMenu({
  accounts,
  initialActiveAccountId,
  currentUserId,
  labels,
}: AccountMenuProps) {
  const [activeAccountId, setActiveAccountId] = useState(initialActiveAccountId);
  const [members, setMembers] = useState<MemberProfile[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [membersError, setMembersError] = useState<string | null>(null);
  const [isPanelOpen, setIsPanelOpen] = useState(false);

  const activeAccount = useMemo(
    () => accounts.find((account) => account.id === activeAccountId) ?? accounts[0],
    [accounts, activeAccountId]
  );

  const syncActiveAccount = async (accountId: string) => {
    localStorage.setItem(STORAGE_KEY, accountId);
    await fetch("/api/active-account", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accountId }),
    });
  };

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && accounts.some((account) => account.id === stored)) {
      setActiveAccountId(stored);
      void syncActiveAccount(stored);
    } else if (initialActiveAccountId) {
      void syncActiveAccount(initialActiveAccountId);
    }
  }, [accounts, initialActiveAccountId]);

  useEffect(() => {
    let cancelled = false;

    async function loadMembers() {
      if (!activeAccount?.id) return;
      setLoadingMembers(true);
      setMembersError(null);

      try {
        const response = await fetch("/api/profiles", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ accountId: activeAccount.id }),
        });

        if (!response.ok) {
          const errorBody = await response.json().catch(() => ({}));
          throw new Error(errorBody.error || "Error cargando participantes");
        }

        const payload = await response.json();
        if (!cancelled) {
          setMembers(payload?.members ?? []);
        }
      } catch (error) {
        console.error("[AccountMenu] Error loading members:", error);
        if (!cancelled) {
          setMembers([]);
          setMembersError("error");
        }
      } finally {
        if (!cancelled) setLoadingMembers(false);
      }
    }

    loadMembers();
    return () => {
      cancelled = true;
    };
  }, [activeAccount?.id]);

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>{labels.title}</CardTitle>
          <CardDescription>{labels.description}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {accounts.map((account) => {
            const isActive = account.id === activeAccount?.id;
            return (
              <button
                key={account.id}
                type="button"
                onClick={() => {
                  setActiveAccountId(account.id);
                  void syncActiveAccount(account.id);
                  setIsPanelOpen(true);
                }}
                className={cn(
                  "flex w-full items-center justify-between rounded-lg border px-4 py-3 text-left transition",
                  isActive ? "border-primary/60 bg-muted" : "border-border hover:bg-muted/50"
                )}
              >
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-foreground">
                    {account.name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {account.base_currency} • {account.memberCount} participantes
                  </p>
                </div>
                <span
                  className={cn(
                    "rounded-full border px-3 py-1 text-xs font-semibold",
                    isActive
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border text-muted-foreground"
                  )}
                >
                  {isActive ? labels.activeBadge : labels.selectBadge}
                </span>
              </button>
            );
          })}
        </CardContent>
      </Card>

      <SlidePanel open={isPanelOpen} onOpenChange={setIsPanelOpen}>
        <SlidePanelContent>
          <SlidePanelHeader>
            <SlidePanelTitle>{labels.detailLabel}</SlidePanelTitle>
            <SlidePanelDescription>
              {activeAccount?.name ?? "-"}
            </SlidePanelDescription>
          </SlidePanelHeader>
          <SlidePanelBody className="space-y-4">
            <div>
              <p className="text-sm font-semibold text-foreground">
                {labels.participantsLabel} ({members.length})
              </p>
            </div>

            {loadingMembers ? (
              <p className="text-sm text-muted-foreground">
                {labels.participantsLoading}
              </p>
            ) : membersError ? (
              <p className="text-sm text-destructive">{labels.participantsError}</p>
            ) : members.length === 0 ? (
              <p className="text-sm text-muted-foreground">{labels.participantsEmpty}</p>
            ) : (
              <div className="space-y-2">
                {members.map((member) => {
                  const isCurrentUser = member.user_id === currentUserId;
                  const name =
                    member.name ||
                    member.email ||
                    `${labels.memberFallbackLabel} ${member.user_id.slice(0, 6)}`;
                  const displayName = isCurrentUser
                    ? member.name || labels.youLabel
                    : name;
                  return (
                    <div
                      key={`${member.user_id}-${member.role}`}
                      className="flex items-center justify-between rounded-md border px-3 py-2"
                    >
                      <p className="text-sm font-medium text-foreground">
                        {displayName}
                      </p>
                      <span className="rounded-full bg-muted px-2 py-1 text-xs font-semibold uppercase text-primary">
                        {member.role}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </SlidePanelBody>
        </SlidePanelContent>
      </SlidePanel>
    </>
  );
}
