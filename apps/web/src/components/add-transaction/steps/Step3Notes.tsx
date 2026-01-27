"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { Plus, X, Image as ImageIcon } from "@phosphor-icons/react";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { TransactionDraft, PhotoAttachment } from "@poleursus/shared";

interface Step3NotesProps {
  draft: TransactionDraft;
  errors: Record<string, string>;
  onFieldChange: <K extends keyof TransactionDraft>(
    field: K,
    value: TransactionDraft[K]
  ) => void;
}

export function Step3Notes({ draft, errors, onFieldChange }: Step3NotesProps) {
  const t = useTranslations("addTransaction");
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleAddPhotos = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const newPhotos: PhotoAttachment[] = Array.from(files).map((file) => ({
      id: crypto.randomUUID(),
      uri: URL.createObjectURL(file),
      status: "pending" as const,
      mimeType: file.type,
      sizeBytes: file.size,
    }));

    onFieldChange("photos", [...draft.photos, ...newPhotos]);

    // Reset input to allow selecting the same file again
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleRemovePhoto = (photoId: string) => {
    const photoToRemove = draft.photos.find((p) => p.id === photoId);
    if (photoToRemove) {
      // Revoke the object URL to free memory
      URL.revokeObjectURL(photoToRemove.uri);
    }
    onFieldChange(
      "photos",
      draft.photos.filter((p) => p.id !== photoId)
    );
  };

  return (
    <div className="space-y-6">
      {/* Notes field */}
      <div className="space-y-2">
        <Label htmlFor="notes" className="text-base font-semibold">
          {t("notesLabel")}
        </Label>
        <Textarea
          id="notes"
          value={draft.notes}
          onChange={(e) => onFieldChange("notes", e.target.value)}
          placeholder={t("notesPlaceholder")}
          className="min-h-[100px] resize-none"
          rows={4}
        />
      </div>

      {/* Photos field */}
      <div className="space-y-3">
        <Label className="text-base font-semibold">{t("photosLabel")}</Label>

        {/* Photo grid */}
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
          {/* Existing photos */}
          {draft.photos.map((photo) => (
            <div
              key={photo.id}
              className="relative aspect-square rounded-lg overflow-hidden border border-border bg-muted"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={photo.uri}
                alt=""
                className="w-full h-full object-cover"
              />

              {/* Status indicator */}
              {photo.status === "uploading" && (
                <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                  <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
                </div>
              )}

              {photo.status === "failed" && (
                <div className="absolute inset-0 bg-destructive/50 flex items-center justify-center">
                  <X className="w-6 h-6 text-white" weight="bold" />
                </div>
              )}

              {/* Remove button */}
              <button
                type="button"
                onClick={() => handleRemovePhoto(photo.id)}
                className={cn(
                  "absolute top-1 right-1 w-6 h-6 rounded-full",
                  "bg-black/60 text-white flex items-center justify-center",
                  "hover:bg-black/80 transition-colors",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                )}
                aria-label={t("photoRemove")}
              >
                <X size={14} weight="bold" />
              </button>
            </div>
          ))}

          {/* Add photo button */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className={cn(
              "aspect-square rounded-lg border-2 border-dashed border-border",
              "flex flex-col items-center justify-center gap-1",
              "text-muted-foreground hover:text-foreground hover:border-foreground/50",
              "transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            )}
          >
            <Plus size={24} />
            <span className="text-xs">{t("photosAdd")}</span>
          </button>

          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            onChange={handleAddPhotos}
            className="hidden"
            aria-label={t("photosAdd")}
          />
        </div>

        {/* Empty state */}
        {draft.photos.length === 0 && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <ImageIcon size={16} />
            <span>{t("photosEmpty")}</span>
          </div>
        )}
      </div>
    </div>
  );
}
