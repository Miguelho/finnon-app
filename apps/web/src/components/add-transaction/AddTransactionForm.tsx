"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
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
import { TransactionStepperBreadcrumb } from "./TransactionStepperBreadcrumb";
import { TransactionStepCarousel } from "./TransactionStepCarousel";
import { FormModeToggle } from "./FormModeToggle";
import { Step1Details } from "./steps/Step1Details";
import { Step2Category } from "./steps/Step2Category";
import { useCachedTransactionsRange } from "@/cache/hooks";
import { getFormMode, setFormMode } from "@/lib/form-mode-storage";
import { createClient } from "@/lib/supabase/client";
import { createTransaction, createObligation } from "@/app/transactions/actions";
import {
  computeCategoryOccurrencesByType,
  EMPTY_CATEGORY_OCCURRENCES_BY_TYPE,
  type TransactionDraft,
  type Transaction,
  type CategoryOccurrencesByType,
  type ContributionSplitType,
  type FormMode,
  type StepStatus,
  type TopCategory,
  type MerchantSuggestion,
  type RecurringFrequency,
  buildEqualSplit,
  buildProjectColorMap,
  getProjectColor,
  parseMoneyToMinor,
  CURRENCY_MINOR_UNITS,
  createInitialDraft,
  formatDateISO,
  normalizeMerchant,
  validateStep1,
  validateStep2,
} from "@poleursus/shared";

const parseIsoDate = (value: string) => {
  const [year, month, day] = value.split("-").map((part) => Number(part));
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day);
};

const subtractDays = (date: Date, days: number) => {
  const next = new Date(date);
  next.setDate(next.getDate() - days);
  return next;
};

const isFutureDate = (value: string) => {
  const date = parseIsoDate(value);
  if (!date) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return date.getTime() > today.getTime();
};

const resolveObligationDueDate = (draft: TransactionDraft) => {
  const effectiveType =
    draft.obligationType ?? (isFutureDate(draft.date) ? "scheduled" : "pending");
  if (effectiveType === "scheduled") {
    return draft.scheduledDate ?? draft.date;
  }
  return draft.date;
};

interface Category {
  id: string;
  name: string;
  icon_id: string;
  type: "income" | "expense";
}

type FormParticipant = {
  userId: string;
  name: string;
  role: "viewer" | "contributor" | "admin";
};

type SubmitMode = "transaction" | "recurring";
type FormStepKey = "details" | "recurring" | "category";

type RecurringSubmitData = {
  frequency: RecurringFrequency;
  interval: number;
  startDate: string;
  endDate: string | null;
};

type CategoryMerchantsByType = {
  expense: Record<string, string[]>;
  income: Record<string, string[]>;
};

type CategoryMerchantRow = {
  type: "income" | "expense" | null;
  category_id: string | null;
  merchant: string | null;
};

type ProjectOption = {
  id: string;
  name: string;
  emoji: string;
  color: string;
};

type ProjectRow = {
  id: string;
  name: string;
  emoji: string | null;
  color: string | null;
  created_at: string | null;
};

const EMPTY_CATEGORY_MERCHANTS: CategoryMerchantsByType = {
  expense: {},
  income: {},
};

const buildCategoryMerchantsByType = (
  rows: CategoryMerchantRow[]
): CategoryMerchantsByType => {
  const grouped: CategoryMerchantsByType = {
    expense: {},
    income: {},
  };
  const seen = {
    expense: new Map<string, Set<string>>(),
    income: new Map<string, Set<string>>(),
  };

  rows.forEach((row) => {
    if (row.type !== "income" && row.type !== "expense") return;
    if (!row.category_id) return;
    if (!row.merchant) return;
    const txType = row.type;
    const categoryId = row.category_id;

    const merchant = row.merchant.trim().replace(/\s+/g, " ");
    if (!merchant) return;

    const normalized = normalizeMerchant(merchant);
    const categoryMap = seen[txType];
    const categorySeen = categoryMap.get(categoryId) ?? new Set<string>();

    if (categorySeen.has(normalized)) return;
    categorySeen.add(normalized);
    categoryMap.set(categoryId, categorySeen);

    if (!grouped[txType][categoryId]) {
      grouped[txType][categoryId] = [];
    }
    grouped[txType][categoryId].push(merchant);
  });

  return grouped;
};

const mapProjectRowsToOptions = (rows: ProjectRow[]): ProjectOption[] => {
  const colorMap = buildProjectColorMap(rows);
  return rows
    .map((row) => ({
      id: row.id,
      name: row.name,
      emoji: row.emoji?.trim() || "\u{1F3AF}",
      color: getProjectColor(row, colorMap),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
};

interface AddTransactionFormProps {
  type?: "income" | "expense";
  accountId: string;
  currency: string;
  locale: string;
  categories: Category[];
  topCategories: {
    expense: TopCategory[];
    income: TopCategory[];
  };
  merchantSuggestions: {
    expense: MerchantSuggestion[];
    income: MerchantSuggestion[];
  };
  participants?: FormParticipant[];
  currentUserId?: string | null;
  defaultDate?: string;
  mode?: "create" | "edit";
  initialDraft?: TransactionDraft;
  allowObligation?: boolean;
  submitMode?: SubmitMode;
  successMessageKey?: string;
  errorMessageKey?: string;
  onSubmitDraft?: (
    draft: TransactionDraft,
    extra?: { recurring?: RecurringSubmitData }
  ) => Promise<void>;
  onRequestAddCategory?: (type: "income" | "expense") => void;
  onSuccess?: () => void;
  onCancel?: () => void;
}

export function AddTransactionForm({
  type = "expense",
  accountId,
  currency,
  locale,
  categories,
  topCategories,
  merchantSuggestions,
  participants = [],
  currentUserId = null,
  defaultDate,
  mode = "create",
  initialDraft,
  allowObligation = true,
  submitMode = "transaction",
  successMessageKey,
  errorMessageKey,
  onSubmitDraft,
  onRequestAddCategory,
  onSuccess,
  onCancel,
}: AddTransactionFormProps) {
  const router = useRouter();
  const t = useTranslations("addTransaction");
  const tTransactions = useTranslations("transactions");
  const tGlobal = useTranslations();
  const translateDynamic = (key: string, params?: Record<string, unknown>) =>
    tGlobal(key as never, params as never);

  const isRecurringMode = submitMode === "recurring";
  const useQuickAddStep = mode === "create" && !isRecurringMode;
  const stepOrder: FormStepKey[] = isRecurringMode
    ? ["details", "recurring", "category"]
    : ["details", "category"];
  const totalSteps = stepOrder.length;
  const activeSplitParticipants = React.useMemo(
    () =>
      participants.filter(
        (participant) =>
          participant.role === "admin" || participant.role === "contributor"
      ),
    [participants]
  );
  const activeSplitMemberIds = React.useMemo(
    () => activeSplitParticipants.map((participant) => participant.userId),
    [activeSplitParticipants]
  );
  const isSharedSplitAccount = activeSplitParticipants.length >= 2;
  const hasParticipantsContext = participants.length > 0;

  // Form state
  const [draft, setDraft] = React.useState<TransactionDraft>(() =>
    initialDraft ?? createInitialDraft(type, currency, defaultDate)
  );

  // Get current top categories and merchant suggestions based on draft type
  const currentTopCategories = topCategories[draft.type];
  const currentMerchantSuggestions = merchantSuggestions[draft.type];
  const loadCachedTransactionsRange = useCachedTransactionsRange();
  const [categoryMerchantsByType, setCategoryMerchantsByType] =
    React.useState<CategoryMerchantsByType>(EMPTY_CATEGORY_MERCHANTS);
  const [categoryOccurrencesByType, setCategoryOccurrencesByType] =
    React.useState<CategoryOccurrencesByType>(EMPTY_CATEGORY_OCCURRENCES_BY_TYPE);
  const [projectOptions, setProjectOptions] = React.useState<ProjectOption[]>([]);
  const [currentStep, setCurrentStep] = React.useState(1);
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [recurringFrequency, setRecurringFrequency] =
    React.useState<RecurringFrequency>("monthly");
  const [recurringInterval, setRecurringInterval] = React.useState("1");
  const [recurringEndDate, setRecurringEndDate] = React.useState("");

  React.useEffect(() => {
    let cancelled = false;
    setCategoryMerchantsByType(EMPTY_CATEGORY_MERCHANTS);

    const loadCategoryMerchants = async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("transactions")
        .select("type, category_id, merchant")
        .eq("account_id", accountId)
        .not("category_id", "is", null)
        .not("merchant", "is", null)
        .order("date", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(400);

      if (error) {
        console.error("[AddTransactionForm] Error loading category merchants:", error);
        return;
      }

      if (cancelled) return;
      setCategoryMerchantsByType(
        buildCategoryMerchantsByType((data ?? []) as CategoryMerchantRow[])
      );
    };

    void loadCategoryMerchants();

    return () => {
      cancelled = true;
    };
  }, [accountId]);

  React.useEffect(() => {
    if (!accountId) {
      setCategoryOccurrencesByType(EMPTY_CATEGORY_OCCURRENCES_BY_TYPE);
      return;
    }

    let cancelled = false;

    const loadCategoryOccurrences = async () => {
      const today = new Date();
      const start = formatDateISO(subtractDays(today, 90));
      const end = formatDateISO(today);
      const supabase = createClient();

      try {
        const transactions = await loadCachedTransactionsRange<Transaction[]>({
          accountId,
          start,
          end,
          loader: async () => {
            const { data, error } = await supabase
              .from("transactions")
              .select(
                "id, account_id, type, amount_minor, currency, category_id, date, merchant, created_at"
              )
              .eq("account_id", accountId)
              .gte("date", start)
              .lte("date", end)
              .order("date", { ascending: false })
              .order("created_at", { ascending: false });

            if (error) throw error;
            return (data ?? []) as Transaction[];
          },
        });

        if (cancelled) return;
        setCategoryOccurrencesByType(computeCategoryOccurrencesByType(transactions));
      } catch (error) {
        console.error("[AddTransactionForm] Error loading category occurrences:", error);
        if (!cancelled) {
          setCategoryOccurrencesByType(EMPTY_CATEGORY_OCCURRENCES_BY_TYPE);
        }
      }
    };

    void loadCategoryOccurrences();

    return () => {
      cancelled = true;
    };
  }, [accountId, loadCachedTransactionsRange]);

  React.useEffect(() => {
    if (initialDraft) {
      setDraft(initialDraft);
    } else {
      setDraft(createInitialDraft(type, currency, defaultDate));
    }
    setCurrentStep(1);
    setErrors({});
  }, [currency, defaultDate, initialDraft, type]);

  React.useEffect(() => {
    if (draft.type !== "expense" || draft.projectId === null) return;
    setDraft((prev) => ({ ...prev, projectId: null }));
  }, [draft.projectId, draft.type]);

  React.useEffect(() => {
    if (!isRecurringMode) return;
    setRecurringFrequency("monthly");
    setRecurringInterval("1");
    setRecurringEndDate("");
  }, [isRecurringMode, accountId]);

  React.useEffect(() => {
    let cancelled = false;

    const loadProjects = async () => {
      const supabase = createClient();
      const { data: activeRows, error: activeError } = await supabase
        .from("projects")
        .select("id, name, emoji, color, created_at")
        .eq("account_id", accountId)
        .not("target_amount_base_minor", "is", null)
        .eq("status", "active")
        .order("name", { ascending: true });

      if (activeError) {
        console.error("[AddTransactionForm] Error loading projects:", activeError);
        if (!cancelled) setProjectOptions([]);
        return;
      }

      const activeProjectRows = (activeRows ?? []) as ProjectRow[];
      const activeOptions = mapProjectRowsToOptions(activeProjectRows);

      const selectedProjectId = draft.projectId;
      const hasSelected =
        selectedProjectId &&
        activeOptions.some((project) => project.id === selectedProjectId);

      if (!selectedProjectId || hasSelected) {
        if (!cancelled) setProjectOptions(activeOptions);
        return;
      }

      const { data: selectedProject, error: selectedError } = await supabase
        .from("projects")
        .select("id, name, emoji, color, created_at")
        .eq("account_id", accountId)
        .eq("id", selectedProjectId)
        .not("target_amount_base_minor", "is", null)
        .maybeSingle();

      if (selectedError) {
        console.error(
          "[AddTransactionForm] Error loading selected project:",
          selectedError
        );
      }

      const mergedRows = selectedProject
        ? [...activeProjectRows, selectedProject as ProjectRow]
        : activeProjectRows;
      const merged = mapProjectRowsToOptions(mergedRows);
      const deduped = Array.from(
        new Map(merged.map((project) => [project.id, project])).values()
      );

      if (!cancelled) setProjectOptions(deduped);
    };

    void loadProjects();

    return () => {
      cancelled = true;
    };
  }, [accountId, draft.projectId]);

  React.useEffect(() => {
    if (allowObligation) return;
    if (!draft.isObligation) return;
    setDraft((prev) => ({
      ...prev,
      isObligation: false,
      obligationType: null,
      scheduledDate: null,
      scheduledDateOverridden: false,
    }));
  }, [allowObligation, draft.isObligation]);

  React.useEffect(() => {
    setDraft((prev) => {
      const next = { ...prev };
      let changed = false;

      const shouldAutofillPaidBy = !(hasParticipantsContext && isSharedSplitAccount);
      if (shouldAutofillPaidBy) {
        const defaultPaidBy =
          prev.paidByUserId ??
          currentUserId ??
          activeSplitParticipants[0]?.userId ??
          null;

        if (defaultPaidBy && defaultPaidBy !== prev.paidByUserId) {
          next.paidByUserId = defaultPaidBy;
          changed = true;
        }
      }

      if (hasParticipantsContext && !isSharedSplitAccount) {
        if (prev.splitType !== "personal") {
          next.splitType = "personal";
          changed = true;
        }
        if (prev.splitDetails !== null) {
          next.splitDetails = null;
          changed = true;
        }
      } else if (hasParticipantsContext && prev.type === "income") {
        if (prev.splitType !== "equal") {
          next.splitType = "equal";
          changed = true;
        }
        if (prev.splitDetails !== null) {
          next.splitDetails = null;
          changed = true;
        }
      } else if (
        prev.splitType === "custom" &&
        (!prev.splitDetails || prev.splitDetails.length === 0)
      ) {
        const amountMinorResult = parseMoneyToMinor(
          prev.amount,
          prev.currency,
          CURRENCY_MINOR_UNITS
        );
        const amountMinor =
          typeof amountMinorResult === "bigint" ? Number(amountMinorResult) : 0;
        next.splitDetails = buildEqualSplit(amountMinor, activeSplitMemberIds);
        changed = true;
      }

      return changed ? next : prev;
    });
  }, [
    activeSplitMemberIds,
    activeSplitParticipants,
    currentUserId,
    hasParticipantsContext,
    isSharedSplitAccount,
  ]);

  // Form mode (panels vs list)
  const [formMode, setFormModeState] = React.useState<FormMode>("panels");

  // Load form mode from localStorage on mount
  React.useEffect(() => {
    setFormModeState(getFormMode());
  }, []);

  const handleFormModeChange = (mode: FormMode) => {
    setFormModeState(mode);
    setFormMode(mode);
  };

  const getStepKey = (step: number): FormStepKey => {
    return stepOrder[step - 1] ?? "details";
  };

  // Field change handler
  const handleFieldChange = <K extends keyof TransactionDraft>(
    field: K,
    value: TransactionDraft[K]
  ) => {
    setDraft((prev) => ({ ...prev, [field]: value }));
    // Clear error for this field when user starts typing
    if (errors[field]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  };

  // Step navigation
  const goToStep = (step: number) => {
    setCurrentStep(step);
  };

  const validateCurrentStep = (step: number) => {
    const stepKey = getStepKey(step);

    if (stepKey === "details") {
      return validateStep1(draft);
    }

    if (stepKey === "recurring") {
      const recurringErrors: Record<string, string> = {};
      const interval = Number(recurringInterval);
      if (!recurringInterval.trim() || !Number.isFinite(interval) || interval < 1) {
        recurringErrors.recurringInterval = "errors.invalidRequest";
      }
      return {
        valid: Object.keys(recurringErrors).length === 0,
        errors: recurringErrors,
      };
    }

    if (stepKey === "category") {
      // Category is optional for recurring mode and obligations.
      if (isRecurringMode || draft.isObligation) {
        return { valid: true, errors: {} };
      }
      return validateStep2(draft);
    }

    return { valid: true, errors: {} };
  };

  const handleNext = () => {
    const validation = validateCurrentStep(currentStep);

    if (!validation.valid) {
      setErrors(validation.errors);
      return;
    }

    setErrors({});
    if (currentStep < totalSteps) {
      setCurrentStep((prev) => prev + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep((prev) => prev - 1);
    }
  };

  // Submit handler
  const handleSubmit = async () => {
    const aggregatedErrors: Record<string, string> = {};
    let firstInvalidStep: number | null = null;

    for (let step = 1; step <= totalSteps; step += 1) {
      const validation = validateCurrentStep(step);
      if (!validation.valid) {
        Object.assign(aggregatedErrors, validation.errors);
        if (firstInvalidStep === null) {
          firstInvalidStep = step;
        }
      }
    }

    if (firstInvalidStep !== null) {
      setErrors(aggregatedErrors);
      setCurrentStep(firstInvalidStep);
      return;
    }

    const normalizedDraft: TransactionDraft = { ...draft };
    if (normalizedDraft.type !== "expense") {
      normalizedDraft.projectId = null;
    }
    normalizedDraft.paidByUserId =
      draft.paidByUserId ??
      currentUserId ??
      activeSplitParticipants[0]?.userId ??
      null;

    if (!normalizedDraft.paidByUserId && activeSplitParticipants.length > 0) {
      setErrors((prev) => ({
        ...prev,
        paidByUserId: "addTransaction.errors.paidByRequired",
      }));
      setCurrentStep(1);
      return;
    }

    if (hasParticipantsContext && !isSharedSplitAccount) {
      normalizedDraft.splitType = "personal";
      normalizedDraft.splitDetails = null;
    } else if (hasParticipantsContext && normalizedDraft.type === "income") {
      normalizedDraft.splitType = "equal";
      normalizedDraft.splitDetails = null;
    } else if (normalizedDraft.splitType === "custom") {
      const amountMinorResult = parseMoneyToMinor(
        normalizedDraft.amount,
        normalizedDraft.currency,
        CURRENCY_MINOR_UNITS
      );
      if (typeof amountMinorResult === "bigint") {
        const amountMinor = Number(amountMinorResult);
        const currentDetails =
          normalizedDraft.splitDetails && normalizedDraft.splitDetails.length > 0
            ? normalizedDraft.splitDetails
            : buildEqualSplit(amountMinor, activeSplitMemberIds);

        const detailsByUser = new Map(
          currentDetails.map((detail) => [
            detail.userId,
            Math.max(0, Math.trunc(detail.shareMinor)),
          ])
        );

        const normalizedDetails = activeSplitMemberIds.map((userId) => ({
          userId,
          shareMinor: detailsByUser.get(userId) ?? 0,
        }));
        const totalDetails = normalizedDetails.reduce(
          (acc, detail) => acc + detail.shareMinor,
          0
        );

        if (totalDetails !== amountMinor) {
          setErrors((prev) => ({
            ...prev,
            splitDetails: "addTransaction.errors.splitTotalMismatch",
          }));
          setCurrentStep(1);
          return;
        }

        normalizedDraft.splitDetails = normalizedDetails;
      }
    } else {
      normalizedDraft.splitDetails = null;
    }

    setIsSubmitting(true);

    try {
      const recurringData =
        isRecurringMode
          ? {
              recurring: {
                frequency: recurringFrequency,
                interval: Number(recurringInterval),
                startDate: draft.date,
                endDate: recurringEndDate.trim() || null,
              },
            }
          : undefined;

      if (onSubmitDraft) {
        await onSubmitDraft(normalizedDraft, recurringData);
        toast.success(
          successMessageKey
            ? translateDynamic(successMessageKey)
            : mode === "edit"
              ? tTransactions("updateSuccess")
              : t("successToast")
        );
        onSuccess?.();
        return;
      }

      if (mode === "edit") {
        throw new Error("Missing edit submit handler");
      }
      if (isRecurringMode) {
        throw new Error("Missing recurring submit handler");
      }

      // If it's an obligation, create it via createObligation
      if (draft.isObligation) {
        const dueDate = resolveObligationDueDate(normalizedDraft);
        const result = await createObligation({
          account_id: accountId,
          name: normalizedDraft.name,
          amount: normalizedDraft.amount,
          currency: normalizedDraft.currency,
          due_date: dueDate,
          status: "pending",
          paid_at: null,
        });

        if (!result.success) {
          toast.error(t("errorToast"));
          return;
        }

        toast.success(t("successToast"));
        onSuccess?.();
        return;
      }

      // Otherwise, create a regular transaction
      const splitDetailsPayload =
        normalizedDraft.splitType === "custom"
          ? (normalizedDraft.splitDetails ?? []).map((split) => ({
              user_id: split.userId,
              share_minor: Math.max(0, Math.trunc(split.shareMinor)),
            }))
          : null;

      const result = await createTransaction({
        account_id: accountId,
        type: normalizedDraft.type,
        amount: normalizedDraft.amount,
        currency: normalizedDraft.currency,
        category_id: normalizedDraft.categoryId,
        project_id:
          normalizedDraft.type === "expense" ? normalizedDraft.projectId : null,
        date: normalizedDraft.date,
        merchant: normalizedDraft.merchant || null,
        notes: normalizedDraft.notes || null,
        paid_by: normalizedDraft.paidByUserId,
        split_type: normalizedDraft.splitType as ContributionSplitType,
        split_details: splitDetailsPayload,
      });

      if (!result.success) {
        toast.error(t("errorToast"));
        return;
      }

      // TODO: Handle photo uploads here if draft.photos.length > 0
      // For now, we'll skip photo uploads and just show success

      toast.success(t("successToast"));
      onSuccess?.();
    } catch (error: any) {
      console.error("Failed to create transaction:", error);
      toast.error(
        error?.message ||
          (errorMessageKey
            ? translateDynamic(errorMessageKey)
            : mode === "edit"
              ? tTransactions("updateError")
              : t("errorToast"))
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const recurringStepContent = (
    <div className="space-y-6">
      <div className="space-y-3 rounded-xl border border-border bg-muted/30 p-4">
        <Label className="text-base font-semibold">
          {tTransactions("repeat.frequencyLabel")}
        </Label>
        <Select
          value={recurringFrequency}
          onValueChange={(value) =>
            setRecurringFrequency(value as RecurringFrequency)
          }
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="weekly">{tTransactions("repeat.weekly")}</SelectItem>
            <SelectItem value="monthly">{tTransactions("repeat.monthly")}</SelectItem>
            <SelectItem value="yearly">{tTransactions("repeat.yearly")}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-3 rounded-xl border border-border bg-muted/30 p-4">
        <Label htmlFor="recurring-interval" className="text-base font-semibold">
          {tTransactions("repeat.intervalLabel")}
        </Label>
        <Input
          id="recurring-interval"
          value={recurringInterval}
          onChange={(event) => {
            const sanitized = event.target.value.replace(/[^0-9]/g, "");
            setRecurringInterval(sanitized);
            if (errors.recurringInterval) {
              setErrors((prev) => {
                const next = { ...prev };
                delete next.recurringInterval;
                return next;
              });
            }
          }}
          placeholder="1"
          inputMode="numeric"
        />
        {errors.recurringInterval ? (
          <p className="text-sm text-destructive">
            {translateDynamic(errors.recurringInterval)}
          </p>
        ) : null}
      </div>

      <div className="space-y-3 rounded-xl border border-border bg-muted/30 p-4">
        <Label htmlFor="recurring-end-date" className="text-base font-semibold">
          {tTransactions("repeat.endDateLabel")}
        </Label>
        <Input
          id="recurring-end-date"
          type="date"
          value={recurringEndDate}
          onChange={(event) => setRecurringEndDate(event.target.value)}
        />
      </div>
    </div>
  );

  const getStepLabel = (stepKey: FormStepKey) => {
    if (stepKey === "details") return t("stepDetails");
    if (stepKey === "recurring") return tTransactions("repeat.label");
    return t("stepCategory");
  };

  // Step status calculation
  const getStepStatus = (step: number): StepStatus => {
    if (step === currentStep) return "active";
    if (step < currentStep) return "completed";
    return "pending";
  };

  const steps = stepOrder.map((stepKey, index) => ({
    number: index + 1,
    label: getStepLabel(stepKey),
    status: getStepStatus(index + 1),
  }));

  const handleRequestAddCategory = React.useCallback(
    (categoryType: "income" | "expense") => {
      if (onRequestAddCategory) {
        onRequestAddCategory(categoryType);
        return;
      }
      router.push(`/account/${accountId}/settings/categories`);
    },
    [accountId, onRequestAddCategory, router]
  );

  // Render step content
  const renderStepContent = (step: number) => {
    const stepKey = getStepKey(step);

    if (stepKey === "details") {
      return (
        <Step1Details
          draft={draft}
          errors={errors}
          locale={locale}
          accountId={accountId}
          categories={categories}
          showQuickAdd={useQuickAddStep}
          onFieldChange={handleFieldChange}
          allowObligation={allowObligation}
          splitParticipants={activeSplitParticipants}
          currentUserId={currentUserId}
          showSplitControls={!isRecurringMode}
        />
      );
    }

    if (stepKey === "recurring") {
      return recurringStepContent;
    }

    if (stepKey === "category") {
      return (
        <Step2Category
          draft={draft}
          errors={errors}
          topCategories={currentTopCategories}
          allCategories={categories}
          categoryOccurrenceCounts={categoryOccurrencesByType[draft.type]}
          merchantSuggestions={currentMerchantSuggestions}
          categoryMerchantOptions={categoryMerchantsByType[draft.type]}
          projectOptions={projectOptions}
          showProjectAssignment={!isRecurringMode}
          onFieldChange={handleFieldChange}
          onAddCategory={handleRequestAddCategory}
        />
      );
    }

    return null;
  };

  // Panels mode
  if (formMode === "panels") {
    return (
      <div className="flex flex-col h-full">
        {/* Header with stepper and mode toggle */}
        <div className="space-y-4 pb-4 border-b">
          <div className="flex items-center justify-between gap-4">
            <TransactionStepperBreadcrumb
              steps={steps}
              onStepClick={(step) => step < currentStep && goToStep(step)}
            />
            <FormModeToggle mode={formMode} onChange={handleFormModeChange} />
          </div>
        </div>

        {/* Step content */}
        <div className="flex-1 overflow-hidden py-6">
          <TransactionStepCarousel
            currentStep={currentStep}
            steps={stepOrder.map((_, index) => renderStepContent(index + 1))}
          />
        </div>

        {/* Footer with navigation buttons */}
        <div className="flex items-center justify-between pt-4 border-t">
          <div>
            {currentStep > 1 ? (
              <Button type="button" variant="ghost" onClick={handleBack}>
                {t("back")}
              </Button>
            ) : (
              <Button type="button" variant="ghost" onClick={onCancel}>
                {t("cancel")}
              </Button>
            )}
          </div>
          <div>
            {currentStep < totalSteps ? (
              <Button type="button" onClick={handleNext}>
                {t("next")}
              </Button>
            ) : (
              <Button
                type="button"
                onClick={handleSubmit}
                disabled={isSubmitting}
              >
                {isSubmitting ? t("saving") : t("save")}
              </Button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // List mode - all steps in one scroll
  return (
    <div className="flex flex-col h-full">
      {/* Header with mode toggle */}
      <div className="flex items-center justify-end pb-4 border-b">
        <FormModeToggle mode={formMode} onChange={handleFormModeChange} />
      </div>

      {/* All steps */}
      <div className="flex-1 overflow-y-auto py-6 space-y-8">
        {stepOrder.map((_, index) => (
          <div key={index}>{renderStepContent(index + 1)}</div>
        ))}
      </div>

      {/* Footer with submit button */}
      <div className="flex items-center justify-between pt-4 border-t">
        <Button type="button" variant="ghost" onClick={onCancel}>
          {t("cancel")}
        </Button>
        <Button type="button" onClick={handleSubmit} disabled={isSubmitting}>
          {isSubmitting ? t("saving") : t("save")}
        </Button>
      </div>
    </div>
  );
}
