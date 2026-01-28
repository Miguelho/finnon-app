"use client";

import { CaretRight } from "@phosphor-icons/react";
import { type TopCategory } from "@poleursus/shared";
import { CategoryIcon } from "@/components/category-icon";
import { cn } from "@/lib/utils";

export interface TopCategorySelectorProps {
  topCategories: TopCategory[];
  selectedCategoryId?: string;
  onSelect: (categoryId: string) => void;
  onOpenAll: () => void;
  seeOthersLabel: string;
}

export function TopCategorySelector({
  topCategories,
  selectedCategoryId,
  onSelect,
  onOpenAll,
  seeOthersLabel,
}: TopCategorySelectorProps) {
  if (topCategories.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {topCategories.map((category) => {
        const isSelected = selectedCategoryId === category.id;
        return (
          <button
            key={category.id}
            type="button"
            onClick={() => onSelect(category.id)}
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
        onClick={onOpenAll}
        className={cn(
          "inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-sm font-semibold",
          "text-muted-foreground hover:text-foreground hover:bg-muted",
          "transition-colors"
        )}
      >
        <span>{seeOthersLabel}</span>
        <CaretRight size={16} weight="bold" />
      </button>
    </div>
  );
}
