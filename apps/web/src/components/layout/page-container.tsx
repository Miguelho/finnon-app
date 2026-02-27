import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { APP_SHELL_CONTAINER_CLASS } from "@/components/layout/shell";

type PageContainerProps = {
  children: ReactNode;
  className?: string;
};

export function PageContainer({ children, className }: PageContainerProps) {
  return (
    <div className={cn(APP_SHELL_CONTAINER_CLASS, "py-4", className)}>
      {children}
    </div>
  );
}
