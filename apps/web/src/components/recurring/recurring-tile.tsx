"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import {
  ArrowDownRight,
  ArrowUpRight,
  Minus,
  MoreHorizontal,
  Pause,
  Play,
  Square,
} from "lucide-react";
import {
  CURRENCIES,
  formatMinorToMoney,
  type RecurringItem,
  type CategoryIconKey,
} from "@poleursus/shared";
import { CategoryIcon } from "@/components/category-icon";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

type Category = {
  id?: string | null;
  name?: string | null;
  icon_id?: string | null;
  type?: "income" | "expense";
};

type StatusBadge = {
  label: string;
  tone: "positive" | "neutral" | "muted";
};

type TrendBadge = {
  label: string;
  tone: "positive" | "negative" | "neutral";
};

type RecurringTileProps = {
  recurringItem: RecurringItem & {
    category?: Category | null;
  };
  density?: "comfortable" | "compact";
  detailLabel?: string | null;
  statusBadge?: StatusBadge | null;
  trend?: TrendBadge | null;
  categoryColor?: string | null;
  showLeadingAccent?: boolean;
  onPress?: (id: string) => void;
  onEdit?: (id: string) => void;
  onPause?: (id: string, isPaused: boolean) => void;
  onEnd?: (id: string) => void;
};

const densityStyles = {
  comfortable: {
    container: "px-5 py-4",
    gap: "gap-3.5",
    badgeSize: 42,
    badgeRadius: 14,
    iconSize: 18,
  },
  compact: {
    container: "px-4 py-3",
    gap: "gap-3",
    badgeSize: 36,
    badgeRadius: 12,
    iconSize: 16,
  },
};

const statusToneClasses: Record<StatusBadge["tone"], string> = {
  positive: "bg-[hsl(var(--state-positive)/0.12)] text-[hsl(var(--state-positive))]",
  neutral: "bg-[hsl(var(--foreground)/0.08)] text-foreground/75",
  muted: "bg-muted text-muted-foreground",
};

const trendToneClasses: Record<TrendBadge["tone"], string> = {
  positive: "text-[hsl(var(--state-positive))]",
  negative: "text-[hsl(var(--state-negative))]",
  neutral: "text-muted-foreground",
};

export function RecurringTile({
  recurringItem,
  density = "comfortable",
  detailLabel,
  statusBadge,
  trend,
  categoryColor,
  showLeadingAccent = false,
  onPress,
  onEdit,
  onPause,
  onEnd,
}: RecurringTileProps) {
  const tCommon = useTranslations("common");
  const t = useTranslations("recurrentes");
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
      ? "hsl(var(--state-positive))"
      : "hsl(var(--state-negative))";

  const displayName = recurringItem.merchant || t("namePlaceholder");

  const frequencyLabel =
    recurringItem.frequency === "weekly"
      ? t("frequencyWeekly")
      : recurringItem.frequency === "monthly"
        ? t("frequencyMonthly")
        : t("frequencyYearly");

  const metaParts = [frequencyLabel];
  if (detailLabel) metaParts.push(detailLabel);

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
        "relative flex items-center gap-4",
        styles.container,
        onPress &&
          "cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 hover:bg-muted/40 active:bg-muted/50",
        recurringItem.is_paused && "opacity-65"
      )}
      role={onPress ? "button" : undefined}
      tabIndex={onPress ? 0 : undefined}
      onClick={onPress ? handlePress : undefined}
      onKeyDown={handleKeyDown}
    >
      {showLeadingAccent && recurringItem.type === "expense" ? (
        <div className="absolute inset-y-3 left-0 w-[3px] rounded-r-full bg-[hsl(var(--state-positive))]" />
      ) : null}

      <div className={cn("flex min-w-0 flex-1 items-start", styles.gap)}>
        <div
          className="flex shrink-0 items-center justify-center border border-border/60 bg-[var(--account-surface-alt)]"
          style={{
            width: styles.badgeSize,
            height: styles.badgeSize,
            borderRadius: styles.badgeRadius,
          }}
        >
          <CategoryIcon
            iconKey={recurringItem.category?.icon_id as CategoryIconKey}
            size={styles.iconSize}
            tone="muted"
            accessibilityLabel={recurringItem.category?.name ?? undefined}
          />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="truncate text-[15px] font-semibold text-foreground">
              {displayName}
            </span>
            {statusBadge ? (
              <span
                className={cn(
                  "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em]",
                  statusToneClasses[statusBadge.tone]
                )}
              >
                {statusBadge.label}
              </span>
            ) : null}
          </div>

          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] text-muted-foreground">
            {metaParts.length > 0 ? <span>{metaParts.join(" · ")}</span> : null}
            {recurringItem.category?.name ? (
              <span className="inline-flex items-center gap-1.5">
                <span
                  className="h-1.5 w-1.5 rounded-full"
                  style={{ backgroundColor: categoryColor ?? "hsl(var(--muted-foreground))" }}
                />
                <span>{recurringItem.category.name}</span>
              </span>
            ) : null}
          </div>
        </div>
      </div>

      <div className="ml-auto flex shrink-0 items-center gap-2">
        <div className="flex flex-col items-end gap-1">
          <div className="flex items-baseline gap-1">
            <span className="text-sm font-medium text-muted-foreground">
              {recurringItem.type === "expense" ? "-" : ""}
              {currencySymbol}
            </span>
            <span className="text-[15px] font-semibold tabular-nums" style={{ color: amountColor }}>
              {amountValue}
            </span>
          </div>

          {trend ? (
            <span
              className={cn(
                "inline-flex items-center gap-1 text-[11px] font-medium",
                trendToneClasses[trend.tone]
              )}
            >
              {trend.tone === "positive" ? (
                <ArrowDownRight className="h-3.5 w-3.5" />
              ) : trend.tone === "negative" ? (
                <ArrowUpRight className="h-3.5 w-3.5" />
              ) : (
                <Minus className="h-3.5 w-3.5" />
              )}
              {trend.label}
            </span>
          ) : null}
        </div>

        {hasActions ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                aria-label={tCommon("moreActions")}
                className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
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
              {onEdit ? (
                <DropdownMenuItem
                  onSelect={(event) => {
                    event.stopPropagation();
                    onEdit(recurringItem.id);
                  }}
                >
                  {tCommon("edit")}
                </DropdownMenuItem>
              ) : null}
              {onPause ? (
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
              ) : null}
              {onEnd ? (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onSelect={(event) => {
                      event.stopPropagation();
                      onEnd(recurringItem.id);
                    }}
                    className="text-[hsl(var(--state-negative))]"
                  >
                    <Square className="mr-2 h-4 w-4" />
                    {t("end")}
                  </DropdownMenuItem>
                </>
              ) : null}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
      </div>
    </div>
  );
}
