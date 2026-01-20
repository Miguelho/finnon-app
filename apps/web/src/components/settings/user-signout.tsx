"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { signOutAndReset } from "@poleursus/shared";
import { toast } from "sonner";
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

const STORAGE_KEY = "finnon:activeAccountId";

export function UserSignOutRow() {
  const t = useTranslations();
  const router = useRouter();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);

  const clearActiveAccount = async () => {
    localStorage.removeItem(STORAGE_KEY);
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
      <AlertDialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <AlertDialogTrigger asChild>
          <button
            type="button"
            disabled={isSigningOut}
            className="flex w-full items-start justify-between gap-2 rounded-md px-2 py-2 text-left text-sm font-semibold text-foreground transition hover:bg-muted/50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <div>
              <p>{t("settings.signOut.label")}</p>
              <p className="text-xs font-normal text-muted-foreground">
                {t("settings.signOut.description")}
              </p>
            </div>
            <span className="text-muted-foreground">›</span>
          </button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("settings.signOut.confirmTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("settings.signOut.confirmDescription")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSigningOut}>
              {t("settings.signOut.confirmCancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={handleSignOut}
              disabled={isSigningOut}
            >
              {isSigningOut ? t("common.loading") : t("settings.signOut.confirmAction")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
