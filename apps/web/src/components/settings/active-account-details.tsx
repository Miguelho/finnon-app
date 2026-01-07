"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useNetworkNotice } from "@/components/network/network-notice";

type MemberProfile = {
  user_id: string;
  role: "viewer" | "contributor" | "admin";
  name: string | null;
  email: string | null;
};

type ActiveAccountDetailsProps = {
  account: {
    id: string;
    name: string;
    base_currency: string;
  };
  currentUserId: string;
};

export function ActiveAccountDetails({
  account,
  currentUserId,
}: ActiveAccountDetailsProps) {
  const t = useTranslations();
  const { reportNetworkIssue } = useNetworkNotice();
  const [members, setMembers] = useState<MemberProfile[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadMembers() {
      setIsLoading(true);
      setHasError(false);
      try {
        const response = await fetch("/api/profiles", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ accountId: account.id }),
        });

        if (!response.ok) {
          throw new Error("profiles_load_failed");
        }

        const payload = await response.json();
        if (!cancelled) {
          setMembers(payload?.members ?? []);
        }
      } catch (error) {
        if (!cancelled) {
          setHasError(true);
          setMembers([]);
        }
        reportNetworkIssue();
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    loadMembers();
    return () => {
      cancelled = true;
    };
  }, [account.id, reportNetworkIssue]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("account.title")}</CardTitle>
        <CardDescription>{t("account.description")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            {t("account.labelAccount")}
          </p>
          <p className="text-lg font-semibold text-foreground">{account.name}</p>
          <p className="text-sm text-muted-foreground">
            {t("account.baseCurrencyLabel", { currency: account.base_currency })}
          </p>
        </div>

        <div className="space-y-3">
          <p className="text-sm font-semibold text-foreground">
            {t("account.participantsLabel", { count: members.length })}
          </p>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">
              {t("dashboard.participantsLoading")}
            </p>
          ) : hasError ? (
            <p className="text-sm text-muted-foreground">
              {t("account.participantsLoadError")}
            </p>
          ) : members.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {t("account.participantsEmpty")}
            </p>
          ) : (
            <div className="space-y-2">
              {members.map((member) => {
                const isCurrentUser = member.user_id === currentUserId;
                const fallback = t("account.memberFallback", {
                  id: member.user_id.slice(0, 6),
                });
                const displayName =
                  member.name ||
                  member.email ||
                  (isCurrentUser ? t("account.youLabel") : fallback);

                return (
                  <div
                    key={`${member.user_id}-${member.role}`}
                    className="flex items-center justify-between rounded-md border px-3 py-2"
                  >
                    <div>
                      <p className="text-sm font-medium text-foreground">
                        {isCurrentUser ? t("account.youLabel") : displayName}
                      </p>
                      {member.email && !isCurrentUser && (
                        <p className="text-xs text-muted-foreground">
                          {member.email}
                        </p>
                      )}
                    </div>
                    <span className="rounded-full bg-muted px-2 py-1 text-xs font-semibold uppercase text-primary">
                      {member.role}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
