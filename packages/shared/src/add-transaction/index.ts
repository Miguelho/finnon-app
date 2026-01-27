/**
 * Add Transaction form utilities
 * Shared between web and mobile platforms
 */

// Types
export type {
  FormMode,
  PhotoAttachment,
  TransactionDraft,
  StepStatus,
  Step,
  StepValidationResult,
} from "./types";

export { createInitialDraft, FORM_MODE_STORAGE_KEY } from "./types";

// Validation
export {
  step1Schema,
  step2Schema,
  step3Schema,
  validateAmount,
  validateStep1,
  validateStep2,
  validateStep3,
  validateAllSteps,
  getStepValidator,
  getToday,
  getYesterday,
  getTomorrow,
  formatDateForDisplay,
} from "./validation";
