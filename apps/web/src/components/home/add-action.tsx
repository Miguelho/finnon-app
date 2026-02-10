"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { ArrowDownLeft, ArrowUpRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  SlidePanel,
  SlidePanelBody,
  SlidePanelContent,
  SlidePanelHeader,
  SlidePanelTitle,
} from "@/components/ui/slide-panel";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { AddMenuItem } from "@/components/home/AddMenuItem";
import { AddTransactionForm } from "@/components/add-transaction";
import { createRecurringItem } from "@/app/transactions/actions";
import {
  ADD_ACTIONS,
  type AddActionKey,
  type TopCategory,
  type MerchantSuggestion,
  type RecurringFrequency,
  type TransactionType,
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
  renderTrigger,
}: AddActionProps) {
  const router = useRouter();
  const t = useTranslations();
  const [isOpen, setIsOpen] = useState(false);
  const [isTransactionOpen, setIsTransactionOpen] = useState(false);
  const [isRecurringOpen, setIsRecurringOpen] = useState(false);
  const [isRecurringSubmitting, setIsRecurringSubmitting] = useState(false);
  const [recurringForm, setRecurringForm] = useState(() => ({
    type: "expense" as TransactionType,
    amount: "",
    categoryId: "",
    startDate: new Date().toISOString().slice(0, 10),
    frequency: "monthly" as RecurringFrequency,
    interval: "1",
    endDate: "",
    merchant: "",
    notes: "",
  }));
  const recurringTitle =
    ADD_ACTIONS.find((action) => action.key === "recurring")?.title ??
    t("home.addCta");

  const handleAction = (key: AddActionKey) => {
    if (!canEdit) return;
    setIsOpen(false);

    switch (key) {
      case "movement":
        setIsTransactionOpen(true);
        return;
      case "category":
        router.push("/categories");
        return;
      case "recurring":
        setIsRecurringOpen(true);
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

  const resetRecurringForm = () => {
    setRecurringForm({
      type: "expense",
      amount: "",
      categoryId: "",
      startDate: new Date().toISOString().slice(0, 10),
      frequency: "monthly",
      interval: "1",
      endDate: "",
      merchant: "",
      notes: "",
    });
  };

  const categoryOptions = useMemo(
    () => categories.filter((category) => category.type === recurringForm.type),
    [categories, recurringForm.type]
  );

  const handleRecurringSubmit = async (
    event?: React.FormEvent<HTMLFormElement>
  ) => {
    event?.preventDefault();
    if (!canEdit || isRecurringSubmitting) return;
    if (!recurringForm.amount.trim()) {
      toast.error(t("errors.invalidRequest"));
      return;
    }
    const intervalValue = Number(recurringForm.interval);
    if (!Number.isFinite(intervalValue) || intervalValue < 1) {
      toast.error(t("errors.invalidRequest"));
      return;
    }

    setIsRecurringSubmitting(true);
    try {
      const result = await createRecurringItem({
        account_id: accountId,
        type: recurringForm.type,
        amount: recurringForm.amount,
        currency,
        category_id: recurringForm.categoryId || null,
        start_date: recurringForm.startDate,
        frequency: recurringForm.frequency,
        interval: intervalValue,
        end_date: recurringForm.endDate.trim() || null,
        merchant: recurringForm.merchant.trim() || null,
        notes: recurringForm.notes.trim() || null,
      });

      if (result.success) {
        setIsRecurringOpen(false);
        resetRecurringForm();
        router.refresh();
        toast.success(t("transactions.repeat.createSuccess"));
      } else {
        toast.error(
          result.error
            ? t(result.error.key, result.error.params)
            : t("transactions.repeat.createError")
        );
      }
    } catch (error) {
      toast.error(t("transactions.repeat.createError"));
    } finally {
      setIsRecurringSubmitting(false);
    }
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

      {canEdit && (
        <SlidePanel open={isRecurringOpen} onOpenChange={setIsRecurringOpen}>
          <SlidePanelContent>
            <SlidePanelHeader>
              <SlidePanelTitle>{recurringTitle}</SlidePanelTitle>
            </SlidePanelHeader>
            <SlidePanelBody>
              <form className="space-y-5" onSubmit={handleRecurringSubmit}>
                <div className="space-y-3 rounded-xl border border-border bg-muted/30 p-4">
                  <Label className="text-sm font-semibold text-foreground">
                    {t("transactions.create.typeLabel")}
                  </Label>
                  <div className="relative flex rounded-full border bg-muted/30 p-1">
                    <span
                      aria-hidden="true"
                      className={`pointer-events-none absolute inset-y-1 left-1 w-[calc(50%-0.25rem)] rounded-full bg-background shadow-sm transition-transform ${
                        recurringForm.type === "income" ? "translate-x-full" : ""
                      }`}
                    />
                    <button
                      type="button"
                      aria-pressed={recurringForm.type === "expense"}
                      onClick={() =>
                        setRecurringForm((prev) => ({
                          ...prev,
                          type: "expense",
                          categoryId: "",
                        }))
                      }
                      className={`relative z-10 flex-1 rounded-full py-2.5 text-sm font-semibold inline-flex items-center justify-center gap-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${
                        recurringForm.type === "expense"
                          ? "text-foreground"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      <ArrowDownLeft className="h-4 w-4" />
                      {t("transactions.create.typeExpense")}
                    </button>
                    <button
                      type="button"
                      aria-pressed={recurringForm.type === "income"}
                      onClick={() =>
                        setRecurringForm((prev) => ({
                          ...prev,
                          type: "income",
                          categoryId: "",
                        }))
                      }
                      className={`relative z-10 flex-1 rounded-full py-2.5 text-sm font-semibold inline-flex items-center justify-center gap-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${
                        recurringForm.type === "income"
                          ? "text-foreground"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      <ArrowUpRight className="h-4 w-4" />
                      {t("transactions.create.typeIncome")}
                    </button>
                  </div>
                </div>

                <div className="grid gap-4 rounded-xl border border-border bg-muted/30 p-4">
                  <div className="space-y-2">
                    <Label>{t("transactions.create.amountLabel")}</Label>
                    <Input
                      value={recurringForm.amount}
                      onChange={(event) =>
                        setRecurringForm((prev) => ({
                          ...prev,
                          amount: event.target.value.replace(/[^0-9.,]/g, ""),
                        }))
                      }
                      placeholder={t("transactions.create.amountPlaceholder")}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>{t("transactions.create.categoryLabel")}</Label>
                    <Select
                      value={recurringForm.categoryId || "none"}
                      onValueChange={(value) =>
                        setRecurringForm((prev) => ({
                          ...prev,
                          categoryId: value === "none" ? "" : value,
                        }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue
                          placeholder={t("transactions.create.categoryPlaceholder")}
                        />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">
                          {t("transactions.create.categoryNone")}
                        </SelectItem>
                        {categoryOptions.map((category) => (
                          <SelectItem key={category.id} value={category.id}>
                            {category.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>{t("transactions.create.merchantLabel")}</Label>
                    <Input
                      value={recurringForm.merchant}
                      onChange={(event) =>
                        setRecurringForm((prev) => ({
                          ...prev,
                          merchant: event.target.value,
                        }))
                      }
                      placeholder={t("transactions.create.merchantPlaceholder")}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>{t("transactions.create.notesLabel")}</Label>
                    <Textarea
                      value={recurringForm.notes}
                      onChange={(event) =>
                        setRecurringForm((prev) => ({
                          ...prev,
                          notes: event.target.value,
                        }))
                      }
                      placeholder={t("transactions.create.notesPlaceholder")}
                    />
                  </div>
                </div>

                <div className="grid gap-4 rounded-xl border border-border bg-muted/30 p-4">
                  <div className="space-y-2">
                    <Label>{t("transactions.repeat.frequencyLabel")}</Label>
                    <Select
                      value={recurringForm.frequency}
                      onValueChange={(value) =>
                        setRecurringForm((prev) => ({
                          ...prev,
                          frequency: value as RecurringFrequency,
                        }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="weekly">
                          {t("transactions.repeat.weekly")}
                        </SelectItem>
                        <SelectItem value="monthly">
                          {t("transactions.repeat.monthly")}
                        </SelectItem>
                        <SelectItem value="yearly">
                          {t("transactions.repeat.yearly")}
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>{t("transactions.repeat.intervalLabel")}</Label>
                    <Input
                      value={recurringForm.interval}
                      onChange={(event) =>
                        setRecurringForm((prev) => ({
                          ...prev,
                          interval: event.target.value.replace(/[^0-9]/g, ""),
                        }))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>{t("transactions.repeat.startDateLabel")}</Label>
                    <Input
                      type="date"
                      value={recurringForm.startDate}
                      onChange={(event) =>
                        setRecurringForm((prev) => ({
                          ...prev,
                          startDate: event.target.value,
                        }))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>{t("transactions.repeat.endDateLabel")}</Label>
                    <Input
                      type="date"
                      value={recurringForm.endDate}
                      onChange={(event) =>
                        setRecurringForm((prev) => ({
                          ...prev,
                          endDate: event.target.value,
                        }))
                      }
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => {
                      setIsRecurringOpen(false);
                      resetRecurringForm();
                    }}
                  >
                    {t("transactions.create.cancel")}
                  </Button>
                  <Button type="submit" disabled={isRecurringSubmitting}>
                    {isRecurringSubmitting
                      ? t("transactions.create.saving")
                      : t("transactions.create.save")}
                  </Button>
                </div>
              </form>
            </SlidePanelBody>
          </SlidePanelContent>
        </SlidePanel>
      )}
    </>
  );
}
