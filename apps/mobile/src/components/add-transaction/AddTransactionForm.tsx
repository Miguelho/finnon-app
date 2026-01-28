import { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Alert,
  Animated,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";
import {
  themeTokens,
  type TransactionDraft,
  type FormMode,
  type StepStatus,
  type TopCategory,
  type MerchantSuggestion,
  createInitialDraft,
  validateStep1,
  validateStep2,
  validateStep3,
  parseMoneyToMinor,
  CURRENCY_MINOR_UNITS,
} from "@poleursus/shared";
import { useCopy, t } from "../../lib/i18n";
import { useAuth } from "../../contexts/AuthContext";
import { supabase } from "../../lib/supabase";
import { Button } from "../Button";
import { TransactionStepperBreadcrumb } from "./TransactionStepperBreadcrumb";
import { FormModeToggle } from "./FormModeToggle";
import { Step1Details, Step2Category, Step3Notes } from "./steps";

const tokens = themeTokens.light;
const colors = tokens.colors;
const SCREEN_WIDTH = Dimensions.get("window").width;
const FORM_MODE_KEY = "finnon:addTransaction:formMode";

interface Category {
  id: string;
  name: string;
  icon_id: string;
  type: "income" | "expense";
}

interface AddTransactionFormProps {
  type: "income" | "expense";
  accountId: string;
  currency: string;
  categories: Category[];
  topCategories: TopCategory[];
  merchantSuggestions: MerchantSuggestion[];
  onSuccess?: () => void;
  onCancel?: () => void;
}

export function AddTransactionForm({
  type,
  accountId,
  currency,
  categories,
  topCategories,
  merchantSuggestions,
  onSuccess,
  onCancel,
}: AddTransactionFormProps) {
  const { dictionary } = useCopy();
  const { user } = useAuth();

  // Form state
  const [draft, setDraft] = useState<TransactionDraft>(() =>
    createInitialDraft(type, currency)
  );
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3>(1);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

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
  const goToStep = (step: 1 | 2 | 3) => {
    setCurrentStep(step);
  };

  const handleNext = () => {
    // Validate current step
    const validation =
      currentStep === 1
        ? validateStep1(draft)
        : currentStep === 2
          ? validateStep2(draft)
          : validateStep3(draft);

    if (!validation.valid) {
      setErrors(validation.errors);
      return;
    }

    setErrors({});
    if (currentStep < 3) {
      setCurrentStep((prev) => (prev + 1) as 1 | 2 | 3);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep((prev) => (prev - 1) as 1 | 2 | 3);
    }
  };

  // Submit handler
  const handleSubmit = async () => {
    // Validate all steps
    const step1 = validateStep1(draft);
    const step2 = validateStep2(draft);
    const step3 = validateStep3(draft);

    if (!step1.valid || !step2.valid || !step3.valid) {
      setErrors({ ...step1.errors, ...step2.errors, ...step3.errors });
      // Go to first invalid step
      if (!step1.valid) setCurrentStep(1);
      else if (!step2.valid) setCurrentStep(2);
      return;
    }

    if (!user) {
      Alert.alert(t(dictionary, "common.error"), t(dictionary, "common.notAuthenticated"));
      return;
    }

    setIsSubmitting(true);

    try {
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

      // Insert transaction
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

      Alert.alert(
        t(dictionary, "common.success"),
        t(dictionary, "addTransaction.successToast"),
        [{ text: t(dictionary, "common.ok"), onPress: () => onSuccess?.() }]
      );
    } catch (error: any) {
      console.error("Failed to create transaction:", error);
      Alert.alert(
        t(dictionary, "common.error"),
        error?.message || t(dictionary, "addTransaction.errorToast")
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  // Step status calculation
  const getStepStatus = (step: 1 | 2 | 3): StepStatus => {
    if (step === currentStep) return "active";
    if (step < currentStep) return "completed";
    return "pending";
  };

  const steps = [
    { number: 1 as const, label: t(dictionary, "addTransaction.stepDetails"), status: getStepStatus(1) },
    { number: 2 as const, label: t(dictionary, "addTransaction.stepCategory"), status: getStepStatus(2) },
    { number: 3 as const, label: t(dictionary, "addTransaction.stepNotes"), status: getStepStatus(3) },
  ];

  // Panels mode
  if (formMode === "panels") {
    return (
      <View style={styles.container}>
        {/* Header with stepper and mode toggle */}
        <View style={styles.header}>
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
              { transform: [{ translateX: slideAnim }] },
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
                <Step2Category
                  draft={draft}
                  errors={errors}
                  topCategories={topCategories}
                  allCategories={categories}
                  merchantSuggestions={merchantSuggestions}
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
        <View style={styles.footer}>
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
          {currentStep < 3 ? (
            <Button
              onPress={handleNext}
              title={t(dictionary, "addTransaction.next")}
            />
          ) : (
            <Button
              onPress={handleSubmit}
              title={isSubmitting ? t(dictionary, "addTransaction.saving") : t(dictionary, "addTransaction.save")}
              disabled={isSubmitting}
              loading={isSubmitting}
            />
          )}
        </View>
      </View>
    );
  }

  // List mode - all steps in one scroll
  return (
    <View style={styles.container}>
      {/* Header with mode toggle */}
      <View style={styles.headerList}>
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
          <Text style={styles.sectionTitle}>
            {t(dictionary, "addTransaction.stepDetails")}
          </Text>
          <Step1Details
            draft={draft}
            errors={errors}
            onFieldChange={handleFieldChange}
          />
        </View>

        <View style={styles.listSection}>
          <Text style={styles.sectionTitle}>
            {t(dictionary, "addTransaction.stepCategory")}
          </Text>
          <Step2Category
            draft={draft}
            errors={errors}
            topCategories={topCategories}
            allCategories={categories}
            merchantSuggestions={merchantSuggestions}
            onFieldChange={handleFieldChange}
          />
        </View>

        <View style={styles.listSection}>
          <Text style={styles.sectionTitle}>
            {t(dictionary, "addTransaction.stepNotes")}
          </Text>
          <Step3Notes
            draft={draft}
            errors={errors}
            onFieldChange={handleFieldChange}
          />
        </View>
      </KeyboardAwareScrollView>

      {/* Footer with submit button */}
      <View style={styles.footer}>
        <Button
          onPress={() => onCancel?.()}
          title={t(dictionary, "addTransaction.cancel")}
          variant="secondary"
        />
        <Button
          onPress={handleSubmit}
          title={isSubmitting ? t(dictionary, "addTransaction.saving") : t(dictionary, "addTransaction.save")}
          disabled={isSubmitting}
          loading={isSubmitting}
        />
      </View>
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
    width: SCREEN_WIDTH * 3,
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
});
