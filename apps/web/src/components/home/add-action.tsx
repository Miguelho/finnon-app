"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { FinnonMark } from "@/components/brand/finnon-mark";
import { Button } from "@/components/ui/button";
import {
  SlidePanel,
  SlidePanelBody,
  SlidePanelContent,
  SlidePanelHeader,
  SlidePanelTitle,
} from "@/components/ui/slide-panel";
import { AddMenuItem } from "@/components/home/AddMenuItem";
import { ADD_ACTIONS, type AddActionKey } from "@poleursus/shared";

type AddActionProps = {
  canEdit: boolean;
  accountId: string;
  renderTrigger?: (open: () => void) => React.ReactNode;
};

export function AddAction({
  canEdit,
  accountId,
  renderTrigger,
}: AddActionProps) {
  const router = useRouter();
  const t = useTranslations();
  const [isOpen, setIsOpen] = useState(false);
  const [isNavigatingToMovement, setIsNavigatingToMovement] = useState(false);

  const handleAction = (key: AddActionKey) => {
    if (!canEdit) return;
    setIsOpen(false);

    switch (key) {
      case "movement":
        setIsNavigatingToMovement(true);
        router.push("/transactions/create");
        return;
      case "recurring":
        router.push("/transactions/create?kind=recurring");
        return;
      case "category":
        router.push("/categories/create");
        return;
    }
  };

  const openMenu = () => {
    setIsOpen(true);
  };

  return (
    <>
      {isNavigatingToMovement ? (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-background/88 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-4 rounded-2xl border border-border bg-background px-8 py-7 shadow-xl">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-border bg-muted/40">
              <span className="inline-flex animate-spin">
                <FinnonMark size="lg" mode="iconOnly" />
              </span>
            </div>
            <p className="text-sm font-medium text-muted-foreground">
              {t("common.loading")}
            </p>
          </div>
        </div>
      ) : null}

      {renderTrigger ? (
        renderTrigger(openMenu)
      ) : (
        <Button
          onClick={openMenu}
          className="fixed right-6 z-50 rounded-full px-5 py-6 shadow-lg bottom-[calc(1.5rem+env(safe-area-inset-bottom)+4rem)] md:bottom-6"
        >
          + {t("home.addCta")}
        </Button>
      )}

      {/* Action menu */}
      <SlidePanel open={isOpen} onOpenChange={setIsOpen}>
        <SlidePanelContent desktopBehavior="bottom" className="h-auto max-h-[80vh]">
          <div
            className="mx-auto mt-3 h-1 w-11 rounded-full bg-border"
            aria-hidden
          />
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
              {ADD_ACTIONS.map((action) => (
                <AddMenuItem
                  key={action.key}
                  meta={action}
                  onClick={() => handleAction(action.key)}
                  disabled={!canEdit}
                />
              ))}
            </div>
          </SlidePanelBody>
        </SlidePanelContent>
      </SlidePanel>
    </>
  );
}
