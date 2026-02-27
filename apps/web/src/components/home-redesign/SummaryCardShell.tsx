import type { ReactNode } from "react";

type SummaryCardShellProps = {
  children: ReactNode;
  className?: string;
};

export function SummaryCardShell({ children, className }: SummaryCardShellProps) {
  return <div className={`rounded-xl border bg-card p-4 ${className ?? ""}`}>{children}</div>;
}
