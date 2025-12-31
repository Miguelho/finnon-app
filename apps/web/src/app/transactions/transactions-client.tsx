"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
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
  CURRENCIES,
  formatMinorToMoney,
  formatMoneyWithSymbol,
  getIconById,
  parseMoneyToMinor,
  computeAmountBaseMinor,
  parseFxRate,
  CURRENCY_MINOR_UNITS,
} from "@poleursus/shared";
import {
  createTransaction,
  updateTransaction,
  deleteTransaction,
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
};

type TransactionsClientProps = {
  accountId: string;
  baseCurrency: string;
  initialTransactions: Transaction[];
  categories: Category[];
  role: "viewer" | "contributor" | "admin";
};

export function TransactionsClient({
  accountId,
  baseCurrency,
  initialTransactions,
  categories,
  role,
}: TransactionsClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tGlobal = useTranslations();
  const t = useTranslations("transactions");
  const locale = useLocale();
  const [transactions, setTransactions] = useState(initialTransactions);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [selectedTransaction, setSelectedTransaction] =
    useState<Transaction | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const canEdit = role !== "viewer";

  // Month filter state (format: YYYY-MM)
  const currentMonth = new Date().toISOString().slice(0, 7);
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);

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
    const typeParam = searchParams.get("type");
    if (typeParam === "income" || typeParam === "expense") {
      setFormData((prev) => ({
        ...prev,
        type: typeParam as TransactionType,
        category_id: undefined,
      }));
    }
  }, [searchParams]);

  // Filter transactions by selected month
  const filteredTransactions = useMemo(() => {
    return transactions.filter((t) => t.date.startsWith(selectedMonth));
  }, [transactions, selectedMonth]);

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
    if (!formData.amount.trim()) return;
    if (!validateFxRate()) return;

    setIsSubmitting(true);
    try {
      const result = await createTransaction({
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
        setTransactions([result.data, ...transactions]);
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
        router.refresh();
      } else {
        alert(
          result.error
            ? tGlobal(result.error.key, result.error.params)
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
    <div className="min-h-screen bg-background p-4">
      <div className="mx-auto max-w-6xl space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{t("pageTitle")}</h1>
            <p className="text-muted-foreground">
              {t("pageDescription")}
            </p>
            {!canEdit && (
              <p className="text-sm text-muted-foreground">
                {t("readOnlyNotice")}
              </p>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => router.push("/")}>
              {t("backToDashboard")}
            </Button>
            <Button onClick={() => setIsCreateOpen(true)} disabled={!canEdit}>
              {t("newTransaction")}
            </Button>
          </div>
        </div>

        {/* Month Filter */}
        <Card>
          <CardHeader>
            <CardTitle>{t("filterByMonth")}</CardTitle>
          </CardHeader>
          <CardContent>
            <Input
              type="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="max-w-xs"
            />
          </CardContent>
        </Card>

        {/* Monthly Summary */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>{t("income")}</CardDescription>
              <CardTitle className="text-3xl text-green-600">
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
              <CardTitle className="text-3xl text-red-600">
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
                className={`text-3xl ${
                  monthlySummary.balance >= 0n
                    ? "text-green-600"
                    : "text-red-600"
                }`}
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
                month: new Date(selectedMonth + "-01").toLocaleDateString(locale, {
                  month: "long",
                  year: "numeric",
                }),
              })}
            </CardTitle>
            <CardDescription>
              {t("transactionsCount", { count: filteredTransactions.length })}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {filteredTransactions.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                {canEdit ? t("noTransactions") : t("noTransactionsReadOnly")}
              </p>
            ) : (
              <div className="space-y-2">
                {filteredTransactions.map((transaction) => {
                  const category = transaction.category;
                  const icon = category ? getIconById(category.icon_id) : null;
                  const amount = formatMoneyWithSymbol(
                    BigInt(transaction.amount_base_minor),
                    baseCurrency,
                    currencySymbol
                  );

                  return (
                    <div
                      key={transaction.id}
                      className="flex items-center justify-between rounded-lg border p-4 hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-start gap-4 flex-1">
                        {/* Icon */}
                        <div className="text-2xl">
                          {icon?.emoji || (transaction.type === "income" ? "💰" : "💸")}
                        </div>

                        {/* Details */}
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

                        {/* Amount */}
                        <div
                          className={`font-semibold text-lg ${
                            transaction.type === "income"
                              ? "text-green-600"
                              : "text-red-600"
                          }`}
                        >
                          {transaction.type === "income" ? "+" : "-"}
                          {amount}
                        </div>

                        {/* Actions */}
                        {canEdit && (
                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => openEditDialog(transaction)}
                            >
                              {t("editButton")}
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => openDeleteDialog(transaction)}
                            >
                              {t("deleteButton")}
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
              <SlidePanelTitle>{t("create.title")}</SlidePanelTitle>
              <SlidePanelDescription>
                {t("create.description")}
              </SlidePanelDescription>
            </SlidePanelHeader>
            <SlidePanelBody>
              <div className="grid gap-6">
              {/* 1. Transaction Type - Pill Selector */}
              <div className="space-y-3">
                <Label>{t("create.typeLabel")}</Label>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    className={`flex-1 transition-colors ${
                      formData.type === "expense"
                        ? "bg-[#5B8DFF] text-white border-[#5B8DFF] hover:bg-[#4A7AE8] hover:border-[#4A7AE8]"
                        : "bg-[#FFFFFF] text-[#1C1E21] border-[#DADCE0] hover:bg-[#F7F8FA]"
                    }`}
                    onClick={() => setFormData({ ...formData, type: "expense", category_id: undefined })}
                  >
                    {t("create.typeExpense")}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className={`flex-1 transition-colors ${
                      formData.type === "income"
                        ? "bg-[#5B8DFF] text-white border-[#5B8DFF] hover:bg-[#4A7AE8] hover:border-[#4A7AE8]"
                        : "bg-[#FFFFFF] text-[#1C1E21] border-[#DADCE0] hover:bg-[#F7F8FA]"
                    }`}
                    onClick={() => setFormData({ ...formData, type: "income", category_id: undefined })}
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
                <p className={`text-sm ${getMonthContext(formData.date).isCurrent ? "text-muted-foreground" : "text-amber-600"}`}>
                  {getMonthContext(formData.date).message}
                </p>
              </div>

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
                        fx_rate: value === baseCurrency ? "1" : formData.fx_rate,
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
                  <Label htmlFor="category">{t("create.categoryLabel")}</Label>
                  <Select
                    value={formData.category_id || "none"}
                    onValueChange={(value) =>
                      setFormData({ ...formData, category_id: value === "none" ? undefined : value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={t("create.categoryPlaceholder")} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">{t("create.categoryNone")}</SelectItem>
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
                            {getIconById(cat.icon_id)?.emoji || "📦"} {cat.name}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="merchant">{t("create.merchantLabel")}</Label>
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
                    variant="outline"
                    className={`flex-1 transition-colors ${
                      formData.type === "expense"
                        ? "bg-[#5B8DFF] text-white border-[#5B8DFF] hover:bg-[#4A7AE8] hover:border-[#4A7AE8]"
                        : "bg-[#FFFFFF] text-[#1C1E21] border-[#DADCE0] hover:bg-[#F7F8FA]"
                    }`}
                    onClick={() => setFormData({ ...formData, type: "expense", category_id: undefined })}
                  >
                    {t("create.typeExpense")}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className={`flex-1 transition-colors ${
                      formData.type === "income"
                        ? "bg-[#5B8DFF] text-white border-[#5B8DFF] hover:bg-[#4A7AE8] hover:border-[#4A7AE8]"
                        : "bg-[#FFFFFF] text-[#1C1E21] border-[#DADCE0] hover:bg-[#F7F8FA]"
                    }`}
                    onClick={() => setFormData({ ...formData, type: "income", category_id: undefined })}
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
                <p className={`text-sm ${getMonthContext(formData.date).isCurrent ? "text-muted-foreground" : "text-amber-600"}`}>
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
                        fx_rate: value === baseCurrency ? "1" : formData.fx_rate,
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
                  <Label htmlFor="edit-category">{t("create.categoryLabel")}</Label>
                  <Select
                    value={formData.category_id || "none"}
                    onValueChange={(value) =>
                      setFormData({ ...formData, category_id: value === "none" ? undefined : value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={t("create.categoryPlaceholder")} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">{t("create.categoryNone")}</SelectItem>
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
                            {getIconById(cat.icon_id)?.emoji || "📦"} {cat.name}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="edit-merchant">{t("create.merchantLabel")}</Label>
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
      </div>
    </div>
  );
}
