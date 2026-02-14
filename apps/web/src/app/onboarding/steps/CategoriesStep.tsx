"use client";

import { useMemo } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { CategoryIcon } from "@/components/category-icon";
import { DEFAULT_CATEGORIES, type DefaultCategory } from "@poleursus/shared";
import { OnboardingProgress } from "./OnboardingProgress";

type CategoriesStepProps = {
  selectedCategories: DefaultCategory[];
  onChangeSelectedCategories: (selected: DefaultCategory[]) => void;
  onContinue: () => void;
  onBack: () => void;
};

export function CategoriesStep({
  selectedCategories,
  onChangeSelectedCategories,
  onContinue,
  onBack,
}: CategoriesStepProps) {
  const t = useTranslations("onboarding");
  const tGlobal = useTranslations();
  const locale = useLocale();
  const selectedNames = useMemo(
    () => new Set(selectedCategories.map((category) => category.name)),
    [selectedCategories]
  );

  const toggleCategory = (category: DefaultCategory) => {
    const next = new Set(selectedNames);
    if (next.has(category.name)) {
      next.delete(category.name);
    } else {
      next.add(category.name);
    }
    onChangeSelectedCategories(
      DEFAULT_CATEGORIES.filter((item) => next.has(item.name))
    );
  };

  return (
    <div className="w-full rounded-2xl border border-border bg-card">
      <div className="px-6 pt-8">
        <OnboardingProgress current="categories" />
        <div className="mt-6 text-center">
          <h2 className="text-2xl font-bold text-foreground">
            {t("categories.title")}
          </h2>
          <p className="text-sm text-muted-foreground">{t("categories.subtitle")}</p>
        </div>
      </div>

      <div className="mt-6 grid gap-3 px-6 sm:grid-cols-2 lg:grid-cols-3">
        {DEFAULT_CATEGORIES.map((category) => {
          const isSelected = selectedNames.has(category.name);
          const label = locale === "en" ? category.name_en : category.name;
          return (
            <button
              key={category.name}
              type="button"
              onClick={() => toggleCategory(category)}
              className={cn(
                "flex items-center gap-3 rounded-lg border border-border px-4 py-3 text-left transition",
                isSelected
                  ? "border-foreground bg-muted/30"
                  : "hover:border-muted-foreground"
              )}
            >
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-muted">
                <CategoryIcon iconKey={category.icon_id} size={18} tone="muted" />
              </span>
              <span className="text-sm font-medium text-foreground">{label}</span>
              <span
                className={cn(
                  "ml-auto flex h-5 w-5 items-center justify-center rounded-full border",
                  isSelected ? "border-foreground bg-foreground" : "border-border"
                )}
              >
                <svg
                  viewBox="0 0 24 24"
                  className={cn("h-3 w-3 text-white", !isSelected && "opacity-0")}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </span>
            </button>
          );
        })}
      </div>

      <p className="px-6 py-4 text-center text-xs text-muted-foreground">
        {t("categories.footer")}
      </p>

      <div className="flex flex-col gap-2 px-6 pb-8 sm:flex-row">
        <Button
          variant="outline"
          onClick={onBack}
          className="w-full border-border text-foreground"
        >
          {tGlobal("common.back")}
        </Button>
        <Button
          onClick={() => {
            onContinue();
          }}
          className="w-full"
        >
          {t("categories.continue")}
        </Button>
      </div>
    </div>
  );
}
