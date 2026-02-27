"use client";

import {
  type CategoryIconKey,
  CATEGORY_ICON_KEYS,
  getIconsByType,
  resolveCategoryIconKey,
  suggestCategoryIcon,
} from "@poleursus/shared";
import { CategoryIcon } from "@/components/category-icon";
import { cn } from "@/lib/utils";

type IconPickerProps = {
  value?: CategoryIconKey;
  onChange: (iconKey: CategoryIconKey) => void;
  filterType?: "income" | "expense";
  categoryName?: string;
};

export function IconPicker({
  value,
  onChange,
  filterType,
  categoryName,
}: IconPickerProps) {
  const suggestion = categoryName ? suggestCategoryIcon(categoryName) : null;
  const selectedValue = value ? resolveCategoryIconKey(value) : undefined;

  // Filter icons by type if provided
  const availableIcons = filterType
    ? getIconsByType(filterType)
    : CATEGORY_ICON_KEYS;

  // Show suggestions row if confidence is not high and we have a suggestion
  const showSuggestions =
    suggestion && suggestion.confidence !== "high" && categoryName;

  return (
    <div className="space-y-3">
      {/* Suggestions row */}
      {showSuggestions && (
        <div className="space-y-1">
          <span className="text-xs text-muted-foreground">Sugeridos</span>
          <div className="flex flex-wrap gap-2.5">
            {suggestion.suggestions.slice(0, 6).map((iconKey) => (
              <IconButton
                key={iconKey}
                iconKey={iconKey}
                isSelected={selectedValue === iconKey}
                isSuggested={iconKey === suggestion.primary}
                onClick={() => onChange(iconKey)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Main grid */}
      <div className="grid grid-cols-6 gap-3">
        {availableIcons.map((iconKey) => (
          <IconButton
            key={iconKey}
            iconKey={iconKey}
            isSelected={selectedValue === iconKey}
            onClick={() => onChange(iconKey)}
          />
        ))}
      </div>
    </div>
  );
}

function IconButton({
  iconKey,
  isSelected,
  isSuggested,
  onClick,
}: {
  iconKey: CategoryIconKey;
  isSelected: boolean;
  isSuggested?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "mx-auto flex aspect-square w-full max-w-12 items-center justify-center rounded-md border-2 p-2 transition-all hover:scale-105 hover:border-primary",
        isSelected
          ? "border-primary bg-primary/10"
          : isSuggested
            ? "border-primary/50 bg-primary/5"
            : "border-border bg-background"
      )}
      title={iconKey}
    >
      <CategoryIcon
        iconKey={iconKey}
        size={24}
        weight={isSelected ? "fill" : "regular"}
        tone={isSelected ? "primary" : "muted"}
      />
    </button>
  );
}
