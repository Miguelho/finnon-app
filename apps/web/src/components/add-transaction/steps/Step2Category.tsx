"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { Plus } from "lucide-react";
import { CaretRight, CaretDown } from "@phosphor-icons/react";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { MerchantAutocomplete } from "@/components/ui/merchant-autocomplete";
import { CategoryIcon } from "@/components/category-icon";
import { cn } from "@/lib/utils";
import { normalizeMerchant } from "@poleursus/shared";
import type {
  TransactionDraft,
  TopCategory,
  MerchantSuggestion,
} from "@poleursus/shared";

interface Category {
  id: string;
  name: string;
  icon_id: string;
  type: "income" | "expense";
}

interface Step2CategoryProps {
  draft: TransactionDraft;
  errors: Record<string, string>;
  topCategories: TopCategory[];
  allCategories: Category[];
  categoryOccurrenceCounts: Record<string, number>;
  merchantSuggestions: MerchantSuggestion[];
  categoryMerchantOptions: Record<string, string[]>;
  onFieldChange: <K extends keyof TransactionDraft>(
    field: K,
    value: TransactionDraft[K]
  ) => void;
  onAddCategory?: (type: "income" | "expense") => void;
}

export function Step2Category({
  draft,
  errors,
  topCategories,
  allCategories,
  categoryOccurrenceCounts,
  merchantSuggestions,
  categoryMerchantOptions,
  onFieldChange,
  onAddCategory,
}: Step2CategoryProps) {
  const t = useTranslations("addTransaction");
  const [showAllCategories, setShowAllCategories] = React.useState(false);
  const [isSmUp, setIsSmUp] = React.useState(false);

  // Filter categories by transaction type
  const filteredCategories = React.useMemo(
    () => allCategories.filter((cat) => cat.type === draft.type),
    [allCategories, draft.type]
  );
  const topCategoryOrder = React.useMemo(() => {
    const map = new Map<string, number>();
    topCategories.forEach((category, index) => {
      map.set(category.id, index);
    });
    return map;
  }, [topCategories]);
  const sortedCategories = React.useMemo(() => {
    return [...filteredCategories].sort((left, right) => {
      const occurrenceDiff =
        (categoryOccurrenceCounts[right.id] ?? 0) -
        (categoryOccurrenceCounts[left.id] ?? 0);
      if (occurrenceDiff !== 0) return occurrenceDiff;

      const leftOrder = topCategoryOrder.get(left.id);
      const rightOrder = topCategoryOrder.get(right.id);
      if (leftOrder !== undefined || rightOrder !== undefined) {
        if (leftOrder === undefined) return 1;
        if (rightOrder === undefined) return -1;
        if (leftOrder !== rightOrder) return leftOrder - rightOrder;
      }

      return left.name.localeCompare(right.name);
    });
  }, [categoryOccurrenceCounts, filteredCategories, topCategoryOrder]);
  const collapsedLimit = isSmUp ? 12 : 8;
  const shouldShowToggle = sortedCategories.length > collapsedLimit;
  const visibleCategories =
    shouldShowToggle && !showAllCategories
      ? sortedCategories.slice(0, collapsedLimit)
      : sortedCategories;

  const handleCategorySelect = React.useCallback((
    categoryId: string,
    options?: { clearMerchant?: boolean }
  ) => {
    const shouldClearMerchant = options?.clearMerchant ?? true;
    const isCategoryChange = draft.categoryId !== categoryId;

    onFieldChange("categoryId", categoryId);
    if (draft.suggestedCategoryId) {
      onFieldChange("suggestedCategoryId", null);
    }

    if (shouldClearMerchant && isCategoryChange) {
      onFieldChange("merchant", "");
    }

    const merchantsForCategory = categoryMerchantOptions[categoryId] ?? [];
    if (merchantsForCategory.length === 1) {
      const [onlyMerchant] = merchantsForCategory;
      if (onlyMerchant) {
        onFieldChange("merchant", onlyMerchant);
      }
    }
  }, [
    categoryMerchantOptions,
    draft.categoryId,
    draft.suggestedCategoryId,
    onFieldChange,
  ]);

  const selectedCategory = filteredCategories.find(
    (cat) => cat.id === draft.categoryId
  );
  const merchantsForSelectedCategory = draft.categoryId
    ? (categoryMerchantOptions[draft.categoryId] ?? [])
    : [];
  const selectedMerchantNormalized = normalizeMerchant(draft.merchant);

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const mediaQuery = window.matchMedia("(min-width: 640px)");
    const update = () => setIsSmUp(mediaQuery.matches);
    update();

    if (typeof mediaQuery.addEventListener === "function") {
      mediaQuery.addEventListener("change", update);
      return () => mediaQuery.removeEventListener("change", update);
    }

    mediaQuery.addListener(update);
    return () => mediaQuery.removeListener(update);
  }, []);

  React.useEffect(() => {
    setShowAllCategories(false);
  }, [draft.type]);

  React.useEffect(() => {
    if (draft.categoryId || !draft.suggestedCategoryId) return;
    const exists = filteredCategories.some(
      (category) => category.id === draft.suggestedCategoryId
    );
    if (!exists) return;
    handleCategorySelect(draft.suggestedCategoryId, { clearMerchant: false });
  }, [draft.categoryId, draft.suggestedCategoryId, filteredCategories, handleCategorySelect]);

  return (
    <div className="space-y-6">
      {/* Category field */}
      <div className="space-y-4 rounded-xl border border-border bg-muted/30 p-4">
        <div className="flex items-center justify-between gap-3">
          <Label className="text-base font-semibold">{t("categoryLabel")}</Label>
          <button
            type="button"
            onClick={() => onAddCategory?.(draft.type)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-semibold",
              "border-border bg-background text-foreground hover:bg-muted",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
              "transition-colors"
            )}
          >
            <Plus className="h-3.5 w-3.5" />
            <span>{t("categoryAddLabel")}</span>
          </button>
        </div>

        {/* All categories grid (expandable) */}
        {sortedCategories.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-2">
            {visibleCategories.map((category) => {
              const isSelected = draft.categoryId === category.id;
              return (
                <button
                  key={category.id}
                  type="button"
                  onClick={() => handleCategorySelect(category.id)}
                  aria-pressed={isSelected}
                  className={cn(
                    "flex items-center gap-2 rounded-lg p-3 text-sm text-left transition-colors",
                    "border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                    isSelected
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border bg-background text-foreground hover:bg-muted"
                  )}
                >
                  <CategoryIcon
                    iconId={category.icon_id}
                    size={20}
                    tone={isSelected ? "primary" : "muted"}
                    accessibilityLabel={category.name}
                  />
                  <span className="truncate">{category.name}</span>
                </button>
              );
            })}
          </div>
        )}

        {shouldShowToggle && (
          <button
            type="button"
            onClick={() => setShowAllCategories((current) => !current)}
            className={cn(
              "inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-sm font-semibold",
              "text-muted-foreground hover:text-foreground hover:bg-muted",
              "transition-colors"
            )}
          >
            <span>{showAllCategories ? t("categoryHide") : t("categorySeeAll")}</span>
            {showAllCategories ? (
              <CaretDown size={16} weight="bold" />
            ) : (
              <CaretRight size={16} weight="bold" />
            )}
          </button>
        )}

        {/* Selected category display */}
        {selectedCategory && !showAllCategories && shouldShowToggle && (
          <p className="text-sm text-muted-foreground">
            {selectedCategory.name}
          </p>
        )}

        {/* Empty state */}
        {filteredCategories.length === 0 && (
          <p className="text-sm text-muted-foreground">{t("categoryEmpty")}</p>
        )}

        {/* Error */}
        {errors.categoryId && (
          <p className="text-sm text-destructive">
            {t("errors.categoryRequired")}
          </p>
        )}
      </div>

      {/* Merchant field */}
      <div className="space-y-3 rounded-xl border border-border bg-muted/30 p-4">
        <Label htmlFor="merchant" className="text-base font-semibold">
          {t("merchantLabel")}
        </Label>

        {merchantSuggestions.length > 0 && (
          <p className="text-sm font-medium text-muted-foreground">
            {t("merchantHistoryHint")}
          </p>
        )}

        <MerchantAutocomplete
          id="merchant"
          value={draft.merchant}
          onChange={(value) => onFieldChange("merchant", value)}
          suggestions={merchantSuggestions}
          placeholder={t("merchantPlaceholder")}
        />

        {merchantsForSelectedCategory.length > 1 && (
          <div className="flex flex-wrap gap-2">
            {merchantsForSelectedCategory.map((merchant) => {
              const isSelected =
                selectedMerchantNormalized === normalizeMerchant(merchant);

              return (
                <button
                  key={merchant}
                  type="button"
                  onClick={() => onFieldChange("merchant", merchant)}
                  className={cn(
                    "inline-flex items-center rounded-full border px-3 py-1.5 text-sm font-medium transition-colors",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                    isSelected
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border bg-background text-foreground hover:bg-muted"
                  )}
                >
                  {merchant}
                </button>
              );
            })}
          </div>
        )}

        {draft.merchant && (
          <button
            type="button"
            onClick={() => onFieldChange("merchant", "")}
            className="text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors"
          >
            {t("merchantSkip")}
          </button>
        )}
      </div>

      {/* Notes field */}
      <div className="space-y-3 rounded-xl border border-border bg-muted/30 p-4">
        <Label htmlFor="notes" className="text-base font-semibold">
          {t("notesLabel")}
        </Label>
        <Textarea
          id="notes"
          value={draft.notes}
          onChange={(event) => onFieldChange("notes", event.target.value)}
          placeholder={t("notesPlaceholder")}
          className="min-h-[120px] resize-none"
          rows={4}
        />
      </div>
    </div>
  );
}
