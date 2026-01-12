"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { MoreHorizontal } from "lucide-react";
import { themeTokens } from "@poleursus/shared";
import { CategoryIcon } from "@/components/category-icon";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

type CategoryTileProps = {
  category: {
    id: string;
    name: string;
    icon_id: string;
    type: "income" | "expense";
  };
  density?: "comfortable" | "compact";
  onPress?: (id: string) => void;
  onEdit?: (id: string) => void;
  onDelete?: (id: string) => void;
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

export function CategoryTile({
  category,
  density = "comfortable",
  onPress,
  onEdit,
  onDelete,
}: CategoryTileProps) {
  const tCommon = useTranslations("common");
  const styles = densityStyles[density];
  const hasActions = Boolean(onEdit || onDelete);

  const handlePress = () => onPress?.(category.id);
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
      <div className={cn("flex items-center min-w-0 flex-1", styles.gap)}>
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
            iconId={category.icon_id}
            size={styles.iconSize}
            tone="muted"
            accessibilityLabel={category.name}
          />
        </div>

        <div className="min-w-0 flex-1">
          <div
            className="text-base font-semibold truncate"
            style={{ color: colors.text.primary }}
          >
            {category.name}
          </div>
        </div>
      </div>

      {hasActions && (
        <div className="shrink-0">
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
                    onEdit(category.id);
                  }}
                >
                  {tCommon("edit")}
                </DropdownMenuItem>
              )}
              {onDelete && (
                <DropdownMenuItem
                  onSelect={(event) => {
                    event.stopPropagation();
                    onDelete(category.id);
                  }}
                  style={{ color: colors.state.negative }}
                >
                  {tCommon("delete")}
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}
    </div>
  );
}
