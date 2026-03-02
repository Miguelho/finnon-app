"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { PageContainer } from "@/components/layout/page-container";
import { AddTransactionForm } from "@/components/add-transaction";
import { CategoryFormPanel } from "@/components/categories/category-form-panel";
import { createRecurringItem } from "@/app/transactions/actions";
import { createCategory } from "@/app/categories/actions";
import { useWebDataCache } from "@/cache/WebDataCacheProvider";
import {
  ADD_ACTIONS,
  normalizeHexColor,
  normalizeCategoryName,
  suggestCategoryIcon,
  type CategoryIconKey,
  type CategoryType,
  type TopCategory,
  type MerchantSuggestion,
  type TransactionDraft,
  type RecurringFrequency,
} from "@poleursus/shared";

type Category = {
  id: string;
  name: string;
  icon_id: string;
  type: "income" | "expense";
};

type FormParticipant = {
  userId: string;
  name: string;
  role: "viewer" | "contributor" | "admin";
};

type CreateTransactionClientProps = {
  kind: "movement" | "recurring";
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
  participants: FormParticipant[];
  currentUserId: string;
  defaultDate?: string;
};

export function CreateTransactionClient({
  kind,
  accountId,
  currency,
  locale,
  categories,
  topCategories,
  merchantSuggestions,
  participants,
  currentUserId,
  defaultDate,
}: CreateTransactionClientProps) {
  const router = useRouter();
  const { emitMutation } = useWebDataCache();
  const t = useTranslations();

  const [availableCategories, setAvailableCategories] =
    useState<Category[]>(categories);
  const [isCategoryOpen, setIsCategoryOpen] = useState(false);
  const [isCategorySubmitting, setIsCategorySubmitting] = useState(false);
  const [categoryForm, setCategoryForm] = useState({
    name: "",
    icon_id: "Tag" as CategoryIconKey,
    type: "expense" as CategoryType,
    color: null as string | null,
  });
  const [categoryIconSelected, setCategoryIconSelected] = useState(false);

  useEffect(() => {
    setAvailableCategories(categories);
  }, [categories]);

  const normalizedCategoryName = normalizeCategoryName(categoryForm.name);
  const canSubmitCategory =
    Boolean(normalizedCategoryName) && !isCategorySubmitting;

  const resetCategoryForm = () => {
    setCategoryForm({
      name: "",
      icon_id: "Tag",
      type: "expense",
      color: null,
    });
    setCategoryIconSelected(false);
  };

  const handleRequestAddCategory = (type: CategoryType) => {
    setCategoryForm({
      name: "",
      icon_id: type === "income" ? "Bank" : "Tag",
      type,
      color: null,
    });
    setCategoryIconSelected(false);
    setIsCategoryOpen(true);
  };

  const handleCategorySubmit = async () => {
    if (isCategorySubmitting) return;

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
        color: normalizeHexColor(categoryForm.color),
      });

      if (result.success && result.data) {
        const created = result.data as Category;
        setAvailableCategories((prev) => {
          if (prev.some((category) => category.id === created.id)) {
            return prev;
          }
          return [...prev, created];
        });
        await emitMutation("categories", "insert");
        setIsCategoryOpen(false);
        resetCategoryForm();
        return;
      }

      toast.error(
        result.error
          ? t(result.error.key as any, result.error.params as any)
          : t("categories.createError")
      );
    } catch {
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
    const recurring = extra?.recurring;
    if (!recurring) {
      throw new Error(t("errors.invalidRequest" as any));
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
          ? t(result.error.key as any, result.error.params as any)
          : t("transactions.repeat.createError" as any)
      );
    }

    await emitMutation("recurring_items", "insert");
  };

  const handleSuccess = () => {
    void emitMutation("transactions", "insert");
    router.push("/transactions");
  };

  const handleRecurringSuccess = () => {
    router.push("/transactions");
  };

  const handleCancel = () => {
    router.back();
  };

  const isRecurring = kind === "recurring";

  const recurringTitleKey =
    ADD_ACTIONS.find((action) => action.key === "recurring")?.titleKey;
  const title = isRecurring
    ? ((recurringTitleKey ? t(recurringTitleKey as any) : null) ??
      t("home.addCta"))
    : t("addTransaction.entryTitle");

  return (
    <PageContainer>
      <div className="mx-auto max-w-2xl py-6">
        <h1 className="mb-6 text-xl font-semibold">{title}</h1>
        <div className="min-h-[60vh]">
          {isRecurring ? (
            <AddTransactionForm
              accountId={accountId}
              currency={currency}
              locale={locale}
              categories={availableCategories}
              topCategories={topCategories}
              merchantSuggestions={merchantSuggestions}
              participants={participants}
              currentUserId={currentUserId}
              defaultDate={defaultDate}
              allowObligation={false}
              submitMode="recurring"
              successMessageKey="transactions.repeat.createSuccess"
              errorMessageKey="transactions.repeat.createError"
              onSubmitDraft={handleRecurringSubmitDraft}
              onRequestAddCategory={handleRequestAddCategory}
              onSuccess={handleRecurringSuccess}
              onCancel={handleCancel}
            />
          ) : (
            <AddTransactionForm
              accountId={accountId}
              currency={currency}
              locale={locale}
              categories={availableCategories}
              topCategories={topCategories}
              merchantSuggestions={merchantSuggestions}
              participants={participants}
              currentUserId={currentUserId}
              defaultDate={defaultDate}
              onRequestAddCategory={handleRequestAddCategory}
              onSuccess={handleSuccess}
              onCancel={handleCancel}
            />
          )}
        </div>
      </div>

      <CategoryFormPanel
        open={isCategoryOpen}
        onOpenChange={(open) => {
          setIsCategoryOpen(open);
          if (!open && !isCategorySubmitting) {
            resetCategoryForm();
          }
        }}
        desktopBehavior="bottom"
        title={t("categories.newTitle")}
        description={t("categories.createDescription")}
        nameLabel={t("categories.nameLabel")}
        namePlaceholder={t("categories.namePlaceholder")}
        typeLabel={t("categories.typeLabel")}
        expenseLabel={t("categories.expenseLabel")}
        incomeLabel={t("categories.incomeLabel")}
        iconLabel={t("categories.iconLabel")}
        colorLabel={t("categories.colorLabel")}
        customColorLabel={t("categories.customColorLabel")}
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
        colorValue={categoryForm.color}
        onColorChange={(color) =>
          setCategoryForm((prev) => ({ ...prev, color }))
        }
        onCancel={() => {
          setIsCategoryOpen(false);
          resetCategoryForm();
        }}
        onSubmit={handleCategorySubmit}
        cancelLabel={t("common.cancel")}
        submitLabel={
          isCategorySubmitting
            ? t("common.saving")
            : t("categories.saveLabel")
        }
        submitDisabled={!canSubmitCategory}
        cancelDisabled={isCategorySubmitting}
        nameInputId="create-tx-category-name"
      />
    </PageContainer>
  );
}
