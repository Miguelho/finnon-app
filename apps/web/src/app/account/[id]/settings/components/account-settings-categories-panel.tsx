"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus, Pencil, X } from "lucide-react";
import {
  normalizeCategoryName,
  resolveCategoryIconKey,
  suggestCategoryIcon,
  type CategoryIconKey,
  type CategoryType,
} from "@poleursus/shared";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { CategoryIcon } from "@/components/category-icon";
import { CategoryFormPanel } from "@/components/categories/category-form-panel";
import { createCategory, deleteCategory, updateCategory } from "@/app/categories/actions";
import { cn } from "@/lib/utils";
import styles from "../settings-panels.module.css";

type Category = {
  id: string;
  account_id: string;
  name: string;
  icon_id: string;
  type: CategoryType;
  created_at: string;
};

type AccountSettingsCategoriesPanelProps = {
  accountId: string;
  canEdit: boolean;
};

export function AccountSettingsCategoriesPanel({
  accountId,
  canEdit,
}: AccountSettingsCategoriesPanelProps) {
  const t = useTranslations();
  const locale = useLocale();
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [userSelectedIcon, setUserSelectedIcon] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    icon_id: "Tag" as CategoryIconKey,
    type: "expense" as CategoryType,
  });

  const loadCategories = async () => {
    setIsLoading(true);
    setHasError(false);

    try {
      const { data, error } = await supabase
        .from("categories")
        .select("id, account_id, name, icon_id, type, created_at")
        .eq("account_id", accountId)
        .order("name", { ascending: true });

      if (error) {
        throw error;
      }

      setCategories((data ?? []) as Category[]);
    } catch (error) {
      console.error("[AccountSettingsCategoriesPanel] load categories error:", error);
      setHasError(true);
      setCategories([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadCategories();
  }, [accountId]);

  const sortedCategories = useMemo(() => {
    return [...categories].sort((a, b) =>
      a.name.localeCompare(b.name, locale, { sensitivity: "base" })
    );
  }, [categories, locale]);

  const expenseCategories = sortedCategories.filter((category) => category.type === "expense");
  const incomeCategories = sortedCategories.filter((category) => category.type === "income");

  const resetForm = () => {
    setFormData({
      name: "",
      icon_id: "Tag",
      type: "expense",
    });
    setSelectedCategory(null);
    setUserSelectedIcon(false);
  };

  const openCreate = (type: CategoryType) => {
    if (!canEdit) return;
    setFormData({
      name: "",
      icon_id: type === "expense" ? "Tag" : "Bank",
      type,
    });
    setUserSelectedIcon(false);
    setIsCreateOpen(true);
  };

  const openEdit = (category: Category) => {
    if (!canEdit) return;
    setSelectedCategory(category);
    setFormData({
      name: category.name,
      icon_id: resolveCategoryIconKey(category.icon_id),
      type: category.type,
    });
    setUserSelectedIcon(true);
    setIsEditOpen(true);
  };

  const handleCreate = async () => {
    if (!canEdit) return;
    const normalizedName = normalizeCategoryName(formData.name);

    if (!normalizedName) {
      toast.error(t("categories.nameRequired"));
      return;
    }

    if (normalizedName.length < 2 || normalizedName.length > 40) {
      toast.error(t("categories.error.nameLength"));
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await createCategory({
        account_id: accountId,
        name: normalizedName,
        icon_id: formData.icon_id,
        type: formData.type,
      });

      if (!result.success || !result.data) {
        toast.error(
          result.error ? t(result.error.key as any, result.error.params as any) : t("categories.createError")
        );
        return;
      }

      toast.success(t("categories.createSuccess"));
      setIsCreateOpen(false);
      resetForm();
      await loadCategories();
      router.refresh();
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = async () => {
    if (!canEdit || !selectedCategory) return;

    const normalizedName = normalizeCategoryName(formData.name);
    if (!normalizedName) {
      toast.error(t("categories.nameRequired"));
      return;
    }

    if (normalizedName.length < 2 || normalizedName.length > 40) {
      toast.error(t("categories.error.nameLength"));
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await updateCategory(selectedCategory.id, {
        name: normalizedName,
        icon_id: formData.icon_id,
        type: formData.type,
      });

      if (!result.success || !result.data) {
        toast.error(
          result.error ? t(result.error.key as any, result.error.params as any) : t("categories.updateError")
        );
        return;
      }

      toast.success(t("categories.updateSuccess"));
      setIsEditOpen(false);
      resetForm();
      await loadCategories();
      router.refresh();
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (category: Category) => {
    if (!canEdit) return;

    const confirmed = window.confirm(
      t("categories.deleteConfirmDescription", { name: category.name })
    );

    if (!confirmed) return;

    const result = await deleteCategory(category.id);
    if (!result.success) {
      toast.error(
        result.error ? t(result.error.key as any, result.error.params as any) : t("categories.deleteError")
      );
      return;
    }

    toast.success(t("accountSettings.categories.deleteSuccess"));
    await loadCategories();
    router.refresh();
  };

  const renderSection = (type: CategoryType, sectionCategories: Category[]) => {
    const isExpense = type === "expense";

    return (
      <section className={styles.section}>
        <header className={styles.sectionHeader}>
          <span
            className={cn(
              styles.sectionDot,
              isExpense ? styles.sectionDotExpense : styles.sectionDotIncome
            )}
          />
          <span
            className={cn(
              styles.sectionLabel,
              isExpense ? styles.sectionLabelExpense : styles.sectionLabelIncome
            )}
          >
            {isExpense
              ? t("accountSettings.categories.expenseSection")
              : t("accountSettings.categories.incomeSection")}
          </span>
          <span className={styles.sectionCount}>
            · {t("accountSettings.categories.categoryCount", { count: sectionCategories.length })}
          </span>
        </header>

        <div className={styles.categoriesCard}>
          {sectionCategories.length === 0 ? (
            <p className={styles.emptyState}>
              {isExpense ? t("categories.emptyExpense") : t("categories.emptyIncome")}
            </p>
          ) : (
            sectionCategories.map((category) => (
              <div key={category.id} className={styles.categoryRow}>
                <div className={styles.categoryMain}>
                  <div
                    className={cn(
                      styles.categoryIcon,
                      isExpense ? styles.categoryIconExpense : styles.categoryIconIncome
                    )}
                  >
                    <CategoryIcon
                      iconKey={resolveCategoryIconKey(category.icon_id)}
                      size={16}
                      tone={isExpense ? "negative" : "positive"}
                      accessibilityLabel={category.name}
                    />
                  </div>
                  <p className={styles.categoryName}>{category.name}</p>
                </div>

                {canEdit ? (
                  <div className={styles.categoryActions}>
                    <button
                      type="button"
                      className={styles.iconButton}
                      onClick={() => openEdit(category)}
                      aria-label={t("common.edit")}
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      type="button"
                      className={cn(styles.iconButton, styles.iconButtonDanger)}
                      onClick={() => {
                        void handleDelete(category);
                      }}
                      aria-label={t("common.delete")}
                    >
                      <X size={14} />
                    </button>
                  </div>
                ) : null}
              </div>
            ))
          )}

          {canEdit ? (
            <div className={styles.addCategoryRow}>
              <button
                type="button"
                className={styles.addCategoryButton}
                onClick={() => openCreate(type)}
              >
                <Plus size={14} />
                {isExpense
                  ? t("accountSettings.categories.addExpense")
                  : t("accountSettings.categories.addIncome")}
              </button>
            </div>
          ) : null}
        </div>
      </section>
    );
  };

  if (isLoading) {
    return <p className={styles.pageDescription}>{t("common.loading")}</p>;
  }

  if (hasError) {
    return <p className={styles.pageDescription}>{t("categories.loadError")}</p>;
  }

  return (
    <>
      {renderSection("expense", expenseCategories)}
      {renderSection("income", incomeCategories)}

      <CategoryFormPanel
        open={isCreateOpen}
        onOpenChange={setIsCreateOpen}
        title={t("categories.newTitle")}
        description={t("categories.createDescription")}
        nameLabel={t("categories.nameLabel")}
        namePlaceholder={t("categories.namePlaceholder")}
        typeLabel={t("categories.typeLabel")}
        expenseLabel={t("categories.expenseLabel")}
        incomeLabel={t("categories.incomeLabel")}
        iconLabel={t("categories.iconLabel")}
        nameValue={formData.name}
        onNameChange={(newName) => {
          setFormData((prev) => {
            if (!userSelectedIcon && newName.trim()) {
              const suggestion = suggestCategoryIcon(newName);
              return { ...prev, name: newName, icon_id: suggestion.primary };
            }
            return { ...prev, name: newName };
          });
        }}
        typeValue={formData.type}
        onTypeChange={(value) => setFormData((prev) => ({ ...prev, type: value }))}
        iconValue={formData.icon_id}
        onIconChange={(iconKey) => {
          setUserSelectedIcon(true);
          setFormData((prev) => ({ ...prev, icon_id: iconKey }));
        }}
        onCancel={() => {
          setIsCreateOpen(false);
          resetForm();
        }}
        onSubmit={handleCreate}
        cancelLabel={t("common.cancel")}
        submitLabel={isSubmitting ? t("common.saving") : t("categories.saveLabel")}
        submitDisabled={isSubmitting || !normalizeCategoryName(formData.name)}
        cancelDisabled={isSubmitting}
        nameInputId="account-settings-create-category"
      />

      <CategoryFormPanel
        open={isEditOpen}
        onOpenChange={setIsEditOpen}
        title={t("categories.editTitle")}
        description={t("categories.editDescription")}
        nameLabel={t("categories.nameLabel")}
        namePlaceholder={t("categories.namePlaceholder")}
        typeLabel={t("categories.typeLabel")}
        expenseLabel={t("categories.expenseLabel")}
        incomeLabel={t("categories.incomeLabel")}
        iconLabel={t("categories.iconLabel")}
        nameValue={formData.name}
        onNameChange={(newName) => {
          setFormData((prev) => ({ ...prev, name: newName }));
        }}
        typeValue={formData.type}
        onTypeChange={(value) => setFormData((prev) => ({ ...prev, type: value }))}
        iconValue={formData.icon_id}
        onIconChange={(iconKey) => {
          setUserSelectedIcon(true);
          setFormData((prev) => ({ ...prev, icon_id: iconKey }));
        }}
        onCancel={() => {
          setIsEditOpen(false);
          resetForm();
        }}
        onSubmit={handleEdit}
        cancelLabel={t("common.cancel")}
        submitLabel={isSubmitting ? t("common.saving") : t("common.saveChanges")}
        submitDisabled={isSubmitting || !normalizeCategoryName(formData.name)}
        cancelDisabled={isSubmitting}
        nameInputId="account-settings-edit-category"
      />
    </>
  );
}
