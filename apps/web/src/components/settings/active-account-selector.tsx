"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { formatParticipantCount } from "@poleursus/shared";

type Account = {
  id: string;
  name: string;
  base_currency: string;
  memberCount: number;
};

type ActiveAccountSelectorProps = {
  accounts: Account[];
  initialActiveAccountId: string;
};

const STORAGE_KEY = "finnon:activeAccountId";

export function ActiveAccountSelector({
  accounts,
  initialActiveAccountId,
}: ActiveAccountSelectorProps) {
  const router = useRouter();
  const t = useTranslations();
  const locale = useLocale();
  const [activeAccountId, setActiveAccountId] = useState(initialActiveAccountId);
  const lastSyncedAccountId = useRef<string | null>(null);

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
    if (accounts.length === 0) return;

    const stored = localStorage.getItem(STORAGE_KEY);
    const storedIsValid =
      stored !== null && accounts.some((account) => account.id === stored);
    const desiredAccountId = storedIsValid ? stored : initialActiveAccountId;

    if (!desiredAccountId) return;

    if (desiredAccountId !== activeAccountId) {
      setActiveAccountId(desiredAccountId);
    }

    if (!storedIsValid) {
      localStorage.setItem(STORAGE_KEY, desiredAccountId);
      return;
    }

    if (desiredAccountId === initialActiveAccountId) {
      return;
    }

    if (lastSyncedAccountId.current === desiredAccountId) return;
    lastSyncedAccountId.current = desiredAccountId;

    void syncActiveAccount(desiredAccountId)
      .then(() => {
        router.refresh();
      })
      .catch(() => {
        lastSyncedAccountId.current = null;
      });
  }, [accounts, initialActiveAccountId, activeAccountId, router]);

  if (accounts.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        {t("errors.accountNotFound")}
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {accounts.map((account) => {
        const isActive = account.id === activeAccount?.id;
        return (
          <button
            key={account.id}
            type="button"
            onClick={async () => {
              setActiveAccountId(account.id);
              await syncActiveAccount(account.id);
              router.refresh();
            }}
            className={cn(
              "flex w-full items-center justify-between rounded-lg border px-4 py-3 text-left transition",
              isActive
                ? "border-primary/60 bg-muted"
                : "border-border hover:bg-muted/50"
            )}
          >
            <div className="space-y-1">
              <p className="text-sm font-semibold text-foreground">
                {account.name}
              </p>
              <p className="text-xs text-muted-foreground">
                {account.base_currency} ·{" "}
                {formatParticipantCount(locale, account.memberCount)}
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
              {isActive
                ? t("dashboard.accountsActiveBadge")
                : t("dashboard.accountsSelectBadge")}
            </span>
          </button>
        );
      })}
    </div>
  );
}
