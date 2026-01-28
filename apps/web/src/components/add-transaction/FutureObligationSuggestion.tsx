"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";

interface FutureObligationSuggestionProps {
  visible: boolean;
  onAccept: () => void;
  onDismiss: () => void;
}

export function FutureObligationSuggestion({
  visible,
  onAccept,
  onDismiss,
}: FutureObligationSuggestionProps) {
  const t = useTranslations("addTransaction");

  if (!visible) return null;

  return (
    <div className="space-y-3 rounded-lg border border-border bg-background p-3">
      <p className="text-sm text-foreground">{t("obligationSuggestion")}</p>
      <div className="flex items-center gap-3">
        <Button type="button" size="sm" variant="secondary" onClick={onAccept}>
          {t("obligationSuggestionAccept")}
        </Button>
        <Button type="button" size="sm" variant="link" onClick={onDismiss}>
          {t("obligationSuggestionDismiss")}
        </Button>
      </div>
    </div>
  );
}
