"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

interface TransactionStepCarouselProps {
  currentStep: 1 | 2 | 3;
  step1: React.ReactNode;
  step2: React.ReactNode;
  step3: React.ReactNode;
  className?: string;
}

export function TransactionStepCarousel({
  currentStep,
  step1,
  step2,
  step3,
  className,
}: TransactionStepCarouselProps) {
  return (
    <div className={cn("overflow-hidden", className)}>
      <div
        className="flex transition-transform duration-300 ease-out"
        style={{
          transform: `translateX(-${(currentStep - 1) * 100}%)`,
        }}
      >
        <div
          className="w-full flex-shrink-0 px-1"
          aria-hidden={currentStep !== 1}
        >
          {step1}
        </div>
        <div
          className="w-full flex-shrink-0 px-1"
          aria-hidden={currentStep !== 2}
        >
          {step2}
        </div>
        <div
          className="w-full flex-shrink-0 px-1"
          aria-hidden={currentStep !== 3}
        >
          {step3}
        </div>
      </div>
    </div>
  );
}
