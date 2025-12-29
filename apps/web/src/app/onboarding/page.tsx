"use client";

import { useState, type FormEventHandler } from "react";
import { useTranslations } from "next-intl";
import { createAccountAction } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { CURRENCIES } from "@/lib/currencies";
import { LocaleSwitcher } from "@/components/locale-switcher";

export default function OnboardingPage() {
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

      if (result?.error) {
        setError(result.error);
        setLoading(false);
      }
      // Si no hay error, el redirect se manejará en la action
    } catch (err) {
      console.error("Error creating account:", err);
      setError(
        err instanceof Error ? err.message : "Error al crear la cuenta"
      );
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="absolute right-4 top-4">
        <LocaleSwitcher />
      </div>
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>{t("title")}</CardTitle>
          <CardDescription>{t("description")}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="accountName">{t("accountNameLabel")}</Label>
              <Input
                id="accountName"
                name="accountName"
                type="text"
                placeholder={t("accountNamePlaceholder")}
                required
                disabled={loading}
                maxLength={255}
              />
              <p className="text-xs text-muted-foreground">
                {t("accountNameHelper")}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="currency">{t("currencyLabel")}</Label>
              <select
                id="currency"
                name="currency"
                disabled={loading}
                defaultValue="EUR"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {CURRENCIES.map((curr) => (
                  <option key={curr.code} value={curr.code}>
                    {curr.symbol} {curr.name} ({curr.code})
                  </option>
                ))}
              </select>
              <p className="text-xs text-muted-foreground">
                {t("currencyHelper")}
              </p>
            </div>

            {error && (
              <div className="rounded-md bg-destructive/15 p-3 text-sm text-destructive">
                {error}
              </div>
            )}

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? t("submitting") : t("submitButton")}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
