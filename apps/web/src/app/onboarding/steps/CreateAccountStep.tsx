"use client";

import { useState, type FormEventHandler } from "react";
import { useTranslations } from "next-intl";
import { createAccountAction } from "../actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CURRENCIES } from "@poleursus/shared";

const STORAGE_KEY = "finnon:activeAccountId";

type CreateAccountStepProps = {
  onComplete: (accountId: string, currency: string) => void;
};

export function CreateAccountStep({ onComplete }: CreateAccountStepProps) {
  const tGlobal = useTranslations();
  const t = useTranslations("onboarding");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit: FormEventHandler<HTMLFormElement> = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const formData = new FormData(e.currentTarget);
      const result = await createAccountAction(formData);

      if (result && "error" in result) {
        setError(tGlobal(result.error.key, result.error.params));
        setLoading(false);
        return;
      }

      if (result && "accountId" in result) {
        if (typeof window !== "undefined") {
          window.localStorage.setItem(STORAGE_KEY, result.accountId);
        }
        onComplete(result.accountId, result.currency);
        return;
      }

      setError(tGlobal("errors.internalServer"));
      setLoading(false);
    } catch (err) {
      console.error("Error creating account:", err);
      setError(t("createError"));
      setLoading(false);
    }
  };

  return (
    <div className="w-full rounded-2xl border border-[#e5e7eb] bg-white p-8 shadow-sm">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-[#1a1f36]">{t("title")}</h2>
        <p className="text-sm text-[#6b7280]">{t("description")}</p>
      </div>
      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="accountName" className="text-sm font-semibold text-[#1a1f36]">
            {t("accountNameLabel")}
          </Label>
          <Input
            id="accountName"
            name="accountName"
            type="text"
            placeholder={t("accountNamePlaceholder")}
            required
            disabled={loading}
            maxLength={255}
            className="h-11 border-[#e5e7eb] text-sm text-[#1a1f36] placeholder:text-[#9ca3af] focus-visible:ring-0 focus-visible:border-[#1a1f36]"
          />
          <p className="text-xs text-[#9ca3af]">{t("accountNameHelper")}</p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="currency" className="text-sm font-semibold text-[#1a1f36]">
            {t("currencyLabel")}
          </Label>
          <select
            id="currency"
            name="currency"
            disabled={loading}
            defaultValue="EUR"
            className="flex h-11 w-full rounded-lg border border-[#e5e7eb] bg-white px-3 py-2 text-sm text-[#1a1f36] focus:outline-none focus:border-[#1a1f36] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {CURRENCIES.map((curr) => (
              <option key={curr.code} value={curr.code}>
                {curr.symbol} {curr.name} ({curr.code})
              </option>
            ))}
          </select>
          <p className="text-xs text-[#9ca3af]">{t("currencyHelper")}</p>
        </div>

        {error && (
          <div className="rounded-md bg-[#fef2f2] p-3 text-sm text-[#dc2626]">
            {error}
          </div>
        )}

        <Button
          type="submit"
          className="w-full bg-[#1a1f36] text-white hover:bg-[#2a3050]"
          disabled={loading}
        >
          {loading ? t("submitting") : t("submitButton")}
        </Button>
      </form>
    </div>
  );
}
