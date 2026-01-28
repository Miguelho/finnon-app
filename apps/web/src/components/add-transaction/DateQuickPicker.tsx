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
      dateInputRef.current.showPicker();
    }
  };

  const isSelected = (getValue: () => string) => value === getValue();

  return (
    <div className={cn("space-y-2", className)}>
      <Label className="text-sm font-semibold text-foreground">
        {t("dateLabel")}
      </Label>

      {/* Quick option chips */}
      <div className="flex flex-nowrap gap-1.5 overflow-x-auto pb-0.5">
        {quickOptions.map((option) => (
          <button
            key={option.labelKey}
            type="button"
            onClick={() => handleQuickSelect(option.getValue)}
            className={cn(
              "shrink-0 px-2.5 py-1 text-xs rounded-full border transition-colors",
              isSelected(option.getValue)
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-background border-input hover:bg-accent hover:text-accent-foreground"
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
            "shrink-0 inline-flex items-center px-2.5 py-1 text-xs rounded-full border transition-colors",
            "bg-background border-input hover:bg-accent hover:text-accent-foreground"
          )}
        >
          <CalendarBlank className="w-3.5 h-3.5 mr-1" />
          {t("datePickOther")}
        </button>

        {/* Hidden date input */}
        <input
          ref={dateInputRef}
          type="date"
          value={value}
          onChange={handleCalendarChange}
          className="sr-only"
          aria-label={t("datePickOther")}
          tabIndex={-1}
        />
      </div>

      {/* Selected date display */}
      {value && (
        <p className="text-sm font-medium text-muted-foreground">
          {formatDateForDisplay(value, locale)}
        </p>
      )}

      {/* Error message */}
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
