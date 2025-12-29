"use client";

import { ICONS, type IconDefinition } from "@poleursus/shared";
import { cn } from "@/lib/utils";

type IconPickerProps = {
  value?: string;
  onChange: (iconId: string) => void;
  filterType?: "income" | "expense" | "both";
};

export function IconPicker({ value, onChange, filterType }: IconPickerProps) {
  const icons = filterType
    ? ICONS.filter(
        (icon) =>
          icon.suggested_for === filterType || icon.suggested_for === "both"
      )
    : ICONS;

  return (
    <div className="grid grid-cols-6 gap-2 sm:grid-cols-8 md:grid-cols-10">
      {icons.map((icon) => (
        <button
          key={icon.id}
          type="button"
          onClick={() => onChange(icon.id)}
          className={cn(
            "flex h-12 w-12 items-center justify-center rounded-md border-2 text-2xl transition-all hover:scale-110 hover:border-primary",
            value === icon.id
              ? "border-primary bg-primary/10"
              : "border-border bg-background"
          )}
          title={icon.label}
        >
          {icon.emoji}
        </button>
      ))}
    </div>
  );
}
