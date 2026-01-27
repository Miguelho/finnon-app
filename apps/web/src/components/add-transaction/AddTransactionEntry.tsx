"use client";

import { useTranslations } from "next-intl";
import { TrendUp, TrendDown } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { TransactionType } from "@poleursus/shared";

interface AddTransactionEntryProps {
  onSelect: (type: TransactionType) => void;
}

export function AddTransactionEntry({ onSelect }: AddTransactionEntryProps) {
  const t = useTranslations("addTransaction");

  return (
    <div className="flex flex-col items-center justify-center py-8 px-4">
      <h2 className="text-xl font-semibold text-foreground mb-2">
        {t("entryTitle")}
      </h2>
      <p className="text-sm text-muted-foreground mb-8">{t("entrySubtitle")}</p>

      <div className="flex flex-col sm:flex-row gap-4 w-full max-w-md">
        <button
          type="button"
          onClick={() => onSelect("income")}
          className={cn(
            "flex-1 flex flex-col items-center gap-3 p-6 rounded-xl",
            "border-2 border-border bg-background",
            "hover:border-primary hover:bg-primary/5",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
            "transition-colors"
          )}
        >
          <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center">
            <TrendUp className="w-6 h-6 text-green-600" weight="bold" />
          </div>
          <span className="text-base font-medium">{t("typeIncome")}</span>
        </button>

        <button
          type="button"
          onClick={() => onSelect("expense")}
          className={cn(
            "flex-1 flex flex-col items-center gap-3 p-6 rounded-xl",
            "border-2 border-border bg-background",
            "hover:border-primary hover:bg-primary/5",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
            "transition-colors"
          )}
        >
          <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center">
            <TrendDown className="w-6 h-6 text-red-600" weight="bold" />
          </div>
          <span className="text-base font-medium">{t("typeExpense")}</span>
        </button>
      </div>
    </div>
  );
}
