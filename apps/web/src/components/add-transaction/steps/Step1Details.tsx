"use client";

import { useTranslations } from "next-intl";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DateQuickPicker } from "../DateQuickPicker";
import type { TransactionDraft } from "@poleursus/shared";

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

  return (
    <div className="space-y-6">
      {/* Name field */}
      <div className="space-y-2">
        <Label htmlFor="name" className="text-base font-semibold">
          {t("nameLabel")}
        </Label>
        <Input
          id="name"
          type="text"
          value={draft.name}
          onChange={(e) => onFieldChange("name", e.target.value)}
          placeholder={t("namePlaceholder")}
          className="text-lg h-12"
          autoComplete="off"
        />
        <p className="text-sm text-muted-foreground">{t("nameHelper")}</p>
        {errors.name && (
          <p className="text-sm text-destructive">{t(`errors.nameRequired`)}</p>
        )}
      </div>

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
            onChange={(e) => onFieldChange("amount", e.target.value)}
            placeholder={locale === "es" ? "0,00" : "0.00"}
            className="text-2xl h-14 font-semibold pr-16"
            autoComplete="off"
          />
          <span className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground text-lg">
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
