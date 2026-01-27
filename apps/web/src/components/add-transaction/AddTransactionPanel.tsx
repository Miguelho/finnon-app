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
import { AddTransactionEntry } from "./AddTransactionEntry";
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
  topCategories: TopCategory[];
  merchantSuggestions: MerchantSuggestion[];
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
  const [selectedType, setSelectedType] = React.useState<TransactionType | null>(
    defaultType || null
  );

  const handleClose = () => {
    setOpen(false);
    // Reset type selection after a short delay (after animation completes)
    setTimeout(() => setSelectedType(defaultType || null), 300);
  };

  const handleSuccess = () => {
    handleClose();
  };

  const handleTypeSelect = (type: TransactionType) => {
    setSelectedType(type);
  };

  // Filter top categories by selected type
  const filteredTopCategories = selectedType
    ? topCategories.filter((cat) => cat.type === selectedType)
    : [];

  return (
    <SlidePanel open={open} onOpenChange={setOpen}>
      <SlidePanelTrigger asChild>{trigger}</SlidePanelTrigger>
      <SlidePanelContent>
        <SlidePanelHeader>
          <SlidePanelTitle>
            {selectedType
              ? selectedType === "income"
                ? t("typeIncome")
                : t("typeExpense")
              : t("entryTitle")}
          </SlidePanelTitle>
        </SlidePanelHeader>
        <SlidePanelBody className="p-0">
          {!selectedType ? (
            <AddTransactionEntry onSelect={handleTypeSelect} />
          ) : (
            <div className="h-full px-6 py-4">
              <AddTransactionForm
                type={selectedType}
                accountId={accountId}
                currency={currency}
                locale={locale}
                categories={categories}
                topCategories={filteredTopCategories}
                merchantSuggestions={merchantSuggestions}
                onSuccess={handleSuccess}
                onCancel={handleClose}
              />
            </div>
          )}
        </SlidePanelBody>
      </SlidePanelContent>
    </SlidePanel>
  );
}
