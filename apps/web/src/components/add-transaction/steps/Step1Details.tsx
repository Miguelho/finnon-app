"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { ArrowDownLeft, ArrowUpRight, Info } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FutureObligationSuggestion } from "../FutureObligationSuggestion";
import { DateQuickPicker } from "../DateQuickPicker";
import type {
  TransactionDraft,
  TransactionType,
  ObligationType,
  ContributionSplitType,
} from "@poleursus/shared";
import {
  formatDateForDisplay,
  parseMoneyToMinor,
  formatMinorToMoney,
  buildEqualSplit,
  CURRENCY_MINOR_UNITS,
} from "@poleursus/shared";
import { cn } from "@/lib/utils";

interface Step1DetailsProps {
  draft: TransactionDraft;
  errors: Record<string, string>;
  locale: string;
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
  const [customSplitInputs, setCustomSplitInputs] = React.useState<
    Record<string, string>
  >({});
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
    if (draft.paidByUserId) return;
    const fallbackPaidBy = currentUserId ?? splitParticipantIds[0] ?? null;
    if (fallbackPaidBy) {
      onFieldChange("paidByUserId", fallbackPaidBy);
    }
  }, [
    canConfigureSplit,
    currentUserId,
    draft.paidByUserId,
    onFieldChange,
    splitParticipantIds,
  ]);

  React.useEffect(() => {
    if (!canConfigureSplit) return;
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
  ]);

  React.useEffect(() => {
    if (!canConfigureSplit || draft.splitType !== "custom") {
      setCustomSplitInputs((prev) => (Object.keys(prev).length > 0 ? {} : prev));
      return;
    }
    const details = draft.splitDetails ?? [];
    const nextInputs: Record<string, string> = {};
    splitParticipantIds.forEach((userId) => {
      const detail = details.find((item) => item.userId === userId);
      const shareMinor = detail?.shareMinor ?? 0;
      nextInputs[userId] = formatMinorToMoney(
        BigInt(Math.max(0, shareMinor)),
        draft.currency,
        CURRENCY_MINOR_UNITS
      ).replace(".", ",");
    });
    setCustomSplitInputs((prev) => {
      const prevKeys = Object.keys(prev);
      const nextKeys = Object.keys(nextInputs);
      if (
        prevKeys.length === nextKeys.length &&
        nextKeys.every((key) => prev[key] === nextInputs[key])
      ) {
        return prev;
      }
      return nextInputs;
    });
  }, [
    canConfigureSplit,
    draft.currency,
    draft.splitDetails,
    draft.splitType,
    splitParticipantIds,
  ]);

  const handlePaidByChange = (userId: string) => {
    onFieldChange("paidByUserId", userId);
  };

  const handleSplitTypeChange = (value: ContributionSplitType) => {
    onFieldChange("splitType", value);
    if (value !== "custom") {
      onFieldChange("splitDetails", null);
      return;
    }
    const amountMinor = resolveAmountMinor() ?? 0;
    onFieldChange("splitDetails", buildEqualSplit(amountMinor, splitParticipantIds));
  };

  const applyCustomSplitValue = (userId: string, rawValue: string) => {
    const amountMinor = resolveAmountMinor();
    if (amountMinor === null) return;

    const sanitized = rawValue.replace(/[^0-9.,]/g, "");
    setCustomSplitInputs((prev) => ({ ...prev, [userId]: sanitized }));

    const parsedTarget = parseMoneyToMinor(
      sanitized || "0",
      draft.currency,
      CURRENCY_MINOR_UNITS
    );

    const targetValue = Math.max(
      0,
      Math.min(
        amountMinor,
        typeof parsedTarget === "bigint" ? Number(parsedTarget) : 0
      )
    );

    const otherUserIds = splitParticipantIds.filter((id) => id !== userId);
    const remaining = Math.max(0, amountMinor - targetValue);
    const baseShare =
      otherUserIds.length > 0 ? Math.floor(remaining / otherUserIds.length) : 0;
    const remainder =
      otherUserIds.length > 0 ? remaining % otherUserIds.length : 0;

    const nextDetails = splitParticipantIds.map((id) => {
      if (id === userId) {
        return { userId: id, shareMinor: targetValue };
      }
      const otherIndex = otherUserIds.indexOf(id);
      return {
        userId: id,
        shareMinor:
          baseShare + (otherIndex >= 0 && otherIndex < remainder ? 1 : 0),
      };
    });

    onFieldChange("splitDetails", nextDetails);
  };

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
        <div className="relative">
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
            className="h-14 text-2xl font-semibold pr-20 leading-tight"
            autoComplete="off"
          />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 inline-flex items-center rounded-full border border-border bg-background px-2.5 py-1 text-xs font-semibold text-foreground">
            {draft.currency}
          </span>
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

      {canConfigureSplit && (
        <>
          <div className="space-y-3 rounded-xl border border-border bg-muted/30 p-4">
            <Label className="text-sm font-semibold text-foreground">
              {t("paidByLabel")}
            </Label>
            <div className="flex flex-wrap gap-2">
              {visibleSplitParticipants.map((member) => {
                const isSelected = draft.paidByUserId === member.userId;
                return (
                  <button
                    key={member.userId}
                    type="button"
                    onClick={() => handlePaidByChange(member.userId)}
                    className={cn(
                      "rounded-full border px-3 py-1.5 text-sm font-medium transition-colors",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                      isSelected
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-background text-foreground hover:bg-muted/50"
                    )}
                  >
                    {member.name}
                  </button>
                );
              })}
            </div>
            {errors.paidByUserId ? (
              <p className="text-sm text-destructive">{t("errors.paidByRequired")}</p>
            ) : null}
          </div>

          <div className="space-y-3 rounded-xl border border-border bg-muted/30 p-4">
            <Label className="text-sm font-semibold text-foreground">
              {t("splitLabel")}
            </Label>
            <div className="grid grid-cols-3 gap-2 rounded-full border border-border bg-muted/40 p-1">
              {(
                [
                  { key: "equal", label: "splitEqualOption" },
                  { key: "personal", label: "splitPersonalOption" },
                  { key: "custom", label: "splitCustomOption" },
                ] as const
              ).map((option) => {
                const isActive = draft.splitType === option.key;
                return (
                  <button
                    key={option.key}
                    type="button"
                    onClick={() => handleSplitTypeChange(option.key)}
                    className={cn(
                      "rounded-full px-2 py-2 text-xs font-semibold transition-colors sm:text-sm",
                      isActive
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {t(option.label)}
                  </button>
                );
              })}
            </div>

            {draft.splitType === "custom" && (
              <div className="space-y-3 rounded-lg border border-border bg-background p-3">
                <p className="text-xs font-medium text-muted-foreground">
                  {t("splitCustomHelper")}
                </p>
                <div className="space-y-2">
                  {visibleSplitParticipants.map((member) => (
                    <div
                      key={member.userId}
                      className="flex items-center justify-between gap-3"
                    >
                      <span className="text-sm text-foreground">{member.name}</span>
                      <Input
                        value={customSplitInputs[member.userId] ?? ""}
                        onChange={(event) =>
                          applyCustomSplitValue(member.userId, event.target.value)
                        }
                        placeholder={locale === "es" ? "0,00" : "0.00"}
                        inputMode="decimal"
                        className="h-9 w-28 text-right text-sm"
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {errors.splitDetails ? (
              <p className="text-sm text-destructive">
                {t("errors.splitTotalMismatch")}
              </p>
            ) : null}
          </div>
        </>
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
