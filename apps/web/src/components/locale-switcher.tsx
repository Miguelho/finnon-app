"use client";

import { useTransition } from "react";
import { useLocale } from "next-intl";
import { Button } from "@/components/ui/button";

export function LocaleSwitcher() {
  const [isPending, startTransition] = useTransition();
  const locale = useLocale();

  const switchLocale = (newLocale: string) => {
    startTransition(() => {
      document.cookie = `NEXT_LOCALE=${newLocale}; path=/; max-age=31536000`;
      window.location.reload();
    });
  };

  return (
    <div className="flex gap-2">
      <Button
        variant={locale === "es" ? "default" : "outline"}
        size="sm"
        onClick={() => switchLocale("es")}
        disabled={isPending}
      >
        ES
      </Button>
      <Button
        variant={locale === "en" ? "default" : "outline"}
        size="sm"
        onClick={() => switchLocale("en")}
        disabled={isPending}
      >
        EN
      </Button>
    </div>
  );
}
