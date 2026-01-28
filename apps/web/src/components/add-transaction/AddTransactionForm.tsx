"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { TransactionStepperBreadcrumb } from "./TransactionStepperBreadcrumb";
import { TransactionStepCarousel } from "./TransactionStepCarousel";
import { FormModeToggle } from "./FormModeToggle";
import { Step1Details } from "./steps/Step1Details";
import { Step2Category } from "./steps/Step2Category";
import { Step3Notes } from "./steps/Step3Notes";
import { getFormMode, setFormMode } from "@/lib/form-mode-storage";
import { createTransaction, createObligation } from "@/app/transactions/actions";
import {
  type TransactionDraft,
  type FormMode,
  type StepStatus,
  type TopCategory,
  type MerchantSuggestion,
  createInitialDraft,
  validateStep1,
  validateStep2,
  validateStep3,
} from "@poleursus/shared";

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
  onSuccess,
  onCancel,
}: AddTransactionFormProps) {
  const t = useTranslations("addTransaction");

  // Form state
  const [draft, setDraft] = React.useState<TransactionDraft>(() =>
    createInitialDraft(type, currency)
  );

  // Get current top categories and merchant suggestions based on draft type
  const currentTopCategories = topCategories[draft.type];
  const currentMerchantSuggestions = merchantSuggestions[draft.type];
  const [currentStep, setCurrentStep] = React.useState<1 | 2 | 3>(1);
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = React.useState(false);

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
    // Skip category validation for obligations
    const step2 = draft.isObligation ? { valid: true, errors: {} } : validateStep2(draft);
    const step3 = validateStep3(draft);

    if (!step1.valid || !step2.valid || !step3.valid) {
      setErrors({ ...step1.errors, ...step2.errors, ...step3.errors });
      // Go to first invalid step
      if (!step1.valid) setCurrentStep(1);
      else if (!step2.valid) setCurrentStep(2);
      return;
    }

    setIsSubmitting(true);

    try {
      // If it's an obligation, create it via createObligation
      if (draft.isObligation) {
        const dueDate = resolveObligationDueDate(draft);
        const result = await createObligation({
          account_id: accountId,
          name: draft.name,
          amount: draft.amount,
          currency: draft.currency,
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
      const result = await createTransaction({
        account_id: accountId,
        type: draft.type,
        amount: draft.amount,
        currency: draft.currency,
        category_id: draft.categoryId,
        date: draft.date,
        merchant: draft.merchant || null,
        notes: draft.notes || null,
      });

      if (!result.success) {
        toast.error(t("errorToast"));
        return;
      }

      // TODO: Handle photo uploads here if draft.photos.length > 0
      // For now, we'll skip photo uploads and just show success

      toast.success(t("successToast"));
      onSuccess?.();
    } catch (error) {
      console.error("Failed to create transaction:", error);
      toast.error(t("errorToast"));
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
    { number: 1 as const, label: t("stepDetails"), status: getStepStatus(1) },
    { number: 2 as const, label: t("stepCategory"), status: getStepStatus(2) },
    { number: 3 as const, label: t("stepNotes"), status: getStepStatus(3) },
  ];

  // Render step content
  const renderStepContent = (step: 1 | 2 | 3) => {
    switch (step) {
      case 1:
        return (
          <Step1Details
            draft={draft}
            errors={errors}
            locale={locale}
            onFieldChange={handleFieldChange}
          />
        );
      case 2:
        return (
          <Step2Category
            draft={draft}
            errors={errors}
            topCategories={currentTopCategories}
            allCategories={categories}
            merchantSuggestions={currentMerchantSuggestions}
            onFieldChange={handleFieldChange}
          />
        );
      case 3:
        return (
          <Step3Notes
            draft={draft}
            errors={errors}
            onFieldChange={handleFieldChange}
          />
        );
    }
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
            step1={
              <Step1Details
                draft={draft}
                errors={errors}
                locale={locale}
                onFieldChange={handleFieldChange}
              />
            }
            step2={
              <Step2Category
                draft={draft}
                errors={errors}
                topCategories={currentTopCategories}
                allCategories={categories}
                merchantSuggestions={currentMerchantSuggestions}
                onFieldChange={handleFieldChange}
              />
            }
            step3={
              <Step3Notes
                draft={draft}
                errors={errors}
                onFieldChange={handleFieldChange}
              />
            }
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
            {currentStep < 3 ? (
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
        <div>{renderStepContent(1)}</div>
        <div>{renderStepContent(2)}</div>
        <div>{renderStepContent(3)}</div>
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
