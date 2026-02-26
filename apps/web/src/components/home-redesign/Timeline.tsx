import { formatCurrencyParts, formatShortDate } from "./utils";
import { useTranslations } from "next-intl";

type TimelineMovement = {
  name: string;
  amountMinor: bigint;
  date: string | Date;
  type: "income" | "expense";
};

type TimelineProps = {
  last?: TimelineMovement | null;
  next?: TimelineMovement | null;
  currencySymbol: string;
  locale?: string;
  monoClassName?: string;
};

export function Timeline({
  last,
  next,
  currencySymbol,
  locale = "es",
  monoClassName,
}: TimelineProps) {
  const t = useTranslations();
  return (
    <div className="grid grid-cols-[1fr_auto_1fr] items-center rounded-xl border border-border bg-card px-4 py-5 sm:px-6">
      <TimelineItem
        label={t("mobile.home.timelineLast")}
        movement={last}
        align="left"
        currencySymbol={currencySymbol}
        locale={locale}
        monoClassName={monoClassName}
      />

      <div className="flex flex-col items-center gap-1 px-3 sm:px-6">
        <div className="h-5 w-px bg-border" />
        <div className="h-2 w-2 rounded-full bg-foreground" />
        <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
          {t("mobile.home.timelineToday")}
        </span>
        <div className="h-2 w-2 rounded-full bg-border" />
        <div className="h-5 w-px bg-border" />
      </div>

      <TimelineItem
        label={t("mobile.home.timelineNext")}
        movement={next}
        align="right"
        currencySymbol={currencySymbol}
        locale={locale}
        monoClassName={monoClassName}
      />
    </div>
  );
}

type TimelineItemProps = {
  label: string;
  movement?: TimelineMovement | null;
  align: "left" | "right";
  currencySymbol: string;
  locale: string;
  monoClassName?: string;
};

function TimelineItem({
  label,
  movement,
  align,
  currencySymbol,
  locale,
  monoClassName,
}: TimelineItemProps) {
  const alignClass = align === "right" ? "text-right" : "text-left";

  if (!movement) {
    return (
      <div className={`flex flex-col gap-0.5 ${alignClass}`}>
        <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </span>
        <span className="text-sm text-muted-foreground">—</span>
      </div>
    );
  }

  const { integer, decimals } = formatCurrencyParts(
    movement.amountMinor,
    currencySymbol,
    locale
  );
  const isIncome = movement.type === "income";

  return (
    <div className={`flex flex-col gap-0.5 ${alignClass}`}>
      <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <span className="text-sm font-semibold text-foreground">
        {movement.name}
      </span>
      <span
        className={`text-[15px] font-semibold ${
          isIncome ? "text-green-600" : "text-red-600"
        } ${monoClassName ?? ""}`}
      >
        {isIncome ? "+" : "-"}
        {integer},{decimals}
      </span>
      <span className="text-xs text-muted-foreground">
        {formatShortDate(movement.date, locale)}
      </span>
    </div>
  );
}
