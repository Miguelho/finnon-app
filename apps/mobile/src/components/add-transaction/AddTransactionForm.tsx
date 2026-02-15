import { useState, useEffect, useRef } from "react";
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
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";
import {
  themeTokens,
  ConfirmationModal,
  type TransactionDraft,
  type FormMode,
  type StepStatus,
  type TopCategory,
  type MerchantSuggestion,
  type RecurringFrequency,
  createInitialDraft,
  validateStep1,
  validateStep2,
  validateStep3,
  parseMoneyToMinor,
  CURRENCY_MINOR_UNITS,
} from "@poleursus/shared";
import { useCopy, t } from "../../lib/i18n";
import { useAuth } from "../../contexts/AuthContext";
import { useUserTheme } from "../../contexts/UserThemeContext";
import { supabase } from "../../lib/supabase";
import { Button } from "../Button";
import { DatePickerField } from "../DatePickerField";
import { TransactionStepperBreadcrumb } from "./TransactionStepperBreadcrumb";
import { FormModeToggle } from "./FormModeToggle";
import { Step1Details, Step2Category, Step3Notes } from "./steps";

const tokens = themeTokens.light;
const colors = tokens.colors;
const SCREEN_WIDTH = Dimensions.get("window").width;
const FORM_MODE_KEY = "finnon:addTransaction:formMode";

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

type SubmitMode = "transaction" | "recurring";

type FormStepKey = "details" | "recurring" | "category" | "notes";

type RecurringSubmitData = {
  frequency: RecurringFrequency;
  interval: number;
  startDate: string;
  endDate: string | null;
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
  defaultDate,
  mode = "create",
  initialDraft,
  allowObligation = true,
  submitMode = "transaction",
  successMessageKey,
  errorMessageKey,
  onSubmitDraft,
  onSuccess,
  onCancel,
}: AddTransactionFormProps) {
  const { dictionary } = useCopy();
  const { user } = useAuth();
  const { tokens: userTokens, primaryActionColor, primaryActionTextColor } =
    useUserTheme();
  const translateDynamic = (key: string) => t(dictionary, key as never);
  const isRecurringMode = submitMode === "recurring";
  const stepOrder: FormStepKey[] = isRecurringMode
    ? ["details", "recurring", "category", "notes"]
    : ["details", "category", "notes"];
  const totalSteps = stepOrder.length;

  // Form state
  const [draft, setDraft] = useState<TransactionDraft>(() =>
    initialDraft ?? createInitialDraft(type, currency, defaultDate)
  );

  // Get current top categories and merchant suggestions based on draft type
  const currentTopCategories = topCategories[draft.type];
  const currentMerchantSuggestions = merchantSuggestions[draft.type];
  const [currentStep, setCurrentStep] = useState(1);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccessOpen, setIsSuccessOpen] = useState(false);
  const [recurringFrequency, setRecurringFrequency] =
    useState<RecurringFrequency>("monthly");
  const [recurringInterval, setRecurringInterval] = useState("1");
  const [recurringEndDate, setRecurringEndDate] = useState("");

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

  // Form mode (panels vs list)
  const [formMode, setFormModeState] = useState<FormMode>("panels");

  // Animation for carousel
  const slideAnim = useRef(new Animated.Value(0)).current;

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

    return validateStep3(draft);
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
        await onSubmitDraft(draft, recurringData);
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
        draft.amount,
        draft.currency,
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
      if (draft.isObligation) {
        const dueDate = resolveObligationDueDate(draft);
        const { error: obligationError } = await supabase
          .from("obligations")
          .insert({
            account_id: accountId,
            name: draft.name,
            amount_minor: amountMinor,
            currency: draft.currency,
            due_date: dueDate,
            status: "pending",
            paid_at: null,
            created_by: user.id,
          })
          .select()
          .single();

        if (obligationError) throw obligationError;

        setIsSuccessOpen(true);
        return;
      }

      // Insert regular transaction
      const { error } = await supabase
        .from("transactions")
        .insert({
          account_id: accountId,
          type: draft.type,
          amount_minor: amountMinor,
          amount_base_minor: amountMinor, // Same if base currency
          currency: draft.currency,
          category_id: draft.categoryId,
          date: draft.date,
          merchant: draft.merchant || null,
          notes: draft.notes || null,
          created_by: user.id,
        })
        .select()
        .single();

      if (error) throw error;

      // TODO: Handle photo uploads here if draft.photos.length > 0

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
    if (stepKey === "category") return translateDynamic("addTransaction.stepCategory");
    return translateDynamic("addTransaction.stepNotes");
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
                style={styles.stepScrollView}
                contentContainerStyle={styles.stepContent}
                enableOnAndroid
                extraScrollHeight={80}
                keyboardShouldPersistTaps="handled"
              >
                <Step1Details
                  draft={draft}
                  errors={errors}
                  onFieldChange={handleFieldChange}
                  allowObligation={allowObligation}
                />
              </KeyboardAwareScrollView>
            </View>

            {isRecurringMode && (
              <View style={styles.carouselStep}>
                <KeyboardAwareScrollView
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
                  merchantSuggestions={currentMerchantSuggestions}
                  onFieldChange={handleFieldChange}
                />
              </KeyboardAwareScrollView>
            </View>

            <View style={styles.carouselStep}>
              <KeyboardAwareScrollView
                style={styles.stepScrollView}
                contentContainerStyle={styles.stepContent}
                enableOnAndroid
                extraScrollHeight={80}
                keyboardShouldPersistTaps="handled"
              >
                <Step3Notes
                  draft={draft}
                  errors={errors}
                  onFieldChange={handleFieldChange}
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
            onFieldChange={handleFieldChange}
            allowObligation={allowObligation}
          />
        </View>

        {isRecurringMode && <View style={styles.listSection}>{recurringFields}</View>}

        <View style={styles.listSection}>
          <Step2Category
            draft={draft}
            errors={errors}
            topCategories={currentTopCategories}
            allCategories={categories}
            merchantSuggestions={currentMerchantSuggestions}
            onFieldChange={handleFieldChange}
          />
        </View>

        <View style={styles.listSection}>
          <Step3Notes
            draft={draft}
            errors={errors}
            onFieldChange={handleFieldChange}
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
