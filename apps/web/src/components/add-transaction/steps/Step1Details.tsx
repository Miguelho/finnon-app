"use client";

import { useTranslations } from "next-intl";
import { ArrowDownLeft, ArrowUpRight } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { DateQuickPicker } from "../DateQuickPicker";
import type { TransactionDraft, TransactionType } from "@poleursus/shared";
import { cn } from "@/lib/utils";

interface Step1DetailsProps {
  draft: TransactionDraft;
  errors: Record<string, string>;
  locale: string;
  onFieldChange: <K extends keyof TransactionDraft>(
    field: K,
    value: TransactionDraft[K]
  ) => void;
}

export function Step1Details({
  draft,
  errors,
  locale,
  onFieldChange,
}: Step1DetailsProps) {
  const t = useTranslations("addTransaction");
  const sanitizeNumericInput = (value: string) =>
    value.replace(/[^0-9.,]/g, "");

  const handleTypeChange = (type: TransactionType) => {
    onFieldChange("type", type);
    // If switching to income while obligation is on, turn it off
    if (type === "income" && draft.isObligation) {
      onFieldChange("isObligation", false);
      onFieldChange("isPaid", false);
    }
  };

  const handleObligationChange = (checked: boolean) => {
    onFieldChange("isObligation", checked);
    if (checked) {
      // Force type to expense when obligation is enabled
      onFieldChange("type", "expense");
    } else {
      // Reset paid status when obligation is disabled
      onFieldChange("isPaid", false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Type selector */}
      <div className="space-y-2">
        <Label className="text-base font-semibold">{t("typeLabel")}</Label>
        <div
          className={cn(
            "relative flex rounded-full border bg-muted/30 p-1",
            draft.isObligation && "opacity-60"
          )}
        >
          <span
            aria-hidden="true"
            className={cn(
              "pointer-events-none absolute inset-y-1 left-1 w-[calc(50%-0.25rem)] rounded-full bg-background shadow-sm transition-transform",
              draft.type === "income" && "translate-x-full"
            )}
          />
          <button
            type="button"
            onClick={() => handleTypeChange("expense")}
            disabled={draft.isObligation}
            aria-pressed={draft.type === "expense"}
            className={cn(
              "relative z-10 flex-1 rounded-full py-2.5 text-sm font-semibold",
              "inline-flex items-center justify-center gap-2 transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
              draft.type === "expense"
                ? "text-foreground"
                : "text-muted-foreground hover:text-foreground",
              draft.isObligation && "cursor-not-allowed"
            )}
          >
            <ArrowDownLeft className="h-4 w-4" />
            {t("typeExpense")}
          </button>
          <button
            type="button"
            onClick={() => handleTypeChange("income")}
            disabled={draft.isObligation}
            aria-pressed={draft.type === "income"}
            className={cn(
              "relative z-10 flex-1 rounded-full py-2.5 text-sm font-semibold",
              "inline-flex items-center justify-center gap-2 transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
              draft.type === "income"
                ? "text-foreground"
                : "text-muted-foreground hover:text-foreground",
              draft.isObligation && "cursor-not-allowed"
            )}
          >
            <ArrowUpRight className="h-4 w-4" />
            {t("typeIncome")}
          </button>
        </div>
      </div>

      {draft.type === "expense" && (
        <>
          {/* Obligation toggle */}
          <div className="flex items-center justify-between py-3 px-4 rounded-lg border bg-muted/30">
            <div className="space-y-0.5">
              <Label
                htmlFor="obligation-toggle"
                className="text-base font-semibold cursor-pointer"
              >
                {t("obligationLabel")}
              </Label>
              <p className="text-sm text-muted-foreground">
                {t("obligationHelper")}
              </p>
            </div>
            <Switch
              id="obligation-toggle"
              checked={draft.isObligation}
              onCheckedChange={handleObligationChange}
            />
          </div>

          {/* Paid toggle (only visible when obligation is on) */}
          {draft.isObligation && (
            <div className="flex items-center justify-between py-3 px-4 rounded-lg border bg-muted/30">
              <div className="space-y-0.5">
                <Label
                  htmlFor="paid-toggle"
                  className="text-base font-semibold cursor-pointer"
                >
                  {t("paidLabel")}
                </Label>
                <p className="text-sm text-muted-foreground">
                  {t("paidHelper")}
                </p>
              </div>
              <Switch
                id="paid-toggle"
                checked={draft.isPaid}
                onCheckedChange={(checked) => onFieldChange("isPaid", checked)}
              />
            </div>
          )}
        </>
      )}

      {/* Date field */}
      <DateQuickPicker
        value={draft.date}
        onChange={(date) => onFieldChange("date", date)}
        locale={locale}
        error={errors.date ? t(`errors.dateRequired`) : undefined}
      />

      {/* Amount field */}
      <div className="space-y-2">
        <Label htmlFor="amount" className="text-base font-semibold">
          {t("amountLabel")}
        </Label>
        <div className="relative">
          <Input
            id="amount"
            type="text"
            inputMode="decimal"
            value={draft.amount}
            onChange={(e) =>
              onFieldChange("amount", sanitizeNumericInput(e.target.value))
            }
            pattern="[0-9]*[.,]?[0-9]*"
            placeholder={locale === "es" ? "0,00" : "0.00"}
            className="text-lg h-12 py-1 font-semibold pr-16 leading-tight"
            autoComplete="off"
          />
          <span className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
            {draft.currency}
          </span>
        </div>
        <p className="text-sm text-muted-foreground">{t("amountHelper")}</p>
        {errors.amount && (
          <p className="text-sm text-destructive">
            {errors.amount.includes("Positive")
              ? t(`errors.amountPositive`)
              : errors.amount.includes("Invalid")
                ? t(`errors.amountInvalid`)
                : t(`errors.amountRequired`)}
          </p>
        )}
      </div>
    </div>
  );
}
