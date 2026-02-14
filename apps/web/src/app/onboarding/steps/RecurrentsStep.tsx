"use client";

import type { Dispatch, SetStateAction } from "react";
import { useLocale, useTranslations } from "next-intl";
import {
  ArrowDownLeft,
  ArrowUpRight,
  BriefcaseBusiness,
  Dumbbell,
  House,
  Landmark,
  Music2,
  Smartphone,
  Tv,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  DEFAULT_CATEGORIES,
  ONBOARDING_MIN_RECURRENTS,
  parseMoneyToMinor,
  type OnboardingRecurrentInput,
} from "@poleursus/shared";
import { OnboardingProgress } from "./OnboardingProgress";
import type { RecurrentsStepState, RecurrentDraft } from "../state";

type RecurrentsStepProps = {
  currency: string;
  state: RecurrentsStepState;
  onChangeState: Dispatch<SetStateAction<RecurrentsStepState>>;
  onContinue: (recurrents: OnboardingRecurrentInput[]) => void;
  onBack: () => void;
};

const recurrentIcons: Record<string, LucideIcon> = {
  sug_salary: BriefcaseBusiness,
  sug_rent: House,
  sug_netflix: Tv,
  sug_spotify: Music2,
  sug_gym: Dumbbell,
  sug_phone: Smartphone,
};

export function RecurrentsStep({
  currency,
  state,
  onChangeState,
  onContinue,
  onBack,
}: RecurrentsStepProps) {
  const t = useTranslations("onboarding");
  const tGlobal = useTranslations();
  const locale = useLocale();
  const {
    items,
    customEnabled,
    customLabel,
    customAmount,
    customExpectedDate,
    customType,
  } = state;
  const today = new Date().toISOString().slice(0, 10);

  const resolveCategoryName = (categoryName: string) => {
    const match = DEFAULT_CATEGORIES.find(
      (category) =>
        category.name === categoryName || category.name_en === categoryName
    );
    if (!match) return categoryName;
    return locale === "en" ? match.name_en : match.name;
  };

  const updateItem = (id: string, changes: Partial<RecurrentDraft>) => {
    onChangeState((prev) => ({
      ...prev,
      items: prev.items.map((item) =>
        item.id === id ? { ...item, ...changes } : item
      ),
    }));
  };

  const dayOfMonthFromDate = (value: string, fallback: number) => {
    const day = Number(value.slice(8, 10));
    if (!Number.isInteger(day) || day < 1 || day > 31) return fallback;
    return day;
  };

  const selectedItems = items.filter((item) => item.selected);
  const sanitizeNumericInput = (value: string) => value.replace(/[^0-9.,]/g, "");

  const selectedAmounts = selectedItems
    .filter((item) => item.amount.trim() !== "")
    .map((item) => parseMoneyToMinor(item.amount, currency));
  const hasEmptySuggestedAmount = selectedItems.some(
    (item) => item.amount.trim() === ""
  );
  const hasInvalidSuggestedAmount = selectedAmounts.some(
    (result) => typeof result === "object"
  );

  const customHasInput = customLabel.trim() !== "" || customAmount.trim() !== "";
  const customAmountResult = customHasInput && customAmount.trim() !== ""
    ? parseMoneyToMinor(customAmount, currency)
    : null;
  const customValid =
    customHasInput &&
    customLabel.trim() !== "" &&
    customAmount.trim() !== "" &&
    typeof customAmountResult !== "object";
  const customHasEmptyAmount = customHasInput && customAmount.trim() === "";
  const customHasError =
    customHasInput &&
    (customHasEmptyAmount || !customValid || typeof customAmountResult === "object");

  const selectedCount = selectedItems.length + (customValid ? 1 : 0);
  const meetsMinimum = selectedCount >= ONBOARDING_MIN_RECURRENTS;

  const canContinue =
    meetsMinimum &&
    !hasEmptySuggestedAmount &&
    !hasInvalidSuggestedAmount &&
    !customHasError;

  const buildRecurrents = () => {
    const dayOfMonth = new Date().getUTCDate();

    const suggested: OnboardingRecurrentInput[] = selectedItems
      .map((item) => {
        const parsed = parseMoneyToMinor(item.amount, currency);
        if (typeof parsed === "object") return null;
        const expectedDate = item.expectedDate || today;
        return {
          suggestedId: item.id,
          label: item.label,
          type: item.type,
          amountMinor: Number(parsed),
          currency,
          categoryName: resolveCategoryName(item.suggestedCategoryName),
          expectedDate,
          frequency: item.frequency,
          interval: item.interval,
          dayOfMonth: dayOfMonthFromDate(expectedDate, dayOfMonth),
        } satisfies OnboardingRecurrentInput;
      })
      .filter(Boolean) as OnboardingRecurrentInput[];

    if (!customValid || typeof customAmountResult === "object") {
      return suggested;
    }

    const customDate = customExpectedDate || today;
    const custom: OnboardingRecurrentInput = {
      suggestedId: `custom_${Date.now()}`,
      label: customLabel.trim(),
      type: customType,
      amountMinor: Number(customAmountResult),
      currency,
      categoryName: "",
      expectedDate: customDate,
      frequency: "monthly",
      interval: 1,
      dayOfMonth: dayOfMonthFromDate(customDate, dayOfMonth),
    };

    return [...suggested, custom];
  };

  const handleContinue = () => {
    if (!canContinue) return;
    onContinue(buildRecurrents());
  };

  const minimumLabel = meetsMinimum
    ? `${selectedCount} ${t("recurrents.minimumMet")}`
    : t("recurrents.minimum");

  return (
    <div className="w-full rounded-2xl border border-border bg-card">
      <div className="px-6 pt-8">
        <OnboardingProgress current="recurrents" />
        <div className="mt-6 text-center">
          <h2 className="text-2xl font-bold text-foreground">
            {t("recurrents.title")}
          </h2>
          <p className="text-sm text-muted-foreground">{t("recurrents.subtitle")}</p>
        </div>
      </div>

      <div className="mt-6 flex flex-col gap-3 px-6">
        {items.map((item) => {
          const detail = item.type === "income"
            ? tGlobal("common.incomeLabel")
            : tGlobal("common.expenseLabel");
          const ItemIcon = recurrentIcons[item.id] ?? Landmark;
          return (
            <div
              key={item.id}
              role="button"
              tabIndex={0}
              onClick={() => updateItem(item.id, { selected: !item.selected })}
              className={cn(
                "flex items-center gap-3 rounded-lg border border-border px-4 py-3 transition",
                item.selected
                  ? "border-foreground bg-muted/30"
                  : "hover:border-muted-foreground"
              )}
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                <ItemIcon className="h-4 w-4" />
              </div>
              <div className="flex-1">
                <input
                  type="text"
                  value={item.label}
                  onClick={(event) => event.stopPropagation()}
                  onChange={(event) => updateItem(item.id, { label: event.target.value })}
                  className="w-full bg-transparent text-sm font-semibold text-foreground outline-none"
                />
                <p className="text-xs text-muted-foreground">{detail}</p>
              </div>
              <div className="flex flex-wrap items-center justify-end gap-2">
                <input
                  type="date"
                  value={item.expectedDate || today}
                  onClick={(event) => event.stopPropagation()}
                  onChange={(event) =>
                    updateItem(item.id, { expectedDate: event.target.value })
                  }
                  className="h-8 rounded-md border border-border bg-background px-2 text-xs text-foreground outline-none focus:border-ring"
                />
                <span className="text-xs text-muted-foreground">{currency}</span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={item.amount}
                  onClick={(event) => event.stopPropagation()}
                  onChange={(event) =>
                    updateItem(item.id, { amount: sanitizeNumericInput(event.target.value) })
                  }
                  className="h-8 w-20 rounded-md border border-border bg-background px-2 text-right text-sm font-semibold text-foreground outline-none focus:border-ring"
                />
              </div>
            </div>
          );
        })}
      </div>

      <button
        type="button"
        onClick={() =>
          onChangeState((prev) => ({ ...prev, customEnabled: !prev.customEnabled }))
        }
        className="mx-6 mt-4 flex items-center justify-center gap-2 rounded-lg border border-dashed border-border px-4 py-3 text-sm font-medium text-muted-foreground transition hover:border-muted-foreground hover:text-foreground"
      >
        <span className="text-base">＋</span>
        {t("recurrents.addCustom")}
      </button>

      {customEnabled && (
        <div className="mx-6 mt-4 space-y-4 rounded-xl border border-border bg-muted/30 p-4">
          <div className="space-y-2">
            <Label className="text-sm font-semibold text-foreground">
              {tGlobal("common.nameLabel")}
            </Label>
            <Input
              type="text"
              value={customLabel}
              onChange={(event) =>
                onChangeState((prev) => ({
                  ...prev,
                  customLabel: event.target.value,
                }))
              }
              placeholder={tGlobal("addTransaction.namePlaceholder")}
              className="bg-background"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-sm font-semibold text-foreground">
              {tGlobal("addTransaction.amountLabel")}
            </Label>
            <div className="relative">
              <Input
                type="text"
                inputMode="decimal"
                value={customAmount}
                onChange={(event) =>
                  onChangeState((prev) => ({
                    ...prev,
                    customAmount: sanitizeNumericInput(event.target.value),
                  }))
                }
                placeholder={tGlobal("addTransaction.amountPlaceholder")}
                className="bg-background pr-16"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 inline-flex items-center rounded-full border border-border bg-background px-2.5 py-1 text-xs font-semibold text-foreground">
                {currency}
              </span>
            </div>
          </div>
          <div className="space-y-2">
            <Label className="text-sm font-semibold text-foreground">
              {tGlobal("addTransaction.dateLabel")}
            </Label>
            <Input
              type="date"
              value={customExpectedDate || today}
              onChange={(event) =>
                onChangeState((prev) => ({
                  ...prev,
                  customExpectedDate: event.target.value,
                }))
              }
              placeholder={tGlobal("transactions.datePlaceholder")}
              className="bg-background"
            />
          </div>
          <div className="space-y-3 rounded-xl border border-border bg-muted/30 p-4">
            <Label className="text-sm font-semibold text-foreground">
              {tGlobal("addTransaction.typeLabel")}
            </Label>
            <div className={cn("relative flex rounded-full border bg-muted/30 p-1")}>
              <span
                aria-hidden="true"
                className={cn(
                  "pointer-events-none absolute inset-y-1 left-1 w-[calc(50%-0.25rem)] rounded-full bg-background shadow-sm transition-transform",
                  customType === "income" && "translate-x-full"
                )}
              />
              <button
                type="button"
                onClick={() =>
                  onChangeState((prev) => ({ ...prev, customType: "expense" }))
                }
                aria-pressed={customType === "expense"}
                className={cn(
                  "relative z-10 flex-1 rounded-full py-2.5 text-sm font-semibold",
                  "inline-flex items-center justify-center gap-2 transition-colors",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                  customType === "expense"
                    ? "text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <ArrowDownLeft className="h-4 w-4" />
                {tGlobal("addTransaction.typeExpense")}
              </button>
              <button
                type="button"
                onClick={() =>
                  onChangeState((prev) => ({ ...prev, customType: "income" }))
                }
                aria-pressed={customType === "income"}
                className={cn(
                  "relative z-10 flex-1 rounded-full py-2.5 text-sm font-semibold",
                  "inline-flex items-center justify-center gap-2 transition-colors",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                  customType === "income"
                    ? "text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <ArrowUpRight className="h-4 w-4" />
                {tGlobal("addTransaction.typeIncome")}
              </button>
            </div>
          </div>
        </div>
      )}

      <div
        className={cn(
          "px-6 py-4 text-center text-xs font-medium",
          meetsMinimum ? "text-emerald-600" : "text-amber-600"
        )}
      >
        {minimumLabel}
      </div>

      {(hasEmptySuggestedAmount || hasInvalidSuggestedAmount || customHasError) && (
        <p className="px-6 pb-2 text-center text-xs font-medium text-destructive">
          {tGlobal("money.invalidFormat")}
        </p>
      )}

      <div className="flex flex-col gap-2 px-6 pb-8 sm:flex-row">
        <Button
          variant="outline"
          onClick={onBack}
          className="w-full border-border text-foreground"
        >
          {tGlobal("common.back")}
        </Button>
        <Button
          onClick={handleContinue}
          disabled={!canContinue}
          className="w-full bg-[#1a1f36] text-white hover:bg-[#2a3050]"
        >
          {t("recurrents.continue")}
        </Button>
      </div>
    </div>
  );
}
