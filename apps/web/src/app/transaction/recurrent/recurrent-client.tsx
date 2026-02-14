"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageContainer } from "@/components/layout/page-container";
import { Card, CardContent } from "@/components/ui/card";
import {
  SlidePanel,
  SlidePanelContent,
  SlidePanelDescription,
  SlidePanelFooter,
  SlidePanelHeader,
  SlidePanelTitle,
  SlidePanelBody,
} from "@/components/ui/slide-panel";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  type RecurringItem,
  type TopCategory,
  formatMinorToMoney,
  parseMoneyToMinor,
  CURRENCY_MINOR_UNITS,
  themeTokens,
} from "@poleursus/shared";
import { RecurringTile } from "@/components/recurring/recurring-tile";
import { TopCategorySelector } from "@/components/categories/top-category-selector";
import {
  updateRecurringItem,
  pauseRecurringItem,
  endRecurringItem,
} from "@/app/transactions/actions";

type Category = {
  id: string;
  name: string;
  icon_id: string;
  type: "income" | "expense";
};

type RecurringItemWithCategory = RecurringItem & {
  category?: Category | null;
};

type RecurrentesClientProps = {
  accountId: string;
  baseCurrency: string;
  initialRecurringItems: RecurringItemWithCategory[];
  categories: Category[];
  canEdit: boolean;
};

export function RecurrentesClient({
  accountId,
  baseCurrency,
  initialRecurringItems,
  categories,
  canEdit,
}: RecurrentesClientProps) {
  const router = useRouter();
  const t = useTranslations("recurrentes");
  const tCommon = useTranslations("common");
  const tTransactions = useTranslations("transactions");
  const colors = themeTokens.light.colors;

  const [recurringItems, setRecurringItems] = useState(initialRecurringItems);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isEndConfirmOpen, setIsEndConfirmOpen] = useState(false);
  const [selectedItem, setSelectedItem] =
    useState<RecurringItemWithCategory | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Edit form state
  const [editForm, setEditForm] = useState({
    merchant: "",
    amount: "",
    category_id: "",
    start_date: "",
    end_date: "",
    effective_from: new Date().toISOString().slice(0, 10),
  });
  const [showFullCategorySelector, setShowFullCategorySelector] = useState(false);

  const openEditForm = (item: RecurringItemWithCategory) => {
    const amountMinor =
      typeof item.amount_minor === "bigint"
        ? item.amount_minor
        : BigInt(item.amount_minor);
    setSelectedItem(item);
    setEditForm({
      merchant: item.merchant || "",
      amount: formatMinorToMoney(amountMinor, item.currency),
      category_id: item.category?.id || "",
      start_date: item.start_date,
      end_date: item.end_date || "",
      effective_from: new Date().toISOString().slice(0, 10),
    });
    setShowFullCategorySelector(false);
    setIsEditOpen(true);
  };

  const handleEdit = async () => {
    if (!selectedItem) return;

    setIsSubmitting(true);
    try {
      // Parse amount to minor units
      const amountMinor = parseMoneyToMinor(
        editForm.amount,
        selectedItem.currency,
        CURRENCY_MINOR_UNITS
      );

      if (typeof amountMinor === "object" && "error" in amountMinor) {
        alert(tTransactions("amountRequired"));
        setIsSubmitting(false);
        return;
      }

      const result = await updateRecurringItem({
        id: selectedItem.id,
        merchant: editForm.merchant || undefined,
        amount_minor: Number(amountMinor),
        category_id: editForm.category_id || null,
        start_date: editForm.start_date || undefined,
        end_date: editForm.end_date || null,
        effective_from: editForm.effective_from,
      });

      if (result.success && result.data) {
        setRecurringItems((prev) =>
          prev.map((item) =>
            item.id === selectedItem.id
              ? { ...item, ...result.data, category: item.category }
              : item
          )
        );
        setIsEditOpen(false);
        setSelectedItem(null);
        router.refresh();
      } else {
        alert(t("updateError"));
      }
    } catch (error) {
      console.error("Error updating recurring item:", error);
      alert(t("updateError"));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePause = async (id: string, isPaused: boolean) => {
    setIsSubmitting(true);
    try {
      const result = await pauseRecurringItem({ id, is_paused: isPaused });

      if (result.success && result.data) {
        setRecurringItems((prev) =>
          prev.map((item) =>
            item.id === id
              ? { ...item, is_paused: result.data.is_paused }
              : item
          )
        );
        router.refresh();
      } else {
        alert(isPaused ? t("pauseError") : t("resumeError"));
      }
    } catch (error) {
      console.error("Error pausing recurring item:", error);
      alert(isPaused ? t("pauseError") : t("resumeError"));
    } finally {
      setIsSubmitting(false);
    }
  };

  const confirmEnd = (item: RecurringItemWithCategory) => {
    setSelectedItem(item);
    setIsEndConfirmOpen(true);
  };

  const handleEnd = async () => {
    if (!selectedItem) return;

    setIsSubmitting(true);
    try {
      const today = new Date().toISOString().slice(0, 10);
      const result = await endRecurringItem({
        id: selectedItem.id,
        end_date: today,
      });

      if (result.success && result.data) {
        setRecurringItems((prev) =>
          prev.map((item) =>
            item.id === selectedItem.id
              ? { ...item, end_date: result.data.end_date }
              : item
          )
        );
        setIsEndConfirmOpen(false);
        setSelectedItem(null);
        router.refresh();
      } else {
        alert(t("endError"));
      }
    } catch (error) {
      console.error("Error ending recurring item:", error);
      alert(t("endError"));
    } finally {
      setIsSubmitting(false);
    }
  };

  const sanitizeNumericInput = (value: string) =>
    value.replace(/[^0-9.,]/g, "");

  return (
    <PageContainer className="space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push("/transactions")}
            aria-label={tCommon("back")}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="space-y-1">
            <h1 className="text-3xl font-bold tracking-tight">{t("title")}</h1>
            <p className="text-muted-foreground">{t("pageDescription")}</p>
          </div>
        </div>
        {!canEdit && (
          <p className="text-sm text-muted-foreground">
            {tTransactions("readOnlyNotice")}
          </p>
        )}
      </div>

      {/* List */}
      <Card>
        <CardContent className="p-0">
          {recurringItems.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-muted-foreground">{t("empty")}</p>
            </div>
          ) : (
            <div className="divide-y">
              {recurringItems.map((item) => (
                <RecurringTile
                  key={item.id}
                  recurringItem={item}
                  onEdit={canEdit ? () => openEditForm(item) : undefined}
                  onPause={
                    canEdit
                      ? (id, isPaused) => handlePause(id, isPaused)
                      : undefined
                  }
                  onEnd={canEdit ? () => confirmEnd(item) : undefined}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Panel */}
      <SlidePanel open={isEditOpen} onOpenChange={setIsEditOpen}>
        <SlidePanelContent>
          <SlidePanelHeader>
            <SlidePanelTitle>{t("edit")}</SlidePanelTitle>
            <SlidePanelDescription>{t("editDescription")}</SlidePanelDescription>
          </SlidePanelHeader>
          <SlidePanelBody className="space-y-4">
            {/* Category */}
            <div className="space-y-2">
              <Label>{tTransactions("categoryOptionalLabel")}</Label>
              {(() => {
                const itemType = selectedItem?.type;
                const filteredCategories = categories.filter((cat) => cat.type === itemType);
                const topCats: TopCategory[] = filteredCategories.slice(0, 3);
                return (
                  <>
                    {topCats.length > 0 && (
                      <TopCategorySelector
                        topCategories={topCats}
                        selectedCategoryId={editForm.category_id || undefined}
                        onSelect={(id) =>
                          setEditForm((prev) => ({ ...prev, category_id: id }))
                        }
                        onOpenAll={() => setShowFullCategorySelector((prev) => !prev)}
                        seeOthersLabel={tTransactions("create.categorySeeOthers")}
                      />
                    )}
                    {(showFullCategorySelector || topCats.length === 0) && (
                      <div className="space-y-1 rounded-md border p-1">
                        <button
                          type="button"
                          onClick={() =>
                            setEditForm((prev) => ({ ...prev, category_id: "" }))
                          }
                          className={`w-full rounded px-3 py-1.5 text-left text-sm ${
                            !editForm.category_id
                              ? "bg-primary/10 font-semibold text-primary"
                              : "text-foreground hover:bg-muted"
                          }`}
                        >
                          {tCommon("noneOption")}
                        </button>
                        {filteredCategories.map((cat) => (
                          <button
                            key={cat.id}
                            type="button"
                            onClick={() =>
                              setEditForm((prev) => ({ ...prev, category_id: cat.id }))
                            }
                            className={`w-full rounded px-3 py-1.5 text-left text-sm ${
                              editForm.category_id === cat.id
                                ? "bg-primary/10 font-semibold text-primary"
                                : "text-foreground hover:bg-muted"
                            }`}
                          >
                            {cat.name}
                          </button>
                        ))}
                      </div>
                    )}
                  </>
                );
              })()}
            </div>

            {/* Name */}
            <div className="space-y-2">
              <Label htmlFor="merchant">{t("nameLabel")}</Label>
              <Input
                id="merchant"
                value={editForm.merchant}
                onChange={(e) =>
                  setEditForm((prev) => ({ ...prev, merchant: e.target.value }))
                }
                placeholder={t("namePlaceholder")}
              />
            </div>

            {/* Amount */}
            <div className="space-y-2">
              <Label htmlFor="amount">{t("amountLabel")}</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="amount"
                  value={editForm.amount}
                  onChange={(e) =>
                    setEditForm((prev) => ({
                      ...prev,
                      amount: sanitizeNumericInput(e.target.value),
                    }))
                  }
                  placeholder="0,00"
                />
                <span className="text-sm text-muted-foreground">
                  {baseCurrency}
                </span>
              </div>
            </div>

            {/* Start Date */}
            <div className="space-y-2">
              <Label htmlFor="start_date">{t("startDateLabel")}</Label>
              <Input
                id="start_date"
                type="date"
                value={editForm.start_date}
                onChange={(e) =>
                  setEditForm((prev) => ({
                    ...prev,
                    start_date: e.target.value,
                  }))
                }
              />
            </div>

            {/* End Date */}
            <div className="space-y-2">
              <Label htmlFor="end_date">{t("endDateLabel")}</Label>
              <Input
                id="end_date"
                type="date"
                value={editForm.end_date}
                onChange={(e) =>
                  setEditForm((prev) => ({ ...prev, end_date: e.target.value }))
                }
              />
            </div>

            {/* Effective From */}
            <div className="space-y-2">
              <Label htmlFor="effective_from">{t("applyFrom")}</Label>
              <Input
                id="effective_from"
                type="date"
                value={editForm.effective_from}
                min={new Date().toISOString().slice(0, 10)}
                onChange={(e) =>
                  setEditForm((prev) => ({
                    ...prev,
                    effective_from: e.target.value,
                  }))
                }
              />
              <p className="text-sm text-muted-foreground">
                {t("applyFromHint")}
              </p>
            </div>
          </SlidePanelBody>
          <SlidePanelFooter>
            <Button
              variant="outline"
              onClick={() => setIsEditOpen(false)}
              disabled={isSubmitting}
            >
              {tCommon("cancel")}
            </Button>
            <Button onClick={handleEdit} disabled={isSubmitting}>
              {isSubmitting ? tCommon("saving") : tCommon("saveChanges")}
            </Button>
          </SlidePanelFooter>
        </SlidePanelContent>
      </SlidePanel>

      {/* End Confirmation Dialog */}
      <AlertDialog open={isEndConfirmOpen} onOpenChange={setIsEndConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("endConfirmTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("endConfirmDescription")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSubmitting}>
              {tCommon("cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleEnd}
              disabled={isSubmitting}
              style={{ backgroundColor: colors.state.negative }}
            >
              {isSubmitting ? tCommon("saving") : t("end")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageContainer>
  );
}
