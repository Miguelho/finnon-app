"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import {
  CURRENCIES,
  parseMoneyToMinor,
  type OnboardingFirstProjectInput,
} from "@poleursus/shared";
import { OnboardingProgress } from "./OnboardingProgress";

type ObjectiveStepProps = {
  currency: string;
  name: string;
  emoji: string;
  targetAmount: string;
  monthlyCommitment: string;
  onNameChange: (value: string) => void;
  onEmojiChange: (value: string) => void;
  onTargetAmountChange: (value: string) => void;
  onMonthlyCommitmentChange: (value: string) => void;
  onContinue: (project: OnboardingFirstProjectInput) => void;
  onSkip: () => void;
  onBack: () => void;
};

const sanitizeNumericInput = (value: string) => value.replace(/[^0-9.,]/g, "");

export function ObjectiveStep({
  currency,
  name,
  emoji,
  targetAmount,
  monthlyCommitment,
  onNameChange,
  onEmojiChange,
  onTargetAmountChange,
  onMonthlyCommitmentChange,
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

  const parsedTarget = targetAmount.trim()
    ? parseMoneyToMinor(targetAmount, currency)
    : null;
  const parsedCommitment = monthlyCommitment.trim()
    ? parseMoneyToMinor(monthlyCommitment, currency)
    : null;

  const targetValid =
    parsedTarget !== null && typeof parsedTarget !== "object" && parsedTarget > 0n;
  const commitmentValid =
    parsedCommitment !== null &&
    typeof parsedCommitment !== "object" &&
    parsedCommitment > 0n;
  const canContinue = name.trim().length > 0 && targetValid && commitmentValid;

  const handleContinue = () => {
    if (!canContinue) return;
    if (typeof parsedTarget === "object" || typeof parsedCommitment === "object") return;
    if (parsedTarget === null || parsedCommitment === null) return;

    onContinue({
      name: name.trim(),
      emoji: emoji.trim() || "🎯",
      targetAmountMinor: Number(parsedTarget),
      monthlyCommitmentMinor: Number(parsedCommitment),
    });
  };

  return (
    <div className="w-full rounded-2xl border border-border bg-card">
      <div className="px-6 pt-8">
        <OnboardingProgress current="project" />
        <div className="mt-6 text-center">
          <h2 className="text-2xl font-bold text-foreground">
            {t("project.title")}
          </h2>
          <p className="text-sm text-muted-foreground">{t("project.subtitle")}</p>
        </div>
      </div>

      <div className="mx-6 mt-6 rounded-2xl border border-border bg-card p-6">
        <div className="space-y-5">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {t("project.nameLabel")}
            </p>
            <input
              type="text"
              value={name}
              onChange={(event) => onNameChange(event.target.value)}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none"
              placeholder={t("project.namePlaceholder")}
            />
          </div>

          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {t("project.emojiLabel")}
            </p>
            <input
              type="text"
              value={emoji}
              onChange={(event) => onEmojiChange(event.target.value)}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none"
              placeholder="🎯"
              maxLength={8}
            />
          </div>

          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {t("project.targetLabel")}
            </p>
            <div className="flex items-center gap-3">
              <span className="text-2xl font-bold text-muted-foreground">{currencySymbol}</span>
              <input
                type="text"
                inputMode="decimal"
                value={targetAmount}
                onChange={(event) =>
                  onTargetAmountChange(sanitizeNumericInput(event.target.value))
                }
                className="w-full bg-transparent text-3xl font-bold text-foreground outline-none placeholder:text-muted-foreground"
                placeholder="3000"
              />
            </div>
            {!targetValid && targetAmount.trim() !== "" ? (
              <p className="text-xs text-destructive">{tGlobal("money.invalidFormat")}</p>
            ) : null}
          </div>

          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {t("project.commitmentLabel")}
            </p>
            <div className="flex items-center gap-3">
              <span className="text-2xl font-bold text-muted-foreground">{currencySymbol}</span>
              <input
                type="text"
                inputMode="decimal"
                value={monthlyCommitment}
                onChange={(event) =>
                  onMonthlyCommitmentChange(sanitizeNumericInput(event.target.value))
                }
                className="w-full bg-transparent text-3xl font-bold text-foreground outline-none placeholder:text-muted-foreground"
                placeholder="200"
              />
            </div>
            {!commitmentValid && monthlyCommitment.trim() !== "" ? (
              <p className="text-xs text-destructive">{tGlobal("money.invalidFormat")}</p>
            ) : null}
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-2 px-6 pb-8 pt-6">
        <Button onClick={handleContinue} disabled={!canContinue} className="w-full">
          {t("project.continue")}
        </Button>
        <Button
          variant="ghost"
          onClick={onSkip}
          className="w-full text-foreground/80 hover:text-foreground"
        >
          {t("project.skip")}
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

