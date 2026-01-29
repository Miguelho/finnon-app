"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, PlusCircle } from "lucide-react";
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
  getExpandedMonthRange,
  getSummaryForDay,
  markObligationPaid,
  t,
  themeTokens,
  withAlpha,
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

type SummaryValueWithPendingChipProps = {
  value: string;
  pendingMinor: bigint;
  pendingText: string;
  triggerLabel: string;
  valueColor: string;
  pendingToneColor?: string;
  colors: typeof themeTokens.light.colors;
  typography: ReturnType<typeof createTypographyStyles>;
  id?: string;
  align?: "apart" | "compact";
};

function SummaryValueWithPendingChip({
  value,
  pendingMinor,
  pendingText,
  triggerLabel,
  valueColor,
  pendingToneColor,
  colors,
  typography,
  id,
  align = "apart",
}: SummaryValueWithPendingChipProps) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const chipRef = useRef<HTMLDivElement | null>(null);
  const generatedId = useId();
  const chipId = id ?? generatedId;
  const hasPending = pendingMinor > 0n;

  useEffect(() => {
    if (!open) return;

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        chipRef.current?.contains(target) ||
        triggerRef.current?.contains(target)
      ) {
        return;
      }
      setOpen(false);
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [open]);

  const containerClassName =
    align === "compact"
      ? "flex items-center gap-2"
      : "flex items-center justify-between gap-3";

  const pendingTextColor = pendingToneColor
    ? withAlpha(pendingToneColor, 0.65)
    : colors.text.secondary;

  return (
    <div className={containerClassName}>
      <p
        style={{
          fontSize: typography.body.fontSize,
          fontWeight: typography.body.fontWeight,
          color: valueColor,
        }}
      >
        {value}
      </p>
      {hasPending ? (
        <div className="relative">
          <button
            type="button"
            ref={triggerRef}
            onClick={() => setOpen((prev) => !prev)}
            aria-expanded={open}
            aria-controls={chipId}
            aria-label={triggerLabel}
            className="inline-flex items-center"
            style={{
              fontSize: typography.meta.fontSize,
              fontWeight: typography.meta.fontWeight,
              color: colors.text.muted,
              background: "transparent",
              border: "none",
              padding: 0,
              lineHeight: 0,
              cursor: "pointer",
            }}
          >
            <PlusCircle size={16} aria-hidden="true" />
          </button>
          {open ? (
            <div
              id={chipId}
              ref={chipRef}
              role="status"
              className="absolute right-0 top-full z-10 mt-2 rounded-full border px-3 py-1 text-xs shadow-sm"
              style={{
                backgroundColor: colors.bg.surface,
                borderColor: colors.state.neutral,
                color: pendingTextColor,
                maxWidth: 220,
                whiteSpace: "normal",
              }}
            >
              {pendingText}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

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
  const [monthlyTxItems, setMonthlyTxItems] = useState<Transaction[]>(
    monthlyTransactions
  );
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [isLoadingMonth, setIsLoadingMonth] = useState(false);

  useEffect(() => {
    setObligationItems(obligations);
  }, [obligations]);

  useEffect(() => {
    setMonthlyTxItems(monthlyTransactions);
  }, [monthlyTransactions]);

  const now = new Date();
  const [viewMonth, setViewMonth] = useState<Date>(now);

  // Reload data when viewMonth changes
  useEffect(() => {
    let cancelled = false;

    async function loadMonthData() {
      // Skip initial load since we have server-side data
      const isCurrentMonth =
        viewMonth.getFullYear() === now.getFullYear() &&
        viewMonth.getMonth() === now.getMonth();
      if (isCurrentMonth) return;

      setIsLoadingMonth(true);

      const expandedRange = getExpandedMonthRange(viewMonth);
      const startDate = expandedRange.start.toISOString().slice(0, 10);
      const endDate = expandedRange.end.toISOString().slice(0, 10);

      try {
        const [txResult, oblResult] = await Promise.all([
          supabase
            .from("transactions")
            .select(
              "id, account_id, type, amount_minor, amount_base_minor, currency, category_id, date, merchant, notes, created_at, category:categories(id, name, icon_id)"
            )
            .eq("account_id", account.id)
            .gte("date", startDate)
            .lte("date", endDate)
            .order("date", { ascending: false })
            .order("created_at", { ascending: false }),
          supabase
            .from("obligations")
            .select(
              "id, account_id, name, amount_minor, amount_base_minor, currency, due_date, status, paid_at"
            )
            .eq("account_id", account.id)
            .gte("due_date", startDate)
            .lte("due_date", endDate)
            .order("due_date", { ascending: true }),
        ]);

        if (!cancelled) {
          if (!txResult.error) {
            setMonthlyTxItems((txResult.data as unknown as Transaction[]) ?? []);
          }
          if (!oblResult.error) {
            setObligationItems((oblResult.data as unknown as Obligation[]) ?? []);
          }
        }
      } catch (error) {
        console.error("[HomeHero] Error loading month data:", error);
      } finally {
        if (!cancelled) setIsLoadingMonth(false);
      }
    }

    void loadMonthData();
    return () => {
      cancelled = true;
    };
  }, [viewMonth, account.id, supabase, now]);

  const handlePrevMonth = () => {
    setViewMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setViewMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  };

  const viewMonthLabel = viewMonth.toLocaleDateString(locale, {
    month: "long",
    year: "numeric",
  });

  const calendarEventRange = getExpandedMonthRange(viewMonth);
  const viewModel = buildHomeViewModel({
    account,
    role,
    dictionary,
    obligations: obligationItems,
    monthlyTransactions: monthlyTxItems,
    upcomingTransactions,
    month: viewMonth,
    nextDays,
    recentLimit: 6,
    now,
    calendarEventRange,
  });

  const colors = themeTokens.light.colors;
  const typography = createTypographyStyles(themeTokens.light);
  const currencySymbol =
    CURRENCIES.find((currency) => currency.code === account.base_currency)
      ?.symbol ?? account.base_currency;
  const cashflowNetMinor =
    viewModel.cashflow.incomeMinor - viewModel.cashflow.expenseMinor;
  const formatSignedBalance = (amountMinor: bigint) => {
    const absoluteMinor = amountMinor < 0n ? -amountMinor : amountMinor;
    const sign = amountMinor < 0n ? "-" : "";
    return `${sign}${formatMoneyWithSymbol(
      absoluteMinor,
      account.base_currency,
      currencySymbol
    )}`;
  };
  const pendingTriggerLabel = t(dictionary, "home.pendingTriggerLabel");
  const incomeRealFormatted = formatMoneyWithSymbol(
    viewModel.monthOverview.incomeRealMinor,
    account.base_currency,
    currencySymbol
  );
  const incomePendingFormatted = formatMoneyWithSymbol(
    viewModel.monthOverview.incomePendingMinor,
    account.base_currency,
    currencySymbol
  );
  const expenseRealFormatted = formatMoneyWithSymbol(
    viewModel.monthOverview.expenseRealMinor,
    account.base_currency,
    currencySymbol
  );
  const expensePendingFormatted = formatMoneyWithSymbol(
    viewModel.monthOverview.expensePendingMinor,
    account.base_currency,
    currencySymbol
  );
  const incomePendingText = t(dictionary, "home.pendingChipLabel", {
    amount: incomePendingFormatted,
  });
  const expensePendingText = t(dictionary, "home.pendingChipLabel", {
    amount: expensePendingFormatted,
  });
  const balancePendingText = t(dictionary, "home.pendingChipLabel", {
    amount: formatSignedBalance(-viewModel.monthOverview.expensePendingMinor),
  });
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const [isDayPanelOpen, setIsDayPanelOpen] = useState(false);
  const [sheetExpanded, setSheetExpanded] = useState(false);

  const daySummary = useMemo(() => {
    if (!selectedDay) return null;
    return getSummaryForDay(
      selectedDay,
      obligationItems,
      monthlyTxItems,
      account.base_currency,
      t(dictionary, "home.recentFallbackTitle")
    );
  }, [
    selectedDay,
    obligationItems,
    monthlyTxItems,
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
            {/* 1. Este mes - Month Header with Navigation */}
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2
                  style={{
                    fontSize: typography.h2.fontSize,
                    fontWeight: typography.h2.fontWeight,
                    color: colors.text.primary,
                  }}
                >
                  {t(dictionary, "dashboard.thisMonth")}
                </h2>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handlePrevMonth}
                  className="p-1 hover:opacity-70"
                  style={{ color: colors.text.secondary }}
                  aria-label={t(dictionary, "transactions.previousMonth")}
                >
                  <ChevronLeft size={20} />
                </button>
                <p
                  style={{
                    fontSize: typography.body.fontSize,
                    fontWeight: typography.body.fontWeight,
                    color: colors.text.primary,
                    textTransform: "capitalize",
                  }}
                >
                  {viewMonthLabel}
                </p>
                <button
                  type="button"
                  onClick={handleNextMonth}
                  className="p-1 hover:opacity-70"
                  style={{ color: colors.text.secondary }}
                  aria-label={t(dictionary, "transactions.nextMonth")}
                >
                  <ChevronRight size={20} />
                </button>
              </div>

              {/* 2. Calendar */}
              <MonthMap
                month={viewMonth}
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
            </div>

            {/* 3. Income - Expenses */}
            <div
              className="space-y-3 border-t pt-4"
              style={{ borderColor: colors.state.neutral }}
            >
              <div className="grid gap-4 md:grid-cols-2">
                <div
                  className="rounded-xl border p-4"
                  style={{
                    borderColor: colors.state.neutral,
                    backgroundColor: colors.bg.secondary,
                  }}
                >
                  <p
                    style={{
                      fontSize: typography.h3.fontSize,
                      fontWeight: typography.h3.fontWeight,
                      color: colors.text.primary,
                    }}
                  >
                    {viewModel.copy.incomeLabel}
                  </p>
                  <div className="mt-3">
                    <SummaryValueWithPendingChip
                      value={incomeRealFormatted}
                      pendingMinor={viewModel.monthOverview.incomePendingMinor}
                      pendingText={incomePendingText}
                      triggerLabel={pendingTriggerLabel}
                      valueColor={colors.state.positive}
                      pendingToneColor={colors.state.positive}
                      colors={colors}
                      typography={typography}
                    />
                  </div>
                </div>

                <div
                  className="rounded-xl border p-4"
                  style={{
                    borderColor: colors.state.neutral,
                    backgroundColor: colors.bg.secondary,
                  }}
                >
                  <p
                    style={{
                      fontSize: typography.h3.fontSize,
                      fontWeight: typography.h3.fontWeight,
                      color: colors.text.primary,
                    }}
                  >
                    {viewModel.copy.expenseLabel}
                  </p>
                  <div className="mt-3">
                    <SummaryValueWithPendingChip
                      value={expenseRealFormatted}
                      pendingMinor={viewModel.monthOverview.expensePendingMinor}
                      pendingText={expensePendingText}
                      triggerLabel={pendingTriggerLabel}
                      valueColor={colors.state.negative}
                      pendingToneColor={colors.state.negative}
                      colors={colors}
                      typography={typography}
                    />
                  </div>
                </div>
              </div>

              {!viewModel.monthOverview.hasActivity && (
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

            {/* 4. Balance */}
            <div
              className="space-y-2 border-t pt-4"
              style={{ borderColor: colors.state.neutral }}
            >
              <h3
                style={{
                  fontSize: typography.h3.fontSize,
                  fontWeight: typography.h3.fontWeight,
                  color: colors.text.primary,
                }}
              >
                {viewModel.copy.balanceLabel}
              </h3>
              <div
                className="space-y-3 rounded-xl border p-4"
                style={{
                  borderColor: colors.state.neutral,
                  backgroundColor: colors.bg.secondary,
                }}
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs" style={{ color: colors.text.secondary }}>
                    {viewModel.copy.balanceTodayLabel}
                  </p>
                  <SummaryValueWithPendingChip
                    value={formatSignedBalance(viewModel.monthOverview.balanceTodayMinor)}
                    pendingMinor={viewModel.monthOverview.expensePendingMinor}
                    pendingText={balancePendingText}
                    triggerLabel={pendingTriggerLabel}
                    valueColor={colors.text.primary}
                    pendingToneColor={colors.state.negative}
                    colors={colors}
                    typography={typography}
                    align="compact"
                  />
                </div>
              </div>
            </div>

            {/* 5. Próximos X días (Cashflow) */}
            <div
              className="space-y-3 border-t pt-4"
              style={{ borderColor: colors.state.neutral }}
            >
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
