import { useState, useEffect, useRef, useMemo } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Alert,
  Animated,
  TextInput,
  Pressable,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";
import {
  themeTokens,
  ConfirmationModal,
  computeCategoryOccurrencesByType,
  EMPTY_CATEGORY_OCCURRENCES_BY_TYPE,
  formatDateISO,
  type TransactionDraft,
  type Transaction,
  type CategoryOccurrencesByType,
  type ContributionSplitType,
  type FormMode,
  type StepStatus,
  type TopCategory,
  type MerchantSuggestion,
  type RecurringFrequency,
  type MutationAction,
  type MutationEntity,
  buildEqualSplit,
  createInitialDraft,
  validateStep1,
  validateStep2,
  parseMoneyToMinor,
  CURRENCY_MINOR_UNITS,
  normalizeMerchant,
} from "@poleursus/shared";
import { useCachedTransactionsRange } from "../../cache/hooks";
import { useCopy, t } from "../../lib/i18n";
import { useAuth } from "../../contexts/AuthContext";
import { useUserTheme } from "../../contexts/UserThemeContext";
import { supabase } from "../../lib/supabase";
import { Button } from "../Button";
import { DatePickerField } from "../DatePickerField";
import { TransactionStepperBreadcrumb } from "./TransactionStepperBreadcrumb";
import { FormModeToggle } from "./FormModeToggle";
import { Step1Details, Step2Category } from "./steps";

const tokens = themeTokens.light;
const colors = tokens.colors;
const SCREEN_WIDTH = Dimensions.get("window").width;
const FORM_MODE_KEY = "finnon:addTransaction:formMode";

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

interface AddTransactionFormProps {
  type?: "income" | "expense";
  accountId: string;
  currency: string;
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
  onMutationSuccess?: (
    entity: MutationEntity,
    action: MutationAction
  ) => Promise<void> | void;
  onSuccess?: () => void;
  onCancel?: () => void;
}

export function AddTransactionForm({
  type = "expense",
  accountId,
  currency,
  categories,
  topCategories,
  merchantSuggestions,
  participants = [],
  defaultDate,
  mode = "create",
  initialDraft,
  allowObligation = true,
  submitMode = "transaction",
  successMessageKey,
  errorMessageKey,
  onSubmitDraft,
  onRequestAddCategory,
  onMutationSuccess,
  onSuccess,
  onCancel,
}: AddTransactionFormProps) {
  const router = useRouter();
  const { dictionary } = useCopy();
  const { user } = useAuth();
  const { tokens: userTokens, primaryActionColor, primaryActionTextColor } =
    useUserTheme();
  const translateDynamic = (key: string) => t(dictionary, key as never);
  const isRecurringMode = submitMode === "recurring";
  const useQuickAddStep = mode === "create" && !isRecurringMode;
  const stepOrder: FormStepKey[] = isRecurringMode
    ? ["details", "recurring", "category"]
    : ["details", "category"];
  const totalSteps = stepOrder.length;
  const activeSplitParticipants = useMemo(
    () =>
      participants.filter(
        (participant) =>
          participant.role === "admin" || participant.role === "contributor"
      ),
    [participants]
  );
  const activeSplitMemberIds = useMemo(
    () => activeSplitParticipants.map((participant) => participant.userId),
    [activeSplitParticipants]
  );
  const isSharedSplitAccount = activeSplitParticipants.length >= 2;
  const hasParticipantsContext = participants.length > 0;

  // Form state
  const [draft, setDraft] = useState<TransactionDraft>(() =>
    initialDraft ?? createInitialDraft(type, currency, defaultDate)
  );

  // Get current top categories and merchant suggestions based on draft type
  const currentTopCategories = topCategories[draft.type];
  const currentMerchantSuggestions = merchantSuggestions[draft.type];
  const loadCachedTransactionsRange = useCachedTransactionsRange();
  const [categoryMerchantsByType, setCategoryMerchantsByType] =
    useState<CategoryMerchantsByType>(EMPTY_CATEGORY_MERCHANTS);
  const [categoryOccurrencesByType, setCategoryOccurrencesByType] =
    useState<CategoryOccurrencesByType>(EMPTY_CATEGORY_OCCURRENCES_BY_TYPE);
  const [currentStep, setCurrentStep] = useState(1);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccessOpen, setIsSuccessOpen] = useState(false);
  const [recurringFrequency, setRecurringFrequency] =
    useState<RecurringFrequency>("monthly");
  const [recurringInterval, setRecurringInterval] = useState("1");
  const [recurringEndDate, setRecurringEndDate] = useState("");

  useEffect(() => {
    let cancelled = false;
    setCategoryMerchantsByType(EMPTY_CATEGORY_MERCHANTS);

    const loadCategoryMerchants = async () => {
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

  useEffect(() => {
    if (!accountId) {
      setCategoryOccurrencesByType(EMPTY_CATEGORY_OCCURRENCES_BY_TYPE);
      return;
    }

    let cancelled = false;

    const loadCategoryOccurrences = async () => {
      const today = new Date();
      const start = formatDateISO(subtractDays(today, 90));
      const end = formatDateISO(today);

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

  useEffect(() => {
    if (initialDraft) {
      setDraft(initialDraft);
    } else {
      setDraft(createInitialDraft(type, currency, defaultDate));
    }
    setCurrentStep(1);
    setErrors({});
  }, [currency, defaultDate, initialDraft, type]);

  useEffect(() => {
    if (!isRecurringMode) return;
    setRecurringFrequency("monthly");
    setRecurringInterval("1");
    setRecurringEndDate("");
  }, [isRecurringMode, accountId]);

  useEffect(() => {
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

  useEffect(() => {
    setDraft((prev) => {
      const next = { ...prev };
      let changed = false;

      const shouldAutofillPaidBy = !(hasParticipantsContext && isSharedSplitAccount);
      if (shouldAutofillPaidBy) {
        const defaultPaidBy =
          prev.paidByUserId ??
          user?.id ??
          activeSplitParticipants[0]?.userId ??
          null;

        if (defaultPaidBy && defaultPaidBy !== prev.paidByUserId) {
          next.paidByUserId = defaultPaidBy;
          changed = true;
        }
      }

      if (!isSharedSplitAccount) {
        if (prev.splitType !== "personal") {
          next.splitType = "personal";
          changed = true;
        }
        if (prev.splitDetails !== null) {
          next.splitDetails = null;
          changed = true;
        }
      } else if (prev.type === "income") {
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
    hasParticipantsContext,
    isSharedSplitAccount,
    user?.id,
  ]);

  // Form mode (panels vs list)
  const [formMode, setFormModeState] = useState<FormMode>("panels");

  // Animation for carousel
  const slideAnim = useRef(new Animated.Value(0)).current;

  // Scroll view refs for auto-scroll on step change (panels mode)
  const scrollViewRefs = useRef<Record<string, KeyboardAwareScrollView | null>>({});

  // Load form mode from storage on mount
  useEffect(() => {
    AsyncStorage.getItem(FORM_MODE_KEY).then((value) => {
      if (value === "panels" || value === "list") {
        setFormModeState(value);
      }
    });
  }, []);

  // Animate step changes
  useEffect(() => {
    Animated.spring(slideAnim, {
      toValue: -(currentStep - 1) * SCREEN_WIDTH,
      useNativeDriver: true,
      friction: 8,
      tension: 40,
    }).start();
  }, [currentStep, slideAnim]);

  // Auto-scroll to top on step change (panels mode)
  useEffect(() => {
    if (formMode !== "panels") return;
    const stepKey = getStepKey(currentStep);
    const scrollView = scrollViewRefs.current[stepKey];
    if (scrollView) {
      scrollView.scrollToPosition(0, 0, false);
    }
  }, [currentStep, formMode]);

  const handleFormModeChange = async (mode: FormMode) => {
    setFormModeState(mode);
    await AsyncStorage.setItem(FORM_MODE_KEY, mode);
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

  const handleSuccessAcknowledge = () => {
    setIsSuccessOpen(false);
    onSuccess?.();
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

    if (!user) {
      Alert.alert(
        t(dictionary, "common.errorTitle"),
        t(dictionary, "errors.authRequired")
      );
      return;
    }

    const normalizedDraft: TransactionDraft = { ...draft };
    normalizedDraft.paidByUserId =
      draft.paidByUserId ??
      user.id ??
      activeSplitParticipants[0]?.userId ??
      null;

    if (!normalizedDraft.paidByUserId) {
      setErrors((prev) => ({
        ...prev,
        paidByUserId: "addTransaction.errors.paidByRequired",
      }));
      setCurrentStep(1);
      return;
    }

    if (!isSharedSplitAccount) {
      normalizedDraft.splitType = "personal";
      normalizedDraft.splitDetails = null;
    } else if (normalizedDraft.type === "income") {
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
        setIsSuccessOpen(true);
        return;
      }

      if (mode === "edit") {
        throw new Error("Missing edit submit handler");
      }
      if (isRecurringMode) {
        throw new Error("Missing recurring submit handler");
      }

      // Parse amount to minor units
      const amountMinorResult = parseMoneyToMinor(
        normalizedDraft.amount,
        normalizedDraft.currency,
        CURRENCY_MINOR_UNITS
      );

      // Check for parse errors
      if (typeof amountMinorResult === "object" && "error" in amountMinorResult) {
        setErrors({ amount: amountMinorResult.error.key });
        setCurrentStep(1);
        setIsSubmitting(false);
        return;
      }

      // Convert BigInt to Number for Supabase serialization
      const amountMinor = Number(amountMinorResult);

      // If it's an obligation, create it instead of a transaction
      if (normalizedDraft.isObligation) {
        const dueDate = resolveObligationDueDate(normalizedDraft);
        const { error: obligationError } = await supabase
          .from("obligations")
          .insert({
            account_id: accountId,
            name: normalizedDraft.name,
            amount_minor: amountMinor,
            currency: normalizedDraft.currency,
            due_date: dueDate,
            status: "pending",
            paid_at: null,
            created_by: user.id,
          })
          .select()
          .single();

        if (obligationError) throw obligationError;

        await onMutationSuccess?.("obligations", "insert");
        setIsSuccessOpen(true);
        return;
      }

      const splitType: ContributionSplitType = isSharedSplitAccount
        ? normalizedDraft.splitType
        : "personal";

      const splitDetails =
        splitType === "custom"
          ? (normalizedDraft.splitDetails ?? []).map((detail) => ({
              user_id: detail.userId,
              share_minor: Math.max(0, Math.trunc(detail.shareMinor)),
            }))
          : null;

      // Insert regular transaction
      const { error } = await supabase
        .from("transactions")
        .insert({
          account_id: accountId,
          type: normalizedDraft.type,
          amount_minor: amountMinor,
          amount_base_minor: amountMinor, // Same if base currency
          currency: normalizedDraft.currency,
          category_id: normalizedDraft.categoryId,
          date: normalizedDraft.date,
          merchant: normalizedDraft.merchant || null,
          notes: normalizedDraft.notes || null,
          created_by: user.id,
          paid_by: normalizedDraft.paidByUserId,
          split_type: splitType,
          split_details: splitDetails,
        })
        .select()
        .single();

      if (error) throw error;

      // TODO: Handle photo uploads here if draft.photos.length > 0

      await onMutationSuccess?.("transactions", "insert");
      setIsSuccessOpen(true);
    } catch (error: any) {
      console.error("Failed to create transaction:", error);
      Alert.alert(
        t(dictionary, "common.errorTitle"),
        error?.message ||
          (errorMessageKey
            ? translateDynamic(errorMessageKey)
            : mode === "edit"
              ? t(dictionary, "transactions.updateError")
              : t(dictionary, "addTransaction.errorToast"))
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const recurringFields = (
    <View
      style={[
        styles.recurringSection,
        { backgroundColor: userTokens.surfaceAlt, borderColor: userTokens.border },
      ]}
    >
      <Text style={[styles.recurringLabel, { color: userTokens.textPrimary }]}>
        {t(dictionary, "transactions.repeat.frequencyLabel")}
      </Text>
      <View
        style={[
          styles.frequencySelector,
          { backgroundColor: userTokens.surface, borderColor: userTokens.border },
        ]}
      >
        {(["weekly", "monthly", "yearly"] as const).map((value) => {
          const isActive = recurringFrequency === value;
          return (
            <Pressable
              key={value}
              onPress={() => setRecurringFrequency(value)}
              style={[
                styles.frequencyOption,
                isActive && { backgroundColor: primaryActionColor },
              ]}
            >
              <Text
                style={[
                  styles.frequencyOptionText,
                  { color: userTokens.textSecondary },
                  isActive && { color: primaryActionTextColor },
                ]}
              >
                {translateDynamic(`transactions.repeat.${value}`)}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Text style={[styles.recurringLabel, { color: userTokens.textPrimary }]}>
        {t(dictionary, "transactions.repeat.intervalLabel")}
      </Text>
      <TextInput
        value={recurringInterval}
        onChangeText={(value) => {
          const sanitized = value.replace(/[^0-9]/g, "");
          setRecurringInterval(sanitized);
          if (errors.recurringInterval) {
            setErrors((prev) => {
              const next = { ...prev };
              delete next.recurringInterval;
              return next;
            });
          }
        }}
        keyboardType="number-pad"
        placeholder="1"
        placeholderTextColor={userTokens.textTertiary}
        style={[
          styles.recurringIntervalInput,
          {
            backgroundColor: userTokens.surface,
            borderColor: userTokens.border,
            color: userTokens.textPrimary,
          },
        ]}
      />
      {errors.recurringInterval ? (
        <Text style={styles.recurringErrorText}>
          {translateDynamic(errors.recurringInterval)}
        </Text>
      ) : null}

      <DatePickerField
        label={t(dictionary, "transactions.repeat.endDateLabel")}
        value={recurringEndDate}
        onChangeText={setRecurringEndDate}
        placeholder={t(dictionary, "transactions.datePlaceholder")}
        allowClear
      />
    </View>
  );

  const getStepLabel = (stepKey: FormStepKey) => {
    if (stepKey === "details") return translateDynamic("addTransaction.stepDetails");
    if (stepKey === "recurring") return translateDynamic("transactions.repeat.label");
    return translateDynamic("addTransaction.stepCategory");
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

  const handleRequestAddCategory = (categoryType: "income" | "expense") => {
    if (onRequestAddCategory) {
      onRequestAddCategory(categoryType);
      return;
    }
    router.push(`/(auth)/(tabs)/account/categories/create?type=${categoryType}`);
  };

  // Panels mode
  if (formMode === "panels") {
    return (
      <View style={[styles.container, { backgroundColor: userTokens.background }]}> 
        {/* Header with stepper and mode toggle */}
        <View style={[styles.header, { borderBottomColor: userTokens.border }]}> 
          <TransactionStepperBreadcrumb
            steps={steps}
            onStepClick={(step) => step < currentStep && goToStep(step)}
          />
          <FormModeToggle mode={formMode} onChange={handleFormModeChange} />
        </View>

        {/* Step content carousel */}
        <View style={styles.carouselContainer}>
          <Animated.View
            style={[
              styles.carousel,
              {
                width: SCREEN_WIDTH * totalSteps,
                transform: [{ translateX: slideAnim }],
              },
            ]}
          >
            <View style={styles.carouselStep}>
              <KeyboardAwareScrollView
                ref={(el) => { scrollViewRefs.current.details = el; }}
                style={styles.stepScrollView}
                contentContainerStyle={styles.stepContent}
                enableOnAndroid
                extraScrollHeight={80}
                keyboardShouldPersistTaps="handled"
              >
                <Step1Details
                  draft={draft}
                  errors={errors}
                  accountId={accountId}
                  categories={categories}
                  showQuickAdd={useQuickAddStep}
                  onFieldChange={handleFieldChange}
                  allowObligation={allowObligation}
                  splitParticipants={activeSplitParticipants}
                  currentUserId={user?.id ?? null}
                  showSplitControls={!isRecurringMode}
                />
              </KeyboardAwareScrollView>
            </View>

            {isRecurringMode && (
              <View style={styles.carouselStep}>
                <KeyboardAwareScrollView
                  ref={(el) => { scrollViewRefs.current.recurring = el; }}
                  style={styles.stepScrollView}
                  contentContainerStyle={styles.stepContent}
                  enableOnAndroid
                  extraScrollHeight={80}
                  keyboardShouldPersistTaps="handled"
                >
                  {recurringFields}
                </KeyboardAwareScrollView>
              </View>
            )}

            <View style={styles.carouselStep}>
              <KeyboardAwareScrollView
                ref={(el) => { scrollViewRefs.current.category = el; }}
                style={styles.stepScrollView}
                contentContainerStyle={styles.stepContent}
                enableOnAndroid
                extraScrollHeight={80}
                keyboardShouldPersistTaps="handled"
              >
                <Step2Category
                  draft={draft}
                  errors={errors}
                  topCategories={currentTopCategories}
                  allCategories={categories}
                  categoryOccurrenceCounts={categoryOccurrencesByType[draft.type]}
                  merchantSuggestions={currentMerchantSuggestions}
                  categoryMerchantOptions={categoryMerchantsByType[draft.type]}
                  onFieldChange={handleFieldChange}
                  onAddCategory={handleRequestAddCategory}
                />
              </KeyboardAwareScrollView>
            </View>
          </Animated.View>
        </View>

        {/* Footer with navigation buttons */}
        <View style={[styles.footer, { borderTopColor: userTokens.border }]}> 
          {currentStep > 1 ? (
            <Button
              onPress={handleBack}
              title={t(dictionary, "addTransaction.back")}
              variant="secondary"
            />
          ) : (
            <Button
              onPress={() => onCancel?.()}
              title={t(dictionary, "addTransaction.cancel")}
              variant="secondary"
            />
          )}
          {currentStep < totalSteps ? (
            <Button
              onPress={handleNext}
              title={t(dictionary, "addTransaction.next")}
            />
          ) : (
            <Button
              onPress={handleSubmit}
              title={
                isSubmitting
                  ? t(dictionary, "addTransaction.saving")
                  : t(dictionary, "addTransaction.save")
              }
              disabled={isSubmitting}
              loading={isSubmitting}
            />
          )}
        </View>
        <ConfirmationModal
          open={isSuccessOpen}
          title={t(dictionary, "common.successTitle")}
          description={
            successMessageKey
              ? translateDynamic(successMessageKey)
              : mode === "edit"
                ? t(dictionary, "transactions.updateSuccess")
                : t(dictionary, "addTransaction.successToast")
          }
          confirmLabel={t(dictionary, "common.ok")}
          onConfirm={handleSuccessAcknowledge}
          onCancel={handleSuccessAcknowledge}
        />
      </View>
    );
  }

  // List mode - all steps in one scroll
  return (
    <View style={[styles.container, { backgroundColor: userTokens.background }]}> 
      {/* Header with mode toggle */}
      <View style={[styles.headerList, { borderBottomColor: userTokens.border }]}> 
        <FormModeToggle mode={formMode} onChange={handleFormModeChange} />
      </View>

      {/* All steps */}
      <KeyboardAwareScrollView
        contentContainerStyle={styles.listContent}
        enableOnAndroid
        extraScrollHeight={80}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.listSection}>
          <Step1Details
            draft={draft}
            errors={errors}
            accountId={accountId}
            categories={categories}
            showQuickAdd={useQuickAddStep}
            onFieldChange={handleFieldChange}
            allowObligation={allowObligation}
            splitParticipants={activeSplitParticipants}
            currentUserId={user?.id ?? null}
            showSplitControls={!isRecurringMode}
          />
        </View>

        {isRecurringMode && <View style={styles.listSection}>{recurringFields}</View>}

        <View style={styles.listSection}>
          <Step2Category
            draft={draft}
            errors={errors}
            topCategories={currentTopCategories}
            allCategories={categories}
            categoryOccurrenceCounts={categoryOccurrencesByType[draft.type]}
            merchantSuggestions={currentMerchantSuggestions}
            categoryMerchantOptions={categoryMerchantsByType[draft.type]}
            onFieldChange={handleFieldChange}
            onAddCategory={handleRequestAddCategory}
          />
        </View>
      </KeyboardAwareScrollView>

      {/* Footer with submit button */}
      <View style={[styles.footer, { borderTopColor: userTokens.border }]}> 
        <Button
          onPress={() => onCancel?.()}
          title={t(dictionary, "addTransaction.cancel")}
          variant="secondary"
        />
        <Button
          onPress={handleSubmit}
          title={
            isSubmitting
              ? t(dictionary, "addTransaction.saving")
              : t(dictionary, "addTransaction.save")
          }
          disabled={isSubmitting}
          loading={isSubmitting}
        />
      </View>
      <ConfirmationModal
        open={isSuccessOpen}
        title={t(dictionary, "common.successTitle")}
        description={
          successMessageKey
            ? translateDynamic(successMessageKey)
            : mode === "edit"
              ? t(dictionary, "transactions.updateSuccess")
              : t(dictionary, "addTransaction.successToast")
        }
        confirmLabel={t(dictionary, "common.ok")}
        onConfirm={handleSuccessAcknowledge}
        onCancel={handleSuccessAcknowledge}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg.primary,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: tokens.spacing.lg,
    paddingVertical: tokens.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.state.neutral,
  },
  headerList: {
    flexDirection: "row",
    justifyContent: "flex-end",
    paddingHorizontal: tokens.spacing.lg,
    paddingVertical: tokens.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.state.neutral,
  },
  carouselContainer: {
    flex: 1,
    overflow: "hidden",
  },
  carousel: {
    flexDirection: "row",
    flex: 1,
  },
  carouselStep: {
    width: SCREEN_WIDTH,
    flex: 1,
  },
  stepScrollView: {
    flex: 1,
  },
  stepContent: {
    padding: tokens.spacing.xl,
    paddingTop: tokens.spacing.xxl,
    paddingBottom: tokens.spacing.xxl,
  },
  listContent: {
    padding: tokens.spacing.xl,
    paddingBottom: tokens.spacing.xxl,
  },
  listSection: {
    marginBottom: tokens.spacing.xxl,
  },
  sectionTitle: {
    fontSize: tokens.typography.size.md,
    fontWeight: tokens.typography.weight.semibold,
    color: colors.text.muted,
    marginBottom: tokens.spacing.lg,
  },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: tokens.spacing.lg,
    paddingVertical: tokens.spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.state.neutral,
    gap: tokens.spacing.md,
  },
  recurringSection: {
    gap: tokens.spacing.md,
    padding: tokens.spacing.lg,
    borderWidth: 1,
    borderRadius: tokens.radii.lg,
  },
  recurringLabel: {
    fontSize: tokens.typography.size.md,
    fontWeight: tokens.typography.weight.semibold,
  },
  frequencySelector: {
    borderWidth: 1,
    borderRadius: tokens.radii.lg,
    padding: tokens.spacing.xs,
    flexDirection: "row",
    gap: tokens.spacing.xs,
  },
  frequencyOption: {
    flex: 1,
    borderRadius: tokens.radii.md,
    paddingVertical: tokens.spacing.md,
    alignItems: "center",
    justifyContent: "center",
  },
  frequencyOptionText: {
    fontSize: tokens.typography.size.sm,
    fontWeight: tokens.typography.weight.medium,
  },
  recurringIntervalInput: {
    borderWidth: 1,
    borderRadius: tokens.radii.lg,
    paddingVertical: tokens.spacing.lg,
    paddingHorizontal: tokens.spacing.lg,
    fontSize: tokens.typography.size.md,
  },
  recurringErrorText: {
    color: colors.state.negative,
    fontSize: tokens.typography.size.sm,
  },
});
