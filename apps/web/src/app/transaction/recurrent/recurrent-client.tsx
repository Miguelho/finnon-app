"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { useWebDataCache } from "@/cache/WebDataCacheProvider";
import { PageContainer } from "@/components/layout/page-container";
import { RecurringTile } from "@/components/recurring/recurring-tile";
import { TopCategorySelector } from "@/components/categories/top-category-selector";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import {
  SlidePanel,
  SlidePanelBody,
  SlidePanelContent,
  SlidePanelDescription,
  SlidePanelFooter,
  SlidePanelHeader,
  SlidePanelTitle,
} from "@/components/ui/slide-panel";
import {
  CURRENCIES,
  CURRENCY_MINOR_UNITS,
  computeRecurringMonthInsights,
  formatMinorToMoney,
  formatMonthLabel,
  parseMoneyToMinor,
  themeTokens,
  type RecurringItem,
  type RecurringItemInsight,
  type RecurringLinkedTransaction,
  type RecurringItemWithCategory,
  type TopCategory,
} from "@poleursus/shared";
import {
  endRecurringItem,
  pauseRecurringItem,
  updateRecurringItem,
} from "@/app/transactions/actions";

type Category = {
  id: string;
  name: string;
  icon_id: string;
  type: "income" | "expense";
};

type RecurrentesClientProps = {
  baseCurrency: string;
  initialRecurringItems: RecurringItemWithCategory[];
  recurringTransactions: RecurringLinkedTransaction[];
  categories: Category[];
  canEdit: boolean;
};

const donutSize = 180;
const donutRadius = 66;
const donutStroke = 20;
const donutCircumference = 2 * Math.PI * donutRadius;

const getCurrencySymbol = (currency: string) =>
  CURRENCIES.find((entry) => entry.code === currency)?.symbol ?? currency;

const capitalize = (value: string) =>
  value.length > 0 ? value[0]!.toUpperCase() + value.slice(1) : value;

function DonutChart({
  totalMinor,
  currency,
  categories,
  centerLabel,
}: {
  totalMinor: bigint;
  currency: string;
  categories: ReturnType<typeof computeRecurringMonthInsights>["categories"];
  centerLabel: string;
}) {
  let cumulativeLength = 0;

  return (
    <div className="relative mx-auto h-[180px] w-[180px] shrink-0">
      <svg viewBox={`0 0 ${donutSize} ${donutSize}`} className="h-full w-full">
        <circle
          cx={donutSize / 2}
          cy={donutSize / 2}
          r={donutRadius}
          fill="none"
          stroke="hsl(var(--muted))"
          strokeWidth={donutStroke}
        />
        {categories.map((category) => {
          const segmentLength = donutCircumference * category.share;
          const offset = cumulativeLength;
          cumulativeLength += segmentLength;

          return (
            <circle
              key={category.id ?? category.name ?? category.color}
              cx={donutSize / 2}
              cy={donutSize / 2}
              r={donutRadius}
              fill="none"
              stroke={category.color}
              strokeWidth={donutStroke}
              strokeDasharray={`${segmentLength} ${donutCircumference}`}
              strokeDashoffset={-offset}
              strokeLinecap="butt"
              transform={`rotate(-90 ${donutSize / 2} ${donutSize / 2})`}
            />
          );
        })}
      </svg>

      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <div className="text-xl font-semibold tracking-tight tabular-nums text-foreground">
          {getCurrencySymbol(currency)}
          {formatMinorToMoney(totalMinor, currency)}
        </div>
        <div className="mt-1 text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
          {centerLabel}
        </div>
      </div>
    </div>
  );
}

export function RecurrentesClient({
  baseCurrency,
  initialRecurringItems,
  recurringTransactions,
  categories,
  canEdit,
}: RecurrentesClientProps) {
  const router = useRouter();
  const locale = useLocale();
  const t = useTranslations("recurrentes");
  const tCommon = useTranslations("common");
  const tTransactions = useTranslations("transactions");
  const colors = themeTokens.light.colors;
  const { emitMutation } = useWebDataCache();

  const [recurringItems, setRecurringItems] = useState(initialRecurringItems);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isEndConfirmOpen, setIsEndConfirmOpen] = useState(false);
  const [selectedItem, setSelectedItem] =
    useState<RecurringItemWithCategory | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showFullCategorySelector, setShowFullCategorySelector] = useState(false);
  const [editForm, setEditForm] = useState({
    merchant: "",
    amount: "",
    category_id: "",
    start_date: "",
    end_date: "",
    effective_from: new Date().toISOString().slice(0, 10),
  });

  const todayISO = new Date().toISOString().slice(0, 10);
  const monthKey = todayISO.slice(0, 7);
  const monthLabel = capitalize(formatMonthLabel(monthKey, locale));
  const insights = computeRecurringMonthInsights({
    recurringItems,
    transactions: recurringTransactions,
    monthKey,
    todayISO,
  });
  const expenseItems = insights.expense.items;
  const incomeItems = insights.income.items;
  const currencySymbol = getCurrencySymbol(baseCurrency);

  const formatShortDate = (value: string) =>
    new Date(value).toLocaleDateString(locale, { day: "numeric", month: "short" });

  const formatSignedAmount = (minor: bigint) => {
    const sign = minor < 0n ? "-" : "";
    const absolute = minor < 0n ? -minor : minor;
    return `${sign}${currencySymbol} ${formatMinorToMoney(absolute, baseCurrency)}`;
  };

  const formatExpenseAmount = (minor: bigint) =>
    `-${currencySymbol} ${formatMinorToMoney(minor, baseCurrency)}`;

  const formatIncomeAmount = (minor: bigint) =>
    `${currencySymbol} ${formatMinorToMoney(minor, baseCurrency)}`;

  const formatDeltaAmount = (minor: bigint) => {
    if (minor === 0n) return t("trendFlat");
    const sign = minor > 0n ? "+" : "-";
    const absolute = minor > 0n ? minor : -minor;
    return `${sign}${currencySymbol}${formatMinorToMoney(absolute, baseCurrency)}`;
  };

  const formatPercent = (value: number) =>
    new Intl.NumberFormat(locale, {
      style: "percent",
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    }).format(value);

  const getRecurringCountLabel = (count: number) =>
    count === 1
      ? t("summaryRecurringCountOne")
      : t("summaryRecurringCountOther", { count });

  const getConfirmedCountLabel = (count: number) =>
    count === 1
      ? t("summaryConfirmedCountOne")
      : t("summaryConfirmedCountOther", { count });

  const getListCountLabel = (count: number) =>
    count === 1 ? t("listCountOne") : t("listCountOther", { count });

  const getTrendTone = (item: RecurringItem, deltaMinor: bigint | null) => {
    if (deltaMinor === null || deltaMinor === 0n) return "neutral" as const;
    if (item.type === "expense") {
      return deltaMinor > 0n ? ("negative" as const) : ("positive" as const);
    }
    return deltaMinor > 0n ? ("positive" as const) : ("negative" as const);
  };

  const getStatusBadge = (item: RecurringItemInsight) => {
    if (item.status === "confirmed") {
      return { label: t("statusConfirmed"), tone: "positive" as const };
    }
    if (item.status === "paused") {
      return { label: t("paused"), tone: "muted" as const };
    }
    if (item.nextOccurrence) {
      return { label: formatShortDate(item.nextOccurrence), tone: "neutral" as const };
    }
    return null;
  };

  const getDetailLabel = (item: RecurringItemInsight) =>
    item.referenceDate ? formatShortDate(item.referenceDate) : null;

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
      effective_from: todayISO,
    });
    setShowFullCategorySelector(false);
    setIsEditOpen(true);
  };

  const handleEdit = async () => {
    if (!selectedItem) return;

    setIsSubmitting(true);
    try {
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
        await emitMutation("recurring_items", "update");
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
        await emitMutation("recurring_items", "update");
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
      const result = await endRecurringItem({
        id: selectedItem.id,
        end_date: todayISO,
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
        await emitMutation("recurring_items", "update");
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

  const leadIncomeItem =
    incomeItems.find((item) => item.occurrenceCountThisMonth > 0) ?? incomeItems[0];

  const benchmarkRatio = insights.expenseShareOfIncome;
  const benchmarkPercent =
    benchmarkRatio !== null ? formatPercent(benchmarkRatio) : null;
  const benchmarkFill = Math.min((benchmarkRatio ?? 0) * 100, 100);

  return (
    <PageContainer className="py-6">
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => router.push("/transactions")}
              aria-label={tCommon("back")}
              className="rounded-full border border-border bg-card"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-3xl font-semibold tracking-tight text-foreground">
                {t("title")}
              </h1>
              <p className="text-sm text-muted-foreground">
                {t("monthlyProjection", { month: monthLabel })}
              </p>
            </div>
          </div>

          {!canEdit ? (
            <p className="text-sm text-muted-foreground">
              {tTransactions("readOnlyNotice")}
            </p>
          ) : null}
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Card className="overflow-hidden rounded-[20px] border-border/70 shadow-sm">
            <div className="h-1 bg-[hsl(var(--state-negative))]" />
            <CardContent className="space-y-2 p-5 pt-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                {t("expenseSummaryTitle")}
              </p>
              <p className="text-[28px] font-semibold tracking-[-0.04em] text-[hsl(var(--state-negative))] tabular-nums">
                {formatExpenseAmount(insights.expense.totalMinor)}
              </p>
              <p className="text-sm text-muted-foreground">
                {getRecurringCountLabel(insights.expense.projectedCount)} ·{" "}
                {getConfirmedCountLabel(insights.expense.confirmedCount)}
              </p>
            </CardContent>
          </Card>

          <Card className="overflow-hidden rounded-[20px] border-border/70 shadow-sm">
            <div className="h-1 bg-[hsl(var(--state-positive))]" />
            <CardContent className="space-y-2 p-5 pt-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                {t("incomeSummaryTitle")}
              </p>
              <p className="text-[28px] font-semibold tracking-[-0.04em] text-[hsl(var(--state-positive))] tabular-nums">
                {formatIncomeAmount(insights.income.totalMinor)}
              </p>
              <p className="text-sm text-muted-foreground">
                {getRecurringCountLabel(insights.income.projectedCount)}
                {leadIncomeItem?.referenceDate
                  ? ` · ${leadIncomeItem.recurringItem.merchant || t("incomeFallback")} · ${t("dayOfMonth", { day: new Date(leadIncomeItem.referenceDate).toLocaleDateString(locale, { day: "numeric" }) })}`
                  : ""}
              </p>
            </CardContent>
          </Card>
        </div>

        <Card className="rounded-[20px] border-border/70 shadow-sm">
          <CardContent className="space-y-4 p-5">
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  {t("benchmarkTitle")}
                </p>
                <p className="mt-1 text-2xl font-semibold tracking-tight text-foreground tabular-nums">
                  {benchmarkPercent ?? "—"}
                </p>
              </div>
              <span className="text-xs font-medium text-[hsl(var(--state-positive))]">
                {t("benchmarkRecommended", { value: "50%" })}
              </span>
            </div>

            <div className="h-2 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-[linear-gradient(90deg,#5B8DFF_0%,#818CF8_100%)] transition-all duration-500"
                style={{ width: `${benchmarkFill}%` }}
              />
            </div>

            <div className="flex justify-between text-[11px] text-muted-foreground">
              <span>0%</span>
              <span className="text-[hsl(var(--state-positive))]">
                {t("benchmarkRecommended", { value: "50%" })}
              </span>
              <span>100%</span>
            </div>

            <p className="text-sm leading-6 text-muted-foreground">
              {benchmarkRatio !== null
                ? t("benchmarkNote", {
                    percentage: benchmarkPercent ?? "—",
                    amount: formatSignedAmount(insights.remainingBalanceMinor),
                  })
                : t("benchmarkEmpty")}
            </p>
          </CardContent>
        </Card>

        <Card className="rounded-[20px] border-border/70 shadow-sm">
          <CardContent className="space-y-5 p-5">
            <div className="flex items-center justify-between gap-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                {t("categoryDistributionTitle")}
              </p>
            </div>

            {insights.categories.length > 0 ? (
              <div className="flex flex-col gap-6 lg:flex-row lg:items-center">
                <DonutChart
                  totalMinor={insights.expense.totalMinor}
                  currency={baseCurrency}
                  categories={insights.categories}
                  centerLabel={t("projectedShort")}
                />

                <div className="flex-1 space-y-2">
                  {insights.categories.map((category) => (
                    <div
                      key={category.id ?? category.name ?? category.color}
                      className="flex items-center justify-between rounded-2xl border border-border/60 bg-[var(--account-surface-alt)] px-4 py-3"
                    >
                      <div className="flex items-center gap-3">
                        <span
                          className="h-2.5 w-2.5 rounded-full"
                          style={{ backgroundColor: category.color }}
                        />
                        <span className="text-sm font-medium text-foreground">
                          {category.name || tCommon("noneOption")}
                        </span>
                      </div>

                      <div className="flex items-center gap-3 text-right">
                        <span className="text-sm font-semibold tabular-nums text-foreground">
                          {formatIncomeAmount(category.amountMinor)}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {formatPercent(category.share)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">{t("chartEmpty")}</p>
            )}
          </CardContent>
        </Card>

        {expenseItems.length === 0 && incomeItems.length === 0 ? (
          <Card className="rounded-[20px] border-border/70 shadow-sm">
            <CardContent className="p-8 text-center">
              <p className="text-muted-foreground">{t("empty")}</p>
            </CardContent>
          </Card>
        ) : null}

        {expenseItems.length > 0 ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                {t("expenseListTitle")}
              </p>
              <span className="rounded-full bg-[var(--account-surface-alt)] px-3 py-1 text-xs text-muted-foreground">
                {getListCountLabel(expenseItems.length)}
              </span>
            </div>

            <Card className="overflow-hidden rounded-[20px] border-border/70 shadow-sm">
              <CardContent className="divide-y p-0">
                {expenseItems.map((item) => (
                  <RecurringTile
                    key={item.recurringItem.id}
                    recurringItem={item.recurringItem}
                    detailLabel={getDetailLabel(item)}
                    statusBadge={getStatusBadge(item)}
                    trend={
                      item.deltaMinor !== null
                        ? {
                            label: formatDeltaAmount(item.deltaMinor),
                            tone: getTrendTone(item.recurringItem, item.deltaMinor),
                          }
                        : null
                    }
                    categoryColor={item.categoryColor}
                    showLeadingAccent={item.status === "confirmed"}
                    onEdit={canEdit ? () => openEditForm(item.recurringItem) : undefined}
                    onPause={
                      canEdit
                        ? (id, isPaused) => handlePause(id, isPaused)
                        : undefined
                    }
                    onEnd={canEdit ? () => confirmEnd(item.recurringItem) : undefined}
                  />
                ))}
              </CardContent>
            </Card>
          </div>
        ) : null}

        {incomeItems.length > 0 ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                {t("incomeListTitle")}
              </p>
              <span className="rounded-full bg-[var(--account-surface-alt)] px-3 py-1 text-xs text-muted-foreground">
                {getListCountLabel(incomeItems.length)}
              </span>
            </div>

            <Card className="overflow-hidden rounded-[20px] border-border/70 shadow-sm">
              <CardContent className="divide-y p-0">
                {incomeItems.map((item) => (
                  <RecurringTile
                    key={item.recurringItem.id}
                    recurringItem={item.recurringItem}
                    detailLabel={getDetailLabel(item)}
                    statusBadge={getStatusBadge(item)}
                    trend={
                      item.deltaMinor !== null
                        ? {
                            label: formatDeltaAmount(item.deltaMinor),
                            tone: getTrendTone(item.recurringItem, item.deltaMinor),
                          }
                        : null
                    }
                    categoryColor={item.categoryColor}
                    onEdit={canEdit ? () => openEditForm(item.recurringItem) : undefined}
                    onPause={
                      canEdit
                        ? (id, isPaused) => handlePause(id, isPaused)
                        : undefined
                    }
                    onEnd={canEdit ? () => confirmEnd(item.recurringItem) : undefined}
                  />
                ))}
              </CardContent>
            </Card>
          </div>
        ) : null}
      </div>

      <SlidePanel open={isEditOpen} onOpenChange={setIsEditOpen}>
        <SlidePanelContent>
          <SlidePanelHeader>
            <SlidePanelTitle>{t("edit")}</SlidePanelTitle>
            <SlidePanelDescription>{t("editDescription")}</SlidePanelDescription>
          </SlidePanelHeader>
          <SlidePanelBody className="space-y-4">
            <div className="space-y-2">
              <Label>{tTransactions("categoryOptionalLabel")}</Label>
              {(() => {
                const itemType = selectedItem?.type;
                const filteredCategories = categories.filter((cat) => cat.type === itemType);
                const topCats: TopCategory[] = filteredCategories.slice(0, 3);
                return (
                  <>
                    {topCats.length > 0 ? (
                      <TopCategorySelector
                        topCategories={topCats}
                        selectedCategoryId={editForm.category_id || undefined}
                        onSelect={(id) =>
                          setEditForm((prev) => ({ ...prev, category_id: id }))
                        }
                        onOpenAll={() => setShowFullCategorySelector((prev) => !prev)}
                        seeOthersLabel={tTransactions("create.categorySeeOthers")}
                      />
                    ) : null}
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

            <div className="space-y-2">
              <Label htmlFor="merchant">{t("nameLabel")}</Label>
              <Input
                id="merchant"
                value={editForm.merchant}
                onChange={(event) =>
                  setEditForm((prev) => ({ ...prev, merchant: event.target.value }))
                }
                placeholder={t("namePlaceholder")}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="amount">{t("amountLabel")}</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="amount"
                  value={editForm.amount}
                  onChange={(event) =>
                    setEditForm((prev) => ({
                      ...prev,
                      amount: sanitizeNumericInput(event.target.value),
                    }))
                  }
                  placeholder="0,00"
                />
                <span className="text-sm text-muted-foreground">{baseCurrency}</span>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="start_date">{t("startDateLabel")}</Label>
              <Input
                id="start_date"
                type="date"
                value={editForm.start_date}
                onChange={(event) =>
                  setEditForm((prev) => ({
                    ...prev,
                    start_date: event.target.value,
                  }))
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="end_date">{t("endDateLabel")}</Label>
              <Input
                id="end_date"
                type="date"
                value={editForm.end_date}
                onChange={(event) =>
                  setEditForm((prev) => ({ ...prev, end_date: event.target.value }))
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="effective_from">{t("applyFrom")}</Label>
              <Input
                id="effective_from"
                type="date"
                value={editForm.effective_from}
                min={todayISO}
                onChange={(event) =>
                  setEditForm((prev) => ({
                    ...prev,
                    effective_from: event.target.value,
                  }))
                }
              />
              <p className="text-sm text-muted-foreground">{t("applyFromHint")}</p>
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
