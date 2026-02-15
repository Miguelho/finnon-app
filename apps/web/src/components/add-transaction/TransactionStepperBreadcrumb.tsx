"use client";

import { Check } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import type { StepStatus } from "@poleursus/shared";

interface StepItem {
  number: number;
  label: string;
  status: StepStatus;
}

interface TransactionStepperBreadcrumbProps {
  steps: StepItem[];
  onStepClick?: (stepNumber: number) => void;
}

export function TransactionStepperBreadcrumb({
  steps,
  onStepClick,
}: TransactionStepperBreadcrumbProps) {
  return (
    <nav aria-label="Progress" className="w-full">
      <ol className="flex items-center justify-between">
        {steps.map((step, index) => {
          const isClickable =
            step.status === "completed" && onStepClick !== undefined;

          return (
            <li key={step.number} className="flex items-center flex-1">
              <button
                type="button"
                onClick={() => isClickable && onStepClick?.(step.number)}
                disabled={!isClickable}
                className={cn(
                  "flex items-center gap-2 group",
                  isClickable && "cursor-pointer",
                  !isClickable && "cursor-default"
                )}
                aria-current={step.status === "active" ? "step" : undefined}
              >
                {/* Step indicator */}
                <span
                  className={cn(
                    "flex items-center justify-center w-7 h-7 rounded-full text-xs font-semibold transition-colors",
                    step.status === "completed" &&
                      "bg-primary text-primary-foreground",
                    step.status === "active" &&
                      "bg-primary text-primary-foreground ring-2 ring-primary/30",
                    step.status === "pending" &&
                      "bg-muted text-muted-foreground border border-border"
                  )}
                >
                  {step.status === "completed" ? (
                    <Check size={14} weight="bold" />
                  ) : (
                    step.number
                  )}
                </span>

                {/* Step label */}
                <span
                  className={cn(
                    "text-sm font-medium transition-colors hidden sm:inline",
                    step.status === "active" && "text-foreground",
                    step.status === "completed" &&
                      "text-muted-foreground group-hover:text-foreground",
                    step.status === "pending" && "text-muted-foreground"
                  )}
                >
                  {step.label}
                </span>
              </button>

              {/* Connector line (except for last item) */}
              {index < steps.length - 1 && (
                <div
                  className={cn(
                    "flex-1 h-px mx-3",
                    step.status === "completed" ? "bg-primary" : "bg-border"
                  )}
                  aria-hidden="true"
                />
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
