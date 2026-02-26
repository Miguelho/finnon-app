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
      <p className="text-[12px] font-semibold uppercase tracking-[0.5px] text-muted-foreground">
        {t("mobile.home.balanceLabel")}
      </p>
      <p
        className={`text-[44px] font-semibold leading-none tracking-[-0.04em] text-foreground sm:text-[44px] ${
          monoClassName ?? ""
        }`}
      >
        {integer}
        <span className="text-[22px] font-normal text-muted-foreground">
          ,{decimals}
        </span>
      </p>
      <p className="mt-1 text-sm text-muted-foreground">{monthLabel}</p>
    </div>
  );
}
