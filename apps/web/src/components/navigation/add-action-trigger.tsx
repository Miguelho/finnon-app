"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { AddAction } from "@/components/home/add-action";
import {
  getAddActionDataSnapshot,
  loadAddActionData,
  primeAddActionData,
  type AddActionCategory,
  type AddActionDataPayload,
} from "@/lib/add-action-data-cache";
import type { TopCategory, MerchantSuggestion } from "@poleursus/shared";

type Category = AddActionCategory;

type AddActionTriggerProps = {
  canEdit: boolean;
  accountId: string;
  currency: string;
  locale: string;
  variant?: "top-nav" | "bottom-nav";
};

function upsertCategory(items: Category[], category: Category) {
  if (items.some((item) => item.id === category.id)) {
    return items;
  }
  return [...items, category].sort((a, b) => a.name.localeCompare(b.name));
}

export function AddActionTrigger({
  canEdit,
  accountId,
  currency,
  locale,
  variant = "top-nav",
}: AddActionTriggerProps) {
  const t = useTranslations();
  const [categories, setCategories] = useState<Category[]>([]);
  const [topCategories, setTopCategories] = useState<{
    expense: TopCategory[];
    income: TopCategory[];
  }>({ expense: [], income: [] });
  const [merchantSuggestions, setMerchantSuggestions] = useState<{
    expense: MerchantSuggestion[];
    income: MerchantSuggestion[];
  }>({ expense: [], income: [] });
  const [isLoading, setIsLoading] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);
  const currentAccountIdRef = useRef(accountId);

  useEffect(() => {
    currentAccountIdRef.current = accountId;
  }, [accountId]);

  const applyPayload = useCallback((payload: AddActionDataPayload) => {
    setCategories(payload.categories ?? []);
    setTopCategories(payload.topCategories ?? { expense: [], income: [] });
    setMerchantSuggestions(
      payload.merchantSuggestions ?? { expense: [], income: [] }
    );
    setHasLoaded(true);
  }, []);

  const loadData = useCallback(
    async ({
      force = false,
      blocking = true,
      showErrorToast = true,
    }: {
      force?: boolean;
      blocking?: boolean;
      showErrorToast?: boolean;
    } = {}) => {
      if (!accountId) return false;

      if (blocking) setIsLoading(true);
      try {
        const payload = await loadAddActionData(accountId, { force });
        if (currentAccountIdRef.current !== accountId) {
          return false;
        }
        applyPayload(payload);
        return true;
      } catch (error) {
        console.error("[AddActionTrigger] Error loading add data:", error);
        if (showErrorToast) {
          toast.error(t("common.errorTitle"));
        }
        return false;
      } finally {
        if (blocking) setIsLoading(false);
      }
    },
    [accountId, applyPayload, t]
  );

  useEffect(() => {
    let cancelled = false;

    setCategories([]);
    setTopCategories({ expense: [], income: [] });
    setMerchantSuggestions({ expense: [], income: [] });
    setHasLoaded(false);

    if (!accountId) return;

    const snapshot = getAddActionDataSnapshot(accountId);
    if (snapshot.payload) {
      applyPayload(snapshot.payload);
    }

    if (canEdit && snapshot.payload && snapshot.isStale) {
      void (async () => {
        try {
          const payload = await loadAddActionData(accountId, { force: true });
          if (cancelled) return;
          applyPayload(payload);
        } catch (error) {
          console.warn(
            "[AddActionTrigger] Background refresh failed for add data:",
            error
          );
        }
      })();
    }

    return () => {
      cancelled = true;
    };
  }, [accountId, applyPayload, canEdit]);

  const handleCategoryCreated = useCallback(
    (created: Category) => {
      setCategories((prev) => upsertCategory(prev, created));
      setHasLoaded(true);

      const snapshot = getAddActionDataSnapshot(accountId);
      const payload = snapshot.payload ?? {
        categories,
        topCategories,
        merchantSuggestions,
      };

      primeAddActionData(accountId, {
        ...payload,
        categories: upsertCategory(payload.categories, created),
      });
    },
    [accountId, categories, merchantSuggestions, topCategories]
  );

  const handleOpen = async (open: () => void) => {
    if (isLoading) return;

    if (!canEdit) {
      open();
      return;
    }

    const snapshot = getAddActionDataSnapshot(accountId);
    if (hasLoaded || snapshot.payload) {
      if (snapshot.payload && !hasLoaded) {
        applyPayload(snapshot.payload);
      }
      open();

      if (snapshot.payload && snapshot.isStale) {
        void loadData({
          force: true,
          blocking: false,
          showErrorToast: false,
        });
      }
      return;
    }

    const ok = await loadData({
      blocking: true,
      showErrorToast: true,
    });
    if (!ok) return;
    open();
  };

  const label = t("home.addCta");
  const triggerClassName =
    variant === "bottom-nav"
      ? "relative -mt-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-70"
      : "inline-flex items-center gap-2 rounded-full bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-70 sm:px-4 sm:py-1.5";

  return (
    <AddAction
      canEdit={canEdit}
      accountId={accountId}
      currency={currency}
      locale={locale}
      categories={categories}
      topCategories={topCategories}
      merchantSuggestions={merchantSuggestions}
      onCategoryCreated={handleCategoryCreated}
      renderTrigger={(open) => (
        <button
          type="button"
          onClick={() => void handleOpen(open)}
          className={triggerClassName}
          aria-label={label}
          aria-busy={isLoading}
          disabled={isLoading}
        >
          {isLoading ? (
            <Loader2
              className={`${variant === "bottom-nav" ? "h-5 w-5" : "h-4 w-4"} animate-spin`}
            />
          ) : (
            <Plus className={variant === "bottom-nav" ? "h-5 w-5" : "h-4 w-4"} />
          )}
          {variant === "top-nav" && (
            <span className="hidden sm:inline">{label}</span>
          )}
        </button>
      )}
    />
  );
}
