"use client";

import { useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type AccountDetailItem = {
  label: string;
  value: string;
  valueTitle?: string;
  monospace?: boolean;
  copyValue?: string;
};

type AccountDetailsCardProps = {
  title: string;
  description?: string;
  items: AccountDetailItem[];
  copyLabel: string;
};

export function AccountDetailsCard({
  title,
  description,
  items,
  copyLabel,
}: AccountDetailsCardProps) {
  const handleCopy = useCallback((value: string) => {
    if (!navigator?.clipboard) return;
    void navigator.clipboard.writeText(value);
  }, []);

  if (items.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {description ? <CardDescription>{description}</CardDescription> : null}
      </CardHeader>
      <CardContent className="grid gap-4 sm:grid-cols-2">
        {items.map((item) => (
          <div key={`${item.label}-${item.value}`} className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {item.label}
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={cn(
                  "text-sm font-medium text-foreground",
                  item.monospace && "font-mono text-xs"
                )}
                title={item.valueTitle}
              >
                {item.value}
              </span>
              {item.copyValue ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => handleCopy(item.copyValue!)}
                >
                  {copyLabel}
                </Button>
              ) : null}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
