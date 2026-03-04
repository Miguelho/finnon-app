"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { ArrowDownLeft, ArrowUpRight, Info } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FutureObligationSuggestion } from "../FutureObligationSuggestion";
import { DateQuickPicker } from "../DateQuickPicker";
import { Step0QuickAdd } from "./Step0QuickAdd";
import { PaidBySelector } from "./PaidBySelector";
import { SplitSelector } from "./SplitSelector";
import type {
  TransactionDraft,
  TransactionType,
  ObligationType,
} from "@poleursus/shared";
import {
  formatDateForDisplay,
  parseMoneyToMinor,
  buildEqualSplit,
  CURRENCY_MINOR_UNITS,
  CURRENCIES,
} from "@poleursus/shared";
import { cn } from "@/lib/utils";

interface Step1DetailsProps {
  draft: TransactionDraft;
  errors: Record<string, string>;
  locale: string;
  accountId?: string;
  categories?: {
    id: string;
    name: string;
    icon_id: string;
    type: "income" | "expense";
  }[];
  showQuickAdd?: boolean;
  onFieldChange: <K extends keyof TransactionDraft>(
    field: K,
    value: TransactionDraft[K]
  ) => void;
  allowObligation?: boolean;
  splitParticipants?: {
    userId: string;
    name: string;
    role: "viewer" | "contributor" | "admin";
  }[];
  currentUserId?: string | null;
  showSplitControls?: boolean;
}

const parseIsoDate = (value: string) => {
  const [year, month, day] = value.split("-").map((part) => Number(part));
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day);
};

const isFutureDate = (value: string) => {
  const date = parseIsoDate(value);
  if (!date) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return date.getTime() > today.getTime();
};

const getDefaultObligationConfig = (date: string) =>
  isFutureDate(date)
    ? ({ type: "scheduled", scheduledDate: date } as const)
    : ({ type: "pending", scheduledDate: null } as const);

export function Step1Details({
  draft,
  errors,
  locale,
  accountId = "",
  categories = [],
  showQuickAdd = false,
  onFieldChange,
  allowObligation = true,
  splitParticipants = [],
  currentUserId = null,
  showSplitControls = true,
}: Step1DetailsProps) {
  const t = useTranslations("addTransaction");
  const tCommon = useTranslations("common");
  const [isObligationDialogOpen, setIsObligationDialogOpen] =
    React.useState(false);
  const [sheetType, setSheetType] = React.useState<ObligationType>("pending");
  const [sheetScheduledDate, setSheetScheduledDate] = React.useState(draft.date);
  const [sheetScheduledOverride, setSheetScheduledOverride] =
    React.useState(false);
  const [dismissedFutureSuggestion, setDismissedFutureSuggestion] =
    React.useState(false);
  const [paidByBoth, setPaidByBoth] = React.useState(() => draft.paidByUserId === null);
  const openedFromToggleRef = React.useRef(false);

  const sanitizeNumericInput = (value: string) =>
    value.replace(/[^0-9.,]/g, "");

  const clearObligation = () => {
    onFieldChange("isObligation", false);
    onFieldChange("obligationType", null);
    onFieldChange("scheduledDate", null);
    onFieldChange("scheduledDateOverridden", false);
  };

  const handleTypeChange = (type: TransactionType) => {
    onFieldChange("type", type);
    if (draft.suggestedCategoryId) {
      if (draft.categoryId === draft.suggestedCategoryId) {
        onFieldChange("categoryId", null);
      }
      onFieldChange("suggestedCategoryId", null);
    }
    // If switching to income while obligation is on, turn it off
    if (type === "income" && draft.isObligation) {
      clearObligation();
    }
  };

  const openObligationDialog = ({ fromToggle }: { fromToggle: boolean }) => {
    const defaults = draft.obligationType
      ? {
          type: draft.obligationType,
          scheduledDate: draft.scheduledDate ?? draft.date,
          overridden: draft.scheduledDateOverridden,
        }
      : {
          ...getDefaultObligationConfig(draft.date),
          overridden: false,
        };

    setSheetType(defaults.type);
    setSheetScheduledDate(defaults.scheduledDate ?? draft.date);
    setSheetScheduledOverride(defaults.overridden);
    openedFromToggleRef.current = fromToggle;
    setIsObligationDialogOpen(true);
  };

  const handleObligationChange = (checked: boolean) => {
    onFieldChange("isObligation", checked);
    if (checked) {
      // Force type to expense when obligation is enabled
      onFieldChange("type", "expense");
      onFieldChange("obligationType", null);
      onFieldChange("scheduledDate", null);
      onFieldChange("scheduledDateOverridden", false);
      openObligationDialog({ fromToggle: true });
    } else {
      setIsObligationDialogOpen(false);
      clearObligation();
    }
  };

  const handleSheetTypeChange = (value: ObligationType) => {
    setSheetType(value);
    if (value === "scheduled" && !sheetScheduledDate) {
      setSheetScheduledDate(draft.scheduledDate ?? draft.date);
      setSheetScheduledOverride(false);
    }
  };

  const handleSaveObligationConfig = () => {
    onFieldChange("obligationType", sheetType);
    if (sheetType === "scheduled") {
      const resolvedDate = sheetScheduledDate || draft.date;
      onFieldChange("scheduledDate", resolvedDate);
      onFieldChange(
        "scheduledDateOverridden",
        sheetScheduledOverride && resolvedDate !== draft.date
      );
    } else {
      onFieldChange("scheduledDate", null);
      onFieldChange("scheduledDateOverridden", false);
    }
    openedFromToggleRef.current = false;
    setIsObligationDialogOpen(false);
  };

  const handleCancelObligationConfig = () => {
    if (openedFromToggleRef.current) {
      clearObligation();
    }
    openedFromToggleRef.current = false;
    setIsObligationDialogOpen(false);
  };

  const handleDialogOpenChange = (open: boolean) => {
    if (!open) {
      handleCancelObligationConfig();
      return;
    }
    setIsObligationDialogOpen(true);
  };

  const handleSuggestionAccept = () => {
    onFieldChange("isObligation", true);
    onFieldChange("type", "expense");
    onFieldChange("obligationType", "scheduled");
    onFieldChange("scheduledDate", draft.date);
    onFieldChange("scheduledDateOverridden", false);
  };

  const handleSuggestionDismiss = () => {
    setDismissedFutureSuggestion(true);
  };

  React.useEffect(() => {
    if (!draft.isObligation || draft.obligationType !== "scheduled") return;
    if (draft.scheduledDateOverridden) return;
    if (draft.scheduledDate !== draft.date) {
      onFieldChange("scheduledDate", draft.date);
    }
  }, [
    draft.date,
    draft.isObligation,
    draft.obligationType,
    draft.scheduledDateOverridden,
    draft.scheduledDate,
    onFieldChange,
  ]);

  const shouldShowFutureSuggestion =
    draft.type === "expense" &&
    !draft.isObligation &&
    isFutureDate(draft.date) &&
    !dismissedFutureSuggestion;

  const hasObligationConfig = draft.isObligation && !!draft.obligationType;
  const obligationSummary =
    draft.obligationType === "scheduled"
      ? `${t("obligationChipScheduled")} · ${formatDateForDisplay(
          draft.scheduledDate ?? draft.date,
          locale
        )}`
      : t("obligationChipPending");

  const visibleSplitParticipants = React.useMemo(
    () => (showSplitControls ? splitParticipants : []),
    [showSplitControls, splitParticipants]
  );
  const splitParticipantIds = React.useMemo(
    () => visibleSplitParticipants.map((member) => member.userId),
    [visibleSplitParticipants]
  );
  const canConfigureSplit = splitParticipantIds.length >= 2;
  const shouldShowSplitSection = canConfigureSplit && draft.type !== "income";
  const currencyCodes = React.useMemo(
    () => Object.keys(CURRENCY_MINOR_UNITS).sort(),
    []
  );
  const currencySymbol = React.useMemo(
    () => CURRENCIES.find((item) => item.code === draft.currency)?.symbol ?? draft.currency,
    [draft.currency]
  );

  const resolveAmountMinor = React.useCallback(() => {
    const parsed = parseMoneyToMinor(
      draft.amount,
      draft.currency,
      CURRENCY_MINOR_UNITS
    );
    if (typeof parsed !== "bigint") return null;
    return Math.max(0, Number(parsed));
  }, [draft.amount, draft.currency]);

  React.useEffect(() => {
    if (!canConfigureSplit) return;
    if (draft.type === "income") return;
    if (paidByBoth) return;
    if (draft.paidByUserId) return;
    const fallbackPaidBy =
      (currentUserId && splitParticipantIds.includes(currentUserId)
        ? currentUserId
        : splitParticipantIds[0]) ?? null;
    if (fallbackPaidBy) {
      onFieldChange("paidByUserId", fallbackPaidBy);
    }
  }, [
    canConfigureSplit,
    currentUserId,
    draft.paidByUserId,
    onFieldChange,
    paidByBoth,
    splitParticipantIds,
    draft.type,
  ]);

  React.useEffect(() => {
    if (!canConfigureSplit) return;
    if (draft.type === "income") return;
    if (draft.splitType !== "custom") return;
    if (draft.splitDetails && draft.splitDetails.length > 0) return;
    const amountMinor = resolveAmountMinor();
    if (amountMinor === null) return;
    onFieldChange("splitDetails", buildEqualSplit(amountMinor, splitParticipantIds));
  }, [
    canConfigureSplit,
    draft.splitDetails,
    draft.splitType,
    onFieldChange,
    resolveAmountMinor,
    splitParticipantIds,
    draft.type,
  ]);

  React.useEffect(() => {
    if (!canConfigureSplit || draft.type === "income") {
      if (paidByBoth) {
        setPaidByBoth(false);
      }
      return;
    }

    const shouldBeBoth = draft.paidByUserId === null;
    if (paidByBoth !== shouldBeBoth) {
      setPaidByBoth(shouldBeBoth);
    }
  }, [canConfigureSplit, draft.paidByUserId, draft.type, paidByBoth]);

  React.useEffect(() => {
    if (!canConfigureSplit) return;
    if (draft.type !== "income") return;
    if (draft.splitType !== "equal") {
      onFieldChange("splitType", "equal");
    }
    if (draft.splitDetails !== null) {
      onFieldChange("splitDetails", null);
    }
  }, [
    canConfigureSplit,
    draft.splitDetails,
    draft.splitType,
    draft.type,
    onFieldChange,
  ]);

  const handlePaidByChange = (userId: string | null, bothSelected: boolean) => {
    setPaidByBoth(bothSelected);
    if (bothSelected) {
      onFieldChange("paidByUserId", null);
      return;
    }

    const nextUserId =
      userId ??
      (currentUserId && splitParticipantIds.includes(currentUserId)
        ? currentUserId
        : splitParticipantIds[0] ?? null);
    onFieldChange("paidByUserId", nextUserId);
  };

  const handleSplitTypeChange = (
    value: "equal" | "personal" | "custom",
    splitDetails?: TransactionDraft["splitDetails"]
  ) => {
    onFieldChange("splitType", value);
    if (value !== "custom") {
      onFieldChange("splitDetails", null);
      return;
    }
    const amountMinor = resolveAmountMinor();
    if (splitDetails && splitDetails.length > 0) {
      onFieldChange("splitDetails", splitDetails);
      return;
    }
    onFieldChange(
      "splitDetails",
      buildEqualSplit(amountMinor ?? 0, splitParticipantIds)
    );
  };

  const paidByParticipant =
    visibleSplitParticipants.find((member) => member.userId === draft.paidByUserId) ??
    null;
  const paidByFirstName = paidByParticipant?.name.trim().split(/\s+/)[0] ?? "";
  const personalSplitLabel =
    !paidByBoth &&
    draft.paidByUserId &&
    draft.paidByUserId !== currentUserId &&
    paidByFirstName
      ? t("splitPersonalOf", { name: paidByFirstName })
      : t("splitPersonalOption");

  return (
    <div className="space-y-6">
      {/* Type selector */}
      <div className="space-y-3 rounded-xl border border-border bg-muted/30 p-4">
        <Label className="text-sm font-semibold text-foreground">
          {t("typeLabel")}
        </Label>
        <div
          className={cn(
            "relative flex rounded-full border bg-muted/30 p-1",
            draft.isObligation && "opacity-60"
          )}
        >
          <span
            aria-hidden="true"
            className={cn(
              "pointer-events-none absolute inset-y-1 left-1 w-[calc(50%-0.25rem)] rounded-full bg-background shadow-sm transition-transform",
              draft.type === "income" && "translate-x-full"
            )}
          />
          <button
            type="button"
            onClick={() => handleTypeChange("expense")}
            disabled={draft.isObligation}
            aria-pressed={draft.type === "expense"}
            className={cn(
              "relative z-10 flex-1 rounded-full py-2.5 text-sm font-semibold",
              "inline-flex items-center justify-center gap-2 transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
              draft.type === "expense"
                ? "text-foreground"
                : "text-muted-foreground hover:text-foreground",
              draft.isObligation && "cursor-not-allowed"
            )}
          >
            <ArrowDownLeft className="h-4 w-4" />
            {t("typeExpense")}
          </button>
          <button
            type="button"
            onClick={() => handleTypeChange("income")}
            disabled={draft.isObligation}
            aria-pressed={draft.type === "income"}
            className={cn(
              "relative z-10 flex-1 rounded-full py-2.5 text-sm font-semibold",
              "inline-flex items-center justify-center gap-2 transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
              draft.type === "income"
                ? "text-foreground"
                : "text-muted-foreground hover:text-foreground",
              draft.isObligation && "cursor-not-allowed"
            )}
          >
            <ArrowUpRight className="h-4 w-4" />
            {t("typeIncome")}
          </button>
        </div>
      </div>

      {showQuickAdd ? (
        <Step0QuickAdd
          accountId={accountId}
          locale={locale}
          categories={categories}
          draft={draft}
          onFieldChange={onFieldChange}
        />
      ) : null}

      {allowObligation && draft.type === "expense" && draft.isObligation && (
        <div className="space-y-3 rounded-xl border border-border bg-muted/30 p-4">
          {/* Obligation toggle */}
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Label
                htmlFor="obligation-toggle"
                className="text-base font-semibold cursor-pointer"
              >
                {t("obligationLabel")}
              </Label>
              <button
                type="button"
                className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-border bg-background"
                title={t("obligationInfoText")}
                aria-label={t("obligationInfoTitle")}
              >
                <Info className="h-4 w-4 text-muted-foreground" />
              </button>
            </div>
            <Switch
              id="obligation-toggle"
              checked={draft.isObligation}
              onCheckedChange={handleObligationChange}
            />
          </div>

          {hasObligationConfig && (
            <div className="flex items-center justify-between gap-3 rounded-full border border-border bg-background px-3 py-1.5 text-sm">
              <span>{obligationSummary}</span>
              <Button
                type="button"
                variant="link"
                size="sm"
                onClick={() => openObligationDialog({ fromToggle: false })}
              >
                {t("obligationEdit")}
              </Button>
            </div>
          )}

        </div>
      )}

      {/* Amount field */}
      <div className="space-y-3 rounded-xl border border-border bg-muted/30 p-4">
        <Label htmlFor="amount" className="text-lg font-bold">
          {t("amountLabel")}
        </Label>
        <div className="flex items-center justify-start">
          <Select
            value={draft.currency}
            onValueChange={(nextCurrency) => onFieldChange("currency", nextCurrency)}
          >
            <SelectTrigger className="h-8 w-24 shrink-0 rounded-md border-border bg-muted/40 px-2.5 text-xs font-semibold">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="max-h-80">
              {currencyCodes.map((code) => (
                <SelectItem key={code} value={code}>
                  {code}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex min-h-12 items-end gap-1">
          <Input
            id="amount"
            type="text"
            inputMode="decimal"
            value={draft.amount}
            onChange={(e) =>
              onFieldChange("amount", sanitizeNumericInput(e.target.value))
            }
            pattern="[0-9]*[.,]?[0-9]*"
            placeholder={locale === "es" ? "0,00" : "0.00"}
            className={cn(
              "h-auto flex-1 border-0 bg-transparent px-0 py-0 text-[40px] font-light leading-none tracking-[-0.04em] shadow-none",
              "[font-variant-numeric:tabular-nums] placeholder:text-muted-foreground/70",
              "focus-visible:ring-0 focus-visible:ring-offset-0"
            )}
            style={{ caretColor: "hsl(var(--primary))" }}
            autoComplete="off"
          />
          <span className="pb-1 text-xl text-muted-foreground">{currencySymbol}</span>
        </div>
        {errors.amount ? (
          <p className="text-sm text-destructive">
            {errors.amount.includes("Positive")
              ? t(`errors.amountPositive`)
              : errors.amount.includes("Invalid")
                ? t(`errors.amountInvalid`)
                : t(`errors.amountRequired`)}
          </p>
        ) : (
          <p className="text-sm font-medium text-muted-foreground">
            {t("amountHelper")}
          </p>
        )}
      </div>

      {shouldShowSplitSection && (
        <div className="overflow-hidden rounded-xl border border-border bg-muted/30">
          <div className="space-y-3 p-4">
            <Label className="text-sm font-semibold text-foreground">
              {draft.type === "income" ? t("receivedByLabel") : t("paidByLabel")}
            </Label>
            <PaidBySelector
              participants={visibleSplitParticipants}
              currentUserId={currentUserId}
              value={draft.paidByUserId}
              bothSelected={paidByBoth}
              onChange={handlePaidByChange}
            />
            {errors.paidByUserId ? (
              <p className="text-sm text-destructive">
                {draft.type === "income"
                  ? t("errors.receivedByRequired")
                  : t("errors.paidByRequired")}
              </p>
            ) : null}
          </div>

          <div className="mx-4 h-px bg-border" />

          <div className="space-y-3 p-4">
            <Label className="text-sm font-semibold text-foreground">
              {t("splitLabel")}
            </Label>
            <SplitSelector
              value={draft.splitType}
              paidByBoth={paidByBoth}
              participants={visibleSplitParticipants}
              splitDetails={draft.splitDetails}
              totalAmountMinor={resolveAmountMinor() ?? 0}
              personalLabel={personalSplitLabel}
              onChange={handleSplitTypeChange}
            />

            {errors.splitDetails ? (
              <p className="text-sm text-destructive">
                {t("errors.splitTotalMismatch")}
              </p>
            ) : null}
          </div>
        </div>
      )}

      {/* Date field */}
      <div className="rounded-xl border border-border bg-muted/30 p-4">
        <DateQuickPicker
          value={draft.date}
          onChange={(date) => onFieldChange("date", date)}
          locale={locale}
          error={errors.date ? t(`errors.dateRequired`) : undefined}
        />
      </div>

      {allowObligation && (
        <>
          <FutureObligationSuggestion
            visible={shouldShowFutureSuggestion}
            onAccept={handleSuggestionAccept}
            onDismiss={handleSuggestionDismiss}
          />

          <Dialog open={isObligationDialogOpen} onOpenChange={handleDialogOpenChange}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{t("obligationSheetTitle")}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-sm font-semibold">
                    {t("obligationTypeLabel")}
                  </Label>
                  <div className="flex rounded-full border border-border bg-muted/40 p-1">
                    <button
                      type="button"
                      onClick={() => handleSheetTypeChange("pending")}
                      className={cn(
                        "flex-1 rounded-full py-2 text-sm font-semibold transition",
                        sheetType === "pending"
                          ? "bg-primary text-primary-foreground"
                          : "text-muted-foreground"
                      )}
                    >
                      {t("obligationTypePending")}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSheetTypeChange("scheduled")}
                      className={cn(
                        "flex-1 rounded-full py-2 text-sm font-semibold transition",
                        sheetType === "scheduled"
                          ? "bg-primary text-primary-foreground"
                          : "text-muted-foreground"
                      )}
                    >
                      {t("obligationTypeScheduled")}
                    </button>
                  </div>
                </div>

                {sheetType === "scheduled" && (
                  <div className="space-y-2">
                    <Label htmlFor="scheduled-date">
                      {t("obligationScheduledDate")}
                    </Label>
                    <Input
                      id="scheduled-date"
                      type="date"
                      value={sheetScheduledDate}
                      onChange={(e) => {
                        setSheetScheduledDate(e.target.value);
                        setSheetScheduledOverride(e.target.value !== draft.date);
                      }}
                    />
                    <p className="text-sm text-muted-foreground">
                      {formatDateForDisplay(sheetScheduledDate || draft.date, locale)}
                    </p>
                  </div>
                )}
              </div>
              <DialogFooter className="gap-2">
                <Button type="button" variant="secondary" onClick={handleCancelObligationConfig}>
                  {tCommon("cancel")}
                </Button>
                <Button type="button" onClick={handleSaveObligationConfig}>
                  {tCommon("save")}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </>
      )}
    </div>
  );
}
