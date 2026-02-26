"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { CategoryIcon } from "@/components/category-icon";
import { cn } from "@/lib/utils";
import {
  CURRENCIES,
  CURRENCY_MINOR_UNITS,
  formatMinorToMoney,
  type CategoryIconKey,
  type QuickAddSuggestion,
  type TransactionDraft,
} from "@poleursus/shared";
import { useQuickAddSuggestions } from "@/hooks/useQuickAddSuggestions";

interface Step0QuickAddProps {
  accountId: string;
  locale: string;
  categories: {
    id: string;
    name: string;
    icon_id: string;
    type: "income" | "expense";
  }[];
  draft: TransactionDraft;
  onFieldChange: <K extends keyof TransactionDraft>(
    field: K,
    value: TransactionDraft[K]
  ) => void;
  onContinueManual?: () => void;
}

export function Step0QuickAdd({
  accountId,
  locale,
  categories,
  draft,
  onFieldChange,
  onContinueManual,
}: Step0QuickAddProps) {
  const t = useTranslations("addTransaction");
  const [selectedSuggestionKey, setSelectedSuggestionKey] = React.useState<
    string | null
  >(null);
  const { suggestions, isLoading } = useQuickAddSuggestions(accountId, draft.type);

  const categoriesById = React.useMemo(
    () => new Map(categories.map((category) => [category.id, category])),
    [categories]
  );

  const currencySymbol = React.useMemo(
    () =>
      CURRENCIES.find((item) => item.code === draft.currency)?.symbol ?? draft.currency,
    [draft.currency]
  );

  const formatSuggestionAmount = React.useCallback(
    (amountMinor: number) => {
      const formatted = formatMinorToMoney(
        BigInt(Math.trunc(amountMinor)),
        draft.currency,
        CURRENCY_MINOR_UNITS
      );
      return locale.startsWith("es") ? formatted.replace(".", ",") : formatted;
    },
    [draft.currency, locale]
  );

  const buildSuggestionKey = React.useCallback(
    (suggestion: QuickAddSuggestion) =>
      `${suggestion.merchant}::${suggestion.categoryId}::${suggestion.amount}`,
    []
  );

  const handleQuickAddSelect = (suggestion: QuickAddSuggestion) => {
    const key = buildSuggestionKey(suggestion);
    if (selectedSuggestionKey === key) {
      onFieldChange("amount", "");
      onFieldChange("merchant", "");
      if (draft.categoryId === suggestion.categoryId) {
        onFieldChange("categoryId", null);
      }
      onFieldChange("suggestedCategoryId", null);
      setSelectedSuggestionKey(null);
      return;
    }

    onFieldChange("amount", formatSuggestionAmount(suggestion.amount));
    onFieldChange("merchant", suggestion.merchant);
    onFieldChange("categoryId", suggestion.categoryId);
    onFieldChange("suggestedCategoryId", suggestion.categoryId);
    setSelectedSuggestionKey(key);
    onContinueManual?.();
  };

  return (
    <div className="space-y-4 rounded-xl border border-border bg-muted/30 p-4">
      <Label className="text-sm font-semibold text-foreground">
        {t("quickAddLabel")}
      </Label>

      {!isLoading && suggestions.length === 0 ? (
        <p className="text-sm font-medium text-muted-foreground">{t("quickAddEmpty")}</p>
      ) : (
        <div className="space-y-2">
          {suggestions.map((suggestion) => {
            const key = buildSuggestionKey(suggestion);
            const category = categoriesById.get(suggestion.categoryId);
            const isSelected = selectedSuggestionKey === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => handleQuickAddSelect(suggestion)}
                className={cn(
                  "w-full rounded-lg border px-3 py-2 text-left transition-colors",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                  isSelected
                    ? "border-primary bg-primary/10"
                    : "border-border bg-background hover:bg-muted/60"
                )}
              >
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      "inline-flex h-8 w-8 items-center justify-center rounded-full border",
                      isSelected
                        ? "border-primary bg-background"
                        : "border-border bg-muted/40"
                    )}
                  >
                    <CategoryIcon
                      iconKey={category?.icon_id as CategoryIconKey}
                      size={16}
                      tone={isSelected ? "primary" : "muted"}
                      accessibilityLabel={category?.name ?? suggestion.merchant}
                    />
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-sm font-semibold text-foreground">
                      {suggestion.merchant}
                    </span>
                    <span
                      className={cn(
                        "text-sm font-medium",
                        isSelected ? "text-primary" : "text-muted-foreground"
                      )}
                    >
                      {`${currencySymbol}${formatSuggestionAmount(suggestion.amount)}`}
                    </span>
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {onContinueManual ? (
        <Button type="button" variant="secondary" onClick={onContinueManual}>
          {t("quickAddContinueManual")}
        </Button>
      ) : null}
    </div>
  );
}
