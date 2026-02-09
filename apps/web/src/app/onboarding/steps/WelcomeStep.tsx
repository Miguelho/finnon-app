"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";

type WelcomeStepProps = {
  onContinue: () => void;
  showInvite?: boolean;
};

export function WelcomeStep({ onContinue, showInvite = true }: WelcomeStepProps) {
  const t = useTranslations("onboarding");

  return (
    <div className="w-full rounded-2xl border border-[#e5e7eb] bg-white px-8 py-10 text-center shadow-sm">
      <div className="mx-auto mb-8 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#1a1f36] shadow-md">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="white"
          strokeWidth="2"
          className="h-8 w-8"
        >
          <path d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0H5m14 0h2m-16 0H3" />
          <path d="M9 7h1m-1 4h1m4-4h1m-1 4h1" />
        </svg>
      </div>

      <h1 className="text-3xl font-bold text-[#1a1f36]">{t("welcome.title")}</h1>
      <p className="mx-auto mt-3 max-w-md text-base text-[#6b7280]">
        {t("welcome.subtitle")}
      </p>

      <div className="mx-auto mt-10 flex w-full max-w-sm flex-col gap-4 text-left">
        <div className="flex items-start gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full border border-[#e5e7eb] bg-[#fafafa] text-xs font-semibold text-[#6b7280]">
            1
          </div>
          <div className="text-sm text-[#1a1f36]">
            <p className="font-medium">{t("welcome.step1")}</p>
            <span className="text-xs text-[#6b7280]">{t("welcome.step1Desc")}</span>
          </div>
        </div>
        <div className="flex items-start gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full border border-[#e5e7eb] bg-[#fafafa] text-xs font-semibold text-[#6b7280]">
            2
          </div>
          <div className="text-sm text-[#1a1f36]">
            <p className="font-medium">{t("welcome.step2")}</p>
            <span className="text-xs text-[#6b7280]">{t("welcome.step2Desc")}</span>
          </div>
        </div>
        <div className="flex items-start gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full border border-[#e5e7eb] bg-[#fafafa] text-xs font-semibold text-[#6b7280]">
            3
          </div>
          <div className="text-sm text-[#1a1f36]">
            <p className="font-medium">{t("welcome.step3")}</p>
            <span className="text-xs text-[#6b7280]">{t("welcome.step3Desc")}</span>
          </div>
        </div>
      </div>

      <p className="mt-6 text-xs text-[#9ca3af]">
        ⏱ {t("welcome.timeEstimate")}
      </p>

      <div className="mx-auto mt-6 flex w-full max-w-sm flex-col gap-2">
        <Button
          className="w-full bg-[#1a1f36] text-white hover:bg-[#2a3050]"
          onClick={onContinue}
        >
          {t("welcome.start")}
        </Button>
        {showInvite && (
          <Button variant="ghost" asChild className="w-full text-[#6b7280]">
            <Link href="/join">{t("inviteCta")}</Link>
          </Button>
        )}
      </div>
    </div>
  );
}
