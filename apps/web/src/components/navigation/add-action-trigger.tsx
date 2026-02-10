"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { AddAction } from "@/components/home/add-action";
import type { TopCategory, MerchantSuggestion } from "@poleursus/shared";

type Category = {
  id: string;
  name: string;
  icon_id: string;
  type: "income" | "expense";
};

type AddActionTriggerProps = {
  canEdit: boolean;
  accountId: string;
  currency: string;
  locale: string;
  variant?: "top-nav" | "bottom-nav";
};

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

  useEffect(() => {
    setCategories([]);
    setTopCategories({ expense: [], income: [] });
    setMerchantSuggestions({ expense: [], income: [] });
    setHasLoaded(false);
  }, [accountId]);

  const loadData = useCallback(async () => {
    if (!accountId || isLoading || hasLoaded) return hasLoaded;

    setIsLoading(true);
    try {
      const response = await fetch(
        `/api/add-action-data?accountId=${encodeURIComponent(accountId)}`,
        { cache: "no-store" }
      );
      if (!response.ok) {
        throw new Error("Failed to load add action data");
      }

      const payload = (await response.json()) as {
        categories?: Category[];
        topCategories?: {
          expense: TopCategory[];
          income: TopCategory[];
        };
        merchantSuggestions?: {
          expense: MerchantSuggestion[];
          income: MerchantSuggestion[];
        };
      };

      setCategories(payload.categories ?? []);
      setTopCategories(
        payload.topCategories ?? { expense: [], income: [] }
      );
      setMerchantSuggestions(
        payload.merchantSuggestions ?? { expense: [], income: [] }
      );
      setHasLoaded(true);
      return true;
    } catch (error) {
      console.error("[AddActionTrigger] Error loading add data:", error);
      toast.error(t("common.errorTitle"));
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [accountId, hasLoaded, isLoading, t]);

  const handleOpen = async (open: () => void) => {
    if (isLoading) return;
    if (canEdit && !hasLoaded) {
      const ok = await loadData();
      if (!ok) return;
    }
    open();
  };

  const label = t("home.addCta");
  const triggerClassName =
    variant === "bottom-nav"
      ? "relative -mt-4 flex h-12 w-12 items-center justify-center rounded-full bg-gray-900 text-white shadow-lg"
      : "inline-flex items-center gap-2 rounded-full bg-gray-900 px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-gray-800 sm:px-4 sm:py-1.5";

  return (
    <AddAction
      canEdit={canEdit}
      accountId={accountId}
      currency={currency}
      locale={locale}
      categories={categories}
      topCategories={topCategories}
      merchantSuggestions={merchantSuggestions}
      renderTrigger={(open) => (
        <button
          type="button"
          onClick={() => void handleOpen(open)}
          className={triggerClassName}
          aria-label={label}
          disabled={isLoading}
        >
          <Plus className={variant === "bottom-nav" ? "h-5 w-5" : "h-4 w-4"} />
          {variant === "top-nav" && (
            <span className="hidden sm:inline">{label}</span>
          )}
        </button>
      )}
    />
  );
}
