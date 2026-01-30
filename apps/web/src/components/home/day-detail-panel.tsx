import {
  createTypographyStyles,
  formatMoneyWithSymbol,
  themeTokens,
  type DaySummary,
} from "@poleursus/shared";

type DayDetailPanelProps = {
  variant: "panel" | "sheet";
  isOpen: boolean;
  isExpanded?: boolean;
  summary: DaySummary | null;
  locale: string;
  currency: string;
  currencySymbol: string;
  canEdit: boolean;
  onClose: () => void;
  onToggleExpand?: () => void;
  onToggleObligation: (item: { id: string; status: "pending" | "paid" }) => void;
  onAddForDay?: (date: Date) => void;
  onViewMonth?: () => void;
  copy: {
    balanceLabel: string;
    incomeLabel: string;
    expenseLabel: string;
    markPaid: string;
    markPending: string;
    daySummaryTitle: string;
    dayObligationsTitle: string;
    dayRecurringTitle: string;
    dayTransactionsTitle: string;
    dayEmpty: string;
    closeLabel: string;
    statusPaidLabel: string;
    statusPendingLabel: string;
    addForDayCta?: string;
    viewMonthCta?: string;
  };
};

const tokens = themeTokens.light;
const colors = tokens.colors;
const typography = createTypographyStyles(tokens);

export function DayDetailPanel({
  variant,
  isOpen,
  isExpanded,
  summary,
  locale,
  currency,
  currencySymbol,
  canEdit,
  onClose,
  onToggleExpand,
  onToggleObligation,
  onAddForDay,
  onViewMonth,
  copy,
}: DayDetailPanelProps) {
  if (variant === "sheet" && (!isOpen || !summary)) return null;

  const netColor =
    summary && summary.netMinor < 0n
      ? colors.state.negative
      : colors.text.primary;

  const panelContent = summary ? (
    <div className="space-y-5">
      <div>
        <p
          style={{
            fontSize: typography.h3.fontSize,
            fontWeight: typography.h3.fontWeight,
            color: colors.text.primary,
          }}
        >
          {summary.date.toLocaleDateString(locale, {
            weekday: "short",
            day: "2-digit",
            month: "short",
          })}
        </p>
        <p
          style={{
            fontSize: typography.meta.fontSize,
            fontWeight: typography.meta.fontWeight,
            color: colors.text.secondary,
          }}
        >
          {copy.daySummaryTitle}
        </p>
      </div>

      <div className="flex flex-wrap gap-6">
        <div>
          <p
            style={{
              fontSize: typography.meta.fontSize,
              fontWeight: typography.meta.fontWeight,
              color: colors.text.secondary,
            }}
          >
            {copy.balanceLabel}
          </p>
          <p
            style={{
              fontSize: typography.body.fontSize,
              fontWeight: typography.body.fontWeight,
              color: netColor,
            }}
          >
            {summary.netMinor < 0n ? "-" : "+"}
            {formatMoneyWithSymbol(
              summary.netMinor < 0n ? -summary.netMinor : summary.netMinor,
              currency,
              currencySymbol
            )}
          </p>
        </div>
        <div>
          <p
            style={{
              fontSize: typography.meta.fontSize,
              fontWeight: typography.meta.fontWeight,
              color: colors.text.secondary,
            }}
          >
            {copy.incomeLabel}
          </p>
          <p
            style={{
              fontSize: typography.body.fontSize,
              fontWeight: typography.body.fontWeight,
              color: colors.text.primary,
            }}
          >
            +{formatMoneyWithSymbol(
              summary.incomeMinor,
              currency,
              currencySymbol
            )}
          </p>
        </div>
        <div>
          <p
            style={{
              fontSize: typography.meta.fontSize,
              fontWeight: typography.meta.fontWeight,
              color: colors.text.secondary,
            }}
          >
            {copy.expenseLabel}
          </p>
          <p
            style={{
              fontSize: typography.body.fontSize,
              fontWeight: typography.body.fontWeight,
              color: colors.text.primary,
            }}
          >
            -{formatMoneyWithSymbol(
              summary.expenseMinor,
              currency,
              currencySymbol
            )}
          </p>
        </div>
      </div>

      {!summary.hasActivity && (
        <p style={{ color: colors.text.secondary }}>{copy.dayEmpty}</p>
      )}

      {summary.obligations.length > 0 && (
        <div className="space-y-2">
          <p
            style={{
              fontSize: typography.h3.fontSize,
              fontWeight: typography.h3.fontWeight,
              color: colors.text.primary,
            }}
          >
            {copy.dayObligationsTitle}
          </p>
          {summary.obligations.map((item) => (
            <div
              key={item.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-lg border px-4 py-3"
              style={{
                borderColor: colors.state.neutral,
                backgroundColor: colors.bg.secondary,
              }}
            >
              <div>
                <p style={{ color: colors.text.primary }}>{item.title}</p>
                <p
                  style={{
                    fontSize: typography.meta.fontSize,
                    fontWeight: typography.meta.fontWeight,
                    color: colors.text.secondary,
                  }}
                >
                  {item.status === "paid"
                    ? copy.statusPaidLabel
                    : copy.statusPendingLabel}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <p
                  style={{
                    fontSize: typography.body.fontSize,
                    fontWeight: typography.body.fontWeight,
                    color: colors.text.primary,
                  }}
                >
                  {formatMoneyWithSymbol(
                    item.amountMinor,
                    currency,
                    currencySymbol
                  )}
                </p>
                <button
                  type="button"
                  onClick={() =>
                    onToggleObligation({ id: item.id, status: item.status })
                  }
                  disabled={!canEdit}
                  className="rounded-full px-3 py-1 text-xs font-semibold"
                  style={{
                    backgroundColor:
                      item.status === "paid"
                        ? colors.action.secondary
                        : colors.action.primary,
                    color:
                      item.status === "paid"
                        ? colors.text.primary
                        : colors.bg.primary,
                    border: `1px solid ${colors.action.primary}`,
                    opacity: canEdit ? 1 : 0.6,
                  }}
                >
                  {item.status === "paid" ? copy.markPending : copy.markPaid}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {summary.recurring.length > 0 && (
        <div className="space-y-2">
          <p
            style={{
              fontSize: typography.h3.fontSize,
              fontWeight: typography.h3.fontWeight,
              color: colors.text.primary,
            }}
          >
            {copy.dayRecurringTitle}
          </p>
          {summary.recurring.map((item) => (
            <div
              key={item.id}
              className="flex items-center justify-between gap-3 rounded-lg border px-4 py-3"
              style={{
                borderColor: colors.state.neutral,
                backgroundColor: colors.bg.secondary,
              }}
            >
              <div>
                <p style={{ color: colors.text.primary }}>{item.title}</p>
                {item.notes && (
                  <p
                    style={{
                      fontSize: typography.meta.fontSize,
                      fontWeight: typography.meta.fontWeight,
                      color: colors.text.secondary,
                    }}
                  >
                    {item.notes}
                  </p>
                )}
              </div>
              <p
                style={{
                  fontSize: typography.body.fontSize,
                  fontWeight: typography.body.fontWeight,
                  color:
                    item.type === "income"
                      ? colors.state.positive
                      : colors.state.negative,
                }}
              >
                {item.type === "income" ? "+" : "-"}
                {formatMoneyWithSymbol(
                  item.amountMinor,
                  currency,
                  currencySymbol
                )}
              </p>
            </div>
          ))}
        </div>
      )}

      {summary.transactions.length > 0 && (
        <div className="space-y-2">
          <p
            style={{
              fontSize: typography.h3.fontSize,
              fontWeight: typography.h3.fontWeight,
              color: colors.text.primary,
            }}
          >
            {copy.dayTransactionsTitle}
          </p>
          {summary.transactions.map((item) => (
            <div
              key={item.id}
              className="flex items-center justify-between gap-3 rounded-lg border px-4 py-3"
              style={{
                borderColor: colors.state.neutral,
                backgroundColor: colors.bg.secondary,
              }}
            >
              <div>
                <p style={{ color: colors.text.primary }}>{item.title}</p>
                {item.notes && (
                  <p
                    style={{
                      fontSize: typography.meta.fontSize,
                      fontWeight: typography.meta.fontWeight,
                      color: colors.text.secondary,
                    }}
                  >
                    {item.notes}
                  </p>
                )}
              </div>
              <p
                style={{
                  fontSize: typography.body.fontSize,
                  fontWeight: typography.body.fontWeight,
                  color:
                    item.type === "income"
                      ? colors.state.positive
                      : colors.state.negative,
                }}
              >
                {item.type === "income" ? "+" : "-"}
                {formatMoneyWithSymbol(
                  item.amountMinor,
                  currency,
                  currencySymbol
                )}
              </p>
            </div>
          ))}
        </div>
      )}

      {(onAddForDay || onViewMonth) && (
        <div
          className="space-y-3 border-t pt-4"
          style={{ borderColor: colors.state.neutral }}
        >
          {canEdit && onAddForDay && copy.addForDayCta && (
            <button
              type="button"
              onClick={() => onAddForDay(summary.date)}
              className="w-full rounded-lg px-4 py-2 text-sm font-semibold"
              style={{
                backgroundColor: colors.action.primary,
                color: colors.bg.primary,
              }}
            >
              {copy.addForDayCta}
            </button>
          )}
          {onViewMonth && copy.viewMonthCta && (
            <button
              type="button"
              onClick={onViewMonth}
              className="text-sm"
              style={{ color: colors.action.primary }}
            >
              {copy.viewMonthCta}
            </button>
          )}
        </div>
      )}
    </div>
  ) : (
    <p style={{ color: colors.text.secondary }}>{copy.dayEmpty}</p>
  );

  if (variant === "panel") {
    return (
      <aside
        className="rounded-2xl border p-5 max-h-[70vh] overflow-y-auto"
        style={{
          borderColor: colors.state.neutral,
          backgroundColor: colors.bg.surface,
          minHeight: 320,
        }}
      >
        <div className="flex justify-end sticky top-0" style={{ backgroundColor: colors.bg.surface }}>
          {summary && (
            <button
              type="button"
              onClick={onClose}
              className="text-xs"
              style={{ color: colors.text.secondary }}
            >
              {copy.closeLabel}
            </button>
          )}
        </div>
        {panelContent}
      </aside>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={onClose}
        className="fixed inset-0 z-40 bg-transparent md:hidden"
        aria-label={copy.closeLabel}
      />
      <div
        className="fixed bottom-0 left-0 right-0 z-50 md:hidden"
        style={{
          borderTopLeftRadius: tokens.radii.lg,
          borderTopRightRadius: tokens.radii.lg,
          border: `1px solid ${colors.state.neutral}`,
          backgroundColor: colors.bg.surface,
          height: isExpanded ? "80vh" : "40vh",
        }}
      >
        <div className="flex items-center justify-between px-5 pt-3">
          <button
            type="button"
            onClick={onToggleExpand}
            className="h-1 w-12 rounded-full"
            style={{ backgroundColor: colors.state.neutral }}
            aria-label={copy.daySummaryTitle}
          />
          <button
            type="button"
            onClick={onClose}
            className="text-xs"
            style={{ color: colors.text.secondary }}
          >
            {copy.closeLabel}
          </button>
        </div>
        <div
          className="max-h-[72vh] overflow-y-auto px-5 pb-6 pt-4"
          style={{
            overscrollBehavior: "contain",
            WebkitOverflowScrolling: "touch",
            touchAction: "pan-y",
          }}
        >
          {panelContent}
        </div>
      </div>
    </>
  );
}
