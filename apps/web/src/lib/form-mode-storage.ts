import type { FormMode } from "@poleursus/shared";
import { FORM_MODE_STORAGE_KEY } from "@poleursus/shared";

const STORAGE_KEY = FORM_MODE_STORAGE_KEY.web;

export function getFormMode(): FormMode {
  if (typeof window === "undefined") return "panels";

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored === "list" ? "list" : "panels";
  } catch {
    return "panels";
  }
}

export function setFormMode(mode: FormMode): void {
  if (typeof window === "undefined") return;

  try {
    localStorage.setItem(STORAGE_KEY, mode);
  } catch {
    // Ignore storage errors (e.g., private browsing)
  }
}
