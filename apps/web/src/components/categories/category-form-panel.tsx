"use client";

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
import type { CategoryIconKey, CategoryType } from "@poleursus/shared";

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
  nameValue: string;
  onNameChange: (value: string) => void;
  typeValue: CategoryType;
  onTypeChange: (value: CategoryType) => void;
  iconValue: CategoryIconKey;
  onIconChange: (value: CategoryIconKey) => void;
  onCancel: () => void;
  onSubmit: () => void;
  cancelLabel: string;
  submitLabel: string;
  submitDisabled?: boolean;
  cancelDisabled?: boolean;
  nameInputId?: string;
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
  nameValue,
  onNameChange,
  typeValue,
  onTypeChange,
  iconValue,
  onIconChange,
  onCancel,
  onSubmit,
  cancelLabel,
  submitLabel,
  submitDisabled,
  cancelDisabled,
  nameInputId = "category-name",
}: CategoryFormPanelProps) {
  return (
    <SlidePanel open={open} onOpenChange={onOpenChange}>
      <SlidePanelContent>
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
