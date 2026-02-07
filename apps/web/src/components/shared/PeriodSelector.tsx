"use client";

import { type Period, PERIODS } from "@poleursus/shared";
import { cn } from "@/lib/utils";
import styles from "./PeriodSelector.module.css";

interface PeriodSelectorProps {
  selected: Period;
  onChange: (period: Period) => void;
  className?: string;
}

export function PeriodSelector({ selected, onChange, className }: PeriodSelectorProps) {
  return (
    <div className={cn(styles.selector, className)}>
      {PERIODS.map(({ key, label }) => (
        <button
          key={key}
          type="button"
          onClick={() => onChange(key)}
          className={cn(styles.chip, selected === key && styles.chipActive)}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
