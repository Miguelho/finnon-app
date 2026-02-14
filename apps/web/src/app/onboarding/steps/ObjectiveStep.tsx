"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  CURRENCIES,
  GOAL_TIMELINE_OPTIONS,
  formatMoneyWithSymbol,
  parseMoneyToMinor,
  type OnboardingGoalInput,
} from "@poleursus/shared";
import { OnboardingProgress } from "./OnboardingProgress";

type ObjectiveStepProps = {
  currency: string;
  amount: string;
  months: 3 | 6 | 12;
  onAmountChange: (value: string) => void;
  onMonthsChange: (value: 3 | 6 | 12) => void;
  onContinue: (goal: OnboardingGoalInput) => void;
  onSkip: () => void;
  onBack: () => void;
};

export function ObjectiveStep({
  currency,
  amount,
  months,
  onAmountChange,
  onMonthsChange,
  onContinue,
  onSkip,
  onBack,
}: ObjectiveStepProps) {
  const t = useTranslations("onboarding");
  const tGlobal = useTranslations();

  const currencySymbol = useMemo(
    () => CURRENCIES.find((curr) => curr.code === currency)?.symbol ?? currency,
    [currency]
  );

  const parsedAmount = amount.trim()
    ? parseMoneyToMinor(amount, currency)
    : null;
  const amountValid = parsedAmount !== null && typeof parsedAmount !== "object";

  const monthlyAmount = amountValid
    ? formatMoneyWithSymbol(parsedAmount / BigInt(months), currency, currencySymbol)
    : formatMoneyWithSymbol(0n, currency, currencySymbol);

  const handleContinue = () => {
    if (!amountValid || typeof parsedAmount === "object") return;

    onContinue({
      targetAmountMinor: Number(parsedAmount),
      months,
    });
  };

  return (
    <div className="w-full rounded-2xl border border-border bg-card">
      <div className="px-6 pt-8">
        <OnboardingProgress current="objective" />
        <div className="mt-6 text-center">
          <h2 className="text-2xl font-bold text-foreground">
            {t("objective.title")}
          </h2>
          <p className="text-sm text-muted-foreground">{t("objective.subtitle")}</p>
        </div>
      </div>

      <div className="mx-6 mt-6 rounded-2xl border border-border bg-card p-6">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {t("objective.amountLabel")}
        </p>
        <div className="mt-3 flex items-center gap-3">
          <span className="text-2xl font-bold text-muted-foreground">
            {currencySymbol}
          </span>
          <input
            type="text"
            inputMode="decimal"
            value={amount}
            onChange={(event) => onAmountChange(event.target.value)}
            className="w-full bg-transparent text-3xl font-bold text-foreground outline-none placeholder:text-muted-foreground"
            placeholder="3.000"
          />
        </div>
        {!amountValid && amount.trim() !== "" && (
          <p className="mt-2 text-xs text-destructive">
            {tGlobal("money.invalidFormat")}
          </p>
        )}

        <p className="mt-6 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {t("objective.timelineLabel")}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {GOAL_TIMELINE_OPTIONS.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => onMonthsChange(option)}
              className={cn(
                "rounded-full border px-4 py-2 text-xs font-medium",
                months === option
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border text-muted-foreground"
              )}
            >
              {t(`objective.months${option}` as const)}
            </button>
          ))}
        </div>
      </div>

      {amountValid && (
        <div className="mx-6 mt-5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-4">
          <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-300">
            {t("objective.previewTitle")}
          </p>
          <p className="text-sm text-foreground">
            {t("objective.previewText", { amount: monthlyAmount })}
          </p>
        </div>
      )}

      <div className="flex flex-col gap-2 px-6 pb-8 pt-6">
        <Button
          onClick={handleContinue}
          disabled={!amountValid}
          className="w-full"
        >
          {t("objective.continue")}
        </Button>
        <Button
          variant="ghost"
          onClick={onSkip}
          className="w-full text-foreground/80 hover:text-foreground"
        >
          {t("objective.skip")}
        </Button>
        <Button
          variant="outline"
          onClick={onBack}
          className="w-full border-border text-foreground"
        >
          {tGlobal("common.back")}
        </Button>
      </div>
    </div>
  );
}
