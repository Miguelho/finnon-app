"use client";

import { useTranslations } from "next-intl";
import { SquaresFour, List } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import type { FormMode } from "@poleursus/shared";

interface FormModeToggleProps {
  mode: FormMode;
  onChange: (mode: FormMode) => void;
  className?: string;
}

export function FormModeToggle({
  mode,
  onChange,
  className,
}: FormModeToggleProps) {
  const t = useTranslations("addTransaction");

  const toggleMode = () => {
    onChange(mode === "panels" ? "list" : "panels");
  };

  const Icon = mode === "panels" ? SquaresFour : List;
  const label = mode === "panels" ? t("modePanels") : t("modeList");

  return (
    <button
      type="button"
      onClick={toggleMode}
      title={label}
      aria-label={label}
      className={cn(
        "p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        className
      )}
    >
      <Icon size={20} weight="regular" />
    </button>
  );
}
