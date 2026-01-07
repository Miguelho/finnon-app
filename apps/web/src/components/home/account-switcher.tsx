"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { ChevronDown, Loader2 } from "lucide-react";
import {
  SlidePanel,
  SlidePanelBody,
  SlidePanelContent,
  SlidePanelHeader,
  SlidePanelTitle,
} from "@/components/ui/slide-panel";
import { useNetworkNotice } from "@/components/network/network-notice";
import { cn } from "@/lib/utils";
import { formatParticipantCount } from "@poleursus/shared";

type Account = {
  id: string;
  name: string;
  base_currency: string;
  memberCount: number;
};

type AccountSwitcherProps = {
  accounts: Account[];
  initialActiveAccountId: string;
};

const STORAGE_KEY = "finnon:activeAccountId";

export function AccountSwitcher({
  accounts,
  initialActiveAccountId,
}: AccountSwitcherProps) {
  const router = useRouter();
  const t = useTranslations();
  const locale = useLocale();
  const { reportNetworkIssue } = useNetworkNotice();
  const [activeAccountId, setActiveAccountId] = useState(initialActiveAccountId);
  const [isOpen, setIsOpen] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isPending, startTransition] = useTransition();
  const lastSyncedAccountId = useRef<string | null>(null);
  const isSwitching = isSyncing || isPending;

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

    setIsSyncing(true);
    void syncActiveAccount(desiredAccountId)
      .then(() => {
        startTransition(() => {
          router.refresh();
        });
      })
      .catch(() => {
        lastSyncedAccountId.current = null;
        reportNetworkIssue();
      })
      .finally(() => {
        setIsSyncing(false);
      });
  }, [
    accounts,
    initialActiveAccountId,
    activeAccountId,
    router,
    reportNetworkIssue,
    startTransition,
  ]);

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className={cn(
          "inline-flex max-w-[260px] items-center gap-2 rounded-full border border-border bg-muted px-4 py-2 text-sm font-semibold text-foreground transition-colors",
          isSwitching ? "cursor-wait opacity-70" : "hover:bg-muted/80"
        )}
        disabled={isSwitching}
        aria-busy={isSwitching}
      >
        <span className="truncate">
          {activeAccount?.name ?? t("account.labelAccount")} · {activeAccount?.base_currency ?? ""}
        </span>
        {isSwitching ? (
          <Loader2 className="h-4 w-4 shrink-0 animate-spin opacity-60" />
        ) : (
          <ChevronDown className="h-4 w-4 shrink-0 opacity-60" />
        )}
      </button>

      <SlidePanel open={isOpen} onOpenChange={setIsOpen}>
        <SlidePanelContent>
          <SlidePanelHeader>
            <SlidePanelTitle>{t("dashboard.accountsTitle")}</SlidePanelTitle>
          </SlidePanelHeader>
          <SlidePanelBody className="space-y-3">
            {accounts.map((account) => {
              const isActive = account.id === activeAccount?.id;
              return (
                <button
                  key={account.id}
                  type="button"
                  onClick={async () => {
                    setActiveAccountId(account.id);
                    setIsOpen(false);
                    setIsSyncing(true);
                    try {
                      await syncActiveAccount(account.id);
                      startTransition(() => {
                        router.refresh();
                      });
                    } catch (error) {
                      reportNetworkIssue();
                    } finally {
                      setIsSyncing(false);
                    }
                  }}
                  className={cn(
                    "flex w-full items-center justify-between rounded-lg border px-4 py-3 text-left transition",
                    isActive
                      ? "border-primary/60 bg-muted"
                      : "border-border hover:bg-muted/50"
                  )}
                  disabled={isSwitching}
                >
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-foreground">
                      {account.name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {account.base_currency} · {formatParticipantCount(locale, account.memberCount)}
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
                    {isActive ? t("dashboard.accountsActiveBadge") : t("dashboard.accountsSelectBadge")}
                  </span>
                </button>
              );
            })}
          </SlidePanelBody>
        </SlidePanelContent>
      </SlidePanel>
    </>
  );
}
