"use client";

import { useTranslations } from "next-intl";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import type { TransactionDraft } from "@poleursus/shared";

interface Step3NotesProps {
  draft: TransactionDraft;
  errors: Record<string, string>;
  onFieldChange: <K extends keyof TransactionDraft>(
    field: K,
    value: TransactionDraft[K]
  ) => void;
}

export function Step3Notes({ draft, onFieldChange }: Step3NotesProps) {
  const t = useTranslations("addTransaction");

  return (
    <div className="space-y-6">
      <div className="space-y-3 rounded-xl border border-border bg-muted/30 p-4">
        <Label htmlFor="notes" className="text-base font-semibold">
          {t("notesLabel")}
        </Label>
        <Textarea
          id="notes"
          value={draft.notes}
          onChange={(e) => onFieldChange("notes", e.target.value)}
          placeholder={t("notesPlaceholder")}
          className="min-h-[120px] resize-none"
          rows={4}
        />
      </div>
    </div>
  );
}
