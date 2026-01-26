"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { MoreHorizontal } from "lucide-react";
import {
  CURRENCIES,
  formatMinorToMoney,
  themeTokens,
  type AvatarColorToken,
  type CategoryIconKey,
} from "@poleursus/shared";
import { CategoryIcon } from "@/components/category-icon";
import { UserAvatar } from "@/components/user-avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

type TransactionTileProps = {
  transaction: {
    id: string;
    merchant: string;
    category?: { id: string; name: string; icon: string };
    notes?: string | null;
    date: string | Date;
    amount: bigint;
    currency: string;
    createdBy?: {
      initial: string;
      userId?: string | null;
      email?: string | null;
      avatarPath?: string | null;
      fallbackText?: string | null;
      fallbackBgToken?: AvatarColorToken | null;
      label?: string;
    };
    accountName?: string;
    type?: "income" | "expense";
  };
  density?: "comfortable" | "compact";
  onPress?: (id: string) => void;
  onEdit?: (id: string) => void;
  onDelete?: (id: string) => void;
  showAccountName?: boolean;
};

const tokens = themeTokens.light;
const colors = tokens.colors;

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

const formatDateLabel = (value: string | Date) =>
  new Date(value).toLocaleDateString();
const toStartOfDay = (date: Date) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate());

export function TransactionTile({
  transaction,
  density = "comfortable",
  onPress,
  onEdit,
  onDelete,
  showAccountName = false,
}: TransactionTileProps) {
  const tCommon = useTranslations("common");
  const styles = densityStyles[density];
  const hasActions = Boolean(onEdit || onDelete);
  const transactionType =
    transaction.type ??
    (transaction.amount >= 0n ? ("income" as const) : ("expense" as const));
  const absoluteAmount =
    transaction.amount < 0n ? -transaction.amount : transaction.amount;
  const currencySymbol =
    CURRENCIES.find((currency) => currency.code === transaction.currency)
      ?.symbol ?? transaction.currency;
  const amountValue = formatMinorToMoney(absoluteAmount, transaction.currency);
  const amountColor =
    transactionType === "income"
      ? colors.state.positive
      : colors.state.negative;
  const displayMerchant = transaction.merchant;
  const categoryName = transaction.category?.name;
  const metaParts = [formatDateLabel(transaction.date)];
  const dateValue = new Date(transaction.date);
  const isPending =
    !Number.isNaN(dateValue.getTime()) &&
    toStartOfDay(dateValue).getTime() > toStartOfDay(new Date()).getTime();

  if (categoryName && categoryName !== displayMerchant) {
    metaParts.push(categoryName);
  }

  if (showAccountName && transaction.accountName) {
    metaParts.push(transaction.accountName);
  }

  if (transaction.notes?.trim()) {
    metaParts.push(transaction.notes.trim());
  }

  const handlePress = () => onPress?.(transaction.id);
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
          "cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 hover:bg-[var(--tile-hover)] active:bg-[var(--tile-pressed)]"
      )}
      style={
        onPress
          ? ({
              "--tile-hover": colors.action.secondary,
              "--tile-pressed": colors.action.secondary,
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
            backgroundColor: colors.bg.secondary,
          }}
        >
          <CategoryIcon
            iconKey={transaction.category?.icon as CategoryIconKey}
            size={styles.iconSize}
            tone={transactionType === "income" ? "positive" : "negative"}
            accessibilityLabel={transaction.category?.name}
          />
        </div>

        <div className="min-w-0 flex-1">
          <div
            className="text-base font-semibold truncate"
            style={{ color: colors.text.primary }}
          >
            {displayMerchant}
          </div>
          <div className="flex items-center gap-2 min-w-0">
            <span
              className="text-sm truncate min-w-0 flex-1"
              style={{ color: colors.text.secondary }}
            >
              {metaParts.join(" • ")}
            </span>
            {isPending && (
              <span
                className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold"
                style={{
                  backgroundColor: colors.state.neutral,
                  color: colors.text.secondary,
                }}
              >
                {tCommon("pendingLabel")}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="flex flex-col items-end gap-2 shrink-0">
        <div className="flex items-baseline gap-1">
          <span
            className="text-sm font-medium"
            style={{ color: colors.text.muted }}
          >
            {transactionType === "expense" ? "-" : ""}
            {currencySymbol}
          </span>
          <span
            className="text-base font-semibold"
            style={{ color: amountColor }}
          >
            {amountValue}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {transaction.createdBy && (
            <UserAvatar
              email={transaction.createdBy.email ?? null}
              userId={transaction.createdBy.userId ?? null}
              avatarPath={transaction.createdBy.avatarPath ?? null}
              fallbackText={
                transaction.createdBy.fallbackText ??
                transaction.createdBy.initial ??
                null
              }
              fallbackBgToken={transaction.createdBy.fallbackBgToken ?? null}
              size={24}
              label={transaction.createdBy.label}
            />
          )}

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
                      onEdit(transaction.id);
                    }}
                  >
                    {tCommon("edit")}
                  </DropdownMenuItem>
                )}
                {onDelete && (
                  <DropdownMenuItem
                    onSelect={(event) => {
                      event.stopPropagation();
                      onDelete(transaction.id);
                    }}
                    style={{ color: colors.state.negative }}
                  >
                    {tCommon("delete")}
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>
    </div>
  );
}
