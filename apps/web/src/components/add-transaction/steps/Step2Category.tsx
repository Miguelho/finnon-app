"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { CaretRight, CaretDown } from "@phosphor-icons/react";
import { Label } from "@/components/ui/label";
import { MerchantAutocomplete } from "@/components/ui/merchant-autocomplete";
import { CategoryIcon } from "@/components/category-icon";
import { cn } from "@/lib/utils";
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
  merchantSuggestions: MerchantSuggestion[];
  onFieldChange: <K extends keyof TransactionDraft>(
    field: K,
    value: TransactionDraft[K]
  ) => void;
}

export function Step2Category({
  draft,
  errors,
  topCategories,
  allCategories,
  merchantSuggestions,
  onFieldChange,
}: Step2CategoryProps) {
  const t = useTranslations("addTransaction");
  const [showAllCategories, setShowAllCategories] = React.useState(false);

  // Filter categories by transaction type
  const filteredCategories = allCategories.filter(
    (cat) => cat.type === draft.type
  );

  const handleCategorySelect = (categoryId: string) => {
    onFieldChange("categoryId", categoryId);
  };

  const selectedCategory = filteredCategories.find(
    (cat) => cat.id === draft.categoryId
  );

  return (
    <div className="space-y-6">
      {/* Category field */}
      <div className="space-y-3">
        <Label className="text-base font-semibold">{t("categoryLabel")}</Label>

        {/* Top category chips */}
        {topCategories.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            {topCategories.slice(0, 3).map((category) => {
              const isSelected = draft.categoryId === category.id;
              return (
                <button
                  key={category.id}
                  type="button"
                  onClick={() => handleCategorySelect(category.id)}
                  aria-pressed={isSelected}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition-colors",
                    "border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                    isSelected
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border bg-background text-foreground hover:bg-muted"
                  )}
                >
                  <CategoryIcon
                    iconId={category.icon_id}
                    size={16}
                    tone={isSelected ? "primary" : "muted"}
                    accessibilityLabel={category.name}
                  />
                  <span>{category.name}</span>
                </button>
              );
            })}
            <button
              type="button"
              onClick={() => setShowAllCategories(!showAllCategories)}
              className="inline-flex items-center gap-0.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <span>{t("categorySeeAll")}</span>
              {showAllCategories ? (
                <CaretDown size={14} weight="bold" />
              ) : (
                <CaretRight size={14} weight="bold" />
              )}
            </button>
          </div>
        )}

        {/* All categories grid (expandable) */}
        {(showAllCategories || topCategories.length === 0) && (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-2">
            {filteredCategories.map((category) => {
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

        {/* Selected category display */}
        {selectedCategory && !showAllCategories && topCategories.length > 0 && (
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
      <div className="space-y-2">
        <Label htmlFor="merchant" className="text-base font-semibold">
          {t("merchantLabel")}
        </Label>

        {merchantSuggestions.length > 0 && (
          <p className="text-xs text-muted-foreground">
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

        {draft.merchant && (
          <button
            type="button"
            onClick={() => onFieldChange("merchant", "")}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            {t("merchantSkip")}
          </button>
        )}
      </div>
    </div>
  );
}
