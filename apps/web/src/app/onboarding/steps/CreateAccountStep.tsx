"use client";

import { useEffect, useState, type FormEventHandler } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CURRENCIES } from "@poleursus/shared";

type CreateAccountStepProps = {
  initialAccountName: string;
  initialCurrency: string;
  onContinue: (accountName: string, currency: string) => void;
  onBack?: () => void;
};

export function CreateAccountStep({
  initialAccountName,
  initialCurrency,
  onContinue,
  onBack,
}: CreateAccountStepProps) {
  const tGlobal = useTranslations();
  const t = useTranslations("onboarding");
  const [accountName, setAccountName] = useState(initialAccountName);
  const [currency, setCurrency] = useState(initialCurrency || "EUR");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setAccountName(initialAccountName);
  }, [initialAccountName]);

  useEffect(() => {
    setCurrency(initialCurrency || "EUR");
  }, [initialCurrency]);

  const handleSubmit: FormEventHandler<HTMLFormElement> = (e) => {
    e.preventDefault();
    setError(null);
    const normalizedName = accountName.trim();
    if (!normalizedName || !currency) {
      setError(tGlobal("errors.onboardingMissingFields"));
      return;
    }
    onContinue(normalizedName, currency);
  };

  return (
    <div className="w-full rounded-2xl border border-border bg-card p-8 shadow-sm">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-foreground">{t("title")}</h2>
        <p className="text-sm text-muted-foreground">{t("description")}</p>
      </div>
      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="accountName" className="text-sm font-semibold text-foreground">
            {t("accountNameLabel")}
          </Label>
          <Input
            id="accountName"
            name="accountName"
            type="text"
            placeholder={t("accountNamePlaceholder")}
            value={accountName}
            onChange={(event) => setAccountName(event.target.value)}
            maxLength={255}
            className="h-11 border-border bg-muted/30 text-sm text-foreground placeholder:text-muted-foreground focus-visible:ring-1"
          />
          <p className="text-xs text-muted-foreground">{t("accountNameHelper")}</p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="currency" className="text-sm font-semibold text-foreground">
            {t("currencyLabel")}
          </Label>
          <select
            id="currency"
            name="currency"
            value={currency}
            onChange={(event) => setCurrency(event.target.value)}
            className="flex h-11 w-full rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
          >
            {CURRENCIES.map((curr) => (
              <option key={curr.code} value={curr.code}>
                {curr.symbol} {curr.name} ({curr.code})
              </option>
            ))}
          </select>
          <p className="text-xs text-muted-foreground">{t("currencyHelper")}</p>
        </div>

        {error && (
          <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        )}

        <div className="flex flex-col gap-2 sm:flex-row">
          {onBack ? (
            <Button
              type="button"
              variant="outline"
              className="w-full border-border text-foreground"
              onClick={onBack}
            >
              {tGlobal("common.back")}
            </Button>
          ) : null}
          <Button
            type="submit"
            className="w-full"
            disabled={!accountName.trim()}
          >
            {tGlobal("common.continue")}
          </Button>
        </div>
      </form>
    </div>
  );
}
