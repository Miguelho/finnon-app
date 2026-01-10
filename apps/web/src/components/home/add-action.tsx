"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  SlidePanel,
  SlidePanelBody,
  SlidePanelContent,
  SlidePanelHeader,
  SlidePanelFooter,
  SlidePanelDescription,
  SlidePanelTitle,
} from "@/components/ui/slide-panel";
import { AddMenuItem } from "@/components/home/AddMenuItem";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { IconPicker } from "@/components/icon-picker";
import {
  ADD_ACTIONS,
  normalizeCategoryName,
  type AddActionKey,
  type CategoryType,
} from "@poleursus/shared";
import { createCategory } from "@/app/categories/actions";

type AddActionProps = {
  canEdit: boolean;
  accountId: string;
};

export function AddAction({ canEdit, accountId }: AddActionProps) {
  const router = useRouter();
  const t = useTranslations();
  const [isOpen, setIsOpen] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    icon_id: "general",
    type: "expense" as CategoryType,
  });
  const normalizedNameValue = normalizeCategoryName(formData.name);
  const canSubmit = Boolean(normalizedNameValue) && !isSubmitting;
  const handleAction = (key: AddActionKey) => {
    if (!canEdit) return;
    setIsOpen(false);

    switch (key) {
      case "expense":
        router.push("/transactions?new=1&type=expense");
        return;
      case "income":
        router.push("/transactions?new=1&type=income");
        return;
      case "category":
        setIsCreateOpen(true);
        return;
      case "one_off_obligation":
        router.push("/transactions?new=1&kind=obligation");
        return;
      case "recurring":
        router.push("/transactions?new=1&kind=recurring");
        return;
    }
  };

  const handleCreateCategory = async () => {
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

      if (result.success) {
        toast.success(t("categories.createSuccess"));
        setIsCreateOpen(false);
        setFormData({ name: "", icon_id: "general", type: "expense" });
        router.refresh();
      } else {
        toast.error(
          result.error
            ? t(result.error.key, result.error.params)
            : t("categories.createError")
        );
      }
    } catch (error) {
      toast.error(t("categories.createError"));
    } finally {
      setIsSubmitting(false);
    }
  };
  return (
    <>
      <Button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 z-40 rounded-full px-5 py-6 shadow-lg"
      >
        + {t("home.addCta")}
      </Button>

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

      {canEdit && (
        <SlidePanel open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <SlidePanelContent>
            <SlidePanelHeader>
              <SlidePanelTitle>{t("categories.newTitle")}</SlidePanelTitle>
              <SlidePanelDescription>
                {t("categories.createDescription")}
              </SlidePanelDescription>
            </SlidePanelHeader>
            <SlidePanelBody>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="category-name">
                    {t("categories.nameLabel")}
                  </Label>
                  <Input
                    id="category-name"
                    value={formData.name}
                    onChange={(event) =>
                      setFormData({ ...formData, name: event.target.value })
                    }
                    placeholder={t("categories.namePlaceholder")}
                    maxLength={40}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="category-type">
                    {t("categories.typeLabel")}
                  </Label>
                  <Select
                    value={formData.type}
                    onValueChange={(value: CategoryType) =>
                      setFormData({ ...formData, type: value })
                    }
                  >
                    <SelectTrigger id="category-type">
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
              <Button onClick={handleCreateCategory} disabled={!canSubmit}>
                {isSubmitting
                  ? t("common.saving")
                  : t("categories.saveLabel")}
              </Button>
            </SlidePanelFooter>
          </SlidePanelContent>
        </SlidePanel>
      )}
    </>
  );
}
