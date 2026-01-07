"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { PageContainer } from "@/components/layout/page-container";
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
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  type TransactionType,
  type RecurringFrequency,
  type RecurringItem,
  CURRENCIES,
  formatMinorToMoney,
  formatMoneyWithSymbol,
  parseMoneyToMinor,
  computeAmountBaseMinor,
  parseFxRate,
  CURRENCY_MINOR_UNITS,
  getOccurrencesBetween,
  getOccurrenceKey,
  addMonths,
  formatMonthLabel,
  toMonthKey,
  themeTokens,
} from "@poleursus/shared";
import { CategoryIcon } from "@/components/category-icon";
import {
  createTransaction,
  createRecurringItem,
  createObligation,
  updateTransaction,
  deleteTransaction,
  confirmRecurringTransaction,
} from "./actions";

type Category = {
  id: string;
  name: string;
  icon_id: string;
  type: "income" | "expense";
};

type Transaction = {
  id: string;
  account_id: string;
  type: "income" | "expense";
  amount_minor: string;
  currency: string;
  amount_base_minor: string;
  fx_rate?: string | null;
  fx_date?: string | null;
  category_id: string | null;
  date: string;
  merchant: string | null;
  notes: string | null;
  created_by: string;
  created_at: string;
  category?: Category | null;
  recurring_item_id?: string | null;
  recurring_occurrence_date?: string | null;
};

type RecurringOccurrenceItem = {
  occurrenceDate: string;
  item: RecurringItem;
};

type TransactionsClientProps = {
  accountId: string;
  baseCurrency: string;
  initialTransactions: Transaction[];
  initialRecurringItems: RecurringItem[];
  categories: Category[];
  role: "viewer" | "contributor" | "admin";
};

const parseMonthKey = (monthKey: string) => {
  const [yearStr, monthStr] = monthKey.split("-");
  const year = Number(yearStr);
  const monthIndex = Number(monthStr) - 1;
  return {
    year: Number.isFinite(year) ? year : new Date().getFullYear(),
    monthIndex: Number.isFinite(monthIndex) ? monthIndex : new Date().getMonth(),
  };
};

const getMonthRangeFromKey = (monthKey: string) => {
  const { year, monthIndex } = parseMonthKey(monthKey);
  const start = `${monthKey}-01`;
  const end = new Date(Date.UTC(year, monthIndex + 1, 0))
    .toISOString()
    .slice(0, 10);
  return { start, end };
};

export function TransactionsClient({
  accountId,
  baseCurrency,
  initialTransactions,
  initialRecurringItems,
  categories,
  role,
}: TransactionsClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tGlobal = useTranslations();
  const t = useTranslations("transactions");
  const tObligations = useTranslations("obligations");
  const locale = useLocale();
  const [transactions, setTransactions] = useState(initialTransactions);
  const [recurringItems, setRecurringItems] = useState(initialRecurringItems);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [selectedTransaction, setSelectedTransaction] =
    useState<Transaction | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [confirmingKey, setConfirmingKey] = useState<string | null>(null);
  const [createKind, setCreateKind] = useState<
    "transaction" | "recurring" | "obligation"
  >("transaction");
  const canEdit = role !== "viewer";
  const colors = themeTokens.light.colors;

  // Month filter state (format: YYYY-MM)
  const currentMonth = toMonthKey(new Date());
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);
  const [isMonthPickerOpen, setIsMonthPickerOpen] = useState(false);
  const [pickerYear, setPickerYear] = useState(new Date().getFullYear());
  const [pickerMonthIndex, setPickerMonthIndex] = useState(new Date().getMonth());
  const monthOptions = useMemo(
    () =>
      Array.from({ length: 12 }, (_, index) =>
        new Date(2000, index, 1).toLocaleDateString(locale, {
          month: "long",
        })
      ),
    [locale]
  );
  const yearOptions = useMemo(() => {
    const currentYear = new Date().getFullYear();
    const startYear = currentYear - 5;
    return Array.from({ length: 11 }, (_, index) => startYear + index);
  }, []);

  // Form state
  const [formData, setFormData] = useState<{
    type: TransactionType;
    amount: string;
    currency: string;
    fx_rate: string;
    category_id: string | undefined;
    date: string;
    merchant: string;
    notes: string;
  }>({
    type: "expense" as TransactionType,
    amount: "",
    currency: baseCurrency,
    fx_rate: "1",
    category_id: undefined,
    date: new Date().toISOString().slice(0, 10),
    merchant: "",
    notes: "",
  });

  const [repeatConfig, setRepeatConfig] = useState<{
    enabled: boolean;
    frequency: RecurringFrequency;
    interval: string;
    startDate: string;
    endDate: string;
  }>({
    enabled: false,
    frequency: "monthly",
    interval: "1",
    startDate: new Date().toISOString().slice(0, 10),
    endDate: "",
  });

  const [obligationForm, setObligationForm] = useState<{
    name: string;
    amount: string;
    due_date: string;
    status: "pending" | "paid";
  }>({
    name: "",
    amount: "",
    due_date: new Date().toISOString().slice(0, 10),
    status: "pending",
  });

  const requiresFxRate = formData.currency !== baseCurrency;
  const previewBaseAmount = useMemo(() => {
    if (!requiresFxRate) return null;
    if (!formData.amount.trim() || !formData.fx_rate.trim()) return null;

    const amountMinor = parseMoneyToMinor(
      formData.amount,
      formData.currency,
      CURRENCY_MINOR_UNITS
    );
    if (typeof amountMinor === "object" && "error" in amountMinor) {
      return null;
    }

    const computed = computeAmountBaseMinor({
      amountMinor,
      currency: formData.currency,
      baseCurrency,
      fxRate: formData.fx_rate,
      currencyMeta: CURRENCY_MINOR_UNITS,
    });
    if (typeof computed === "object" && "error" in computed) {
      return null;
    }

    return formatMinorToMoney(computed, baseCurrency, CURRENCY_MINOR_UNITS);
  }, [
    formData.amount,
    formData.currency,
    formData.fx_rate,
    baseCurrency,
    requiresFxRate,
  ]);

  const validateFxRate = () => {
    if (!requiresFxRate) return true;
    if (!formData.fx_rate.trim()) {
      alert(t("fxRateRequired"));
      return false;
    }
    const parsed = parseFxRate(formData.fx_rate);
    if (typeof parsed === "object" && "error" in parsed) {
      alert(t("fxRateInvalid"));
      return false;
    }
    return true;
  };

  const sanitizeNumericInput = (value: string) =>
    value.replace(/[^0-9.,]/g, "");

  useEffect(() => {
    if (!searchParams?.get("new")) return;
    setIsCreateOpen(true);
    const kindParam = searchParams.get("kind");
    const nextKind =
      kindParam === "obligation"
        ? "obligation"
        : kindParam === "recurring"
          ? "recurring"
          : "transaction";
    setCreateKind(nextKind);
    const typeParam = searchParams.get("type");
    if (typeParam === "income" || typeParam === "expense") {
      setFormData((prev) => ({
        ...prev,
        type: typeParam as TransactionType,
        category_id: undefined,
      }));
    }
    if (nextKind === "recurring") {
      setRepeatConfig((prev) => ({
        ...prev,
        enabled: true,
        startDate: prev.startDate || formData.date,
      }));
    } else if (nextKind === "transaction") {
      setRepeatConfig((prev) => ({ ...prev, enabled: false }));
    }
  }, [searchParams]);

  const goToPreviousMonth = () => {
    setSelectedMonth(addMonths(selectedMonth, -1));
  };

  const goToNextMonth = () => {
    setSelectedMonth(addMonths(selectedMonth, 1));
  };

  const openMonthPicker = () => {
    const { year, monthIndex } = parseMonthKey(selectedMonth);
    setPickerYear(year);
    setPickerMonthIndex(monthIndex);
    setIsMonthPickerOpen(true);
  };

  const applyMonthPicker = () => {
    const nextMonth = toMonthKey(new Date(pickerYear, pickerMonthIndex, 1));
    setSelectedMonth(nextMonth);
    setIsMonthPickerOpen(false);
  };

  // Filter transactions by selected month
  const filteredTransactions = useMemo(() => {
    return transactions.filter((t) => t.date.startsWith(selectedMonth));
  }, [transactions, selectedMonth]);

  const monthRange = useMemo(
    () => getMonthRangeFromKey(selectedMonth),
    [selectedMonth]
  );

  const pendingOccurrences = useMemo<RecurringOccurrenceItem[]>(() => {
    if (!recurringItems.length) return [];
    const existingKeys = new Set(
      filteredTransactions
        .filter(
          (transaction) =>
            transaction.recurring_item_id && transaction.recurring_occurrence_date
        )
        .map((transaction) =>
          getOccurrenceKey(
            transaction.recurring_item_id!,
            transaction.recurring_occurrence_date!
          )
        )
    );

    return recurringItems
      .filter((item) => !item.is_paused)
      .flatMap((item) =>
        getOccurrencesBetween(item, monthRange.start, monthRange.end)
          .filter((occurrence) => !existingKeys.has(occurrence.key))
          .map((occurrence) => ({
            occurrenceDate: occurrence.date,
            item,
          }))
      );
  }, [filteredTransactions, monthRange.end, monthRange.start, recurringItems]);

  const mergedItems = useMemo(() => {
    const mappedTransactions = filteredTransactions.map((transaction) => ({
      kind: "transaction" as const,
      date: transaction.date,
      transaction,
    }));

    const mappedRecurring = pendingOccurrences.map((pending) => ({
      kind: "recurring" as const,
      date: pending.occurrenceDate,
      recurring: pending,
    }));

    return [...mappedTransactions, ...mappedRecurring].sort((a, b) => {
      const timeA = new Date(`${a.date}T00:00:00Z`).getTime();
      const timeB = new Date(`${b.date}T00:00:00Z`).getTime();
      if (timeA !== timeB) return timeB - timeA;
      if (a.kind === b.kind) return 0;
      return a.kind === "transaction" ? -1 : 1;
    });
  }, [filteredTransactions, pendingOccurrences]);

  // Calculate monthly summary
  const monthlySummary = useMemo(() => {
    let income = 0n;
    let expense = 0n;

    filteredTransactions.forEach((t) => {
      const amount = BigInt(t.amount_base_minor);
      if (t.type === "income") {
        income += amount;
      } else {
        expense += amount;
      }
    });

    const balance = income - expense;

    return { income, expense, balance };
  }, [filteredTransactions]);

  // Get currency symbol
  const currencySymbol =
    CURRENCIES.find((c) => c.code === baseCurrency)?.symbol || baseCurrency;

  const handleCreate = async () => {
    if (!canEdit) return;
    if (createKind === "obligation") {
      if (!obligationForm.name.trim()) {
        alert(tObligations("create.nameRequired"));
        return;
      }
      if (!obligationForm.amount.trim()) {
        alert(tObligations("create.amountRequired"));
        return;
      }
      if (!obligationForm.due_date.trim()) {
        alert(tObligations("create.dueDateRequired"));
        return;
      }

      setIsSubmitting(true);
      try {
        const result = await createObligation({
          account_id: accountId,
          name: obligationForm.name.trim(),
          amount: obligationForm.amount,
          currency: baseCurrency,
          due_date: obligationForm.due_date,
          status: obligationForm.status,
          paid_at:
            obligationForm.status === "paid"
              ? new Date().toISOString().slice(0, 10)
              : null,
        });

        if (result.success && result.data) {
          setIsCreateOpen(false);
          setCreateKind("transaction");
          setObligationForm({
            name: "",
            amount: "",
            due_date: new Date().toISOString().slice(0, 10),
            status: "pending",
          });
          router.replace("/transactions");
        } else {
          alert(
            result.error
              ? tGlobal(result.error.key, result.error.params)
              : tGlobal("errors.internalServer")
          );
        }
      } catch (error) {
        alert(tGlobal("errors.internalServer"));
      } finally {
        setIsSubmitting(false);
      }
      return;
    }
    if (!formData.amount.trim()) return;
    if (repeatConfig.enabled && formData.currency !== baseCurrency) {
      alert(t("repeat.baseCurrencyOnly"));
      return;
    }
    if (repeatConfig.enabled && Number(repeatConfig.interval) < 1) {
      alert(tGlobal("errors.invalidRequest"));
      return;
    }
    if (!validateFxRate()) return;

    setIsSubmitting(true);
    try {
      const result = repeatConfig.enabled
        ? await createRecurringItem({
            account_id: accountId,
            type: formData.type,
            amount: formData.amount,
            currency: formData.currency,
            category_id: formData.category_id || null,
            start_date: repeatConfig.startDate,
            frequency: repeatConfig.frequency,
            interval: Number(repeatConfig.interval),
            end_date: repeatConfig.endDate.trim() || null,
            merchant: formData.merchant || null,
            notes: formData.notes || null,
          })
        : await createTransaction({
            account_id: accountId,
            type: formData.type,
            amount: formData.amount,
            currency: formData.currency,
            fx_rate: requiresFxRate ? formData.fx_rate : null,
            category_id: formData.category_id || null,
            date: formData.date,
            merchant: formData.merchant || null,
            notes: formData.notes || null,
          });

      if (result.success && result.data) {
        if (repeatConfig.enabled) {
          setRecurringItems([result.data as RecurringItem, ...recurringItems]);
        } else {
          setTransactions([result.data as Transaction, ...transactions]);
        }
        setIsCreateOpen(false);
        setFormData({
          type: "expense",
          amount: "",
          currency: baseCurrency,
          fx_rate: "1",
          category_id: undefined,
          date: new Date().toISOString().slice(0, 10),
          merchant: "",
          notes: "",
        });
        setRepeatConfig({
          enabled: false,
          frequency: "monthly",
          interval: "1",
          startDate: new Date().toISOString().slice(0, 10),
          endDate: "",
        });
        router.refresh();
      } else {
        alert(
          result.error
            ? tGlobal(result.error.key, result.error.params)
            : repeatConfig.enabled
              ? t("repeat.createError")
              : t("createError")
        );
      }
    } catch (error) {
      alert(t("createError"));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = async () => {
    if (!canEdit) return;
    if (!selectedTransaction || !formData.amount.trim()) return;
    if (!validateFxRate()) return;

    setIsSubmitting(true);
    try {
      const result = await updateTransaction(selectedTransaction.id, {
        type: formData.type,
        amount: formData.amount,
        currency: formData.currency,
        fx_rate: requiresFxRate ? formData.fx_rate : null,
        category_id: formData.category_id || null,
        date: formData.date,
        merchant: formData.merchant || null,
        notes: formData.notes || null,
      });

      if (result.success && result.data) {
        setTransactions(
          transactions.map((t) =>
            t.id === selectedTransaction.id ? result.data! : t
          )
        );
        setIsEditOpen(false);
        setSelectedTransaction(null);
        setFormData({
          type: "expense",
          amount: "",
          currency: baseCurrency,
          fx_rate: "1",
          category_id: undefined,
          date: new Date().toISOString().slice(0, 10),
          merchant: "",
          notes: "",
        });
        router.refresh();
      } else {
        alert(
          result.error
            ? tGlobal(result.error.key, result.error.params)
            : t("updateError")
        );
      }
    } catch (error) {
      alert(t("updateError"));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!canEdit) return;
    if (!selectedTransaction) return;

    setIsSubmitting(true);
    try {
      const result = await deleteTransaction(selectedTransaction.id);

      if (result.success) {
        setTransactions(
          transactions.filter((t) => t.id !== selectedTransaction.id)
        );
        setIsDeleteOpen(false);
        setSelectedTransaction(null);
        router.refresh();
      } else {
        alert(
          result.error
            ? tGlobal(result.error.key, result.error.params)
            : t("deleteError")
        );
      }
    } catch (error) {
      alert(t("deleteError"));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmRecurring = async (pending: RecurringOccurrenceItem) => {
    if (!canEdit) return;
    setConfirmingKey(getOccurrenceKey(pending.item.id, pending.occurrenceDate));
    try {
      const result = await confirmRecurringTransaction({
        recurring_item_id: pending.item.id,
        occurrence_date: pending.occurrenceDate,
      });

      if (result.success && result.data) {
        setTransactions([result.data as Transaction, ...transactions]);
      } else if (!result.success) {
        alert(
          result.error
            ? tGlobal(result.error.key, result.error.params)
            : t("recurring.confirmError")
        );
      }
    } catch (error) {
      alert(t("recurring.confirmError"));
    } finally {
      setConfirmingKey(null);
    }
  };

  const openEditDialog = (transaction: Transaction) => {
    if (!canEdit) return;
    setSelectedTransaction(transaction);
    setFormData({
      type: transaction.type,
      amount: formatMinorToMoney(
        BigInt(transaction.amount_minor),
        transaction.currency,
        CURRENCY_MINOR_UNITS
      ),
      currency: transaction.currency,
      fx_rate: transaction.fx_rate ?? "1",
      category_id: transaction.category_id || undefined,
      date: transaction.date,
      merchant: transaction.merchant || "",
      notes: transaction.notes || "",
    });
    setIsEditOpen(true);
  };

  const openDeleteDialog = (transaction: Transaction) => {
    if (!canEdit) return;
    setSelectedTransaction(transaction);
    setIsDeleteOpen(true);
  };

  // Get available categories based on transaction type
  const availableCategories = categories.filter(
    (cat) => cat.type === formData.type
  );

  // Helper function to get monthly context for a date
  const getMonthContext = (dateString: string) => {
    const date = new Date(dateString + "T00:00:00");
    const monthName = date.toLocaleDateString(locale, {
      month: "long",
      year: "numeric",
    });
    const dateMonth = dateString.slice(0, 7);
    const isCurrent = dateMonth === currentMonth;

    return {
      monthName,
      isCurrent,
      message: isCurrent
        ? t("create.dateContextCurrent", { month: monthName })
        : t("create.dateContextOther", { month: monthName })
    };
  };

  return (
    <PageContainer className="space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <h1 className="text-3xl font-bold tracking-tight">{t("pageTitle")}</h1>
            <p className="text-muted-foreground">{t("pageDescription")}</p>
          </div>
          <Button
            variant="outline"
            onClick={() => setIsFiltersOpen(true)}
          >
            {t("filtersButton")}
          </Button>
        </div>
        {!canEdit && (
          <p className="text-sm text-muted-foreground">
            {t("readOnlyNotice")}
          </p>
        )}
      </div>

      <SlidePanel open={isFiltersOpen} onOpenChange={setIsFiltersOpen}>
        <SlidePanelContent>
          <SlidePanelHeader>
            <SlidePanelTitle>{t("filtersButton")}</SlidePanelTitle>
            <SlidePanelDescription>{t("filterByMonth")}</SlidePanelDescription>
          </SlidePanelHeader>
          <SlidePanelBody className="space-y-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <Button
                variant="outline"
                onClick={goToPreviousMonth}
                aria-label={t("previousMonth")}
              >
                {t("previousMonth")}
              </Button>
              <div className="flex flex-col items-center gap-1 text-center">
                <span className="text-lg font-semibold">
                  {formatMonthLabel(selectedMonth, locale)}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={openMonthPicker}
                  aria-label={t("openMonthPicker")}
                >
                  {t("openMonthPicker")}
                </Button>
              </div>
              <Button
                variant="outline"
                onClick={goToNextMonth}
                aria-label={t("nextMonth")}
              >
                {t("nextMonth")}
              </Button>
            </div>
            {isMonthPickerOpen && (
              <div className="space-y-4 rounded-lg border p-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>{t("monthPickerLabel")}</Label>
                    <Select
                      value={String(pickerMonthIndex)}
                      onValueChange={(value) =>
                        setPickerMonthIndex(Number(value))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {monthOptions.map((label, index) => (
                          <SelectItem key={label} value={String(index)}>
                            {label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>{t("yearPickerLabel")}</Label>
                    <Select
                      value={String(pickerYear)}
                      onValueChange={(value) => setPickerYear(Number(value))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {yearOptions.map((year) => (
                          <SelectItem key={year} value={String(year)}>
                            {year}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                  <Button
                    variant="outline"
                    onClick={() => setIsMonthPickerOpen(false)}
                  >
                    {tGlobal("common.cancel")}
                  </Button>
                  <Button onClick={applyMonthPicker}>
                    {t("applyMonthPicker")}
                  </Button>
                </div>
              </div>
            )}
          </SlidePanelBody>
        </SlidePanelContent>
      </SlidePanel>

      {/* Monthly Summary */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>{t("income")}</CardDescription>
            <CardTitle className="text-3xl" style={{ color: colors.state.positive }}>
              {formatMoneyWithSymbol(
                monthlySummary.income,
                baseCurrency,
                currencySymbol
              )}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>{t("expenses")}</CardDescription>
            <CardTitle className="text-3xl" style={{ color: colors.state.negative }}>
              {formatMoneyWithSymbol(
                monthlySummary.expense,
                baseCurrency,
                currencySymbol
              )}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>{t("balance")}</CardDescription>
            <CardTitle
              className="text-3xl"
              style={{
                color:
                  monthlySummary.balance >= 0n
                    ? colors.state.positive
                    : colors.state.negative,
              }}
            >
              {formatMoneyWithSymbol(
                monthlySummary.balance >= 0n
                  ? monthlySummary.balance
                  : -monthlySummary.balance,
                baseCurrency,
                monthlySummary.balance >= 0n ? currencySymbol : `-${currencySymbol}`
              )}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Transactions List */}
      <Card>
        <CardHeader>
          <CardTitle>
            {t("transactionsFor", {
              month: formatMonthLabel(selectedMonth, locale),
            })}
          </CardTitle>
          <CardDescription>
            {t("movimientosCount", { count: mergedItems.length })}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {mergedItems.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              {canEdit ? t("noTransactions") : t("noTransactionsReadOnly")}
            </p>
          ) : (
            <div className="space-y-2">
              {mergedItems.map((item) => {
                if (item.kind === "transaction") {
                  const transaction = item.transaction;
                  const category = transaction.category;
                  const amount = formatMoneyWithSymbol(
                    BigInt(transaction.amount_base_minor),
                    baseCurrency,
                    currencySymbol
                  );

                  return (
                    <div
                      key={transaction.id}
                      className={`flex items-center justify-between rounded-lg border p-4 transition-colors ${
                        canEdit ? "cursor-pointer hover:bg-muted/50" : ""
                      }`}
                      role={canEdit ? "button" : undefined}
                      tabIndex={canEdit ? 0 : undefined}
                      onClick={() => {
                        if (canEdit) openEditDialog(transaction);
                      }}
                      onKeyDown={(event) => {
                        if (!canEdit) return;
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          openEditDialog(transaction);
                        }
                      }}
                    >
                      <div className="flex items-start gap-4 flex-1">
                        <CategoryIcon
                          iconId={category?.icon_id}
                          size={20}
                          tone="muted"
                          accessibilityLabel={category?.name || undefined}
                        />

                        <div className="flex-1 min-w-0">
                          <div className="flex items-baseline gap-2">
                            <span className="font-medium">
                              {transaction.merchant ||
                                category?.name ||
                                t("create.categoryNone")}
                            </span>
                            {transaction.merchant && category && (
                              <span className="text-sm text-muted-foreground">
                                • {category.name}
                              </span>
                            )}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {new Date(transaction.date).toLocaleDateString()}
                            {transaction.notes && (
                              <span className="ml-2">• {transaction.notes}</span>
                            )}
                          </div>
                        </div>

                        <div
                          className="font-semibold text-lg"
                          style={{
                            color:
                              transaction.type === "income"
                                ? colors.state.positive
                                : colors.state.negative,
                          }}
                        >
                          {transaction.type === "income" ? "+" : "-"}
                          {amount}
                        </div>

                        {canEdit && (
                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={(event) => {
                                event.stopPropagation();
                                openDeleteDialog(transaction);
                              }}
                            >
                              {t("deleteButton")}
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                }

                const recurring = item.recurring;
                const category = categories.find(
                  (cat) => cat.id === recurring.item.category_id
                );
                const amount = formatMoneyWithSymbol(
                  BigInt(recurring.item.amount_minor),
                  recurring.item.currency,
                  CURRENCIES.find((c) => c.code === recurring.item.currency)?.symbol ||
                    recurring.item.currency
                );
                const confirmKey = getOccurrenceKey(
                  recurring.item.id,
                  recurring.occurrenceDate
                );

                return (
                  <div
                    key={confirmKey}
                    className="flex items-center justify-between rounded-lg border p-4 hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-start gap-4 flex-1">
                      <CategoryIcon
                        iconId={category?.icon_id}
                        size={20}
                        tone="muted"
                        accessibilityLabel={category?.name || undefined}
                      />

                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline gap-2">
                          <span className="font-medium">
                            {recurring.item.merchant ||
                              category?.name ||
                              t("create.categoryNone")}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            • {t("recurring.pendingLabel")}
                          </span>
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {new Date(recurring.occurrenceDate).toLocaleDateString()}
                          {recurring.item.notes && (
                            <span className="ml-2">• {recurring.item.notes}</span>
                          )}
                        </div>
                      </div>

                      <div
                        className="font-semibold text-lg"
                        style={{
                          color:
                            recurring.item.type === "income"
                              ? colors.state.positive
                              : colors.state.negative,
                        }}
                      >
                        {recurring.item.type === "income" ? "+" : "-"}
                        {amount}
                      </div>

                      {canEdit && (
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleConfirmRecurring(recurring)}
                            disabled={confirmingKey === confirmKey}
                          >
                            {confirmingKey === confirmKey
                              ? t("recurring.confirming")
                              : t("recurring.confirmAction")}
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create Panel */}
      {canEdit && (
        <SlidePanel open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <SlidePanelContent>
            <SlidePanelHeader>
              <SlidePanelTitle>
                {createKind === "obligation"
                  ? tObligations("create.title")
                  : t("create.title")}
              </SlidePanelTitle>
              <SlidePanelDescription>
                {createKind === "obligation"
                  ? tObligations("create.description")
                  : t("create.description")}
              </SlidePanelDescription>
            </SlidePanelHeader>
            <SlidePanelBody>
              {createKind === "obligation" ? (
                <div className="grid gap-6">
                  <div className="space-y-3">
                    <Label htmlFor="obligation-name">
                      {tObligations("create.nameLabel")}
                    </Label>
                    <Input
                      id="obligation-name"
                      value={obligationForm.name}
                      onChange={(e) =>
                        setObligationForm((prev) => ({
                          ...prev,
                          name: e.target.value,
                        }))
                      }
                      placeholder={tObligations("create.namePlaceholder")}
                    />
                  </div>
                  <div className="space-y-3">
                    <Label htmlFor="obligation-amount">
                      {tObligations("create.amountLabel")}
                    </Label>
                    <Input
                      id="obligation-amount"
                      type="text"
                      value={obligationForm.amount}
                      onChange={(e) =>
                        setObligationForm((prev) => ({
                          ...prev,
                          amount: sanitizeNumericInput(e.target.value),
                        }))
                      }
                      placeholder={tObligations("create.amountPlaceholder")}
                    />
                    <p className="text-xs text-muted-foreground">
                      {tObligations("create.currencyHelper", {
                        currency: baseCurrency,
                      })}
                    </p>
                  </div>
                  <div className="space-y-3">
                    <Label htmlFor="obligation-due-date">
                      {tObligations("create.dueDateLabel")}
                    </Label>
                    <Input
                      id="obligation-due-date"
                      type="date"
                      value={obligationForm.due_date}
                      onChange={(e) =>
                        setObligationForm((prev) => ({
                          ...prev,
                          due_date: e.target.value,
                        }))
                      }
                    />
                  </div>
                  <div className="space-y-3">
                    <Label>{tObligations("create.statusLabel")}</Label>
                    <Select
                      value={obligationForm.status}
                      onValueChange={(value) =>
                        setObligationForm((prev) => ({
                          ...prev,
                          status: value as "pending" | "paid",
                        }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pending">
                          {tObligations("create.statusPending")}
                        </SelectItem>
                        <SelectItem value="paid">
                          {tObligations("create.statusPaid")}
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      {tObligations("create.statusHelper")}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="grid gap-6">
                  {/* 1. Transaction Type - Pill Selector */}
                  <div className="space-y-3">
                    <Label>{t("create.typeLabel")}</Label>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant={
                          formData.type === "expense" ? "default" : "outline"
                        }
                        className="flex-1"
                        aria-pressed={formData.type === "expense"}
                        onClick={() =>
                          setFormData({
                            ...formData,
                            type: "expense",
                            category_id: undefined,
                          })
                        }
                      >
                        {t("create.typeExpense")}
                      </Button>
                      <Button
                        type="button"
                        variant={
                          formData.type === "income" ? "default" : "outline"
                        }
                        className="flex-1"
                        aria-pressed={formData.type === "income"}
                        onClick={() =>
                          setFormData({
                            ...formData,
                            type: "income",
                            category_id: undefined,
                          })
                        }
                      >
                        {t("create.typeIncome")}
                      </Button>
                    </div>
                  </div>

                  {/* 2. Date with Monthly Context */}
                  <div className="space-y-3">
                    <Label htmlFor="date">{t("create.dateLabel")}</Label>
                    <Input
                      id="date"
                      type="date"
                      value={formData.date}
                      onChange={(e) =>
                        setFormData({ ...formData, date: e.target.value })
                      }
                    />
                    <p
                      className={`text-sm ${
                        getMonthContext(formData.date).isCurrent
                          ? "text-muted-foreground"
                          : "text-amber-600"
                      }`}
                    >
                      {getMonthContext(formData.date).message}
                    </p>
                  </div>

                  {createKind === "transaction" && (
                    <div className="space-y-3">
                      <Label>{t("repeat.label")}</Label>
                      <label className="flex items-center gap-3 text-sm text-muted-foreground">
                        <input
                          type="checkbox"
                          checked={repeatConfig.enabled}
                          onChange={(event) => {
                            const enabled = event.target.checked;
                            setRepeatConfig((prev) => ({
                              ...prev,
                              enabled,
                              startDate: prev.startDate || formData.date,
                            }));
                            if (enabled && formData.currency !== baseCurrency) {
                              setFormData((prev) => ({
                                ...prev,
                                currency: baseCurrency,
                                fx_rate: "1",
                              }));
                            }
                          }}
                        />
                        {t("repeat.helper")}
                      </label>
                    </div>
                  )}

                  {repeatConfig.enabled && (
                    <div className="grid gap-4 rounded-lg border p-4">
                      <div className="space-y-2">
                        <Label>{t("repeat.frequencyLabel")}</Label>
                        <Select
                          value={repeatConfig.frequency}
                          onValueChange={(value) =>
                            setRepeatConfig((prev) => ({
                              ...prev,
                              frequency: value as RecurringFrequency,
                            }))
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="weekly">
                              {t("repeat.weekly")}
                            </SelectItem>
                            <SelectItem value="monthly">
                              {t("repeat.monthly")}
                            </SelectItem>
                            <SelectItem value="yearly">
                              {t("repeat.yearly")}
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>{t("repeat.intervalLabel")}</Label>
                        <Input
                          value={repeatConfig.interval}
                          onChange={(e) =>
                            setRepeatConfig((prev) => ({
                              ...prev,
                              interval: e.target.value.replace(/[^0-9]/g, ""),
                            }))
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>{t("repeat.startDateLabel")}</Label>
                        <Input
                          type="date"
                          value={repeatConfig.startDate}
                          onChange={(e) =>
                            setRepeatConfig((prev) => ({
                              ...prev,
                              startDate: e.target.value,
                            }))
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>{t("repeat.endDateLabel")}</Label>
                        <Input
                          type="date"
                          value={repeatConfig.endDate}
                          onChange={(e) =>
                            setRepeatConfig((prev) => ({
                              ...prev,
                              endDate: e.target.value,
                            }))
                          }
                        />
                      </div>
                    </div>
                  )}

                  {/* 3. Amount + Currency (Grouped) */}
                  <div className="space-y-3">
                    <Label>{t("create.amountLabel")}</Label>
                    <div className="flex gap-2">
                      <Input
                        id="amount"
                        type="text"
                        value={formData.amount}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            amount: sanitizeNumericInput(e.target.value),
                          })
                        }
                        placeholder={t("create.amountPlaceholder")}
                        className="flex-1"
                      />
                      <Select
                        value={formData.currency}
                        onValueChange={(value) =>
                          setFormData({
                            ...formData,
                            currency: value,
                            fx_rate:
                              value === baseCurrency ? "1" : formData.fx_rate,
                          })
                        }
                        disabled={repeatConfig.enabled}
                      >
                        <SelectTrigger className="w-32">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {CURRENCIES.map((curr) => (
                            <SelectItem key={curr.code} value={curr.code}>
                              {curr.code}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {requiresFxRate && (
                    <div className="space-y-2">
                      <Label htmlFor="fx-rate">{t("fxRateLabel")}</Label>
                      <Input
                        id="fx-rate"
                        type="text"
                        value={formData.fx_rate}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            fx_rate: sanitizeNumericInput(e.target.value),
                          })
                        }
                        placeholder={t("fxRatePlaceholder")}
                      />
                      <p className="text-xs text-muted-foreground">
                        {t("fxRateHelper", {
                          currency: formData.currency,
                          baseCurrency,
                        })}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {t("baseAmountPreview", {
                          amount: previewBaseAmount ?? "-",
                          baseCurrency,
                        })}
                      </p>
                    </div>
                  )}

                  {/* Separator for Optional Fields */}
                  <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                      <span className="w-full border-t" />
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                      <span className="bg-background px-2 text-muted-foreground">
                        {t("create.optionalSeparator")}
                      </span>
                    </div>
                  </div>

                  {/* 4. Optional Fields */}
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="category">
                        {t("create.categoryLabel")}
                      </Label>
                      <Select
                        value={formData.category_id || "none"}
                        onValueChange={(value) =>
                          setFormData({
                            ...formData,
                            category_id: value === "none" ? undefined : value,
                          })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue
                            placeholder={t("create.categoryPlaceholder")}
                          />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">
                            {t("create.categoryNone")}
                          </SelectItem>
                          {availableCategories.length === 0 ? (
                            <SelectItem value="empty" disabled>
                              {t("create.categoryEmpty", {
                                type:
                                  formData.type === "income"
                                    ? t("income")
                                    : t("expenses"),
                              })}
                            </SelectItem>
                          ) : (
                            availableCategories.map((cat) => (
                              <SelectItem key={cat.id} value={cat.id}>
                                <span className="flex items-center gap-2">
                                  <CategoryIcon
                                    iconId={cat.icon_id}
                                    size={16}
                                    tone="muted"
                                    accessibilityLabel={cat.name}
                                  />
                                  <span>{cat.name}</span>
                                </span>
                              </SelectItem>
                            ))
                          )}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="merchant">
                        {t("create.merchantLabel")}
                      </Label>
                      <Input
                        id="merchant"
                        value={formData.merchant}
                        onChange={(e) =>
                          setFormData({ ...formData, merchant: e.target.value })
                        }
                        placeholder={t("create.merchantPlaceholder")}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="notes">{t("create.notesLabel")}</Label>
                      <Textarea
                        id="notes"
                        value={formData.notes}
                        onChange={(e) =>
                          setFormData({ ...formData, notes: e.target.value })
                        }
                        placeholder={t("create.notesPlaceholder")}
                        rows={3}
                      />
                    </div>
                  </div>
                </div>
              )}
            </SlidePanelBody>
            <SlidePanelFooter>
              <Button
                variant="outline"
                onClick={() => setIsCreateOpen(false)}
                disabled={isSubmitting}
              >
                {t("create.cancel")}
              </Button>
              <Button onClick={handleCreate} disabled={isSubmitting}>
                {isSubmitting ? t("create.saving") : t("create.save")}
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
              <SlidePanelTitle>{t("edit.title")}</SlidePanelTitle>
              <SlidePanelDescription>{t("edit.description")}</SlidePanelDescription>
            </SlidePanelHeader>
            <SlidePanelBody>
              <div className="grid gap-6">
                {/* 1. Transaction Type - Pill Selector */}
                <div className="space-y-3">
                  <Label>{t("create.typeLabel")}</Label>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant={
                        formData.type === "expense" ? "default" : "outline"
                      }
                      className="flex-1"
                      aria-pressed={formData.type === "expense"}
                      onClick={() =>
                        setFormData({
                          ...formData,
                          type: "expense",
                          category_id: undefined,
                        })
                      }
                    >
                      {t("create.typeExpense")}
                    </Button>
                    <Button
                      type="button"
                      variant={formData.type === "income" ? "default" : "outline"}
                      className="flex-1"
                      aria-pressed={formData.type === "income"}
                      onClick={() =>
                        setFormData({
                          ...formData,
                          type: "income",
                          category_id: undefined,
                        })
                      }
                    >
                      {t("create.typeIncome")}
                    </Button>
                  </div>
                </div>

                {/* 2. Date with Monthly Context */}
                <div className="space-y-3">
                  <Label htmlFor="edit-date">{t("create.dateLabel")}</Label>
                  <Input
                    id="edit-date"
                    type="date"
                    value={formData.date}
                    onChange={(e) =>
                      setFormData({ ...formData, date: e.target.value })
                    }
                  />
                  <p
                    className={`text-sm ${
                      getMonthContext(formData.date).isCurrent
                        ? "text-muted-foreground"
                        : "text-amber-600"
                    }`}
                  >
                    {getMonthContext(formData.date).message}
                  </p>
                </div>

                {/* 3. Amount + Currency (Grouped) */}
                <div className="space-y-3">
                  <Label>{t("create.amountLabel")}</Label>
                  <div className="flex gap-2">
                    <Input
                      id="edit-amount"
                      type="text"
                      value={formData.amount}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          amount: sanitizeNumericInput(e.target.value),
                        })
                      }
                      placeholder={t("create.amountPlaceholder")}
                      className="flex-1"
                    />
                    <Select
                      value={formData.currency}
                      onValueChange={(value) =>
                        setFormData({
                          ...formData,
                          currency: value,
                          fx_rate:
                            value === baseCurrency ? "1" : formData.fx_rate,
                        })
                      }
                    >
                      <SelectTrigger className="w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {CURRENCIES.map((curr) => (
                          <SelectItem key={curr.code} value={curr.code}>
                            {curr.code}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {requiresFxRate && (
                  <div className="space-y-2">
                    <Label htmlFor="edit-fx-rate">{t("fxRateLabel")}</Label>
                    <Input
                      id="edit-fx-rate"
                      type="text"
                      value={formData.fx_rate}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          fx_rate: sanitizeNumericInput(e.target.value),
                        })
                      }
                      placeholder={t("fxRatePlaceholder")}
                    />
                    <p className="text-xs text-muted-foreground">
                      {t("fxRateHelper", {
                        currency: formData.currency,
                        baseCurrency,
                      })}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {t("baseAmountPreview", {
                        amount: previewBaseAmount ?? "-",
                        baseCurrency,
                      })}
                    </p>
                  </div>
                )}

                {/* Separator for Optional Fields */}
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-background px-2 text-muted-foreground">
                      {t("create.optionalSeparator")}
                    </span>
                  </div>
                </div>

                {/* 4. Optional Fields */}
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="edit-category">
                      {t("create.categoryLabel")}
                    </Label>
                    <Select
                      value={formData.category_id || "none"}
                      onValueChange={(value) =>
                        setFormData({
                          ...formData,
                          category_id: value === "none" ? undefined : value,
                        })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue
                          placeholder={t("create.categoryPlaceholder")}
                        />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">
                          {t("create.categoryNone")}
                        </SelectItem>
                        {availableCategories.length === 0 ? (
                          <SelectItem value="empty" disabled>
                            {t("create.categoryEmpty", {
                              type:
                                formData.type === "income"
                                  ? t("income")
                                  : t("expenses"),
                            })}
                          </SelectItem>
                        ) : (
                          availableCategories.map((cat) => (
                            <SelectItem key={cat.id} value={cat.id}>
                              <span className="flex items-center gap-2">
                                <CategoryIcon
                                  iconId={cat.icon_id}
                                  size={16}
                                  tone="muted"
                                  accessibilityLabel={cat.name}
                                />
                                <span>{cat.name}</span>
                              </span>
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="edit-merchant">
                      {t("create.merchantLabel")}
                    </Label>
                    <Input
                      id="edit-merchant"
                      value={formData.merchant}
                      onChange={(e) =>
                        setFormData({ ...formData, merchant: e.target.value })
                      }
                      placeholder={t("create.merchantPlaceholder")}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="edit-notes">{t("create.notesLabel")}</Label>
                    <Textarea
                      id="edit-notes"
                      value={formData.notes}
                      onChange={(e) =>
                        setFormData({ ...formData, notes: e.target.value })
                      }
                      placeholder={t("create.notesPlaceholder")}
                      rows={3}
                    />
                  </div>
                </div>
              </div>
            </SlidePanelBody>
            <SlidePanelFooter>
              <Button
                variant="outline"
                onClick={() => setIsEditOpen(false)}
                disabled={isSubmitting}
              >
                {t("create.cancel")}
              </Button>
              <Button onClick={handleEdit} disabled={isSubmitting}>
                {isSubmitting ? t("create.saving") : t("create.save")}
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
              <AlertDialogTitle>{t("delete.title")}</AlertDialogTitle>
              <AlertDialogDescription>
                {t("delete.description")}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isSubmitting}>
                {t("delete.cancel")}
              </AlertDialogCancel>
              <AlertDialogAction onClick={handleDelete} disabled={isSubmitting}>
                {isSubmitting ? t("delete.deleting") : t("delete.confirm")}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </PageContainer>
  );
}
