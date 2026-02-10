"use client";

import { useTransition } from "react";
import { useLocale } from "next-intl";
import { getDictionary, t } from "@poleursus/shared";
import { Card, CardContent } from "@/components/ui/card";

type LocaleOption = {
  code: string;
  label: string;
};

export default function LanguageClient() {
  const [isPending, startTransition] = useTransition();
  const currentLocale = useLocale();
  const dictionary = getDictionary(currentLocale);

  const options: LocaleOption[] = [
    { code: "en", label: t(dictionary, "settings.language.options.en") },
    { code: "es", label: t(dictionary, "settings.language.options.es") },
  ];

  const switchLocale = (newLocale: string) => {
    if (newLocale === currentLocale) return;
    startTransition(() => {
      document.cookie = `NEXT_LOCALE=${newLocale}; path=/; max-age=31536000`;
      window.location.reload();
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">
          {t(dictionary, "settings.language.title")}
        </h1>
        <p className="text-muted-foreground">
          {t(dictionary, "settings.language.subtitle")}
        </p>
      </div>

      <Card>
        <CardContent className="p-0">
          {options.map((option, index) => (
            <button
              key={option.code}
              onClick={() => switchLocale(option.code)}
              disabled={isPending}
              className={`w-full flex items-center justify-between p-4 text-left hover:bg-muted/50 transition-colors disabled:opacity-50 ${
                index !== options.length - 1 ? "border-b" : ""
              }`}
            >
              <span className="font-medium">{option.label}</span>
              {currentLocale === option.code && (
                <span className="text-primary font-semibold">✓</span>
              )}
            </button>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
