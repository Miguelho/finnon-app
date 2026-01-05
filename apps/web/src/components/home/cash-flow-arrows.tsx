import {
  createTypographyStyles,
  formatMoneyWithSymbol,
  themeTokens,
} from "@poleursus/shared";

type CashFlowArrowsProps = {
  incomeMinor: bigint;
  expenseMinor: bigint;
  netMinor: bigint;
  currency: string;
  currencySymbol: string;
  incomeLabel: string;
  expenseLabel: string;
  balanceLabel: string;
};

const tokens = themeTokens.light;
const colors = tokens.colors;
const typography = createTypographyStyles(tokens);

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

export function CashFlowArrows({
  incomeMinor,
  expenseMinor,
  netMinor,
  currency,
  currencySymbol,
  incomeLabel,
  expenseLabel,
  balanceLabel,
}: CashFlowArrowsProps) {
  const incomeValue = Number(incomeMinor);
  const expenseValue = Number(expenseMinor);
  const maxValue = Math.max(Math.abs(incomeValue), Math.abs(expenseValue), 1);
  const minWidth = 60;
  const maxWidth = 160;
  const incomeWidth = clamp(
    (Math.abs(incomeValue) / maxValue) * maxWidth,
    minWidth,
    maxWidth
  );
  const expenseWidth = clamp(
    (Math.abs(expenseValue) / maxValue) * maxWidth,
    minWidth,
    maxWidth
  );
  const netColor =
    netMinor < 0n ? colors.state.negative : colors.text.primary;

  return (
    <div className="flex flex-wrap items-end justify-between gap-6">
      <div className="min-w-[140px] space-y-2">
        <p
          style={{
            fontSize: typography.meta.fontSize,
            fontWeight: typography.meta.fontWeight,
            color: colors.text.secondary,
          }}
        >
          {incomeLabel}
        </p>
        <div className="flex items-center gap-1">
          <span
            style={{
              width: incomeWidth,
              height: 2,
              borderRadius: 999,
              backgroundColor: colors.text.secondary,
              display: "inline-block",
            }}
          />
          <span
            style={{
              width: 0,
              height: 0,
              borderTop: "4px solid transparent",
              borderBottom: "4px solid transparent",
              borderLeft: `6px solid ${colors.text.secondary}`,
            }}
          />
        </div>
        <p
          style={{
            fontSize: typography.body.fontSize,
            fontWeight: typography.body.fontWeight,
            color: colors.text.primary,
          }}
        >
          +{formatMoneyWithSymbol(incomeMinor, currency, currencySymbol)}
        </p>
      </div>

      <div className="flex flex-col items-center gap-2">
        <p
          style={{
            fontSize: typography.meta.fontSize,
            fontWeight: typography.meta.fontWeight,
            color: colors.text.secondary,
          }}
        >
          {balanceLabel}
        </p>
        <p
          style={{
            fontSize: typography.display.fontSize,
            fontWeight: typography.display.fontWeight,
            color: netColor,
          }}
        >
          {netMinor < 0n ? "-" : "+"}
          {formatMoneyWithSymbol(
            netMinor < 0n ? -netMinor : netMinor,
            currency,
            currencySymbol
          )}
        </p>
      </div>

      <div className="min-w-[140px] space-y-2 text-right">
        <p
          style={{
            fontSize: typography.meta.fontSize,
            fontWeight: typography.meta.fontWeight,
            color: colors.text.secondary,
          }}
        >
          {expenseLabel}
        </p>
        <div className="flex items-center justify-end gap-1">
          <span
            style={{
              width: 0,
              height: 0,
              borderTop: "4px solid transparent",
              borderBottom: "4px solid transparent",
              borderRight: `6px solid ${colors.text.secondary}`,
            }}
          />
          <span
            style={{
              width: expenseWidth,
              height: 2,
              borderRadius: 999,
              backgroundColor: colors.text.secondary,
              display: "inline-block",
            }}
          />
        </div>
        <p
          style={{
            fontSize: typography.body.fontSize,
            fontWeight: typography.body.fontWeight,
            color: colors.text.primary,
          }}
        >
          -{formatMoneyWithSymbol(expenseMinor, currency, currencySymbol)}
        </p>
      </div>
    </div>
  );
}
