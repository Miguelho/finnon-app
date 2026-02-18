"use client";

import { useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  CURRENCIES,
  formatMoneyWithSymbol,
  type DefaultCategory,
  type OnboardingGoalInput,
  type OnboardingRecurrentInput,
} from "@poleursus/shared";
import { completeOnboardingAction } from "../actions";
import { ONBOARDING_STORAGE_KEY } from "../state";

type DoneStepProps = {
  accountId: string | null;
  accountName: string;
  selectedCategories: DefaultCategory[];
  recurrents: OnboardingRecurrentInput[];
  goal: OnboardingGoalInput | null;
  currency: string;
  onAccountResolved: (accountId: string) => void;
};

export function DoneStep({
  accountId,
  accountName,
  selectedCategories,
  recurrents,
  goal,
  currency,
  onAccountResolved,
}: DoneStepProps) {
  const t = useTranslations("onboarding");
  const tGlobal = useTranslations();
  const locale = useLocale();
  const router = useRouter();
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resolvedAccountId, setResolvedAccountId] = useState<string | null>(
    accountId
  );

  const currencySymbol = useMemo(
    () => CURRENCIES.find((curr) => curr.code === currency)?.symbol ?? currency,
    [currency]
  );

  const handlePersist = async () => {
    if (isSaving) return;
    setIsSaving(true);
    setError(null);

    if (!accountName.trim() || !currency) {
      setError(tGlobal("errors.onboardingMissingFields"));
      setIsSaving(false);
      return;
    }

    try {
      const result = await completeOnboardingAction(
        {
          accountId: resolvedAccountId,
          accountName,
          currency,
          selectedCategories,
          recurrents,
          goal,
        },
        locale === "en" ? "en" : "es"
      );

      if (!result || result.success === false) {
        if (result?.accountId) {
          setResolvedAccountId(result.accountId);
          onAccountResolved(result.accountId);
        }
        setError(result?.error ?? tGlobal("errors.internalServer"));
        setIsSaving(false);
        return;
      }

      setResolvedAccountId(result.accountId);
      onAccountResolved(result.accountId);
      if (typeof window !== "undefined") {
        window.localStorage.setItem("finnon:activeAccountId", result.accountId);
      }
      sessionStorage.removeItem(ONBOARDING_STORAGE_KEY);
      router.replace("/home");
    } catch (err) {
      console.error("Error persisting onboarding:", err);
      setError(tGlobal("errors.internalServer"));
      setIsSaving(false);
    }
  };

  const formatSignedAmount = (rec: OnboardingRecurrentInput) => {
    const amount = formatMoneyWithSymbol(
      BigInt(rec.amountMinor),
      currency,
      currencySymbol
    );
    const sign = rec.type === "income" ? "+" : "-";
    return `${sign}${amount}`;
  };

  return (
    <div className="w-full rounded-2xl border border-[#e5e7eb] bg-white px-8 py-10 text-center shadow-sm">
      <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full border-2 border-[#bbf7d0] bg-[#f0fdf4]">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="#16a34a"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-8 w-8"
        >
          <polyline points="20 6 9 17 4 12" />
        </svg>
      </div>
      <h1 className="text-2xl font-bold text-[#1a1f36]">{t("done.title")}</h1>
      <p className="mx-auto mt-2 max-w-md text-sm text-[#6b7280]">
        {t("done.subtitle")}
      </p>

      <div className="mx-auto mt-8 w-full max-w-md text-left">
        <p className="text-xs font-semibold uppercase tracking-wide text-[#9ca3af]">
          {t("done.thisWeek")}
        </p>
        <div className="mt-3 space-y-3">
          {recurrents.length === 0 ? (
            <p className="text-sm text-[#9ca3af]">{tGlobal("common.noneOption")}</p>
          ) : (
            recurrents.map((rec) => (
              <div
                key={rec.suggestedId}
                className="flex items-center justify-between border-b border-[#e5e7eb] py-2 last:border-b-0"
              >
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      "h-2 w-2 rounded-full",
                      rec.type === "income" ? "bg-[#16a34a]" : "bg-[#dc2626]"
                    )}
                  />
                  <span className="text-sm font-medium text-[#1a1f36]">
                    {rec.label}
                  </span>
                </div>
                <span
                  className={cn(
                    "text-sm font-semibold",
                    rec.type === "income" ? "text-[#16a34a]" : "text-[#dc2626]"
                  )}
                >
                  {formatSignedAmount(rec)}
                </span>
              </div>
            ))
          )}
        </div>
      </div>

      {goal && (
        <div className="mx-auto mt-6 w-full max-w-md rounded-lg border border-[#bbf7d0] bg-[#f0fdf4] p-4 text-left">
          <p className="text-xs font-semibold text-[#16a34a]">
            {t("objective.previewTitle")}
          </p>
          <p className="text-sm text-[#1a1f36]">
            {t("objective.previewText", {
              amount: formatMoneyWithSymbol(
                BigInt(goal.targetAmountMinor) / BigInt(goal.months),
                currency,
                currencySymbol
              ),
            })}
          </p>
        </div>
      )}

      <div className="mx-auto mt-6 flex w-full max-w-md items-center gap-4 rounded-2xl border border-[#bfdbfe] bg-[#eff6ff] p-4 text-left">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-[#bfdbfe] bg-white text-[#3b82f6]">
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4-4v2" />
            <circle cx="9" cy="7" r="4" />
            <line x1="19" y1="8" x2="19" y2="14" />
            <line x1="22" y1="11" x2="16" y2="11" />
          </svg>
        </div>
        <div className="flex-1">
          <p className="text-sm font-semibold text-[#1a1f36]">
            {t("done.inviteTitle")}
          </p>
          <p className="text-xs text-[#6b7280]">{t("done.inviteDesc")}</p>
          <p className="mt-2 text-xs font-semibold text-[#1a1f36]">
            {t("done.inviteHint")}
          </p>
        </div>
      </div>

      {error && (
        <div className="mt-4 rounded-md bg-[#fef2f2] p-3 text-sm text-[#dc2626]">
          {error}
        </div>
      )}

      <div className="mx-auto mt-6 w-full max-w-md">
        <Button
          className="w-full bg-[#1a1f36] text-white hover:bg-[#2a3050]"
          onClick={handlePersist}
          disabled={isSaving}
        >
          {isSaving ? tGlobal("common.saving") : t("done.goToApp")}
        </Button>
      </div>
    </div>
  );
}
