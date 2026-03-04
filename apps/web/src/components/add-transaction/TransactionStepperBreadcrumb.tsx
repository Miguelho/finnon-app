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
      <ol className="flex w-full items-start">
        {steps.map((step, index) => {
          const isClickable =
            step.status === "completed" && onStepClick !== undefined;

          return (
            <li
              key={step.number}
              className="group relative flex flex-1 flex-col items-center"
            >
              {index < steps.length - 1 && (
                <div
                  className={cn(
                    "absolute left-1/2 top-3.5 h-px w-full",
                    step.status === "completed" ? "bg-primary" : "bg-border"
                  )}
                  aria-hidden="true"
                />
              )}

              <button
                type="button"
                onClick={() => isClickable && onStepClick?.(step.number)}
                disabled={!isClickable}
                className={cn(
                  "relative z-10 flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold transition-colors group",
                  isClickable && "cursor-pointer",
                  !isClickable && "cursor-default",
                  step.status === "completed" &&
                    "bg-primary text-primary-foreground",
                  step.status === "active" &&
                    "bg-primary text-primary-foreground ring-2 ring-primary/30",
                  step.status === "pending" &&
                    "bg-muted text-muted-foreground border border-border"
                )}
                aria-current={step.status === "active" ? "step" : undefined}
              >
                {step.status === "completed" ? (
                  <Check size={14} weight="bold" />
                ) : (
                  step.number
                )}
              </button>

              <span
                className={cn(
                  "mt-2 hidden text-center text-xs font-medium transition-colors sm:block",
                  step.status === "active" && "text-foreground",
                  step.status === "completed" &&
                    "text-muted-foreground group-hover:text-foreground",
                  step.status === "pending" && "text-muted-foreground"
                )}
              >
                {step.label}
              </span>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
