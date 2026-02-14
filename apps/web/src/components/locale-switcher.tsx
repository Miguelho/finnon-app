"use client";

import { useTransition } from "react";
import { useLocale } from "next-intl";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type LocaleSwitcherProps = {
  appearance?: "default" | "auth";
  className?: string;
};

export function LocaleSwitcher({
  appearance = "default",
  className,
}: LocaleSwitcherProps) {
  const [isPending, startTransition] = useTransition();
  const locale = useLocale();

  const switchLocale = (newLocale: string) => {
    startTransition(() => {
      document.cookie = `NEXT_LOCALE=${newLocale}; path=/; max-age=31536000`;
      window.location.reload();
    });
  };

  if (appearance === "auth") {
    return (
      <div
        className={cn(
          "inline-flex overflow-hidden rounded-[10px] border border-[#E5E3DE] bg-white shadow-[0_2px_8px_rgba(0,0,0,0.06)]",
          className
        )}
      >
        <button
          type="button"
          onClick={() => switchLocale("es")}
          disabled={isPending}
          className={cn(
            "min-w-11 px-3 py-2 text-[13px] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60",
            locale === "es"
              ? "bg-[#2D2D2D] text-white"
              : "bg-transparent text-[#9A9A9A] hover:text-[#6B6B6B]"
          )}
        >
          ES
        </button>
        <button
          type="button"
          onClick={() => switchLocale("en")}
          disabled={isPending}
          className={cn(
            "min-w-11 px-3 py-2 text-[13px] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60",
            locale === "en"
              ? "bg-[#2D2D2D] text-white"
              : "bg-transparent text-[#9A9A9A] hover:text-[#6B6B6B]"
          )}
        >
          EN
        </button>
      </div>
    );
  }

  return (
    <div className={cn("flex gap-2", className)}>
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
