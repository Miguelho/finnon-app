"use client";
import {
  createTypographyStyles,
  formatMoneyWithSymbol,
  themeTokens,
  type ArrowStyle,
} from "@poleursus/shared";
import { CashFlowArrow } from "@/components/cash-flow-arrow";

type CashFlowArrowsProps = {
  incomeMinor: bigint;
  expenseMinor: bigint;
  netMinor: bigint;
  currency: string;
  currencySymbol: string;
  incomeLabel: string;
  expenseLabel: string;
  balanceLabel: string;
  /** Arrow style variant (default: "chevron") */
  arrowStyle?: ArrowStyle;
  /** Show directional accent on arrow tips (default: true) */
  showDirectionalAccent?: boolean;
};

const tokens = themeTokens.light;
const colors = tokens.colors;
const typography = createTypographyStyles(tokens);

export function CashFlowArrows({
  incomeMinor,
  expenseMinor,
  netMinor,
  currency,
  currencySymbol,
  incomeLabel,
  expenseLabel,
  balanceLabel,
  arrowStyle = "chevron",
  showDirectionalAccent = true,
}: CashFlowArrowsProps) {
  const incomeValue = Number(incomeMinor);
  const expenseValue = Number(expenseMinor);

  // Visibility logic
  const showIncome = incomeMinor !== 0n;
  const showExpense = expenseMinor !== 0n;
  const showLeftColumn = showIncome || showExpense;

  // Proportional arrow widths (percentage-based)
  const maxValue = Math.max(Math.abs(incomeValue), Math.abs(expenseValue), 1);
  const incomeWidthPercent = Math.max(15, (Math.abs(incomeValue) / maxValue) * 100);
  const expenseWidthPercent = Math.max(15, (Math.abs(expenseValue) / maxValue) * 100);

  const netColor =
    netMinor < 0n ? colors.state.negative : colors.text.primary;

  const gridColumns = showLeftColumn
    ? "1fr minmax(var(--balance-col-min), var(--balance-col-max))"
    : "1fr";

  return (
    <div
      className="grid items-center gap-6"
      style={{ gridTemplateColumns: gridColumns }}
    >
      {/* Left Column: Stacked Arrows (40%) */}
      {showLeftColumn && (
        <div className="flex min-w-0 flex-1 flex-col gap-4">
          {/* Income Row */}
          {showIncome && (
            <div
              className="flex flex-col gap-1.5"
              role="group"
              aria-label={`${incomeLabel}: +${formatMoneyWithSymbol(incomeMinor, currency, currencySymbol)}`}
            >
              <p
                style={{
                  fontSize: typography.meta.fontSize,
                  fontWeight: typography.meta.fontWeight,
                  color: colors.text.secondary,
                }}
              >
                {incomeLabel}
              </p>
              <div className="flex items-center gap-2">
                <div style={{ width: `${incomeWidthPercent}%`, minWidth: 20 }}>
                  <CashFlowArrow
                    direction="right"
                    widthPx={9999}
                    style={arrowStyle}
                    accentColor={
                      showDirectionalAccent ? colors.state.positive : undefined
                    }
                    showAccent={showDirectionalAccent}
                  />
                </div>
                <span
                  style={{
                    backgroundColor: colors.bg.secondary,
                    borderRadius: 8,
                    padding: "4px 8px",
                    fontSize: typography.meta.fontSize,
                    fontWeight: 600,
                    color: colors.state.positive,
                    whiteSpace: "nowrap",
                  }}
                >
                  +{formatMoneyWithSymbol(incomeMinor, currency, currencySymbol)}
                </span>
              </div>
            </div>
          )}

          {/* Expense Row */}
          {showExpense && (
            <div
              className="flex flex-col gap-1.5"
              role="group"
              aria-label={`${expenseLabel}: -${formatMoneyWithSymbol(expenseMinor, currency, currencySymbol)}`}
            >
              <p
                style={{
                  fontSize: typography.meta.fontSize,
                  fontWeight: typography.meta.fontWeight,
                  color: colors.text.secondary,
                }}
              >
                {expenseLabel}
              </p>
              <div className="flex items-center gap-2">
                <div style={{ width: `${expenseWidthPercent}%`, minWidth: 20 }}>
                  <CashFlowArrow
                    direction="left"
                    widthPx={9999}
                    style={arrowStyle}
                    accentColor={
                      showDirectionalAccent ? colors.state.negative : undefined
                    }
                    showAccent={showDirectionalAccent}
                  />
                </div>
                <span
                  style={{
                    backgroundColor: colors.bg.secondary,
                    borderRadius: 8,
                    padding: "4px 8px",
                    fontSize: typography.meta.fontSize,
                    fontWeight: 600,
                    color: colors.state.negative,
                    whiteSpace: "nowrap",
                  }}
                >
                  -{formatMoneyWithSymbol(expenseMinor, currency, currencySymbol)}
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Right Column: Balance (60%) */}
      <div className="flex flex-col items-end justify-center gap-1">
        <p
          style={{
            fontSize: typography.meta.fontSize,
            fontWeight: typography.meta.fontWeight,
            color: colors.text.secondary,
            textAlign: "right",
            width: "100%",
          }}
        >
          {balanceLabel}
        </p>
        <p
          className="font-balance"
          style={{
            fontSize: typography.display.fontSize,
            fontWeight: typography.display.fontWeight,
            color: netColor,
            textAlign: "right",
            width: "100%",
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
    </div>
  );
}
