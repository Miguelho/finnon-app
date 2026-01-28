import {
  HelpCircle,
  PlusCircle,
  RefreshCw,
  Repeat,
} from "lucide-react";
import type { AddActionMeta, AddActionIconName } from "@poleursus/shared";
import { cn } from "@/lib/utils";

const iconMap: Record<AddActionIconName, typeof HelpCircle> = {
  PlusCircle,
  Repeat,
  RefreshCw,
};

type AddMenuItemProps = {
  meta: AddActionMeta;
  onClick: () => void;
  disabled?: boolean;
};

const resolveIcon = (meta: AddActionMeta) =>
  iconMap[meta.icon] ??
  (meta.iconFallback ? iconMap[meta.iconFallback] : undefined) ??
  HelpCircle;

export function AddMenuItem({ meta, onClick, disabled = false }: AddMenuItemProps) {
  const Icon = resolveIcon(meta);

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "group flex min-h-14 w-full items-center gap-3 rounded-xl border border-border bg-background px-4 py-3 text-left transition-colors duration-150 hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background active:bg-accent",
        disabled && "cursor-not-allowed opacity-60"
      )}
    >
      <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-muted transition-colors duration-150 group-hover:bg-background">
        <Icon
          className="h-5 w-5 text-muted-foreground transition-colors duration-150 group-hover:text-foreground"
          strokeWidth={2}
        />
      </span>
      <span className="flex flex-col gap-1">
        <span className="text-[15px] font-semibold text-foreground">
          {meta.title}
        </span>
        <span className="text-[13px] text-muted-foreground">
          {meta.description}
        </span>
      </span>
    </button>
  );
}
