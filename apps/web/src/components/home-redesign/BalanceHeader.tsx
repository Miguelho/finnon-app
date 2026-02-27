import { formatCurrencyParts } from "./utils";

type BalanceHeaderProps = {
  amountMinor: bigint;
  monthLabel: string;
  currencySymbol: string;
  locale?: string;
  monoClassName?: string;
};

export function BalanceHeader({
  amountMinor,
  monthLabel: _monthLabel,
  currencySymbol,
  locale = "es-ES",
  monoClassName,
}: BalanceHeaderProps) {
  const { integer, decimals } = formatCurrencyParts(
    amountMinor,
    currencySymbol,
    locale
  );

  return (
    <div className="flex h-full w-full flex-col rounded-xl border bg-card px-4 py-4">
      <p className="text-left text-[12px] font-semibold uppercase tracking-[0.5px] text-foreground">
        Balance
      </p>
      <div className="mt-1 flex flex-1 items-center justify-center">
        <p
          className={`font-balance whitespace-nowrap text-[30px] font-semibold leading-none tracking-[-0.03em] text-foreground sm:text-[34px] ${
            monoClassName ?? ""
          }`}
        >
          {integer}
          <span className="text-[18px] font-normal text-muted-foreground">
            ,{decimals}
          </span>
        </p>
      </div>
    </div>
  );
}
