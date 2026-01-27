/**
 * Types for the Add Transaction form
 * Used by both web and mobile platforms
 */

import type { TransactionType } from "../schemas/transaction";

/**
 * Form mode for the Add Transaction form
 * - panels: 3-step carousel flow
 * - list: all fields in a single scrollable view
 */
export type FormMode = "panels" | "list";

/**
 * Photo attachment state during form editing
 */
export type PhotoAttachment = {
  /** Temporary ID for tracking during form editing */
  id: string;
  /** Local URI for preview (file:// or blob URL) */
  uri: string;
  /** Upload status */
  status: "pending" | "uploading" | "uploaded" | "failed";
  /** Storage path after successful upload */
  storagePath?: string;
  /** MIME type of the file */
  mimeType?: string;
  /** File size in bytes */
  sizeBytes?: number;
  /** Error message if upload failed */
  error?: string;
};

/**
 * Draft state for the transaction form
 * Shared across all steps
 */
export type TransactionDraft = {
  /** Transaction type: income or expense */
  type: TransactionType;
  /** Step 1 - Name of the transaction */
  name: string;
  /** Step 1 - Date in ISO format (YYYY-MM-DD) */
  date: string;
  /** Step 1 - Amount as user input string (accepts comma or dot) */
  amount: string;
  /** Currency code (ISO 4217) */
  currency: string;
  /** Step 2 - Selected category ID */
  categoryId: string | null;
  /** Step 2 - Merchant name (free text) */
  merchant: string;
  /** Step 3 - Notes/description */
  notes: string;
  /** Step 3 - Photo attachments */
  photos: PhotoAttachment[];
};

/**
 * Step status for the stepper breadcrumb
 */
export type StepStatus = "pending" | "active" | "completed";

/**
 * Step definition for the stepper
 */
export type Step = {
  /** Step number (1, 2, or 3) */
  number: 1 | 2 | 3;
  /** i18n key for the step label */
  labelKey: string;
  /** Current status */
  status: StepStatus;
};

/**
 * Validation result for a single step
 */
export type StepValidationResult = {
  /** Whether the step is valid */
  valid: boolean;
  /** Field-level errors (field key -> i18n error key) */
  errors: Record<string, string>;
};

/**
 * Initial draft state factory
 */
export function createInitialDraft(
  type: TransactionType,
  currency: string
): TransactionDraft {
  const today = new Date().toISOString().slice(0, 10);
  return {
    type,
    name: "",
    date: today,
    amount: "",
    currency,
    categoryId: null,
    merchant: "",
    notes: "",
    photos: [],
  };
}

/**
 * Storage keys for form mode persistence
 */
export const FORM_MODE_STORAGE_KEY = {
  web: "finnon:addTransactionFormMode",
  mobile: "@finnon/addTransactionFormMode",
} as const;
