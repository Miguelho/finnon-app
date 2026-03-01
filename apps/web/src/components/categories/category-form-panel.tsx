"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  SlidePanel,
  SlidePanelBody,
  SlidePanelContent,
  SlidePanelDescription,
  SlidePanelFooter,
  SlidePanelHeader,
  SlidePanelTitle,
} from "@/components/ui/slide-panel";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { IconPicker } from "@/components/icon-picker";
import {
  CATEGORY_PALETTE,
  normalizeHexColor,
  type CategoryIconKey,
  type CategoryType,
} from "@poleursus/shared";

type CategoryFormPanelProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  nameLabel: string;
  namePlaceholder?: string;
  typeLabel: string;
  expenseLabel: string;
  incomeLabel: string;
  iconLabel: string;
  colorLabel: string;
  customColorLabel: string;
  nameValue: string;
  onNameChange: (value: string) => void;
  typeValue: CategoryType;
  onTypeChange: (value: CategoryType) => void;
  iconValue: CategoryIconKey;
  onIconChange: (value: CategoryIconKey) => void;
  colorValue: string | null | undefined;
  onColorChange: (value: string) => void;
  onCancel: () => void;
  onSubmit: () => void;
  cancelLabel: string;
  submitLabel: string;
  submitDisabled?: boolean;
  cancelDisabled?: boolean;
  nameInputId?: string;
  desktopBehavior?: "right" | "bottom";
};

export function CategoryFormPanel({
  open,
  onOpenChange,
  title,
  description,
  nameLabel,
  namePlaceholder,
  typeLabel,
  expenseLabel,
  incomeLabel,
  iconLabel,
  colorLabel,
  customColorLabel,
  nameValue,
  onNameChange,
  typeValue,
  onTypeChange,
  iconValue,
  onIconChange,
  colorValue,
  onColorChange,
  onCancel,
  onSubmit,
  cancelLabel,
  submitLabel,
  submitDisabled,
  cancelDisabled,
  nameInputId = "category-name",
  desktopBehavior = "right",
}: CategoryFormPanelProps) {
  const [customColorInput, setCustomColorInput] = useState("");
  const normalizedColor = normalizeHexColor(colorValue);
  const isPresetColor = useMemo(
    () =>
      Boolean(
        normalizedColor &&
          CATEGORY_PALETTE.includes(normalizedColor as (typeof CATEGORY_PALETTE)[number])
      ),
    [normalizedColor]
  );

  useEffect(() => {
    if (normalizedColor && !isPresetColor) {
      setCustomColorInput(normalizedColor);
      return;
    }
    setCustomColorInput("");
  }, [isPresetColor, normalizedColor]);

  return (
    <SlidePanel open={open} onOpenChange={onOpenChange}>
      <SlidePanelContent desktopBehavior={desktopBehavior}>
        <SlidePanelHeader>
          <SlidePanelTitle>{title}</SlidePanelTitle>
          {description ? (
            <SlidePanelDescription>{description}</SlidePanelDescription>
          ) : null}
        </SlidePanelHeader>
        <SlidePanelBody>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor={nameInputId}>{nameLabel}</Label>
              <Input
                id={nameInputId}
                value={nameValue}
                onChange={(event) => onNameChange(event.target.value)}
                placeholder={namePlaceholder}
                maxLength={40}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`${nameInputId}-type`}>{typeLabel}</Label>
              <Select value={typeValue} onValueChange={onTypeChange}>
                <SelectTrigger id={`${nameInputId}-type`}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="expense">{expenseLabel}</SelectItem>
                  <SelectItem value="income">{incomeLabel}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{iconLabel}</Label>
              <IconPicker
                value={iconValue}
                onChange={onIconChange}
                filterType={typeValue}
                categoryName={nameValue}
              />
            </div>
            <div className="space-y-2">
              <Label>{colorLabel}</Label>
              <div className="flex flex-wrap gap-2">
                {CATEGORY_PALETTE.map((color) => {
                  const isSelected = normalizedColor === color;
                  return (
                    <button
                      key={color}
                      type="button"
                      onClick={() => onColorChange(color)}
                      className="inline-flex h-7 w-7 items-center justify-center rounded-full border transition-transform hover:scale-[1.05]"
                      style={{
                        backgroundColor: color,
                        borderColor: isSelected
                          ? "hsl(var(--ring))"
                          : "hsl(var(--border))",
                      }}
                      aria-label={`${colorLabel} ${color}`}
                    >
                      {isSelected ? (
                        <span className="h-2.5 w-2.5 rounded-full border border-white/85" />
                      ) : null}
                    </button>
                  );
                })}
              </div>
              <div className="space-y-1">
                <Label
                  htmlFor={`${nameInputId}-custom-color`}
                  className="text-xs text-muted-foreground"
                >
                  {customColorLabel}
                </Label>
                <Input
                  id={`${nameInputId}-custom-color`}
                  value={customColorInput}
                  onChange={(event) => {
                    const nextValue = event.target.value;
                    setCustomColorInput(nextValue);
                    const normalized = normalizeHexColor(nextValue);
                    if (normalized) {
                      onColorChange(normalized);
                    }
                  }}
                  autoComplete="off"
                  autoCapitalize="characters"
                  maxLength={7}
                  placeholder="#D4943A"
                  className="font-mono uppercase"
                />
              </div>
            </div>
          </div>
        </SlidePanelBody>
        <SlidePanelFooter>
          <Button variant="outline" onClick={onCancel} disabled={cancelDisabled}>
            {cancelLabel}
          </Button>
          <Button onClick={onSubmit} disabled={submitDisabled}>
            {submitLabel}
          </Button>
        </SlidePanelFooter>
      </SlidePanelContent>
    </SlidePanel>
  );
}
