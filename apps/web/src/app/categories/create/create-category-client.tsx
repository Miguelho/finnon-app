"use client";

import { useMemo, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
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
import { PageContainer } from "@/components/layout/page-container";
import { createCategory } from "@/app/categories/actions";
import { useWebDataCache } from "@/cache/WebDataCacheProvider";
import {
  CATEGORY_PALETTE,
  normalizeHexColor,
  normalizeCategoryName,
  suggestCategoryIcon,
  type CategoryIconKey,
  type CategoryType,
} from "@poleursus/shared";

type CreateCategoryClientProps = {
  accountId: string;
};

export function CreateCategoryClient({ accountId }: CreateCategoryClientProps) {
  const router = useRouter();
  const { emitMutation } = useWebDataCache();
  const t = useTranslations();

  const [name, setName] = useState("");
  const [iconKey, setIconKey] = useState<CategoryIconKey>("Tag");
  const [type, setType] = useState<CategoryType>("expense");
  const [color, setColor] = useState<string | null>(null);
  const [customColorInput, setCustomColorInput] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [userSelectedIcon, setUserSelectedIcon] = useState(false);

  const normalizedName = normalizeCategoryName(name);
  const canSubmit = Boolean(normalizedName) && !isSubmitting;
  const normalizedColor = normalizeHexColor(color);
  const isPresetColor = useMemo(
    () =>
      Boolean(
        normalizedColor &&
          CATEGORY_PALETTE.includes(
            normalizedColor as (typeof CATEGORY_PALETTE)[number]
          )
      ),
    [normalizedColor]
  );

  useEffect(() => {
    if (normalizedColor && !isPresetColor) {
      setCustomColorInput(normalizedColor);
      return;
    }
    setCustomColorInput("");
  }, [isPresetColor, normalizedColor]);

  const handleNameChange = (newName: string) => {
    setName(newName);
    if (!userSelectedIcon && newName.trim()) {
      const suggestion = suggestCategoryIcon(newName);
      setIconKey(suggestion.primary);
    }
  };

  const handleIconChange = (newIconKey: CategoryIconKey) => {
    setUserSelectedIcon(true);
    setIconKey(newIconKey);
  };

  const handleSubmit = async () => {
    if (isSubmitting) return;

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
        icon_id: iconKey,
        type,
        color: normalizeHexColor(color),
      });

      if (result.success) {
        await emitMutation("categories", "insert");
        toast.success(t("categories.createSuccess"));
        router.back();
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
      setIsSubmitting(false);
    }
  };

  return (
    <PageContainer>
      <div className="mx-auto max-w-lg py-6">
        <h1 className="mb-2 text-xl font-semibold">
          {t("categories.newTitle")}
        </h1>
        <p className="mb-6 text-sm text-muted-foreground">
          {t("categories.createDescription")}
        </p>

        <div className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="category-name">{t("categories.nameLabel")}</Label>
            <Input
              id="category-name"
              value={name}
              onChange={(event) => handleNameChange(event.target.value)}
              placeholder={t("categories.namePlaceholder")}
              maxLength={40}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="category-type">{t("categories.typeLabel")}</Label>
            <Select value={type} onValueChange={(v) => setType(v as CategoryType)}>
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
              value={iconKey}
              onChange={handleIconChange}
              filterType={type}
              categoryName={name}
            />
          </div>

          <div className="space-y-2">
            <Label>{t("categories.colorLabel")}</Label>
            <div className="flex flex-wrap gap-2">
              {CATEGORY_PALETTE.map((paletteColor) => {
                const isSelected = normalizedColor === paletteColor;
                return (
                  <button
                    key={paletteColor}
                    type="button"
                    onClick={() => setColor(paletteColor)}
                    className="inline-flex h-7 w-7 items-center justify-center rounded-full border transition-transform hover:scale-[1.05]"
                    style={{
                      backgroundColor: paletteColor,
                      borderColor: isSelected
                        ? "hsl(var(--ring))"
                        : "hsl(var(--border))",
                    }}
                    aria-label={`${t("categories.colorLabel")} ${paletteColor}`}
                  >
                    {isSelected ? (
                      <span className="h-2.5 w-2.5 rounded-full border border-white/85" />
                    ) : null}
                  </button>
                );
              })}
            </div>
            <div className="space-y-1">
              <Label
                htmlFor="category-custom-color"
                className="text-xs text-muted-foreground"
              >
                {t("categories.customColorLabel")}
              </Label>
              <Input
                id="category-custom-color"
                value={customColorInput}
                onChange={(event) => {
                  const nextValue = event.target.value;
                  setCustomColorInput(nextValue);
                  const normalized = normalizeHexColor(nextValue);
                  if (normalized) {
                    setColor(normalized);
                  }
                }}
                autoComplete="off"
                autoCapitalize="characters"
                maxLength={7}
                placeholder="#D4943A"
                className="font-mono uppercase"
              />
            </div>
          </div>

          <div className="flex items-center justify-between pt-4 border-t">
            <Button
              type="button"
              variant="ghost"
              onClick={() => router.back()}
              disabled={isSubmitting}
            >
              {t("common.cancel")}
            </Button>
            <Button
              type="button"
              onClick={handleSubmit}
              disabled={!canSubmit}
            >
              {isSubmitting ? t("common.saving") : t("categories.saveLabel")}
            </Button>
          </div>
        </div>
      </div>
    </PageContainer>
  );
}
