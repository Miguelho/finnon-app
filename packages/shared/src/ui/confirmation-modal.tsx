"use client";

import { useEffect, useId, useMemo, useRef } from "react";
import { themeTokens } from "../theme/tokens";
import type { ConfirmationModalProps } from "./confirmation-modal.types";

const tokens = themeTokens.light;

export function ConfirmationModal({
  open,
  title,
  description,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
  confirmDisabled = false,
  cancelDisabled = false,
  confirmLoading = false,
  tone = "default",
  dismissOnBackdrop = true,
}: ConfirmationModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  const hasCancel = Boolean(cancelLabel && onCancel);
  const allowDismiss =
    Boolean(onCancel) && dismissOnBackdrop && !cancelDisabled && !confirmLoading;
  const isConfirmDisabled = confirmDisabled || confirmLoading;
  const isCancelDisabled = cancelDisabled || confirmLoading;

  const confirmColor = useMemo(() => {
    if (tone === "destructive") {
      return "hsl(var(--state-negative))";
    }
    return "hsl(var(--primary))";
  }, [tone]);

  useEffect(() => {
    if (!open) return;
    dialogRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!open || typeof document === "undefined") return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  useEffect(() => {
    if (!open || typeof window === "undefined") return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && allowDismiss) {
        onCancel?.();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [allowDismiss, onCancel, open]);

  if (!open) return null;

  return (
    <div
      role="presentation"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1000,
        backgroundColor: "rgba(0, 0, 0, 0.28)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: tokens.spacing.lg,
      }}
      onClick={(event) => {
        if (!allowDismiss) return;
        if (event.target === event.currentTarget) onCancel?.();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        tabIndex={-1}
        ref={dialogRef}
        style={{
          width: "100%",
          maxWidth: 420,
          backgroundColor: "hsl(var(--card))",
          color: "hsl(var(--foreground))",
          borderRadius: tokens.radii.lg,
          border: "1px solid hsl(var(--border))",
          boxShadow: "0 18px 50px rgba(0, 0, 0, 0.12)",
          padding: tokens.spacing.lg,
          display: "flex",
          flexDirection: "column",
          gap: tokens.spacing.md,
          outline: "none",
        }}
        onClick={(event) => event.stopPropagation()}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: tokens.spacing.xs }}>
          <h2
            id={titleId}
            style={{
              margin: 0,
              fontSize: tokens.typography.size.lg,
              fontWeight: tokens.typography.weight.semibold,
            }}
          >
            {title}
          </h2>
          {description ? (
            <p
              id={descriptionId}
              style={{
                margin: 0,
                fontSize: tokens.typography.size.sm,
                color: "hsl(var(--muted-foreground))",
              }}
            >
              {description}
            </p>
          ) : null}
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            gap: tokens.spacing.sm,
            flexWrap: "wrap",
          }}
        >
          {hasCancel ? (
            <button
              type="button"
              onClick={onCancel}
              disabled={isCancelDisabled}
              style={{
                border: "1px solid hsl(var(--border))",
                background: "transparent",
                color: "hsl(var(--foreground))",
                borderRadius: tokens.radii.md,
                padding: `${tokens.spacing.sm}px ${tokens.spacing.md}px`,
                fontSize: tokens.typography.size.sm,
                fontWeight: tokens.typography.weight.medium,
                cursor: isCancelDisabled ? "not-allowed" : "pointer",
                opacity: isCancelDisabled ? 0.6 : 1,
              }}
            >
              {cancelLabel}
            </button>
          ) : null}
          <button
            type="button"
            onClick={onConfirm}
            disabled={isConfirmDisabled}
            aria-busy={confirmLoading}
            style={{
              border: `1px solid ${confirmColor}`,
              background: "transparent",
              color: confirmColor,
              borderRadius: tokens.radii.md,
              padding: `${tokens.spacing.sm}px ${tokens.spacing.md}px`,
              fontSize: tokens.typography.size.sm,
              fontWeight: tokens.typography.weight.semibold,
              cursor: isConfirmDisabled ? "not-allowed" : "pointer",
              opacity: isConfirmDisabled ? 0.6 : 1,
            }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export type { ConfirmationModalProps, ConfirmationModalTone } from "./confirmation-modal.types";
