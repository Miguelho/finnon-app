"use client";

import { useEffect, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useNetworkNotice } from "@/components/network/network-notice";
import { createClient } from "@/lib/supabase/client";
import { CategoryFormPanel } from "@/components/categories/category-form-panel";
import { CategoryIcon } from "@/components/category-icon";
import { cn } from "@/lib/utils";
import {
  normalizeCategoryName,
  resolveCategoryIconKey,
  suggestCategoryIcon,
  type CategoryIconKey,
  type CategoryType,
} from "@poleursus/shared";
import { createCategory, updateCategory } from "@/app/categories/actions";

type MemberProfile = {
  user_id: string;
  role: "viewer" | "contributor" | "admin";
  name: string | null;
  email: string | null;
};

type Category = {
  id: string;
  account_id: string;
  name: string;
  icon_id: string;
  type: "income" | "expense";
  created_at: string;
};

type ActiveAccountDetailsProps = {
  account: {
    id: string;
    name: string;
    base_currency: string;
  };
  currentUserId: string;
  role: "viewer" | "contributor" | "admin";
};

export function ActiveAccountDetails({
  account,
  currentUserId,
  role,
}: ActiveAccountDetailsProps) {
  const t = useTranslations();
  const locale = useLocale();
  const router = useRouter();
  const { reportNetworkIssue } = useNetworkNotice();
  const supabase = useMemo(() => createClient(), []);
  const [members, setMembers] = useState<MemberProfile[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isCategoriesLoading, setIsCategoriesLoading] = useState(false);
  const [categoriesError, setCategoriesError] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    icon_id: "Tag" as CategoryIconKey,
    type: "expense" as CategoryType,
  });
  const [userSelectedIcon, setUserSelectedIcon] = useState(false);
  const canEdit = role !== "viewer";

  useEffect(() => {
    let cancelled = false;

    async function loadMembers() {
      setIsLoading(true);
      setHasError(false);

      try {
        const response = await fetch("/api/profiles", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ accountId: account.id }),
        });

        if (!response.ok) {
          throw new Error("profiles_load_failed");
        }

        const payload = await response.json();
        if (!cancelled) {
          setMembers(payload?.members ?? []);
        }
      } catch (error) {
        if (!cancelled) {
          setHasError(true);
          setMembers([]);
        }
        reportNetworkIssue({ onRetry: loadMembers });
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    loadMembers();
    return () => {
      cancelled = true;
    };
  }, [account.id, reportNetworkIssue]);

  useEffect(() => {
    let cancelled = false;

    async function loadCategories() {
      setIsCategoriesLoading(true);
      setCategoriesError(false);

      try {
        const { data, error } = await supabase
          .from("categories")
          .select("id, account_id, name, icon_id, type, created_at")
          .eq("account_id", account.id)
          .order("name", { ascending: true });

        if (error) {
          throw error;
        }

        if (!cancelled) {
          setCategories((data ?? []) as Category[]);
        }
      } catch (error) {
        if (!cancelled) {
          setCategoriesError(true);
          setCategories([]);
        }
        reportNetworkIssue({ onRetry: loadCategories });
      } finally {
        if (!cancelled) {
          setIsCategoriesLoading(false);
        }
      }
    }

    loadCategories();
    return () => {
      cancelled = true;
    };
  }, [account.id, reportNetworkIssue, supabase]);

  const description = t("account.description");
  const normalizedNameValue = normalizeCategoryName(formData.name);
  const canSubmit = Boolean(normalizedNameValue) && !isSubmitting;
  const sortedCategories = [...categories].sort((a, b) =>
    a.name.localeCompare(b.name, locale, { sensitivity: "base" })
  );

  const handleCreate = async () => {
    if (!canEdit) return;
    const normalizedName = normalizeCategoryName(formData.name);
    if (!normalizedName) {
      alert(t("categories.nameRequired"));
      return;
    }
    if (normalizedName.length < 2 || normalizedName.length > 40) {
      alert(t("categories.error.nameLength"));
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await createCategory({
        account_id: account.id,
        ...formData,
        name: normalizedName,
      });

      if (result.success && result.data) {
        setCategories((prev) => [...prev, result.data as Category]);
        setIsCreateOpen(false);
        setFormData({ name: "", icon_id: "Tag", type: "expense" });
        setUserSelectedIcon(false);
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
    if (!selectedCategory) return;
    const normalizedName = normalizeCategoryName(formData.name);
    if (!normalizedName) {
      alert(t("categories.nameRequired"));
      return;
    }
    if (normalizedName.length < 2 || normalizedName.length > 40) {
      alert(t("categories.error.nameLength"));
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await updateCategory(selectedCategory.id, {
        name: normalizedName,
        icon_id: formData.icon_id,
        type: formData.type,
      });

      if (result.success && result.data) {
        setCategories((prev) =>
          prev.map((cat) =>
            cat.id === selectedCategory.id ? (result.data as Category) : cat
          )
        );
        setIsEditOpen(false);
        setSelectedCategory(null);
        setFormData({ name: "", icon_id: "Tag", type: "expense" });
        setUserSelectedIcon(false);
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

  const openEditDialog = (category: Category) => {
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

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("account.title")}</CardTitle>
        {description ? <CardDescription>{description}</CardDescription> : null}
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1">
          <p className="text-lg font-semibold text-foreground">{account.name}</p>
          <p className="text-sm text-muted-foreground">
            {t("account.baseCurrencyLabel", { currency: account.base_currency })}
          </p>
        </div>

        <div className="space-y-3">
          <p className="text-sm font-semibold text-foreground">
            {t("account.participantsLabel", { count: members.length })}
          </p>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">
              {t("dashboard.participantsLoading")}
            </p>
          ) : hasError ? (
            <p className="text-sm text-muted-foreground">
              {t("account.participantsLoadError")}
            </p>
          ) : members.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {t("account.participantsEmpty")}
            </p>
          ) : (
            <div className="space-y-2">
              {members.map((member) => {
                const isCurrentUser = member.user_id === currentUserId;
                const fallback = t("account.memberFallback", {
                  id: member.user_id.slice(0, 6),
                });
                const displayName =
                  member.name ||
                  member.email ||
                  (isCurrentUser ? t("account.youLabel") : fallback);

                return (
                  <div
                    key={`${member.user_id}-${member.role}`}
                    className="flex items-center justify-between rounded-md border px-3 py-2"
                  >
                    <div>
                      <p className="text-sm font-medium text-foreground">
                        {isCurrentUser ? t("account.youLabel") : displayName}
                      </p>
                      {member.email && !isCurrentUser && (
                        <p className="text-xs text-muted-foreground">
                          {member.email}
                        </p>
                      )}
                    </div>
                    <span className="rounded-full bg-muted px-2 py-1 text-xs font-semibold capitalize text-foreground">
                      {member.role}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="h-px bg-border" />

        <div className="space-y-3">
          <div className="space-y-1">
            <p className="text-sm font-semibold text-foreground">
              {t("account.categoriesLabel", { count: categories.length })}
            </p>
            <p className="text-sm text-muted-foreground">
              {t("account.categoriesSubtitle")}
            </p>
          </div>

          {isCategoriesLoading ? (
            <p className="text-sm text-muted-foreground">
              {t("common.loading")}
            </p>
          ) : categoriesError ? (
            <p className="text-sm text-muted-foreground">
              {t("categories.loadError")}
            </p>
          ) : sortedCategories.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {t("categories.emptyAll")}
            </p>
          ) : (
            <div className="space-y-2">
              {sortedCategories.map((category) => (
                <div
                  key={category.id}
                  className={cn(
                    "flex items-center justify-between gap-4 rounded-md border px-3 py-2",
                    canEdit &&
                      "cursor-pointer hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  )}
                  role={canEdit ? "button" : undefined}
                  tabIndex={canEdit ? 0 : undefined}
                  onClick={canEdit ? () => openEditDialog(category) : undefined}
                  onKeyDown={(event) => {
                    if (!canEdit) return;
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      openEditDialog(category);
                    }
                  }}
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted">
                      <CategoryIcon
                        iconKey={resolveCategoryIconKey(category.icon_id)}
                        size={16}
                        tone="muted"
                        accessibilityLabel={category.name}
                      />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">
                        {category.name}
                      </p>
                    </div>
                  </div>
                  <span className="rounded-full bg-muted px-2 py-1 text-xs font-semibold text-foreground">
                    {category.type === "income"
                      ? t("categories.incomeLabel")
                      : t("categories.expenseLabel")}
                  </span>
                </div>
              ))}
            </div>
          )}

          {canEdit && (
            <button
              type="button"
              onClick={() => setIsCreateOpen(true)}
              className="text-sm font-medium text-primary hover:underline"
            >
              + {t("account.categoriesAddLabel")}
            </button>
          )}
        </div>
      </CardContent>

      {canEdit && (
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
          onTypeChange={(value) => setFormData({ ...formData, type: value })}
          iconValue={formData.icon_id}
          onIconChange={(iconKey) => {
            setUserSelectedIcon(true);
            setFormData({ ...formData, icon_id: iconKey });
          }}
          onCancel={() => {
            setIsCreateOpen(false);
            setUserSelectedIcon(false);
            setFormData({ name: "", icon_id: "Tag", type: "expense" });
          }}
          onSubmit={handleCreate}
          cancelLabel={t("common.cancel")}
          submitLabel={isSubmitting ? t("common.saving") : t("categories.saveLabel")}
          submitDisabled={!canSubmit}
          cancelDisabled={isSubmitting}
          nameInputId="account-category-name"
        />
      )}

      {canEdit && (
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
          onNameChange={(newName) =>
            setFormData((prev) => ({ ...prev, name: newName }))
          }
          typeValue={formData.type}
          onTypeChange={(value) => setFormData({ ...formData, type: value })}
          iconValue={formData.icon_id}
          onIconChange={(iconKey) => {
            setUserSelectedIcon(true);
            setFormData({ ...formData, icon_id: iconKey });
          }}
          onCancel={() => {
            setIsEditOpen(false);
            setSelectedCategory(null);
            setUserSelectedIcon(false);
            setFormData({ name: "", icon_id: "Tag", type: "expense" });
          }}
          onSubmit={handleEdit}
          cancelLabel={t("common.cancel")}
          submitLabel={isSubmitting ? t("common.saving") : t("common.saveChanges")}
          submitDisabled={isSubmitting}
          cancelDisabled={isSubmitting}
          nameInputId="account-category-edit-name"
        />
      )}
    </Card>
  );
}
