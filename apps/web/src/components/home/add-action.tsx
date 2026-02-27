"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
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
import { CategoryFormPanel } from "@/components/categories/category-form-panel";
import type { AddActionCategory } from "@/lib/add-action-data-cache";
import { useWebDataCache } from "@/cache/WebDataCacheProvider";
import { createCategory } from "@/app/categories/actions";
import { createRecurringItem } from "@/app/transactions/actions";
import {
  ADD_ACTIONS,
  normalizeCategoryName,
  suggestCategoryIcon,
  type AddActionKey,
  type CategoryIconKey,
  type CategoryType,
  type TransactionDraft,
  type TopCategory,
  type MerchantSuggestion,
  type RecurringFrequency,
} from "@poleursus/shared";

type Category = AddActionCategory;

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
  participants?: Array<{
    userId: string;
    name: string;
    role: "viewer" | "contributor" | "admin";
  }>;
  currentUserId?: string | null;
  onCategoryCreated?: (category: Category) => void;
  renderTrigger?: (open: () => void) => React.ReactNode;
};

export function AddAction({
  canEdit,
  accountId,
  currency = "EUR",
  locale = "es",
  categories = [],
  topCategories = { expense: [], income: [] },
  merchantSuggestions = { expense: [], income: [] },
  participants = [],
  currentUserId = null,
  onCategoryCreated,
  renderTrigger,
}: AddActionProps) {
  const router = useRouter();
  const { emitMutation } = useWebDataCache();
  const t = useTranslations();
  const [isOpen, setIsOpen] = useState(false);
  const [isTransactionOpen, setIsTransactionOpen] = useState(false);
  const [isRecurringOpen, setIsRecurringOpen] = useState(false);
  const [isCategoryOpen, setIsCategoryOpen] = useState(false);
  const [isCategorySubmitting, setIsCategorySubmitting] = useState(false);
  const [availableCategories, setAvailableCategories] = useState<Category[]>(
    categories
  );
  const [categoryForm, setCategoryForm] = useState({
    name: "",
    icon_id: "Tag" as CategoryIconKey,
    type: "expense" as CategoryType,
  });
  const [categoryIconSelected, setCategoryIconSelected] = useState(false);
  const translateDynamic = (key: string, params?: Record<string, unknown>) =>
    t(key as any, params as any);
  const recurringTitleKey =
    ADD_ACTIONS.find((action) => action.key === "recurring")?.titleKey;
  const recurringTitle =
    (recurringTitleKey ? t(recurringTitleKey as any) : null) ??
    t("home.addCta");
  const normalizedCategoryName = normalizeCategoryName(categoryForm.name);
  const canSubmitCategory =
    Boolean(normalizedCategoryName) && !isCategorySubmitting;

  useEffect(() => {
    setAvailableCategories(categories);
  }, [categories]);

  const handleAction = (key: AddActionKey) => {
    if (!canEdit) return;
    setIsOpen(false);

    switch (key) {
      case "movement":
        setIsTransactionOpen(true);
        return;
      case "category":
        setIsCategoryOpen(true);
        return;
      case "recurring":
        setIsRecurringOpen(true);
        return;
    }
  };

  const handleTransactionSuccess = () => {
    void emitMutation("transactions", "insert");
    setIsTransactionOpen(false);
    router.refresh();
  };

  const handleTransactionCancel = () => {
    setIsTransactionOpen(false);
  };

  const handleRequestAddCategoryFromForm = (type: CategoryType) => {
    if (!canEdit) return;
    setCategoryForm({
      name: "",
      icon_id: type === "income" ? "Bank" : "Tag",
      type,
    });
    setCategoryIconSelected(false);
    setIsCategoryOpen(true);
  };

  const resetCategoryForm = () => {
    setCategoryForm({
      name: "",
      icon_id: "Tag",
      type: "expense",
    });
    setCategoryIconSelected(false);
  };

  const handleCategorySubmit = async () => {
    if (!canEdit || isCategorySubmitting) return;

    if (!normalizedCategoryName) {
      toast.error(t("categories.nameRequired"));
      return;
    }

    if (normalizedCategoryName.length < 2 || normalizedCategoryName.length > 40) {
      toast.error(t("categories.error.nameLength"));
      return;
    }

    setIsCategorySubmitting(true);
    try {
      const result = await createCategory({
        account_id: accountId,
        name: normalizedCategoryName,
        icon_id: categoryForm.icon_id,
        type: categoryForm.type,
      });

      if (result.success && result.data) {
        const created = result.data as Category;
        setAvailableCategories((prev) => {
          if (prev.some((category) => category.id === created.id)) {
            return prev;
          }
          return [...prev, created];
        });
        onCategoryCreated?.(created);
        await emitMutation("categories", "insert");
        setIsCategoryOpen(false);
        resetCategoryForm();
        router.refresh();
        return;
      }

      toast.error(
        result.error
          ? t(result.error.key, result.error.params)
          : t("categories.createError")
      );
    } catch (error) {
      toast.error(t("categories.createError"));
    } finally {
      setIsCategorySubmitting(false);
    }
  };

  const handleRecurringSubmitDraft = async (
    draft: TransactionDraft,
    extra?: {
      recurring?: {
        frequency: RecurringFrequency;
        interval: number;
        startDate: string;
        endDate: string | null;
      };
    }
  ) => {
    if (!canEdit) {
      throw new Error(translateDynamic("errors.invalidRequest"));
    }

    const recurring = extra?.recurring;
    if (!recurring) {
      throw new Error(translateDynamic("errors.invalidRequest"));
    }

    const result = await createRecurringItem({
      account_id: accountId,
      type: draft.type,
      amount: draft.amount,
      currency,
      category_id: draft.categoryId || null,
      start_date: recurring.startDate,
      frequency: recurring.frequency,
      interval: recurring.interval,
      end_date: recurring.endDate,
      merchant: draft.merchant.trim() || null,
      notes: draft.notes.trim() || null,
    });

    if (!result.success) {
      throw new Error(
        result.error
          ? translateDynamic(result.error.key, result.error.params)
          : translateDynamic("transactions.repeat.createError")
      );
    }

    await emitMutation("recurring_items", "insert");
  };

  const handleRecurringSuccess = () => {
    setIsRecurringOpen(false);
    router.refresh();
  };

  const handleRecurringCancel = () => {
    setIsRecurringOpen(false);
  };

  const openMenu = () => {
    setIsOpen(true);
  };

  return (
    <>
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
        <SlidePanelContent className="h-auto max-h-[80vh] md:h-screen md:max-h-none">
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
                  categories={availableCategories}
                  topCategories={topCategories}
                  merchantSuggestions={merchantSuggestions}
                  participants={participants}
                  currentUserId={currentUserId}
                  onRequestAddCategory={handleRequestAddCategoryFromForm}
                  onSuccess={handleTransactionSuccess}
                  onCancel={handleTransactionCancel}
                />
              </div>
            </SlidePanelBody>
          </SlidePanelContent>
        </SlidePanel>
      )}

      {canEdit && (
        <CategoryFormPanel
          open={isCategoryOpen}
          onOpenChange={(open) => {
            setIsCategoryOpen(open);
            if (!open && !isCategorySubmitting) {
              resetCategoryForm();
            }
          }}
          title={t("categories.newTitle")}
          description={t("categories.createDescription")}
          nameLabel={t("categories.nameLabel")}
          namePlaceholder={t("categories.namePlaceholder")}
          typeLabel={t("categories.typeLabel")}
          expenseLabel={t("categories.expenseLabel")}
          incomeLabel={t("categories.incomeLabel")}
          iconLabel={t("categories.iconLabel")}
          nameValue={categoryForm.name}
          onNameChange={(newName) => {
            setCategoryForm((prev) => {
              if (!categoryIconSelected && newName.trim()) {
                const suggestion = suggestCategoryIcon(newName);
                return { ...prev, name: newName, icon_id: suggestion.primary };
              }
              return { ...prev, name: newName };
            });
          }}
          typeValue={categoryForm.type}
          onTypeChange={(value) =>
            setCategoryForm((prev) => ({ ...prev, type: value }))
          }
          iconValue={categoryForm.icon_id}
          onIconChange={(iconKey) => {
            setCategoryIconSelected(true);
            setCategoryForm((prev) => ({ ...prev, icon_id: iconKey }));
          }}
          onCancel={() => {
            setIsCategoryOpen(false);
            resetCategoryForm();
          }}
          onSubmit={handleCategorySubmit}
          cancelLabel={t("common.cancel")}
          submitLabel={isCategorySubmitting ? t("common.saving") : t("categories.saveLabel")}
          submitDisabled={!canSubmitCategory}
          cancelDisabled={isCategorySubmitting}
          nameInputId="add-action-category-name"
        />
      )}

      {canEdit && (
        <SlidePanel open={isRecurringOpen} onOpenChange={setIsRecurringOpen}>
          <SlidePanelContent>
            <SlidePanelHeader>
              <SlidePanelTitle>{recurringTitle}</SlidePanelTitle>
            </SlidePanelHeader>
            <SlidePanelBody className="p-0">
              <div className="px-6 py-4">
                <AddTransactionForm
                  accountId={accountId}
                  currency={currency}
                  locale={locale}
                  categories={availableCategories}
                  topCategories={topCategories}
                  merchantSuggestions={merchantSuggestions}
                  participants={participants}
                  currentUserId={currentUserId}
                  allowObligation={false}
                  submitMode="recurring"
                  successMessageKey="transactions.repeat.createSuccess"
                  errorMessageKey="transactions.repeat.createError"
                  onSubmitDraft={handleRecurringSubmitDraft}
                  onRequestAddCategory={handleRequestAddCategoryFromForm}
                  onSuccess={handleRecurringSuccess}
                  onCancel={handleRecurringCancel}
                />
              </div>
            </SlidePanelBody>
          </SlidePanelContent>
        </SlidePanel>
      )}
    </>
  );
}
