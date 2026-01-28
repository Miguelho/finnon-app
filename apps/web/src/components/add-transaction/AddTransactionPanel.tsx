"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import {
  SlidePanel,
  SlidePanelContent,
  SlidePanelHeader,
  SlidePanelBody,
  SlidePanelTitle,
  SlidePanelTrigger,
} from "@/components/ui/slide-panel";
import { AddTransactionForm } from "./AddTransactionForm";
import type {
  TransactionType,
  TopCategory,
  MerchantSuggestion,
} from "@poleursus/shared";

interface Category {
  id: string;
  name: string;
  icon_id: string;
  type: "income" | "expense";
}

interface AddTransactionPanelProps {
  accountId: string;
  currency: string;
  locale: string;
  categories: Category[];
  topCategories: {
    expense: TopCategory[];
    income: TopCategory[];
  };
  merchantSuggestions: {
    expense: MerchantSuggestion[];
    income: MerchantSuggestion[];
  };
  trigger: React.ReactNode;
  defaultType?: TransactionType;
}

export function AddTransactionPanel({
  accountId,
  currency,
  locale,
  categories,
  topCategories,
  merchantSuggestions,
  trigger,
  defaultType,
}: AddTransactionPanelProps) {
  const t = useTranslations("addTransaction");
  const [open, setOpen] = React.useState(false);

  const handleClose = () => {
    setOpen(false);
  };

  const handleSuccess = () => {
    handleClose();
  };

  return (
    <SlidePanel open={open} onOpenChange={setOpen}>
      <SlidePanelTrigger asChild>{trigger}</SlidePanelTrigger>
      <SlidePanelContent>
        <SlidePanelHeader>
          <SlidePanelTitle>{t("entryTitle")}</SlidePanelTitle>
        </SlidePanelHeader>
        <SlidePanelBody className="p-0">
          <div className="h-full px-6 py-4">
            <AddTransactionForm
              type={defaultType}
              accountId={accountId}
              currency={currency}
              locale={locale}
              categories={categories}
              topCategories={topCategories}
              merchantSuggestions={merchantSuggestions}
              onSuccess={handleSuccess}
              onCancel={handleClose}
            />
          </div>
        </SlidePanelBody>
      </SlidePanelContent>
    </SlidePanel>
  );
}
