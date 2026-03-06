"use client";

import { useEffect, useMemo, useState, useRef, useCallback } from "react";
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
  withAlpha,
  isFutureDay,
  ConfirmationModal,
  type AvatarColorToken,
  type UserAvatarColorId,
  type TopCategory,
  type MerchantSuggestion,
  type TransactionDraft,
} from "@poleursus/shared";
import { MerchantAutocomplete } from "@/components/ui/merchant-autocomplete";
import { CategoryIcon } from "@/components/category-icon";
import { TopCategorySelector } from "@/components/categories/top-category-selector";
import { TransactionTile } from "@/components/transactions/transaction-tile";
import { AddTransactionForm } from "@/components/add-transaction";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Info,
  PlusCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
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
  project_id?: string | null;
  date: string;
  merchant: string | null;
  merchant_norm?: string | null;
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

type Profile = {
  user_id: string;
  email: string | null;
  display_name: string | null;
  avatar_path: string | null;
  avatar_fallback_text: string | null;
  avatar_fallback_bg_token: AvatarColorToken | null;
  avatar_color: UserAvatarColorId | null;
};

type TransactionsClientProps = {
  accountId: string;
  baseCurrency: string;
  initialTransactions: Transaction[];
  initialRecurringItems: RecurringItem[];
  categories: Category[];
  profiles: Profile[];
  role: "viewer" | "contributor" | "admin";
  initialTopCategories: {
    expense: TopCategory[];
    income: TopCategory[];
  };
  initialMerchantSuggestions: {
    expense: MerchantSuggestion[];
    income: MerchantSuggestion[];
  };
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

const isValidMonthKey = (value?: string | null) =>
  Boolean(value && /^\d{4}-\d{2}$/.test(value));

const normalizeMerchantLite = (value?: string | null) =>
  (value ?? "").trim().toLowerCase();

const formatMerchantLabel = (value: string) =>
  value
    .split(" ")
    .filter(Boolean)
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(" ");

const getMonthRangeFromKey = (monthKey: string) => {
  const { year, monthIndex } = parseMonthKey(monthKey);
  const start = `${monthKey}-01`;
  const end = new Date(Date.UTC(year, monthIndex + 1, 0))
    .toISOString()
    .slice(0, 10);
  return { start, end };
};

const tokens = themeTokens.light;
const colors = tokens.colors;

type SummaryValueWithPendingChipProps = {
  value: string;
  pendingMinor: bigint;
  pendingText: string;
  triggerLabel: string;
  valueColor?: string;
  pendingToneColor?: string;
};

function SummaryValueWithPendingChip({
  value,
  pendingMinor,
  pendingText,
  triggerLabel,
  valueColor,
  pendingToneColor,
}: SummaryValueWithPendingChipProps) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const hasPending = pendingMinor > 0n;

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        popoverRef.current?.contains(target) ||
        triggerRef.current?.contains(target)
      ) {
        return;
      }
      setOpen(false);
    };
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [open]);

  const pendingTextColor = pendingToneColor
    ? withAlpha(pendingToneColor, 0.65)
    : colors.text.secondary;

  return (
    <div className="relative inline-flex items-center gap-2">
      <CardTitle className="text-lg md:text-2xl" style={{ color: valueColor }}>
        {value}
      </CardTitle>
      {hasPending ? (
        <>
          <button
            type="button"
            ref={triggerRef}
            aria-label={triggerLabel}
            aria-expanded={open}
            onClick={() => setOpen((prev) => !prev)}
            className="flex h-6 w-6 items-center justify-center rounded-full text-muted-foreground transition hover:text-foreground"
          >
            <PlusCircle className="h-4 w-4" />
          </button>
          {open ? (
            <div
              ref={popoverRef}
              className="absolute right-0 top-full z-20 mt-2 whitespace-nowrap rounded-full border bg-background px-3 py-1 text-xs shadow-sm animate-in fade-in-0 zoom-in-95"
              style={{
                borderColor: colors.state.neutral,
                color: pendingTextColor,
              }}
            >
              {pendingText}
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

type MovementsLegendTooltipProps = {
  legendText: string;
  incomeLabel: string;
  expenseLabel: string;
  triggerLabel: string;
};

function MovementsLegendTooltip({
  legendText,
  incomeLabel,
  expenseLabel,
  triggerLabel,
}: MovementsLegendTooltipProps) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        popoverRef.current?.contains(target) ||
        triggerRef.current?.contains(target)
      ) {
        return;
      }
      setOpen(false);
    };
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [open]);

  return (
    <div className="relative inline-flex items-center">
      <button
        type="button"
        ref={triggerRef}
        aria-label={triggerLabel}
        aria-expanded={open}
        onClick={() => setOpen((prev) => !prev)}
        className="flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground transition hover:text-foreground"
      >
        <Info className="h-4 w-4" />
      </button>
      {open ? (
        <div
          ref={popoverRef}
          className="absolute right-0 top-full z-20 mt-2 w-64 rounded-lg border px-3 py-2 text-xs shadow-sm"
          style={{
            backgroundColor: colors.bg.surface,
            borderColor: colors.state.neutral,
            color: colors.text.secondary,
          }}
        >
          <p className="text-xs">{legendText}</p>
          <div className="mt-2 flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <span
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: withAlpha(colors.state.positive, 0.45) }}
              />
              <span>{incomeLabel}</span>
            </div>
            <div className="flex items-center gap-2">
              <span
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: withAlpha(colors.state.negative, 0.45) }}
              />
              <span>{expenseLabel}</span>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function TransactionsClient({
  accountId,
  baseCurrency,
  initialTransactions,
  initialRecurringItems,
  categories,
  profiles,
  role,
  initialTopCategories,
  initialMerchantSuggestions,
}: TransactionsClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tGlobal = useTranslations();
  const t = useTranslations("transactions");
  const tObligations = useTranslations("obligations");
  const translateDynamic = (key: string, params?: Record<string, unknown>) =>
    tGlobal(key as never, params as never);
  const locale = useLocale();
  const monthParam = searchParams?.get("month");
  const [transactions, setTransactions] = useState(initialTransactions);
  const [recurringItems, setRecurringItems] = useState(initialRecurringItems);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isCreateSuccessOpen, setIsCreateSuccessOpen] = useState(false);
  const [createSuccessMessage, setCreateSuccessMessage] = useState<string | null>(
    null
  );
  const [selectedTransaction, setSelectedTransaction] =
    useState<Transaction | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [confirmingKey, setConfirmingKey] = useState<string | null>(null);
  const [createKind, setCreateKind] = useState<
    "transaction" | "recurring" | "obligation"
  >("transaction");
  const canEdit = role !== "viewer";

  const openCreateSuccess = (message: string) => {
    setCreateSuccessMessage(message);
    setIsCreateSuccessOpen(true);
  };

  const closeCreateSuccess = () => {
    setIsCreateSuccessOpen(false);
    setCreateSuccessMessage(null);
  };

  // Top categories state - initialized from server-fetched data
  const [topCategories, setTopCategories] = useState<TopCategory[]>(
    initialTopCategories.expense
  );
  const [showFullCategorySelector, setShowFullCategorySelector] = useState(false);
  const [showFullCategorySelectorEdit, setShowFullCategorySelectorEdit] = useState(false);

  // Month filter state (format: YYYY-MM)
  const currentMonth = toMonthKey(new Date());
  const initialMonth = isValidMonthKey(monthParam) ? monthParam! : currentMonth;
  const [selectedMonth, setSelectedMonth] = useState(initialMonth);
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
  const profilesById = useMemo(
    () =>
      profiles.reduce<Record<string, Profile>>((acc, profile) => {
        acc[profile.user_id] = profile;
        return acc;
      }, {}),
    [profiles]
  );
  const categoriesById = useMemo(
    () =>
      categories.reduce<Record<string, Category>>((acc, category) => {
        acc[category.id] = category;
        return acc;
      }, {}),
    [categories]
  );
  const transactionsById = useMemo(
    () => new Map(transactions.map((transaction) => [transaction.id, transaction])),
    [transactions]
  );

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
    const dateParam = searchParams.get("date");
    if (dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
      setFormData((prev) => ({
        ...prev,
        date: dateParam,
      }));
      setRepeatConfig((prev) => ({
        ...prev,
        startDate: dateParam,
      }));
      setObligationForm((prev) => ({
        ...prev,
        due_date: dateParam,
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

  useEffect(() => {
    if (!isValidMonthKey(monthParam)) return;
    setSelectedMonth(monthParam!);
  }, [monthParam]);

  // Update top categories when transaction type changes
  useEffect(() => {
    setTopCategories(initialTopCategories[formData.type]);
  }, [formData.type, initialTopCategories]);

  // Reset full category selector visibility when form opens
  useEffect(() => {
    if (isCreateOpen && createKind !== "obligation") {
      setShowFullCategorySelector(false);
    }
  }, [isCreateOpen, createKind]);

  // Reset full category selector visibility when edit form opens
  useEffect(() => {
    if (isEditOpen) {
      setShowFullCategorySelectorEdit(false);
    }
  }, [isEditOpen]);

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
  const monthTransactions = useMemo(() => {
    return transactions.filter((t) => t.date.startsWith(selectedMonth));
  }, [transactions, selectedMonth]);

  const monthRange = useMemo(
    () => getMonthRangeFromKey(selectedMonth),
    [selectedMonth]
  );

  const pendingOccurrences = useMemo<RecurringOccurrenceItem[]>(() => {
    if (!recurringItems.length) return [];
    const existingKeys = new Set(
      monthTransactions
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
  }, [monthTransactions, monthRange.end, monthRange.start, recurringItems]);

  const mergedItems = useMemo(() => {
    const mappedTransactions = monthTransactions.map((transaction) => ({
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
  }, [monthTransactions, pendingOccurrences]);

  const movementCounts = useMemo(() => {
    let income = 0;
    let expense = 0;
    let pending = 0;

    mergedItems.forEach((item) => {
      const type =
        item.kind === "transaction" ? item.transaction.type : item.recurring.item.type;
      if (type === "income") {
        income += 1;
      } else {
        expense += 1;
      }
      if (isFutureDay(item.date)) {
        pending += 1;
      }
    });

    return { income, expense, pending };
  }, [mergedItems]);

  // Calculate monthly summary
  const monthlySummary = useMemo(() => {
    let income = 0n;
    let expense = 0n;

    monthTransactions.forEach((t) => {
      const amount = BigInt(t.amount_base_minor);
      if (t.type === "income") {
        income += amount;
      } else {
        expense += amount;
      }
    });

    const balance = income - expense;

    return { income, expense, balance };
  }, [monthTransactions]);

  const pendingSummary = useMemo(() => {
    let income = 0n;
    let expense = 0n;
    const toMinorAmount = (value: bigint | number | string) => {
      try {
        return BigInt(value);
      } catch {
        return 0n;
      }
    };

    monthTransactions.forEach((transaction) => {
      if (!isFutureDay(transaction.date)) return;
      const amount = BigInt(transaction.amount_base_minor);
      if (transaction.type === "income") {
        income += amount;
      } else {
        expense += amount;
      }
    });

    pendingOccurrences.forEach((pending) => {
      if (!isFutureDay(pending.occurrenceDate)) return;
      if (pending.item.currency !== baseCurrency) return;
      const amount = toMinorAmount(pending.item.amount_minor);
      if (pending.item.type === "income") {
        income += amount;
      } else {
        expense += amount;
      }
    });

    return { income, expense };
  }, [baseCurrency, monthTransactions, pendingOccurrences]);

  // Get currency symbol
  const currencySymbol =
    CURRENCIES.find((c) => c.code === baseCurrency)?.symbol || baseCurrency;

  const pendingIncomeText = t("pendingChipLabel", {
    amount: formatMoneyWithSymbol(pendingSummary.income, baseCurrency, currencySymbol),
  });
  const pendingExpenseText = t("pendingChipLabel", {
    amount: formatMoneyWithSymbol(pendingSummary.expense, baseCurrency, currencySymbol),
  });

  const formatSignedMinor = useCallback(
    (value: bigint) => {
      const absolute = value < 0n ? -value : value;
      const formatted = formatMoneyWithSymbol(
        absolute,
        baseCurrency,
        currencySymbol
      );
      return value < 0n ? `-${formatted}` : formatted;
    },
    [baseCurrency, currencySymbol]
  );

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
          openCreateSuccess(tObligations("create.success"));
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
        openCreateSuccess(
          repeatConfig.enabled ? t("repeat.createSuccess") : t("createSuccess")
        );
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

  const handleCreateRecurringDraft = async (
    draft: TransactionDraft,
    extra?: {
      recurring?: {
        frequency: RecurringFrequency;
        interval: number;
        startDate: string;
        endDate: string | null;
      };
    }
  ) => {
    if (!canEdit) {
      throw new Error(translateDynamic("errors.invalidRequest"));
    }

    const recurring = extra?.recurring;
    if (!recurring) {
      throw new Error(translateDynamic("errors.invalidRequest"));
    }

    const result = await createRecurringItem({
      account_id: accountId,
      type: draft.type,
      amount: draft.amount,
      currency: draft.currency,
      category_id: draft.categoryId || null,
      start_date: recurring.startDate,
      frequency: recurring.frequency,
      interval: recurring.interval,
      end_date: recurring.endDate,
      merchant: draft.merchant.trim() || null,
      notes: draft.notes.trim() || null,
    });

    if (!result.success) {
      throw new Error(
        result.error
          ? translateDynamic(result.error.key, result.error.params)
          : t("repeat.createError")
      );
    }

    if (result.data) {
      setRecurringItems((prev) => [result.data as RecurringItem, ...prev]);
    }
  };

  const handleRecurringCreateSuccess = () => {
    setIsCreateOpen(false);
    setCreateKind("transaction");
    setRepeatConfig({
      enabled: false,
      frequency: "monthly",
      interval: "1",
      startDate: new Date().toISOString().slice(0, 10),
      endDate: "",
    });
    router.replace("/transactions");
    router.refresh();
  };

  const handleRecurringCreateCancel = () => {
    setIsCreateOpen(false);
    setCreateKind("transaction");
    setRepeatConfig((prev) => ({ ...prev, enabled: false }));
    router.replace("/transactions");
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
        project_id:
          formData.type === "expense"
            ? (selectedTransaction.project_id ?? null)
            : null,
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
            onClick={() => router.push("/transaction/recurrent")}
          >
            {tGlobal("recurrentes.title")}
          </Button>
        </div>
        {!canEdit && (
          <p className="text-sm text-muted-foreground">
            {t("readOnlyNotice")}
          </p>
        )}
      </div>

      {/* Month Navigation */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={goToPreviousMonth}
          className="p-1 hover:opacity-70 text-muted-foreground"
          aria-label={t("previousMonth")}
        >
          <ChevronLeft size={20} />
        </button>
        <span className="text-sm font-semibold capitalize">
          {formatMonthLabel(selectedMonth, locale)}
        </span>
        <button
          type="button"
          onClick={goToNextMonth}
          className="p-1 hover:opacity-70 text-muted-foreground"
          aria-label={t("nextMonth")}
        >
          <ChevronRight size={20} />
        </button>
        <button
          type="button"
          onClick={openMonthPicker}
          className="p-1 hover:opacity-70 text-muted-foreground"
          aria-label={t("openMonthPicker")}
        >
          <Calendar size={18} />
        </button>
      </div>

      {/* Month Picker Dialog */}
      <AlertDialog open={isMonthPickerOpen} onOpenChange={setIsMonthPickerOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("openMonthPicker")}</AlertDialogTitle>
            <AlertDialogDescription>{t("filterByMonth")}</AlertDialogDescription>
          </AlertDialogHeader>
          <div className="grid gap-4 sm:grid-cols-2 py-4">
            <div className="space-y-2">
              <Label>{t("monthPickerLabel")}</Label>
              <Select
                value={String(pickerMonthIndex)}
                onValueChange={(value) => setPickerMonthIndex(Number(value))}
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
          <AlertDialogFooter>
            <AlertDialogCancel>{tGlobal("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={applyMonthPicker}>
              {t("applyMonthPicker")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Monthly Summary */}
      <div className="grid grid-cols-3 gap-2">
          <Card>
            <CardHeader className="p-3">
              <CardDescription className="text-xs">{t("income")}</CardDescription>
              <SummaryValueWithPendingChip
                value={formatMoneyWithSymbol(
                  monthlySummary.income,
                  baseCurrency,
                  currencySymbol
                )}
                pendingMinor={pendingSummary.income}
                pendingText={pendingIncomeText}
                triggerLabel={t("pendingTriggerLabel")}
                valueColor={colors.state.positive}
                pendingToneColor={colors.state.positive}
              />
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="p-3">
              <CardDescription className="text-xs">{t("expenses")}</CardDescription>
              <SummaryValueWithPendingChip
                value={formatMoneyWithSymbol(
                  monthlySummary.expense,
                  baseCurrency,
                  currencySymbol
                )}
                pendingMinor={pendingSummary.expense}
                pendingText={pendingExpenseText}
                triggerLabel={t("pendingTriggerLabel")}
                valueColor={colors.state.negative}
                pendingToneColor={colors.state.negative}
              />
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="p-3">
              <CardDescription className="text-xs">{t("balance")}</CardDescription>
              <CardTitle
                className="font-balance text-lg md:text-2xl"
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

      <div className="flex items-center gap-2">
        <h2 className="text-lg font-bold">
          {t("movimientosCount", { count: mergedItems.length })}
        </h2>
        <MovementsLegendTooltip
          legendText={t("futureLegend")}
          incomeLabel={t("futureIncomeLegend")}
          expenseLabel={t("futureExpenseLegend")}
          triggerLabel={t("futureLegend")}
        />
      </div>
      <div className="mb-4 mt-2 flex flex-wrap items-center gap-2 text-xs">
        <span
          className="inline-flex items-center rounded-full border px-2 py-1"
          style={{
            borderColor: colors.state.neutral,
            backgroundColor: colors.bg.secondary,
            color: colors.state.positive,
          }}
        >
          {t("incomeCount", { count: movementCounts.income })}
        </span>
        <span
          className="inline-flex items-center rounded-full border px-2 py-1"
          style={{
            borderColor: colors.state.neutral,
            backgroundColor: colors.bg.secondary,
            color: colors.state.negative,
          }}
        >
          {t("expenseCount", { count: movementCounts.expense })}
        </span>
        <span
          className="inline-flex items-center rounded-full border px-2 py-1"
          style={{
            borderColor: colors.state.neutral,
            backgroundColor: colors.bg.secondary,
            color: colors.state.warning,
          }}
        >
          {t("pendingCount", { count: movementCounts.pending })}
        </span>
      </div>

      {/* Transactions List */}
      <div
        className="overflow-hidden rounded-lg border"
        style={{
          backgroundColor: colors.bg.primary,
          borderColor: colors.state.neutral,
        }}
      >
        {mergedItems.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            {canEdit ? t("noTransactions") : t("noTransactionsReadOnly")}
          </p>
        ) : (
          <div>
            {mergedItems.map((item, index) => {
              if (item.kind === "transaction") {
                const transaction = item.transaction;
                const category =
                  transaction.category ??
                  (transaction.category_id
                    ? categoriesById[transaction.category_id]
                    : undefined);
                const profile = profilesById[transaction.created_by];
                const creatorName =
                  profile?.display_name ??
                  profile?.email ??
                  transaction.created_by.slice(0, 6);
                const creatorLabel = t("createdBy", { name: creatorName });
                const displayMerchant =
                  transaction.merchant ||
                  category?.name ||
                  t("create.categoryNone");

                return (
                  <div
                    key={transaction.id}
                    className="border-b last:border-b-0"
                    style={{ borderBottomColor: colors.state.neutral }}
                  >
                    <TransactionTile
                      transaction={{
                        id: transaction.id,
                        merchant: displayMerchant,
                        category: category
                          ? {
                              id: category.id,
                              name: category.name,
                              icon: category.icon_id,
                            }
                          : undefined,
                        notes: transaction.notes,
                        date: transaction.date,
                        amount: BigInt(transaction.amount_base_minor),
                        currency: baseCurrency,
                        createdBy: {
                          initial: creatorName.slice(0, 2),
                          userId: transaction.created_by,
                          email: profile?.email ?? null,
                          displayName: profile?.display_name ?? creatorName,
                          avatarPath: profile?.avatar_path ?? null,
                          fallbackText: profile?.avatar_fallback_text ?? null,
                          fallbackBgToken:
                            (profile?.avatar_fallback_bg_token as AvatarColorToken | null) ??
                            null,
                          avatarColor: profile?.avatar_color ?? null,
                          label: creatorLabel,
                        },
                        type: transaction.type,
                      }}
                      onPress={
                        canEdit
                          ? (_id) => openEditDialog(transaction)
                          : undefined
                      }
                      onEdit={
                        canEdit
                          ? (_id) => openEditDialog(transaction)
                          : undefined
                      }
                      onDelete={
                        canEdit
                          ? (_id) => openDeleteDialog(transaction)
                          : undefined
                      }
                    />
                  </div>
                );
              }

              const recurring = item.recurring;
              const category = categories.find(
                (cat) => cat.id === recurring.item.category_id
              );
              const confirmKey = getOccurrenceKey(
                recurring.item.id,
                recurring.occurrenceDate
              );
              const displayMerchant =
                recurring.item.merchant ||
                category?.name ||
                t("create.categoryNone");
              const recurringCurrencySymbol =
                CURRENCIES.find((c) => c.code === recurring.item.currency)
                  ?.symbol || recurring.item.currency;
              const recurringAmount = formatMinorToMoney(
                BigInt(recurring.item.amount_minor),
                recurring.item.currency
              );
              const recurringMeta = [
                new Date(recurring.occurrenceDate).toLocaleDateString(),
                t("recurring.pendingLabel"),
              ];

              if (recurring.item.notes?.trim()) {
                recurringMeta.push(recurring.item.notes.trim());
              }

              return (
                <div
                  key={confirmKey}
                  className="border-b last:border-b-0"
                  style={{ borderBottomColor: "hsl(var(--border))" }}
                >
                  <div className="flex items-center justify-between gap-4 px-4 py-3.5">
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <div
                        className="flex items-center justify-center shrink-0"
                        style={{
                          width: 36,
                          height: 36,
                          borderRadius: 12,
                          backgroundColor: "hsl(var(--secondary))",
                        }}
                      >
                        <CategoryIcon
                          iconId={category?.icon_id}
                          size={18}
                          tone="muted"
                          accessibilityLabel={category?.name || undefined}
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div
                          className="text-base font-semibold truncate"
                          style={{ color: "hsl(var(--foreground))" }}
                        >
                          {displayMerchant}
                        </div>
                        <div
                          className="text-sm truncate"
                          style={{ color: "hsl(var(--muted-foreground))" }}
                        >
                          {recurringMeta.join(" • ")}
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-2">
                      <div className="flex items-baseline gap-1">
                        <span
                          className="text-sm font-medium"
                          style={{ color: "hsl(var(--muted-foreground))" }}
                        >
                          {recurring.item.type === "expense" ? "-" : ""}
                          {recurringCurrencySymbol}
                        </span>
                        <span
                          className="text-base font-semibold"
                          style={{
                            color:
                              recurring.item.type === "income"
                                ? "hsl(var(--state-positive))"
                                : "hsl(var(--state-negative))",
                          }}
                        >
                          {recurringAmount}
                        </span>
                      </div>

                      {canEdit && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleConfirmRecurring(recurring)}
                          disabled={confirmingKey === confirmKey}
                          className="h-7 px-3 text-xs font-semibold"
                          style={{
                            backgroundColor: "hsl(var(--secondary))",
                            borderColor: "hsl(var(--border))",
                            color: "hsl(var(--foreground))",
                          }}
                        >
                          {confirmingKey === confirmKey
                            ? t("recurring.confirming")
                            : t("recurring.confirmAction")}
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

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
                    <p className="text-sm font-medium text-muted-foreground">
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
                    <p className="text-sm font-medium text-muted-foreground">
                      {tObligations("create.statusHelper")}
                    </p>
                  </div>
                </div>
              ) : createKind === "recurring" ? (
                <div className="px-2 py-1">
                  <AddTransactionForm
                    key={`${accountId}-${formData.type}-recurring-create`}
                    type={formData.type}
                    accountId={accountId}
                    currency={baseCurrency}
                    locale={locale}
                    categories={categories}
                    topCategories={initialTopCategories}
                    merchantSuggestions={initialMerchantSuggestions}
                    defaultDate={formData.date}
                    allowObligation={false}
                    submitMode="recurring"
                    successMessageKey="transactions.repeat.createSuccess"
                    errorMessageKey="transactions.repeat.createError"
                    onSubmitDraft={handleCreateRecurringDraft}
                    onSuccess={handleRecurringCreateSuccess}
                    onCancel={handleRecurringCreateCancel}
                  />
                </div>
              ) : (
                <div className="grid gap-6">
                  {/* 1. Transaction Type - Toggle */}
                  <div className="space-y-3 rounded-xl border border-border bg-muted/30 p-4">
                    <Label className="text-sm font-semibold text-foreground">
                      {t("create.typeLabel")}
                    </Label>
                    <div className="relative flex rounded-full border bg-muted/30 p-1">
                      <span
                        aria-hidden="true"
                        className={`pointer-events-none absolute inset-y-1 left-1 w-[calc(50%-0.25rem)] rounded-full bg-background shadow-sm transition-transform ${
                          formData.type === "income" ? "translate-x-full" : ""
                        }`}
                      />
                      <button
                        type="button"
                        aria-pressed={formData.type === "expense"}
                        onClick={() =>
                          setFormData({
                            ...formData,
                            type: "expense",
                            category_id: undefined,
                          })
                        }
                        className={`relative z-10 flex-1 rounded-full py-2.5 text-sm font-semibold inline-flex items-center justify-center gap-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${
                          formData.type === "expense"
                            ? "text-foreground"
                            : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        <ArrowDownLeft className="h-4 w-4" />
                        {t("create.typeExpense")}
                      </button>
                      <button
                        type="button"
                        aria-pressed={formData.type === "income"}
                        onClick={() =>
                          setFormData({
                            ...formData,
                            type: "income",
                            category_id: undefined,
                          })
                        }
                        className={`relative z-10 flex-1 rounded-full py-2.5 text-sm font-semibold inline-flex items-center justify-center gap-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${
                          formData.type === "income"
                            ? "text-foreground"
                            : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        <ArrowUpRight className="h-4 w-4" />
                        {t("create.typeIncome")}
                      </button>
                    </div>
                  </div>

                  {/* 2. Date with Monthly Context */}
                  <div className="space-y-2 rounded-xl border border-border bg-muted/30 p-4">
                    <Label
                      htmlFor="date"
                      className="text-sm font-semibold text-foreground"
                    >
                      {t("create.dateLabel")}
                    </Label>
                    <Input
                      id="date"
                      type="date"
                      value={formData.date}
                      onChange={(e) =>
                        setFormData({ ...formData, date: e.target.value })
                      }
                      className="h-11"
                    />
                    <p
                      className={`text-xs font-medium ${
                        getMonthContext(formData.date).isCurrent
                          ? "text-muted-foreground"
                          : "text-amber-600"
                      }`}
                    >
                      {getMonthContext(formData.date).message}
                    </p>
                  </div>

                  {createKind === "transaction" && (
                    <div className="space-y-3 rounded-xl border border-border bg-muted/30 p-4">
                      <Label className="text-sm font-semibold text-foreground">
                        {t("repeat.label")}
                      </Label>
                      <label className="flex items-center gap-3 text-sm font-medium text-muted-foreground">
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
                    <div className="grid gap-4 rounded-lg border border-border bg-background p-4">
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
                  <div className="space-y-3 rounded-xl border border-border bg-muted/30 p-4">
                    <Label className="text-lg font-bold">
                      {t("create.amountLabel")}
                    </Label>
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
                        className="flex-1 h-14 text-2xl font-semibold"
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
                        <SelectTrigger className="h-14 w-28 text-sm font-semibold">
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
                    <div className="space-y-2 rounded-xl border border-border bg-muted/30 p-4">
                      <Label
                        htmlFor="fx-rate"
                        className="text-sm font-semibold text-foreground"
                      >
                        {t("fxRateLabel")}
                      </Label>
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
                      <p className="text-sm font-medium text-muted-foreground">
                        {t("fxRateHelper", {
                          currency: formData.currency,
                          baseCurrency,
                        })}
                      </p>
                      <p className="text-sm font-medium text-muted-foreground">
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
                    <div className="space-y-3 rounded-xl border border-border bg-muted/30 p-4">
                      <Label htmlFor="category" className="text-base font-semibold">
                        {t("create.categoryLabel")}
                      </Label>
                      {topCategories.length > 0 && (
                        <TopCategorySelector
                          topCategories={topCategories}
                          selectedCategoryId={formData.category_id}
                          onSelect={(categoryId) =>
                            setFormData({
                              ...formData,
                              category_id: categoryId,
                            })
                          }
                          onOpenAll={() => setShowFullCategorySelector(true)}
                          seeOthersLabel={t("create.categorySeeOthers")}
                        />
                      )}
                      {(showFullCategorySelector ||
                        topCategories.length === 0) && (
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
                      )}
                    </div>

                    <div className="space-y-3 rounded-xl border border-border bg-muted/30 p-4">
                      <Label htmlFor="merchant" className="text-base font-semibold">
                        {t("create.merchantLabel")}
                      </Label>
                      <MerchantAutocomplete
                        id="merchant"
                        value={formData.merchant}
                        onChange={(value) =>
                          setFormData({ ...formData, merchant: value })
                        }
                        suggestions={initialMerchantSuggestions[formData.type]}
                        placeholder={t("create.merchantPlaceholder")}
                      />
                    </div>

                    <div className="space-y-3 rounded-xl border border-border bg-muted/30 p-4">
                      <Label htmlFor="notes" className="text-base font-semibold">
                        {t("create.notesLabel")}
                      </Label>
                      <Textarea
                        id="notes"
                        value={formData.notes}
                        onChange={(e) =>
                          setFormData({ ...formData, notes: e.target.value })
                        }
                        placeholder={t("create.notesPlaceholder")}
                        rows={3}
                        className="min-h-[120px]"
                      />
                    </div>
                  </div>
                </div>
              )}
            </SlidePanelBody>
            {createKind !== "recurring" && (
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
            )}
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
                {/* 1. Transaction Type - Toggle */}
                <div className="space-y-3 rounded-xl border border-border bg-muted/30 p-4">
                  <Label className="text-sm font-semibold text-foreground">
                    {t("create.typeLabel")}
                  </Label>
                  <div className="relative flex rounded-full border bg-muted/30 p-1">
                    <span
                      aria-hidden="true"
                      className={cn(
                        "pointer-events-none absolute inset-y-1 left-1 w-[calc(50%-0.25rem)] rounded-full bg-background shadow-sm transition-transform",
                        formData.type === "income" && "translate-x-full"
                      )}
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setFormData({
                          ...formData,
                          type: "expense",
                          category_id: undefined,
                        })
                      }
                      aria-pressed={formData.type === "expense"}
                      className={cn(
                        "relative z-10 flex-1 rounded-full py-2.5 text-sm font-semibold",
                        "inline-flex items-center justify-center gap-2 transition-colors",
                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                        formData.type === "expense"
                          ? "text-foreground"
                          : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      <ArrowDownLeft className="h-4 w-4" />
                      {t("create.typeExpense")}
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setFormData({
                          ...formData,
                          type: "income",
                          category_id: undefined,
                        })
                      }
                      aria-pressed={formData.type === "income"}
                      className={cn(
                        "relative z-10 flex-1 rounded-full py-2.5 text-sm font-semibold",
                        "inline-flex items-center justify-center gap-2 transition-colors",
                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                        formData.type === "income"
                          ? "text-foreground"
                          : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      <ArrowUpRight className="h-4 w-4" />
                      {t("create.typeIncome")}
                    </button>
                  </div>
                </div>

                {/* 2. Date with Monthly Context */}
                <div className="space-y-2 rounded-xl border border-border bg-muted/30 p-4">
                  <Label
                    htmlFor="edit-date"
                    className="text-sm font-semibold text-foreground"
                  >
                    {t("create.dateLabel")}
                  </Label>
                  <Input
                    id="edit-date"
                    type="date"
                    value={formData.date}
                    onChange={(e) =>
                      setFormData({ ...formData, date: e.target.value })
                    }
                    className="h-11"
                  />
                  <p
                    className={`text-xs font-medium ${
                      getMonthContext(formData.date).isCurrent
                        ? "text-muted-foreground"
                        : "text-amber-600"
                    }`}
                  >
                    {getMonthContext(formData.date).message}
                  </p>
                </div>

                {/* 3. Amount + Currency (Grouped) */}
                <div className="space-y-3 rounded-xl border border-border bg-muted/30 p-4">
                  <Label className="text-lg font-bold">
                    {t("create.amountLabel")}
                  </Label>
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
                      className="flex-1 h-14 text-2xl font-semibold"
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
                      <SelectTrigger className="h-14 w-28 text-sm font-semibold">
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
                  <div className="space-y-2 rounded-xl border border-border bg-muted/30 p-4">
                    <Label
                      htmlFor="edit-fx-rate"
                      className="text-sm font-semibold text-foreground"
                    >
                      {t("fxRateLabel")}
                    </Label>
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
                    <p className="text-sm font-medium text-muted-foreground">
                      {t("fxRateHelper", {
                        currency: formData.currency,
                        baseCurrency,
                      })}
                    </p>
                    <p className="text-sm font-medium text-muted-foreground">
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
                  <div className="space-y-3 rounded-xl border border-border bg-muted/30 p-4">
                    <Label
                      htmlFor="edit-category"
                      className="text-base font-semibold"
                    >
                      {t("create.categoryLabel")}
                    </Label>
                    {topCategories.length > 0 && (
                      <TopCategorySelector
                        topCategories={topCategories}
                        selectedCategoryId={formData.category_id}
                        onSelect={(categoryId) =>
                          setFormData({
                            ...formData,
                            category_id: categoryId,
                          })
                        }
                        onOpenAll={() => setShowFullCategorySelectorEdit(true)}
                        seeOthersLabel={t("create.categorySeeOthers")}
                      />
                    )}
                    {(showFullCategorySelectorEdit ||
                      topCategories.length === 0) && (
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
                    )}
                  </div>

                  <div className="space-y-3 rounded-xl border border-border bg-muted/30 p-4">
                    <Label
                      htmlFor="edit-merchant"
                      className="text-base font-semibold"
                    >
                      {t("create.merchantLabel")}
                    </Label>
                    <MerchantAutocomplete
                      id="edit-merchant"
                      value={formData.merchant}
                      onChange={(value) =>
                        setFormData({ ...formData, merchant: value })
                      }
                      suggestions={initialMerchantSuggestions[formData.type]}
                      placeholder={t("create.merchantPlaceholder")}
                    />
                  </div>

                  <div className="space-y-3 rounded-xl border border-border bg-muted/30 p-4">
                    <Label htmlFor="edit-notes" className="text-base font-semibold">
                      {t("create.notesLabel")}
                    </Label>
                    <Textarea
                      id="edit-notes"
                      value={formData.notes}
                      onChange={(e) =>
                        setFormData({ ...formData, notes: e.target.value })
                      }
                      placeholder={t("create.notesPlaceholder")}
                      rows={3}
                      className="min-h-[120px]"
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
      <ConfirmationModal
        open={isCreateSuccessOpen}
        title={tGlobal("common.successTitle")}
        description={createSuccessMessage ?? undefined}
        confirmLabel={tGlobal("common.ok")}
        onConfirm={closeCreateSuccess}
        onCancel={closeCreateSuccess}
      />
    </PageContainer>
  );
}
