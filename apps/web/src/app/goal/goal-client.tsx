"use client";

import { useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { InsightsCarousel } from "@/components/goal/insights-carousel";
import {
  SlidePanel,
  SlidePanelBody,
  SlidePanelContent,
  SlidePanelDescription,
  SlidePanelFooter,
  SlidePanelHeader,
  SlidePanelTitle,
} from "@/components/ui/slide-panel";
import { createClient } from "@/lib/supabase/client";
import {
  computeGoalInsights,
  computeGoalProgress,
  createTypographyStyles,
  formatMinorToMoney,
  formatMoneyWithSymbol,
  formatMonthLabel,
  getGoalTotalsFromTransactions,
  parseMoneyToMinor,
  themeTokens,
  type FinancialGoal,
  type GoalTransaction,
  type UserRole,
  upsertMonthlyGoal,
} from "@poleursus/shared";

const tokens = themeTokens.light;
const colors = tokens.colors;
const typography = createTypographyStyles(tokens);

const sanitizeNumericInput = (value: string) => value.replace(/[^0-9.,]/g, "");

const formatAbs = (value: bigint) => (value < 0n ? -value : value);

const formatSignedMoney = (
  value: bigint,
  currency: string,
  currencySymbol: string
) => {
  const formatted = formatMoneyWithSymbol(
    formatAbs(value),
    currency,
    currencySymbol
  );
  return value < 0n ? `-${formatted}` : formatted;
};

const getStatusColor = (status: "positive" | "negative" | "neutral") => {
  if (status === "positive") return colors.state.positive;
  if (status === "negative") return colors.state.negative;
  return colors.state.neutral;
};

type GoalClientProps = {
  accountId: string;
  baseCurrency: string;
  currencySymbol: string;
  monthKey: string;
  role: UserRole;
  currentUserId: string;
  initialGoal: FinancialGoal | null;
  initialTransactions: GoalTransaction[];
  initialPreviousExpenseTotalMinor: string | null;
};

export function GoalClient({
  accountId,
  baseCurrency,
  currencySymbol,
  monthKey,
  role,
  currentUserId,
  initialGoal,
  initialTransactions,
  initialPreviousExpenseTotalMinor,
}: GoalClientProps) {
  const locale = useLocale();
  const tGlobal = useTranslations();
  const tCommon = useTranslations("common");
  const tGoal = useTranslations("goal");
  const tTransactions = useTranslations("transactions");
  const supabase = useMemo(() => createClient(), []);

  const [goal, setGoal] = useState<FinancialGoal | null>(initialGoal);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [amountInput, setAmountInput] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const canEdit = role !== "viewer";
  const monthLabel = useMemo(
    () => formatMonthLabel(monthKey, locale),
    [locale, monthKey]
  );

  const previousExpenseTotalMinor = useMemo(() => {
    if (!initialPreviousExpenseTotalMinor) return null;
    try {
      return BigInt(initialPreviousExpenseTotalMinor);
    } catch {
      return null;
    }
  }, [initialPreviousExpenseTotalMinor]);

  const totals = useMemo(
    () => getGoalTotalsFromTransactions(initialTransactions),
    [initialTransactions]
  );

  const progress = useMemo(
    () => computeGoalProgress({ goal, totals }),
    [goal, totals]
  );

  const insightCopy = useMemo(
    () => ({
      forecast: (amount: string) => tGoal("insights.forecast", { amount }),
      expenseUp: (amount: string) => tGoal("insights.expenseUp", { amount }),
      expenseDown: (amount: string) => tGoal("insights.expenseDown", { amount }),
      expenseEven: tGoal("insights.expenseEven"),
      topCategories: (categories: string) =>
        tGoal("insights.topCategories", { categories }),
    }),
    [tGoal]
  );

  const insightFormatters = useMemo(
    () => ({
      formatSignedMoney: (value: bigint) =>
        formatSignedMoney(value, baseCurrency, currencySymbol),
      formatMoney: (value: bigint) =>
        formatMoneyWithSymbol(value, baseCurrency, currencySymbol),
    }),
    [baseCurrency, currencySymbol]
  );

  const insights = useMemo(
    () =>
      computeGoalInsights({
        progress,
        totals,
        transactions: initialTransactions,
        previousExpenseTotalMinor,
        uncategorizedLabel: tTransactions("uncategorized"),
        copy: insightCopy,
        formatters: insightFormatters,
      }),
    [
      initialTransactions,
      previousExpenseTotalMinor,
      progress,
      tTransactions,
      totals,
      insightCopy,
      insightFormatters,
    ]
  );

  const formattedTarget = progress
    ? formatMoneyWithSymbol(progress.targetMinor, baseCurrency, currencySymbol)
    : formatMoneyWithSymbol(0n, baseCurrency, currencySymbol);

  const formattedSaved = progress
    ? formatSignedMoney(progress.savedMinor, baseCurrency, currencySymbol)
    : formatMoneyWithSymbol(0n, baseCurrency, currencySymbol);

  const formattedRemaining = progress
    ? formatMoneyWithSymbol(progress.remainingMinor, baseCurrency, currencySymbol)
    : formatMoneyWithSymbol(0n, baseCurrency, currencySymbol);

  const formattedRate = progress
    ? formatMoneyWithSymbol(progress.ratePerDayMinor, baseCurrency, currencySymbol)
    : formatMoneyWithSymbol(0n, baseCurrency, currencySymbol);

  const progressColor = getStatusColor(progress?.status ?? "neutral");
  const progressWidth = progress
    ? `${Math.round(progress.progressRatio * 100)}%`
    : "0%";

  const handleOpenEditor = () => {
    setFormError(null);
    if (goal) {
      const value = formatMinorToMoney(
        progress?.targetMinor ?? 0n,
        baseCurrency
      );
      setAmountInput(value);
    } else {
      setAmountInput("");
    }
    setIsEditorOpen(true);
  };

  const handleSave = async () => {
    if (!canEdit) return;
    const cleaned = amountInput.trim();
    const parsed = parseMoneyToMinor(cleaned, baseCurrency);
    if (typeof parsed === "object" && "error" in parsed) {
      setFormError(tGlobal(parsed.error.key, parsed.error.params));
      return;
    }

    if (parsed <= 0n) {
      setFormError(tGlobal("money.invalidAmount"));
      return;
    }

    setIsSaving(true);
    setFormError(null);

    try {
      const nextGoal = await upsertMonthlyGoal({
        client: supabase,
        accountId,
        month: monthKey,
        targetAmountBaseMinor: parsed,
        createdBy: currentUserId,
      });
      setGoal(nextGoal);
      setIsEditorOpen(false);
    } catch (error) {
      console.error("[Goal] Save error", error);
      setFormError(tGlobal("errors.internalServer"));
    } finally {
      setIsSaving(false);
    }
  };

  const hasTransactions = initialTransactions.length > 0;

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4">
      <div className="space-y-1">
        <h1
          style={{
            fontSize: typography.display.fontSize,
            fontWeight: typography.display.fontWeight,
            color: colors.text.primary,
          }}
        >
          {tGoal("pageTitle")}
        </h1>
        <p
          className="text-sm"
          style={{
            color: colors.text.secondary,
            fontSize: typography.body.fontSize,
            fontWeight: typography.body.fontWeight,
          }}
        >
          {monthLabel}
        </p>
      </div>

      {goal ? (
        <Card>
          <CardHeader className="space-y-4">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="space-y-2">
                <p className="text-sm" style={{ color: colors.text.secondary }}>
                  {tGoal("heroTitle")}
                </p>
                <h2
                  style={{
                    fontSize: typography.h2.fontSize,
                    fontWeight: typography.h2.fontWeight,
                    color: colors.text.primary,
                  }}
                >
                  {tGoal("heroTarget", { amount: formattedTarget })}
                </h2>
              </div>
              <Button
                variant="outline"
                style={{
                  borderColor: colors.state.neutral,
                  backgroundColor: colors.bg.surface,
                  color: colors.text.primary,
                }}
                onClick={handleOpenEditor}
                disabled={!canEdit}
              >
                {tGoal("editCta")}
              </Button>
            </div>
            <div
              className="h-2 w-full rounded-full"
              style={{ backgroundColor: colors.state.neutral }}
              aria-hidden
            >
              <div
                className="h-full rounded-full"
                style={{
                  width: progressWidth,
                  backgroundColor: progressColor,
                }}
              />
            </div>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <p className="text-xs" style={{ color: colors.text.secondary }}>
                  {tGoal("progressLabel")}
                </p>
                <p
                  style={{
                    fontSize: typography.body.fontSize,
                    fontWeight: typography.body.fontWeight,
                    color: colors.text.primary,
                  }}
                >
                  {formattedSaved} / {formattedTarget}
                </p>
              </div>
              <div>
                <p className="text-xs" style={{ color: colors.text.secondary }}>
                  {tGoal("remainingTitle")}
                </p>
                <p
                  style={{
                    fontSize: typography.body.fontSize,
                    fontWeight: typography.body.fontWeight,
                    color:
                      progress?.remainingMinor === 0n
                        ? colors.state.positive
                        : colors.text.primary,
                  }}
                >
                  {progress?.remainingMinor === 0n
                    ? tGoal("remainingComplete")
                    : tGoal("remainingLabel", { amount: formattedRemaining })}
                </p>
              </div>
              <div>
                <p className="text-xs" style={{ color: colors.text.secondary }}>
                  {tGoal("rateTitle")}
                </p>
                <p
                  style={{
                    fontSize: typography.body.fontSize,
                    fontWeight: typography.body.fontWeight,
                    color: colors.text.primary,
                  }}
                >
                  {tGoal("rateLabel", { amount: formattedRate })}
                </p>
              </div>
            </div>

            {!hasTransactions && (
              <p className="text-sm" style={{ color: colors.text.secondary }}>
                {tGoal("noTransactions")}
              </p>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="space-y-4 p-6">
            <div className="space-y-2">
              <h2
                style={{
                  fontSize: typography.h2.fontSize,
                  fontWeight: typography.h2.fontWeight,
                  color: colors.text.primary,
                }}
              >
                {tGoal("emptyTitle")}
              </h2>
              <p className="text-sm" style={{ color: colors.text.secondary }}>
                {tGoal("emptyDescription")}
              </p>
            </div>
            <Button
              variant="outline"
              style={{
                borderColor: colors.state.neutral,
                backgroundColor: colors.bg.surface,
                color: colors.text.primary,
              }}
              onClick={handleOpenEditor}
              disabled={!canEdit}
            >
              {tGoal("createCta")}
            </Button>
          </CardContent>
        </Card>
      )}

      {goal && hasTransactions && insights.length > 0 && (
        <Card>
          <CardHeader>
            <h3
              style={{
                fontSize: typography.h3.fontSize,
                fontWeight: typography.h3.fontWeight,
                color: colors.text.primary,
              }}
            >
              {tGoal("insightsTitle")}
            </h3>
          </CardHeader>
          <CardContent>
            <InsightsCarousel insights={insights} />
          </CardContent>
        </Card>
      )}

      <SlidePanel open={isEditorOpen} onOpenChange={setIsEditorOpen}>
        <SlidePanelContent>
          <SlidePanelHeader>
            <SlidePanelTitle>{tGoal("editorTitle")}</SlidePanelTitle>
            <SlidePanelDescription>{tGoal("editorDescription")}</SlidePanelDescription>
          </SlidePanelHeader>
          <SlidePanelBody className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="goal-amount">{tGoal("amountLabel")}</Label>
              <Input
                id="goal-amount"
                inputMode="decimal"
                value={amountInput}
                onChange={(event) =>
                  setAmountInput(sanitizeNumericInput(event.target.value))
                }
                placeholder={tGoal("amountPlaceholder")}
              />
              {formError && (
                <p className="text-sm" style={{ color: colors.state.negative }}>
                  {formError}
                </p>
              )}
            </div>
          </SlidePanelBody>
          <SlidePanelFooter>
            <Button
              variant="outline"
              onClick={() => setIsEditorOpen(false)}
              style={{
                borderColor: colors.state.neutral,
                backgroundColor: colors.bg.surface,
                color: colors.text.primary,
              }}
            >
              {tCommon("cancel")}
            </Button>
            <Button
              onClick={handleSave}
              disabled={!canEdit || isSaving}
              style={{
                backgroundColor: colors.text.primary,
                color: colors.bg.primary,
              }}
            >
              {isSaving ? tGoal("savingCta") : tGoal("saveCta")}
            </Button>
          </SlidePanelFooter>
        </SlidePanelContent>
      </SlidePanel>
    </div>
  );
}
