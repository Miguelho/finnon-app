"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  CURRENCIES,
  DEFAULT_PROJECT_EMOJI,
  parseMoneyToMinor,
  PROJECT_EMOJI_SUGGESTIONS,
  PROJECT_PALETTE,
  type OnboardingFirstProjectInput,
} from "@poleursus/shared";
import { OnboardingProgress } from "./OnboardingProgress";

type ObjectiveStepProps = {
  currency: string;
  name: string;
  emoji: string;
  color: string;
  targetAmount: string;
  monthlyCommitment: string;
  onNameChange: (value: string) => void;
  onEmojiChange: (value: string) => void;
  onColorChange: (value: string) => void;
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
  color,
  targetAmount,
  monthlyCommitment,
  onNameChange,
  onEmojiChange,
  onColorChange,
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
  const selectedEmoji = emoji.trim() || DEFAULT_PROJECT_EMOJI;
  const selectedColor = PROJECT_PALETTE.includes(color as (typeof PROJECT_PALETTE)[number])
    ? color
    : PROJECT_PALETTE[0];

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
      emoji: selectedEmoji,
      color: selectedColor,
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
            <div className="flex flex-wrap gap-2">
              {PROJECT_EMOJI_SUGGESTIONS.map((emojiOption) => {
                const isSelected = selectedEmoji === emojiOption;
                return (
                  <button
                    key={emojiOption}
                    type="button"
                    onClick={() => onEmojiChange(emojiOption)}
                    className={cn(
                      "inline-flex h-9 w-9 items-center justify-center rounded-md border text-lg transition-transform hover:scale-[1.04]",
                      isSelected
                        ? "border-primary bg-primary/10"
                        : "border-border bg-background"
                    )}
                    aria-label={emojiOption}
                    aria-pressed={isSelected}
                  >
                    {emojiOption}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {tGlobal("projects.colorLabel")}
            </p>
            <div className="flex flex-wrap gap-2">
              {PROJECT_PALETTE.map((paletteColor) => {
                const isSelected = selectedColor === paletteColor;
                return (
                  <button
                    key={paletteColor}
                    type="button"
                    onClick={() => onColorChange(paletteColor)}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-full transition-transform hover:scale-[1.05]"
                    style={{
                      backgroundColor: paletteColor,
                      border: isSelected
                        ? "2px solid rgba(255, 255, 255, 0.8)"
                        : "1px solid hsl(var(--border))",
                    }}
                    aria-label={`${tGlobal("projects.colorLabel")} ${paletteColor}`}
                    aria-pressed={isSelected}
                  >
                    {isSelected ? (
                      <span className="h-2.5 w-2.5 rounded-full border border-white/85" />
                    ) : null}
                  </button>
                );
              })}
            </div>
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
                placeholder="25000"
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
