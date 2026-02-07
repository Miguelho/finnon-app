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
  monthLabel,
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
    <div className="mb-8 text-center">
      <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
        Balance del mes
      </p>
      <p
        className={`text-[42px] font-medium leading-tight text-gray-900 sm:text-[42px] ${
          monoClassName ?? ""
        }`}
      >
        {integer}
        <span className="text-2xl text-gray-400">,{decimals}</span>
      </p>
      <p className="mt-1 text-sm text-gray-400">{monthLabel}</p>
    </div>
  );
}
