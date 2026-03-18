"use client";

import { useCallback, useEffect, useRef } from "react";
import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { AddAction } from "@/components/home/add-action";

type AddActionTriggerProps = {
  canEdit: boolean;
  accountId: string;
  variant?: "top-nav" | "bottom-nav" | "footer-center" | "hidden";
  registerExternalOpen?: (open: (() => void) | null) => void;
};

export function AddActionTrigger({
  canEdit,
  accountId,
  variant = "top-nav",
  registerExternalOpen,
}: AddActionTriggerProps) {
  const router = useRouter();
  const t = useTranslations();
  const externalOpenRef = useRef<(() => void) | null>(null);
  const prefetchedMovementRef = useRef(false);

  const label = t("home.addCta");
  const isBottomStyle = variant === "bottom-nav" || variant === "footer-center";
  const triggerClassName =
    variant === "bottom-nav"
      ? "group flex flex-1 flex-col items-center gap-1 py-2 text-[10px] font-medium text-primary transition-transform active:scale-95 disabled:cursor-not-allowed disabled:opacity-70"
      : variant === "footer-center"
        ? "group fixed bottom-5 left-1/2 z-40 hidden -translate-x-1/2 flex-col items-center gap-1 text-[11px] font-medium text-primary transition-transform active:scale-95 disabled:cursor-not-allowed disabled:opacity-70 sm:flex"
      : variant === "hidden"
        ? "hidden"
        : "inline-flex items-center gap-2 rounded-full bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-70 sm:px-4 sm:py-1.5";

  const prefetchMovementRoute = useCallback(() => {
    if (!canEdit || prefetchedMovementRef.current) return;
    prefetchedMovementRef.current = true;
    router.prefetch("/transactions/create");
  }, [canEdit, router]);

  useEffect(() => {
    if (!canEdit) return;

    const idleWindow = window as Window & {
      requestIdleCallback?: (callback: () => void) => number;
      cancelIdleCallback?: (handle: number) => void;
    };

    if (typeof idleWindow.requestIdleCallback === "function") {
      const idleHandle = idleWindow.requestIdleCallback(prefetchMovementRoute);
      return () => {
        idleWindow.cancelIdleCallback?.(idleHandle);
      };
    }

    const timeoutId = window.setTimeout(prefetchMovementRoute, 250);
    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [canEdit, prefetchMovementRoute]);

  useEffect(() => {
    if (!registerExternalOpen) return;
    registerExternalOpen(() => {
      externalOpenRef.current?.();
    });
    return () => {
      registerExternalOpen(null);
    };
  }, [registerExternalOpen]);

  return (
    <AddAction
      canEdit={canEdit}
      accountId={accountId}
      renderTrigger={(open) => (
        (() => {
          const openMenu = () => {
            prefetchMovementRoute();
            open();
          };
          externalOpenRef.current = openMenu;

          return (
            <button
              type="button"
              onClick={openMenu}
              onPointerEnter={prefetchMovementRoute}
              onFocus={prefetchMovementRoute}
              className={triggerClassName}
              aria-label={label}
            >
              {isBottomStyle ? (
                <span className="relative -mt-4 inline-flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-colors group-hover:bg-primary/90">
                  <Plus className="h-5 w-5" />
                </span>
              ) : (
                <Plus className="h-4 w-4" />
              )}
              {isBottomStyle && <span>{label}</span>}
              {variant === "top-nav" && (
                <span className="hidden sm:inline">{label}</span>
              )}
            </button>
          );
        })()
      )}
    />
  );
}
