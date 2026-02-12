import { formatCurrencyParts } from "./utils";
import { useTranslations } from "next-intl";

type BalanceHeaderProps = {
  amountMinor: bigint;
  monthLabel: string;
  currencySymbol: string;
  locale?: string;
  monoClassName?: string;
};

export function BalanceHeader({
  amountMinor,
  monthLabel,
  currencySymbol,
  locale = "es-ES",
  monoClassName,
}: BalanceHeaderProps) {
  const t = useTranslations();
  const { integer, decimals } = formatCurrencyParts(
    amountMinor,
    currencySymbol,
    locale
  );

  return (
    <div className="mb-8 text-center">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {t("mobile.home.balanceLabel")}
      </p>
      <p
        className={`text-[42px] font-medium leading-tight text-foreground sm:text-[42px] ${
          monoClassName ?? ""
        }`}
      >
        {integer}
        <span className="text-2xl text-muted-foreground">,{decimals}</span>
      </p>
      <p className="mt-1 text-sm text-muted-foreground">{monthLabel}</p>
    </div>
  );
}
