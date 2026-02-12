import { formatCurrencyParts } from "./utils";
import { useTranslations } from "next-intl";

type ProgrammedItem = {
  id: string;
  name: string;
  amountMinor: bigint;
  dateLabel: string;
  type: "income" | "expense";
};

type ProgrammedCardProps = {
  items: ProgrammedItem[];
  onViewAll: () => void;
  currencySymbol: string;
  locale?: string;
  monoClassName?: string;
};

export function ProgrammedCard({
  items,
  onViewAll,
  currencySymbol,
  locale = "es-ES",
  monoClassName,
}: ProgrammedCardProps) {
  const t = useTranslations();
  if (!items || items.length === 0) return null;

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-center justify-between">
        <h3 className="text-[15px] font-semibold text-foreground">
          {t("mobile.home.programmedTitle")}
        </h3>
        <button
          type="button"
          onClick={onViewAll}
          className="text-[13px] font-medium text-primary hover:underline"
        >
          {t("mobile.home.programmedViewAll")}
        </button>
      </div>

      <div className="mt-3">
        {items.map((item) => {
          const isIncome = item.type === "income";
          const { integer, decimals } = formatCurrencyParts(
            item.amountMinor,
            currencySymbol,
            locale
          );
          return (
            <div
              key={item.id}
              className="flex items-center justify-between border-t border-border/50 py-2.5 first:border-t-0"
            >
              <div className="flex items-center gap-3">
                <div
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-secondary text-base ${
                    isIncome ? "text-green-600" : "text-red-600"
                  }`}
                >
                  {isIncome ? "↑" : "↓"}
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">
                    {item.name}
                  </p>
                  <p className="text-xs text-muted-foreground">{item.dateLabel}</p>
                </div>
              </div>
              <span
                className={`shrink-0 text-sm font-medium ${
                  isIncome ? "text-green-600" : "text-red-600"
                } ${monoClassName ?? ""}`}
              >
                {isIncome ? "+" : "-"}
                {integer},{decimals}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
