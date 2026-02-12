"use client";

import * as React from "react";
import { useTranslations, useLocale } from "next-intl";
import { MoreHorizontal, Pause, Play, Square } from "lucide-react";
import {
  CURRENCIES,
  formatMinorToMoney,
  type RecurringItem,
  type CategoryIconKey,
  getNextOccurrence,
} from "@poleursus/shared";
import { CategoryIcon } from "@/components/category-icon";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

type Category = {
  id: string;
  name: string;
  icon_id: string;
  type: "income" | "expense";
};

type RecurringTileProps = {
  recurringItem: RecurringItem & {
    category?: Category | null;
  };
  density?: "comfortable" | "compact";
  onPress?: (id: string) => void;
  onEdit?: (id: string) => void;
  onPause?: (id: string, isPaused: boolean) => void;
  onEnd?: (id: string) => void;
};

const recurringTileColors = {
  tileHover: "hsl(var(--accent))",
  badgeBg: "hsl(var(--secondary))",
  textPrimary: "hsl(var(--foreground))",
  textSecondary: "hsl(var(--muted-foreground))",
  textMuted: "hsl(var(--muted-foreground))",
  positive: "hsl(var(--state-positive))",
  negative: "hsl(var(--state-negative))",
  destructive: "hsl(var(--destructive))",
};

const densityStyles = {
  comfortable: {
    container: "px-4 py-3.5",
    gap: "gap-3",
    badgeSize: 36,
    badgeRadius: 12,
    iconSize: 18,
  },
  compact: {
    container: "px-4 py-2.5",
    gap: "gap-2.5",
    badgeSize: 32,
    badgeRadius: 10,
    iconSize: 16,
  },
};

const formatNextDate = (dateISO: string, locale: string) => {
  const date = new Date(dateISO);
  return date.toLocaleDateString(locale, { day: "numeric", month: "short" });
};

export function RecurringTile({
  recurringItem,
  density = "comfortable",
  onPress,
  onEdit,
  onPause,
  onEnd,
}: RecurringTileProps) {
  const tCommon = useTranslations("common");
  const t = useTranslations("recurrentes");
  const locale = useLocale();
  const styles = densityStyles[density];
  const hasActions = Boolean(onEdit || onPause || onEnd);

  const amountMinor =
    typeof recurringItem.amount_minor === "bigint"
      ? recurringItem.amount_minor
      : BigInt(recurringItem.amount_minor);

  const currencySymbol =
    CURRENCIES.find((c) => c.code === recurringItem.currency)?.symbol ??
    recurringItem.currency;

  const amountValue = formatMinorToMoney(amountMinor, recurringItem.currency);
  const amountColor =
    recurringItem.type === "income"
      ? recurringTileColors.positive
      : recurringTileColors.negative;

  const displayName = recurringItem.merchant || t("namePlaceholder");

  // Build frequency label
  const frequencyLabel =
    recurringItem.frequency === "weekly"
      ? t("frequencyWeekly")
      : recurringItem.frequency === "monthly"
        ? t("frequencyMonthly")
        : t("frequencyYearly");

  // Get next occurrence
  const today = new Date().toISOString().slice(0, 10);
  const nextOccurrence = getNextOccurrence(recurringItem, today);
  const nextOccurrenceLabel = nextOccurrence
    ? t("nextOccurrence", { date: formatNextDate(nextOccurrence, locale) })
    : null;

  // Build meta line
  const metaParts: string[] = [frequencyLabel];
  if (nextOccurrenceLabel && !recurringItem.is_paused) {
    metaParts.push(nextOccurrenceLabel);
  }
  if (recurringItem.is_paused) {
    metaParts.push(t("paused"));
  }
  if (recurringItem.category?.name) {
    metaParts.push(recurringItem.category.name);
  }

  const handlePress = () => onPress?.(recurringItem.id);
  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (!onPress) return;
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      handlePress();
    }
  };

  return (
    <div
      className={cn(
        "flex items-center justify-between gap-4",
        styles.container,
        onPress &&
          "cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 hover:bg-[var(--tile-hover)] active:bg-[var(--tile-pressed)]",
        recurringItem.is_paused && "opacity-60"
      )}
      style={
        onPress
          ? ({
              "--tile-hover": recurringTileColors.tileHover,
              "--tile-pressed": recurringTileColors.tileHover,
            } as React.CSSProperties)
          : undefined
      }
      role={onPress ? "button" : undefined}
      tabIndex={onPress ? 0 : undefined}
      onClick={onPress ? handlePress : undefined}
      onKeyDown={handleKeyDown}
    >
      <div className={cn("flex items-start min-w-0 flex-1", styles.gap)}>
        <div
          className="flex items-center justify-center shrink-0"
          style={{
            width: styles.badgeSize,
            height: styles.badgeSize,
            borderRadius: styles.badgeRadius,
            backgroundColor: recurringTileColors.badgeBg,
          }}
        >
          <CategoryIcon
            iconKey={recurringItem.category?.icon_id as CategoryIconKey}
            size={styles.iconSize}
            tone="muted"
            accessibilityLabel={recurringItem.category?.name}
          />
        </div>

        <div className="min-w-0 flex-1">
          <div
            className="text-base font-semibold truncate"
            style={{ color: recurringTileColors.textPrimary }}
          >
            {displayName}
          </div>
          <div
            className="text-sm truncate"
            style={{ color: recurringTileColors.textSecondary }}
          >
            {metaParts.join(" · ")}
          </div>
        </div>
      </div>

      <div className="flex flex-col items-end gap-2 shrink-0">
        <div className="flex items-baseline gap-1">
          <span
            className="text-sm font-medium"
            style={{ color: recurringTileColors.textMuted }}
          >
            {recurringItem.type === "expense" ? "-" : ""}
            {currencySymbol}
          </span>
          <span
            className="text-base font-semibold"
            style={{ color: amountColor }}
          >
            {amountValue}
          </span>
        </div>

        {hasActions && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                aria-label={tCommon("moreActions")}
                className="flex h-8 w-8 items-center justify-center rounded-md border border-transparent text-muted-foreground hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                onClick={(event) => event.stopPropagation()}
                onKeyDown={(event) => event.stopPropagation()}
              >
                <MoreHorizontal className="h-4 w-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              onClick={(event) => event.stopPropagation()}
            >
              {onEdit && (
                <DropdownMenuItem
                  onSelect={(event) => {
                    event.stopPropagation();
                    onEdit(recurringItem.id);
                  }}
                >
                  {tCommon("edit")}
                </DropdownMenuItem>
              )}
              {onPause && (
                <DropdownMenuItem
                  onSelect={(event) => {
                    event.stopPropagation();
                    onPause(recurringItem.id, !recurringItem.is_paused);
                  }}
                >
                  {recurringItem.is_paused ? (
                    <>
                      <Play className="mr-2 h-4 w-4" />
                      {t("resume")}
                    </>
                  ) : (
                    <>
                      <Pause className="mr-2 h-4 w-4" />
                      {t("pause")}
                    </>
                  )}
                </DropdownMenuItem>
              )}
              {onEnd && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onSelect={(event) => {
                      event.stopPropagation();
                      onEnd(recurringItem.id);
                    }}
                    style={{ color: recurringTileColors.destructive }}
                  >
                    <Square className="mr-2 h-4 w-4" />
                    {t("end")}
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </div>
  );
}
