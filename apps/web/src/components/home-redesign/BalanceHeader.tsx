import { formatCurrencyParts } from "./utils";
import { SummaryCardShell } from "./SummaryCardShell";

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
    <SummaryCardShell className="flex h-full w-full min-w-0 flex-col [container-type:inline-size]">
      <p className="text-left text-[12px] font-semibold uppercase tracking-[0.5px] text-foreground">
        Balance
      </p>
      <div className="mt-1 flex min-w-0 flex-1 items-center justify-center">
        <p
          className={`font-balance max-w-full whitespace-nowrap text-[clamp(14px,12cqw,34px)] font-semibold leading-none tracking-[-0.03em] text-foreground ${
            monoClassName ?? ""
          }`}
        >
          {integer}
          <span className="text-[clamp(10px,6.5cqw,18px)] font-normal text-muted-foreground">
            ,{decimals}
          </span>
        </p>
      </div>
    </SummaryCardShell>
  );
}
