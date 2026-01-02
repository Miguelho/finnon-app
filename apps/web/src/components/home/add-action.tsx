"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import {
  SlidePanel,
  SlidePanelBody,
  SlidePanelContent,
  SlidePanelHeader,
  SlidePanelTitle,
} from "@/components/ui/slide-panel";
import { cn } from "@/lib/utils";

type AddActionProps = {
  canEdit: boolean;
};

export function AddAction({ canEdit }: AddActionProps) {
  const router = useRouter();
  const t = useTranslations();
  const [isOpen, setIsOpen] = useState(false);
  const actions = [
    {
      label: t("home.addExpenseTitle"),
      description: t("home.addExpenseDescription"),
      href: "/transactions?new=1&type=expense",
    },
    {
      label: t("home.addIncomeTitle"),
      description: t("home.addIncomeDescription"),
      href: "/transactions?new=1&type=income",
    },
    {
      label: t("home.addObligationTitle"),
      description: t("home.addObligationDescription"),
      href: "/transactions?new=1&kind=obligation",
    },
    {
      label: t("home.addRecurringTitle"),
      description: t("home.addRecurringDescription"),
      href: "/transactions?new=1&kind=recurring",
    },
  ];

  return (
    <>
      <Button onClick={() => setIsOpen(true)}>+ {t("home.addCta")}</Button>
      <Button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 z-40 rounded-full px-5 py-6 shadow-lg"
      >
        + {t("home.addCta")}
      </Button>

      <SlidePanel open={isOpen} onOpenChange={setIsOpen}>
        <SlidePanelContent>
          <SlidePanelHeader>
            <SlidePanelTitle>{t("home.addCta")}</SlidePanelTitle>
          </SlidePanelHeader>
          <SlidePanelBody className="space-y-4">
            {!canEdit && (
              <p className="text-sm text-muted-foreground">
                {t("home.guestBlurb")}
              </p>
            )}
            <div className="space-y-3">
              {actions.map((action) => (
                <button
                  key={action.label}
                  type="button"
                  disabled={!canEdit}
                  onClick={() => {
                    setIsOpen(false);
                    router.push(action.href);
                  }}
                  className={cn(
                    "w-full rounded-lg border px-4 py-3 text-left",
                    !canEdit && "cursor-not-allowed opacity-60",
                    canEdit
                      ? "border-border hover:bg-muted/40"
                      : "border-border"
                  )}
                >
                  <p className="text-sm font-semibold text-foreground">
                    {action.label}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {action.description}
                  </p>
                </button>
              ))}
            </div>
          </SlidePanelBody>
        </SlidePanelContent>
      </SlidePanel>
    </>
  );
}
