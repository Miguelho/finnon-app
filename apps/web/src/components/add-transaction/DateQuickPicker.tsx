"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { CalendarBlank } from "@phosphor-icons/react/dist/ssr";
import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";
import {
  getToday,
  getYesterday,
  getTomorrow,
  formatDateForDisplay,
} from "@poleursus/shared";

interface DateQuickPickerProps {
  value: string;
  onChange: (date: string) => void;
  locale?: string;
  error?: string;
  className?: string;
}

type QuickOption = {
  labelKey: "dateToday" | "dateYesterday" | "dateTomorrow";
  getValue: () => string;
};

const quickOptions: QuickOption[] = [
  { labelKey: "dateToday", getValue: getToday },
  { labelKey: "dateYesterday", getValue: getYesterday },
  { labelKey: "dateTomorrow", getValue: getTomorrow },
];

export function DateQuickPicker({
  value,
  onChange,
  locale = "es",
  error,
  className,
}: DateQuickPickerProps) {
  const t = useTranslations("addTransaction");
  const dateInputRef = React.useRef<HTMLInputElement>(null);

  const handleQuickSelect = (getValue: () => string) => {
    onChange(getValue());
  };

  const handleCalendarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.value) {
      onChange(e.target.value);
    }
  };

  const handleCalendarClick = () => {
    if (dateInputRef.current) {
      try {
        dateInputRef.current.showPicker();
      } catch {
        // Safari may block showPicker on hidden/clipped elements — fall back to click
        dateInputRef.current.click();
      }
    }
  };

  const isSelected = (getValue: () => string) => value === getValue();

  return (
    <div className={cn("space-y-3", className)}>
      <Label className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
        {t("dateLabel")}
      </Label>

      {/* Quick option chips */}
      <div className="grid grid-cols-4 gap-2">
        {quickOptions.map((option) => (
          <button
            key={option.labelKey}
            type="button"
            onClick={() => handleQuickSelect(option.getValue)}
            className={cn(
              "inline-flex w-full items-center justify-center rounded-lg border px-2 py-1.5 text-xs font-medium transition-all",
              isSelected(option.getValue)
                ? "border-primary/50 bg-primary/15 text-primary"
                : "border-border bg-muted/40 text-muted-foreground hover:border-primary/40 hover:text-foreground"
            )}
          >
            {t(option.labelKey)}
          </button>
        ))}

        {/* Calendar trigger button */}
        <button
          type="button"
          onClick={handleCalendarClick}
          className={cn(
            "inline-flex w-full items-center justify-center rounded-lg border px-2 py-1.5 text-xs font-medium transition-all",
            "border-border bg-muted/40 text-muted-foreground hover:border-primary/40 hover:text-foreground"
          )}
        >
          <CalendarBlank className="mr-1 h-3.5 w-3.5" />
          {t("datePickOther")}
        </button>

        {/* Hidden date input */}
        <input
          ref={dateInputRef}
          type="date"
          value={value}
          onChange={handleCalendarChange}
          className="absolute opacity-0 pointer-events-none"
          style={{ width: 0, height: 0 }}
          aria-label={t("datePickOther")}
          tabIndex={-1}
        />
      </div>

      {/* Selected date display */}
      {value && (
        <div className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-border bg-background px-3 py-1.5">
          <CalendarBlank className="h-4 w-4 text-muted-foreground" />
          <p className="text-sm font-medium text-foreground">
            {formatDateForDisplay(value, locale)}
          </p>
        </div>
      )}

      {/* Error message */}
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
