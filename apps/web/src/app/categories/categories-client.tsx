"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { IconPicker } from "@/components/icon-picker";
import { getIconById, type CategoryType } from "@poleursus/shared";
import { createCategory, updateCategory, deleteCategory } from "./actions";

type Category = {
  id: string;
  account_id: string;
  name: string;
  icon_id: string;
  type: "income" | "expense";
  created_at: string;
};

type CategoriesClientProps = {
  accountId: string;
  initialCategories: Category[];
  role: "viewer" | "contributor" | "admin";
};

export function CategoriesClient({
  accountId,
  initialCategories,
  role,
}: CategoriesClientProps) {
  const router = useRouter();
  const t = useTranslations();
  const [categories, setCategories] = useState(initialCategories);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(
    null
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const canEdit = role !== "viewer";

  // Form state
  const [formData, setFormData] = useState({
    name: "",
    icon_id: "general",
    type: "expense" as CategoryType,
  });

  const handleCreate = async () => {
    if (!canEdit) return;
    if (!formData.name.trim()) return;

    setIsSubmitting(true);
    try {
      const result = await createCategory({
        account_id: accountId,
        ...formData,
      });

      if (result.success && result.data) {
        setCategories([result.data, ...categories]);
        setIsCreateOpen(false);
        setFormData({ name: "", icon_id: "general", type: "expense" });
        router.refresh();
      } else {
        alert(
          result.error
            ? t(result.error.key, result.error.params)
            : t("categories.createError")
        );
      }
    } catch (error) {
      alert(t("categories.createError"));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = async () => {
    if (!canEdit) return;
    if (!selectedCategory || !formData.name.trim()) return;

    setIsSubmitting(true);
    try {
      const result = await updateCategory(selectedCategory.id, {
        name: formData.name,
        icon_id: formData.icon_id,
        type: formData.type,
      });

      if (result.success && result.data) {
        setCategories(
          categories.map((cat) =>
            cat.id === selectedCategory.id ? result.data! : cat
          )
        );
        setIsEditOpen(false);
        setSelectedCategory(null);
        setFormData({ name: "", icon_id: "general", type: "expense" });
        router.refresh();
      } else {
        alert(
          result.error
            ? t(result.error.key, result.error.params)
            : t("categories.updateError")
        );
      }
    } catch (error) {
      alert(t("categories.updateError"));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!canEdit) return;
    if (!selectedCategory) return;

    setIsSubmitting(true);
    try {
      const result = await deleteCategory(selectedCategory.id);

      if (result.success) {
        setCategories(categories.filter((cat) => cat.id !== selectedCategory.id));
        setIsDeleteOpen(false);
        setSelectedCategory(null);
        router.refresh();
      } else {
        alert(
          result.error
            ? t(result.error.key, result.error.params)
            : t("categories.deleteError")
        );
      }
    } catch (error) {
      alert(t("categories.deleteError"));
    } finally {
      setIsSubmitting(false);
    }
  };

  const openEditDialog = (category: Category) => {
    if (!canEdit) return;
    setSelectedCategory(category);
    setFormData({
      name: category.name,
      icon_id: category.icon_id,
      type: category.type,
    });
    setIsEditOpen(true);
  };

  const openDeleteDialog = (category: Category) => {
    if (!canEdit) return;
    setSelectedCategory(category);
    setIsDeleteOpen(true);
  };

  const incomeCategories = categories.filter((cat) => cat.type === "income");
  const expenseCategories = categories.filter((cat) => cat.type === "expense");

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="mx-auto max-w-6xl space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              {t("categories.title")}
            </h1>
            <p className="text-muted-foreground">{t("categories.subtitle")}</p>
            {!canEdit && (
              <p className="text-sm text-muted-foreground">
                {t("categories.readOnlyNotice")}
              </p>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => router.push("/")}>
              {t("categories.backToDashboard")}
            </Button>
            <Button onClick={() => setIsCreateOpen(true)} disabled={!canEdit}>
              {t("categories.createTitle")}
            </Button>
          </div>
        </div>

        {/* Categories Grid */}
        <div className="grid gap-6 md:grid-cols-2">
          {/* Expense Categories */}
          <Card>
            <CardHeader>
              <CardTitle>{t("categories.expenseTitle")}</CardTitle>
              <CardDescription>
                {t("categories.countLabel", { count: expenseCategories.length })}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {expenseCategories.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  {canEdit
                    ? t("categories.emptyExpense")
                    : t("categories.emptyExpenseReadOnly")}
                </p>
              ) : (
                <div className="space-y-2">
                  {expenseCategories.map((category) => {
                    const icon = getIconById(category.icon_id);
                    return (
                      <div
                        key={category.id}
                        className="flex items-center justify-between rounded-lg border p-3"
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-2xl">{icon?.emoji || "📦"}</span>
                          <span className="font-medium">{category.name}</span>
                        </div>
                        {canEdit && (
                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => openEditDialog(category)}
                            >
                              {t("common.edit")}
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => openDeleteDialog(category)}
                            >
                              {t("common.delete")}
                            </Button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Income Categories */}
          <Card>
            <CardHeader>
              <CardTitle>{t("categories.incomeTitle")}</CardTitle>
              <CardDescription>
                {t("categories.countLabel", { count: incomeCategories.length })}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {incomeCategories.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  {canEdit
                    ? t("categories.emptyIncome")
                    : t("categories.emptyIncomeReadOnly")}
                </p>
              ) : (
                <div className="space-y-2">
                  {incomeCategories.map((category) => {
                    const icon = getIconById(category.icon_id);
                    return (
                      <div
                        key={category.id}
                        className="flex items-center justify-between rounded-lg border p-3"
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-2xl">{icon?.emoji || "📦"}</span>
                          <span className="font-medium">{category.name}</span>
                        </div>
                        {canEdit && (
                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => openEditDialog(category)}
                            >
                              {t("common.edit")}
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => openDeleteDialog(category)}
                            >
                              {t("common.delete")}
                            </Button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Create Dialog */}
        {canEdit && (
          <SlidePanel open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <SlidePanelContent>
            <SlidePanelHeader>
              <SlidePanelTitle>{t("categories.createTitle")}</SlidePanelTitle>
              <SlidePanelDescription>
                {t("categories.createDescription")}
              </SlidePanelDescription>
            </SlidePanelHeader>
            <SlidePanelBody>
              <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">{t("categories.nameLabel")}</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  placeholder={t("categories.namePlaceholder")}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="type">{t("categories.typeLabel")}</Label>
                <Select
                  value={formData.type}
                  onValueChange={(value: CategoryType) =>
                    setFormData({ ...formData, type: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="expense">
                      {t("categories.expenseLabel")}
                    </SelectItem>
                    <SelectItem value="income">
                      {t("categories.incomeLabel")}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{t("categories.iconLabel")}</Label>
                <IconPicker
                  value={formData.icon_id}
                  onChange={(iconId) =>
                    setFormData({ ...formData, icon_id: iconId })
                  }
                  filterType={formData.type}
                />
              </div>
              </div>
            </SlidePanelBody>
            <SlidePanelFooter>
              <Button
                variant="outline"
                onClick={() => setIsCreateOpen(false)}
                disabled={isSubmitting}
              >
                {t("common.cancel")}
              </Button>
              <Button onClick={handleCreate} disabled={isSubmitting}>
                {isSubmitting ? t("common.creating") : t("common.create")}
              </Button>
            </SlidePanelFooter>
            </SlidePanelContent>
          </SlidePanel>
        )}

        {/* Edit Panel */}
        {canEdit && (
          <SlidePanel open={isEditOpen} onOpenChange={setIsEditOpen}>
            <SlidePanelContent>
            <SlidePanelHeader>
              <SlidePanelTitle>{t("categories.editTitle")}</SlidePanelTitle>
              <SlidePanelDescription>
                {t("categories.editDescription")}
              </SlidePanelDescription>
            </SlidePanelHeader>
            <SlidePanelBody>
              <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="edit-name">{t("categories.nameLabel")}</Label>
                <Input
                  id="edit-name"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-type">{t("categories.typeLabel")}</Label>
                <Select
                  value={formData.type}
                  onValueChange={(value: CategoryType) =>
                    setFormData({ ...formData, type: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="expense">
                      {t("categories.expenseLabel")}
                    </SelectItem>
                    <SelectItem value="income">
                      {t("categories.incomeLabel")}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{t("categories.iconLabel")}</Label>
                <IconPicker
                  value={formData.icon_id}
                  onChange={(iconId) =>
                    setFormData({ ...formData, icon_id: iconId })
                  }
                  filterType={formData.type}
                />
              </div>
              </div>
            </SlidePanelBody>
            <SlidePanelFooter>
              <Button
                variant="outline"
                onClick={() => setIsEditOpen(false)}
                disabled={isSubmitting}
              >
                {t("common.cancel")}
              </Button>
              <Button onClick={handleEdit} disabled={isSubmitting}>
                {isSubmitting ? t("common.saving") : t("common.saveChanges")}
              </Button>
            </SlidePanelFooter>
            </SlidePanelContent>
          </SlidePanel>
        )}

        {/* Delete Confirmation Dialog */}
        {canEdit && (
          <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
            <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t("categories.deleteConfirmTitle")}</AlertDialogTitle>
              <AlertDialogDescription>
                {t("categories.deleteConfirmDescription", {
                  name: selectedCategory?.name ?? "",
                })}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isSubmitting}>
                {t("common.cancel")}
              </AlertDialogCancel>
              <AlertDialogAction onClick={handleDelete} disabled={isSubmitting}>
                {isSubmitting ? t("common.deleting") : t("common.delete")}
              </AlertDialogAction>
            </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>
    </div>
  );
}
