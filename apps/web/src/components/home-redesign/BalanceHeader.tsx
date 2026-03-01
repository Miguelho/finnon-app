import { formatCurrencyParts } from "./utils";
import { SummaryCardShell } from "./SummaryCardShell";
import { ChevronRight } from "lucide-react";

export type BalanceAccountItem = {
  id: string;
  name: string;
  balanceMinor: bigint;
  color: string;
};

type BalanceRowProps = {
  totalBalanceMinor: bigint;
  currencySymbol: string;
  accounts: BalanceAccountItem[];
  onPress?: () => void;
  locale?: string;
};

function BalanceRowContent({
  totalBalanceMinor,
  currencySymbol,
  accounts,
  locale = "es-ES",
  isClickable = false,
}: Omit<BalanceRowProps, "onPress"> & { isClickable?: boolean }) {
  const { integer, decimals } = formatCurrencyParts(
    totalBalanceMinor,
    currencySymbol,
    locale
  );
  const showBreakdown = accounts.length > 1;

  return (
    <SummaryCardShell className="w-full rounded-[14px] border-[color:rgba(255,255,255,0.12)] px-[14px] py-[10px]">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[9px] font-semibold uppercase tracking-[0.7px] text-[var(--account-text-tertiary)]">
            BALANCE
          </p>
          <p className="mt-[2px] truncate font-balance text-[21px] font-normal leading-[1.15] tracking-[-0.5px] text-[var(--account-text-primary)]">
            {integer}
            <span className="font-balance text-[14px] text-[var(--account-text-secondary)]">
              ,{decimals}
            </span>
          </p>
        </div>

        <div className="flex min-w-0 items-center justify-end gap-2">
          {showBreakdown ? (
            <div className="flex flex-wrap items-center justify-end gap-x-2 gap-y-1">
              {accounts.map((account) => {
                const parts = formatCurrencyParts(account.balanceMinor, currencySymbol, locale);
                return (
                  <div key={account.id} className="inline-flex items-center gap-1.5">
                    <span
                      className="h-[5px] w-[5px] rounded-full"
                      style={{ backgroundColor: account.color }}
                      aria-hidden
                    />
                    <span className="font-balance text-[11px] font-medium text-[var(--account-text-secondary)]">
                      {parts.full}
                    </span>
                  </div>
                );
              })}
            </div>
          ) : null}
          {isClickable ? (
            <ChevronRight
              size={16}
              className="shrink-0 text-[var(--account-text-tertiary)]"
              aria-hidden="true"
            />
          ) : null}
          </div>
      </div>
    </SummaryCardShell>
  );
}

export function BalanceRow(props: BalanceRowProps) {
  if (!props.onPress) {
    return <BalanceRowContent {...props} isClickable={false} />;
  }

  return (
    <button
      type="button"
      onClick={props.onPress}
      className="w-full text-left transition-opacity hover:opacity-[0.96]"
    >
      <BalanceRowContent {...props} isClickable />
    </button>
  );
}

// Compatibility export for existing imports.
export const BalanceHeader = BalanceRow;
