/**
 * Validation logic for the Add Transaction form
 * Step-by-step validation with i18n-ready error keys
 */

import { z } from "zod";
import { parseMoneyToMinor, CURRENCY_MINOR_UNITS } from "../utils/money";
import type { TransactionDraft, StepValidationResult } from "./types";

/**
 * Step 1 validation schema: Date + Amount
 */
export const step1Schema = z.object({
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, {
      message: "addTransaction.errors.dateInvalid",
    }),
  amount: z
    .string()
    .min(1, { message: "addTransaction.errors.amountRequired" }),
});

/**
 * Step 2 validation schema: Category + Merchant
 */
export const step2Schema = z.object({
  categoryId: z
    .string()
    .min(1, { message: "addTransaction.errors.categoryRequired" })
    .nullable()
    .refine((val) => val !== null && val.length > 0, {
      message: "addTransaction.errors.categoryRequired",
    }),
  merchant: z.string().optional(),
});

/**
 * Step 3 validation schema: Notes + Photos (all optional)
 */
export const step3Schema = z.object({
  notes: z.string().optional(),
  photos: z.array(z.any()).optional(),
});

/**
 * Validate the amount field using parseMoneyToMinor
 * Returns the parsed bigint value or an error key
 */
export function validateAmount(
  amount: string,
  currency: string
): { valid: true; value: bigint } | { valid: false; error: string } {
  if (!amount || amount.trim() === "") {
    return { valid: false, error: "addTransaction.errors.amountRequired" };
  }

  const result = parseMoneyToMinor(amount, currency, CURRENCY_MINOR_UNITS);

  if (typeof result === "object" && "error" in result) {
    // Map money.ts error keys to addTransaction error keys
    const errorKeyMap: Record<string, string> = {
      "money.amountRequired": "addTransaction.errors.amountRequired",
      "money.invalidFormat": "addTransaction.errors.amountInvalid",
      "money.maxDecimalPlaces": "addTransaction.errors.amountInvalid",
      "money.noDecimalPlaces": "addTransaction.errors.amountInvalid",
      "money.negativeAmount": "addTransaction.errors.amountPositive",
      "money.invalidAmount": "addTransaction.errors.amountInvalid",
    };
    return {
      valid: false,
      error: errorKeyMap[result.error.key] || "addTransaction.errors.amountInvalid",
    };
  }

  // Check that amount is greater than 0
  if (result <= BigInt(0)) {
    return { valid: false, error: "addTransaction.errors.amountPositive" };
  }

  return { valid: true, value: result };
}

/**
 * Validate Step 1: Date + Amount
 */
export function validateStep1(
  draft: TransactionDraft
): StepValidationResult {
  const errors: Record<string, string> = {};

  // Validate date
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!draft.date || !dateRegex.test(draft.date)) {
    errors.date = "addTransaction.errors.dateRequired";
  }

  // Validate amount
  const amountResult = validateAmount(draft.amount, draft.currency);
  if (!amountResult.valid) {
    errors.amount = amountResult.error;
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}

/**
 * Validate Step 2: Category + Merchant
 */
export function validateStep2(
  draft: TransactionDraft
): StepValidationResult {
  const errors: Record<string, string> = {};

  // Category is required
  if (!draft.categoryId) {
    errors.categoryId = "addTransaction.errors.categoryRequired";
  }

  // Merchant is optional, no validation needed

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}

/**
 * Validate Step 3: Notes + Photos (all optional)
 */
export function validateStep3(
  _draft: TransactionDraft
): StepValidationResult {
  // Everything in step 3 is optional
  return {
    valid: true,
    errors: {},
  };
}

/**
 * Validate all steps
 */
export function validateAllSteps(
  draft: TransactionDraft
): StepValidationResult {
  const step1 = validateStep1(draft);
  const step2 = validateStep2(draft);
  const step3 = validateStep3(draft);

  return {
    valid: step1.valid && step2.valid && step3.valid,
    errors: {
      ...step1.errors,
      ...step2.errors,
      ...step3.errors,
    },
  };
}

/**
 * Get validation function for a specific step
 */
export function getStepValidator(
  step: 1 | 2 | 3
): (draft: TransactionDraft) => StepValidationResult {
  switch (step) {
    case 1:
      return validateStep1;
    case 2:
      return validateStep2;
    case 3:
      return validateStep3;
  }
}

/**
 * Date utility: get ISO date string for today
 */
export function getToday(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Date utility: get ISO date string for yesterday
 */
export function getYesterday(): string {
  const date = new Date();
  date.setDate(date.getDate() - 1);
  return date.toISOString().slice(0, 10);
}

/**
 * Date utility: get ISO date string for tomorrow
 */
export function getTomorrow(): string {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  return date.toISOString().slice(0, 10);
}

/**
 * Format a date string to locale display format
 */
export function formatDateForDisplay(
  isoDate: string,
  locale: string = "es"
): string {
  try {
    const date = new Date(isoDate + "T00:00:00");
    return new Intl.DateTimeFormat(locale, {
      weekday: "short",
      day: "numeric",
      month: "short",
      year: "numeric",
    }).format(date);
  } catch {
    return isoDate;
  }
}
