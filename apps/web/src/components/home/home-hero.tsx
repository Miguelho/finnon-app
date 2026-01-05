"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { CashFlowArrows } from "@/components/home/cash-flow-arrows";
import { DayDetailPanel } from "@/components/home/day-detail-panel";
import { MonthMap } from "@/components/home/month-map";
import {
  buildHomeViewModel,
  CURRENCIES,
  createTypographyStyles,
  formatMoneyWithSymbol,
  getSummaryForDay,
  markObligationPaid,
  t,
  themeTokens,
  type CopyDictionary,
  type Obligation,
  type Transaction,
  type UserRole,
} from "@poleursus/shared";

type HomeHeroProps = {
  account: {
    id: string;
    name: string;
    base_currency: string;
  };
  role: UserRole;
  dictionary: CopyDictionary;
  locale: string;
  obligations: Obligation[];
  monthlyTransactions: Transaction[];
  upcomingTransactions: Transaction[];
};

const CASHFLOW_DAYS_OPTIONS = [7, 14, 30] as const;

export function HomeHero({
  account,
  role,
  dictionary,
  locale,
  obligations,
  monthlyTransactions,
  upcomingTransactions,
}: HomeHeroProps) {
  const supabase = useMemo(() => createClient(), []);
  const [nextDays, setNextDays] = useState<number>(CASHFLOW_DAYS_OPTIONS[0]);
  const [obligationItems, setObligationItems] = useState<Obligation[]>(
    obligations
  );
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  useEffect(() => {
    setObligationItems(obligations);
  }, [obligations]);

  const now = new Date();
  const viewModel = buildHomeViewModel({
    account,
    role,
    dictionary,
    obligations: obligationItems,
    monthlyTransactions,
    upcomingTransactions,
    month: now,
    nextDays,
    recentLimit: 6,
    now,
  });

  const colors = themeTokens.light.colors;
  const typography = createTypographyStyles(themeTokens.light);
  const currencySymbol =
    CURRENCIES.find((currency) => currency.code === account.base_currency)
      ?.symbol ?? account.base_currency;
  const cashflowNetMinor =
    viewModel.cashflow.incomeMinor - viewModel.cashflow.expenseMinor;
  const monthLabel = now.toLocaleDateString(locale, {
    month: "long",
    year: "numeric",
  });
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const [isDayPanelOpen, setIsDayPanelOpen] = useState(false);
  const [sheetExpanded, setSheetExpanded] = useState(false);

  const daySummary = useMemo(() => {
    if (!selectedDay) return null;
    return getSummaryForDay(
      selectedDay,
      obligationItems,
      monthlyTransactions,
      account.base_currency,
      t(dictionary, "home.recentFallbackTitle")
    );
  }, [
    selectedDay,
    obligationItems,
    monthlyTransactions,
    account.base_currency,
    dictionary,
  ]);

  const handleSelectDay = (date: Date) => {
    setSelectedDay(date);
    setIsDayPanelOpen(true);
    setSheetExpanded(false);
  };

  const handleToggleObligation = async (item: {
    id: string;
    status?: "pending" | "paid";
  }) => {
    if (!viewModel.permissions.canEdit) return;

    setUpdatingId(item.id);
    try {
      const update = await markObligationPaid(
        supabase,
        item.id,
        item.status
      );
      setObligationItems((prev) =>
        prev.map((obligation) =>
          obligation.id === item.id
            ? {
                ...obligation,
                status: update.status,
                paid_at: update.paidAt,
              }
            : obligation
        )
      );
    } catch (error) {
      console.error("[Home] Error updating obligation:", error);
      window.alert(t(dictionary, "errors.internalServer"));
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <>
      <section
        className="rounded-2xl border p-6"
        style={{
          borderColor: colors.state.neutral,
          backgroundColor: colors.bg.surface,
        }}
      >
        <div className="flex flex-col gap-6 md:flex-row">
          <div className="flex-1 space-y-6">
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2
                  style={{
                    fontSize: typography.h2.fontSize,
                    fontWeight: typography.h2.fontWeight,
                    color: colors.text.primary,
                  }}
                >
                  {viewModel.copy.cashflowTitle}
                </h2>
                <div className="flex flex-wrap items-center gap-2">
                  {CASHFLOW_DAYS_OPTIONS.map((days) => (
                    <button
                      key={days}
                      type="button"
                      className="rounded-full border px-3 py-1 text-xs font-semibold"
                      style={{
                        borderColor:
                          nextDays === days
                            ? colors.action.primary
                            : colors.state.neutral,
                        backgroundColor:
                          nextDays === days
                            ? colors.action.secondary
                            : colors.bg.secondary,
                        color:
                          nextDays === days
                            ? colors.text.primary
                            : colors.text.secondary,
                      }}
                      onClick={() => setNextDays(days)}
                    >
                      {days}
                    </button>
                  ))}
                </div>
              </div>
              {viewModel.cashflow.items.length === 0 ? (
                <p className="text-sm" style={{ color: colors.text.secondary }}>
                  {viewModel.emptyStates.upcoming}
                </p>
              ) : (
                <CashFlowArrows
                  incomeMinor={viewModel.cashflow.incomeMinor}
                  expenseMinor={viewModel.cashflow.expenseMinor}
                  netMinor={cashflowNetMinor}
                  currency={account.base_currency}
                  currencySymbol={currencySymbol}
                  incomeLabel={viewModel.copy.incomeLabel}
                  expenseLabel={viewModel.copy.expenseLabel}
                  balanceLabel={viewModel.copy.balanceLabel}
                />
              )}
            </div>

            <div
              className="space-y-3 border-t pt-4"
              style={{ borderColor: colors.state.neutral }}
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2
                    style={{
                      fontSize: typography.h2.fontSize,
                      fontWeight: typography.h2.fontWeight,
                      color: colors.text.primary,
                    }}
                  >
                    {t(dictionary, "dashboard.thisMonth")}
                  </h2>
                  <p
                    style={{
                      fontSize: typography.meta.fontSize,
                      fontWeight: typography.meta.fontWeight,
                      color: colors.text.secondary,
                    }}
                  >
                    {monthLabel}
                  </p>
                </div>
              </div>

              <MonthMap
                month={now}
                locale={locale}
                events={viewModel.calendar.events}
                highlightRange={viewModel.calendar.highlightRange}
                selectedDate={selectedDay}
                onSelectDate={handleSelectDay}
              />

              {viewModel.calendar.events.length === 0 && (
                <p className="text-sm" style={{ color: colors.text.secondary }}>
                  {viewModel.copy.monthEmpty}
                </p>
              )}

              <div className="grid gap-4 md:grid-cols-3">
                <div>
                  <p className="text-xs" style={{ color: colors.text.secondary }}>
                    {viewModel.copy.committedLabel}
                  </p>
                  <p
                    style={{
                      fontSize: typography.body.fontSize,
                      fontWeight: typography.body.fontWeight,
                      color: colors.text.primary,
                    }}
                  >
                    {formatMoneyWithSymbol(
                      viewModel.monthlyHero.committedMinor,
                      account.base_currency,
                      currencySymbol
                    )}
                  </p>
                </div>
                <div>
                  <p className="text-xs" style={{ color: colors.text.secondary }}>
                    {viewModel.copy.pendingLabel}
                  </p>
                  <p
                    style={{
                      fontSize: typography.body.fontSize,
                      fontWeight: typography.body.fontWeight,
                      color: colors.text.primary,
                    }}
                  >
                    {formatMoneyWithSymbol(
                      viewModel.monthlyHero.pendingMinor,
                      account.base_currency,
                      currencySymbol
                    )}
                  </p>
                </div>
                <div>
                  <p className="text-xs" style={{ color: colors.text.secondary }}>
                    {viewModel.monthlyHero.paidLabel}
                  </p>
                  <p
                    style={{
                      fontSize: typography.body.fontSize,
                      fontWeight: typography.body.fontWeight,
                      color: colors.text.primary,
                    }}
                  >
                    {formatMoneyWithSymbol(
                      viewModel.monthlyHero.paidMinor,
                      account.base_currency,
                      currencySymbol
                    )}
                  </p>
                </div>
              </div>

              {!viewModel.monthlyHero.hasActivity && (
                <div
                  className="space-y-2 border-t pt-4"
                  style={{ borderColor: colors.state.neutral }}
                >
                  <p className="text-sm" style={{ color: colors.text.secondary }}>
                    {viewModel.emptyStates.activity.title}
                  </p>
                  <Button
                    variant="outline"
                    asChild
                    style={{
                      borderColor: colors.state.neutral,
                      backgroundColor: colors.bg.surface,
                      color: colors.text.primary,
                    }}
                  >
                    <Link href="/transactions?new=1&type=expense">
                      {viewModel.emptyStates.activity.cta}
                    </Link>
                  </Button>
                </div>
              )}
            </div>

            {viewModel.permissions.isGuestReadOnly && (
              <div
                className="flex flex-wrap items-center gap-3 border-t pt-4"
                style={{ borderColor: colors.state.neutral }}
              >
                <p className="text-sm" style={{ color: colors.text.secondary }}>
                  {viewModel.copy.guestBlurb}
                </p>
                <Button
                  variant="secondary"
                  asChild
                  style={{
                    backgroundColor: colors.action.secondary,
                    color: colors.text.primary,
                  }}
                >
                  <Link href="/onboarding">{viewModel.copy.guestCta}</Link>
                </Button>
              </div>
            )}
          </div>

          <div className="hidden md:block md:w-80">
            <DayDetailPanel
              variant="panel"
              isOpen={isDayPanelOpen}
              summary={isDayPanelOpen ? daySummary : null}
              locale={locale}
              currency={account.base_currency}
              currencySymbol={currencySymbol}
              canEdit={viewModel.permissions.canEdit && !updatingId}
              onClose={() => {
                setIsDayPanelOpen(false);
                setSelectedDay(null);
                setSheetExpanded(false);
              }}
              onToggleObligation={handleToggleObligation}
              copy={{
                balanceLabel: viewModel.copy.balanceLabel,
                incomeLabel: viewModel.copy.incomeLabel,
                expenseLabel: viewModel.copy.expenseLabel,
                markPaid: viewModel.copy.markPaid,
                markPending: viewModel.copy.markPending,
                daySummaryTitle: viewModel.copy.daySummaryTitle,
                dayObligationsTitle: viewModel.copy.dayObligationsTitle,
                dayRecurringTitle: viewModel.copy.dayRecurringTitle,
                dayTransactionsTitle: viewModel.copy.dayTransactionsTitle,
                dayEmpty: viewModel.copy.dayEmpty,
                closeLabel: t(dictionary, "common.close"),
                statusPaidLabel: t(dictionary, "obligations.create.statusPaid"),
                statusPendingLabel: t(
                  dictionary,
                  "obligations.create.statusPending"
                ),
              }}
            />
          </div>
        </div>
      </section>

      <DayDetailPanel
        variant="sheet"
        isOpen={isDayPanelOpen}
        isExpanded={sheetExpanded}
        onToggleExpand={() => setSheetExpanded((prev) => !prev)}
        summary={isDayPanelOpen ? daySummary : null}
        locale={locale}
        currency={account.base_currency}
        currencySymbol={currencySymbol}
        canEdit={viewModel.permissions.canEdit && !updatingId}
        onClose={() => {
          setIsDayPanelOpen(false);
          setSelectedDay(null);
          setSheetExpanded(false);
        }}
        onToggleObligation={handleToggleObligation}
        copy={{
          balanceLabel: viewModel.copy.balanceLabel,
          incomeLabel: viewModel.copy.incomeLabel,
          expenseLabel: viewModel.copy.expenseLabel,
          markPaid: viewModel.copy.markPaid,
          markPending: viewModel.copy.markPending,
          daySummaryTitle: viewModel.copy.daySummaryTitle,
          dayObligationsTitle: viewModel.copy.dayObligationsTitle,
          dayRecurringTitle: viewModel.copy.dayRecurringTitle,
          dayTransactionsTitle: viewModel.copy.dayTransactionsTitle,
          dayEmpty: viewModel.copy.dayEmpty,
          closeLabel: t(dictionary, "common.close"),
          statusPaidLabel: t(dictionary, "obligations.create.statusPaid"),
          statusPendingLabel: t(
            dictionary,
            "obligations.create.statusPending"
          ),
        }}
      />
    </>
  );
}
