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
import { AddMenuItem } from "@/components/home/AddMenuItem";
import { AddTransactionForm } from "@/components/add-transaction";
import {
  ADD_ACTIONS,
  type AddActionKey,
  type TopCategory,
  type MerchantSuggestion,
} from "@poleursus/shared";

type Category = {
  id: string;
  name: string;
  icon_id: string;
  type: "income" | "expense";
};

type AddActionProps = {
  canEdit: boolean;
  accountId: string;
  currency?: string;
  locale?: string;
  categories?: Category[];
  topCategories?: {
    expense: TopCategory[];
    income: TopCategory[];
  };
  merchantSuggestions?: {
    expense: MerchantSuggestion[];
    income: MerchantSuggestion[];
  };
};

export function AddAction({
  canEdit,
  accountId,
  currency = "EUR",
  locale = "es",
  categories = [],
  topCategories = { expense: [], income: [] },
  merchantSuggestions = { expense: [], income: [] },
}: AddActionProps) {
  const router = useRouter();
  const t = useTranslations();
  const [isOpen, setIsOpen] = useState(false);
  const [isTransactionOpen, setIsTransactionOpen] = useState(false);

  const handleAction = (key: AddActionKey) => {
    if (!canEdit) return;
    setIsOpen(false);

    switch (key) {
      case "movement":
        setIsTransactionOpen(true);
        return;
      case "recurring":
        router.push("/transactions?new=1&kind=recurring");
        return;
    }
  };

  const handleTransactionSuccess = () => {
    setIsTransactionOpen(false);
    router.refresh();
  };

  const handleTransactionCancel = () => {
    setIsTransactionOpen(false);
  };

  return (
    <>
      <Button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 z-40 rounded-full px-5 py-6 shadow-lg"
      >
        + {t("home.addCta")}
      </Button>

      {/* Action menu */}
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

      {/* Add Transaction panel */}
      {canEdit && (
        <SlidePanel open={isTransactionOpen} onOpenChange={setIsTransactionOpen}>
          <SlidePanelContent>
            <SlidePanelHeader>
              <SlidePanelTitle>{t("addTransaction.entryTitle")}</SlidePanelTitle>
            </SlidePanelHeader>
            <SlidePanelBody className="p-0">
              <div className="px-6 py-4">
                <AddTransactionForm
                  accountId={accountId}
                  currency={currency}
                  locale={locale}
                  categories={categories}
                  topCategories={topCategories}
                  merchantSuggestions={merchantSuggestions}
                  onSuccess={handleTransactionSuccess}
                  onCancel={handleTransactionCancel}
                />
              </div>
            </SlidePanelBody>
          </SlidePanelContent>
        </SlidePanel>
      )}
    </>
  );
}
