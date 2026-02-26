"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { ConfirmationModal, signOutAndReset } from "@poleursus/shared";
import { toast } from "sonner";
import { webDataCacheClient } from "@/cache/client";

const STORAGE_KEY = "finnon:activeAccountId";

export function UserSignOutRow() {
  const t = useTranslations();
  const router = useRouter();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);

  const closeDialog = () => {
    if (!isSigningOut) setIsDialogOpen(false);
  };

  const clearActiveAccount = async () => {
    localStorage.removeItem(STORAGE_KEY);
    await webDataCacheClient.clearAll();
  };

  const handleSignOut = async () => {
    setIsSigningOut(true);

    try {
      await signOutAndReset({
        signOut: async () => {
          const res = await fetch("/api/auth/signout", {
            method: "POST",
            credentials: "include",
          });
          if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            throw new Error(
              typeof data?.error === "string" ? data.error : "Sign out failed"
            );
          }
        },
        clearLocalSessionArtifacts: clearActiveAccount,
        onReset: () => setIsDialogOpen(false),
        onNavigate: () => router.replace("/login"),
      });
    } catch (error) {
      console.error("[UserSignOut] Sign out failed:", error);
      toast.error(t("settings.signOut.error"));
    } finally {
      setIsSigningOut(false);
    }
  };

  return (
    <div className="border-t pt-4">
      <button
        type="button"
        disabled={isSigningOut}
        className="flex w-full items-start justify-between gap-2 rounded-md px-2 py-2 text-left text-sm font-semibold text-foreground transition hover:bg-muted/50 disabled:cursor-not-allowed disabled:opacity-60"
        onClick={() => setIsDialogOpen(true)}
      >
        <div>
          <p>{t("settings.signOut.label")}</p>
          <p className="text-xs font-normal text-muted-foreground">
            {t("settings.signOut.description")}
          </p>
        </div>
        <span className="text-muted-foreground">›</span>
      </button>
      <ConfirmationModal
        open={isDialogOpen}
        title={t("settings.signOut.confirmTitle")}
        description={t("settings.signOut.confirmDescription")}
        confirmLabel={
          isSigningOut ? t("common.loading") : t("settings.signOut.confirmAction")
        }
        cancelLabel={t("settings.signOut.confirmCancel")}
        onConfirm={handleSignOut}
        onCancel={closeDialog}
        confirmLoading={isSigningOut}
        confirmDisabled={isSigningOut}
        cancelDisabled={isSigningOut}
        dismissOnBackdrop={!isSigningOut}
        tone="destructive"
      />
    </div>
  );
}
