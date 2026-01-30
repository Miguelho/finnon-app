"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PlusCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { CashFlowArrows } from "@/components/home/cash-flow-arrows";
import { DayDetailPanel } from "@/components/home/day-detail-panel";
import { WeekStrip } from "@/components/home/week-strip";
import { MonthViewPanel } from "@/components/home/month-view-panel";
import {
  buildHomeViewModel,
  CURRENCIES,
  createTypographyStyles,
  formatMoneyWithSymbol,
  getExpandedMonthRange,
  getWeekInfo,
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
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [nextDays, setNextDays] = useState<number>(CASHFLOW_DAYS_OPTIONS[0]);
  const [obligationItems, setObligationItems] = useState<Obligation[]>(
    obligations
  );
  const [monthlyTxItems, setMonthlyTxItems] = useState<Transaction[]>(
    monthlyTransactions
  );
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [weekReference, setWeekReference] = useState<Date>(new Date());

  useEffect(() => {
    setObligationItems(obligations);
  }, [obligations]);

  useEffect(() => {
    setMonthlyTxItems(monthlyTransactions);
  }, [monthlyTransactions]);

  const now = new Date();
  const calendarEventRange = getExpandedMonthRange(now);
  const calendarTransactions = useMemo(() => {
    const map = new Map<string, Transaction>();
    [...monthlyTxItems, ...upcomingTransactions].forEach((item) => {
      map.set(item.id, item);
    });
    return Array.from(map.values());
  }, [monthlyTxItems, upcomingTransactions]);
  const viewModel = buildHomeViewModel({
    account,
    role,
    dictionary,
    obligations: obligationItems,
    monthlyTransactions: monthlyTxItems,
    upcomingTransactions,
    month: now,
    nextDays,
    recentLimit: 6,
    upcomingEventsLimit: 3,
    locale,
    now,
    calendarEventRange,
    weekReference,
    weekTransactions: calendarTransactions,
    weekObligations: obligationItems,
  });

  const weekInfo = getWeekInfo(weekReference, locale);
  const weekLabel = `${weekInfo.weekNumber} · ${weekInfo.monthLabel}`;

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
  const monthNetMinor = viewModel.monthOverview.balanceEomMinor;
  const monthNetFormatted = formatSignedBalance(monthNetMinor);
  const pendingTotalMinor =
    viewModel.monthOverview.incomePendingMinor +
    viewModel.monthOverview.expensePendingMinor;
  const pendingTotalText = t(dictionary, "home.includesPending", {
    amount: formatMoneyWithSymbol(
      pendingTotalMinor,
      account.base_currency,
      currencySymbol
    ),
  });
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const [isDayPanelOpen, setIsDayPanelOpen] = useState(false);
  const [sheetExpanded, setSheetExpanded] = useState(false);
  const [isMonthViewOpen, setIsMonthViewOpen] = useState(false);

  const daySummary = useMemo(() => {
    if (!selectedDay) return null;
    return getSummaryForDay(
      selectedDay,
      obligationItems,
      calendarTransactions,
      account.base_currency,
      t(dictionary, "home.recentFallbackTitle")
    );
  }, [
    selectedDay,
    obligationItems,
    calendarTransactions,
    account.base_currency,
    dictionary,
  ]);

  const handleSelectDay = (date: Date) => {
    setSelectedDay(date);
    setIsDayPanelOpen(true);
    setSheetExpanded(false);
  };

  const shiftWeek = (delta: number) => {
    setWeekReference((prev) => {
      const next = new Date(prev);
      next.setDate(next.getDate() + delta);
      return next;
    });
    setSelectedDay(null);
    setIsDayPanelOpen(false);
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

  const handleAddForDay = (date: Date) => {
    const isoDate = date.toISOString().slice(0, 10);
    setIsDayPanelOpen(false);
    setSheetExpanded(false);
    router.push(`/transactions?new=1&date=${isoDate}`);
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
          {/* LEFT COLUMN: Hero, Próximos (60% on desktop) */}
          <div className="flex-1 space-y-6 md:w-3/5">
            {/* 1. Resumen del mes */}
            <div className="space-y-2">
              <h2
                style={{
                  fontSize: typography.h2.fontSize,
                  fontWeight: typography.h2.fontWeight,
                  color: colors.text.primary,
                }}
              >
                {viewModel.copy.monthSummaryTitle}
              </h2>
              <div className="flex flex-wrap items-center gap-3">
                <p
                  style={{
                    fontSize: typography.display.fontSize,
                    fontWeight: typography.display.fontWeight,
                    color: colors.text.primary,
                  }}
                >
                  {monthNetFormatted}
                </p>
                {pendingTotalMinor > 0n && (
                  <span
                    className="rounded-full border px-3 py-1 text-xs"
                    style={{
                      borderColor: colors.state.neutral,
                      backgroundColor: colors.bg.secondary,
                      color: colors.text.secondary,
                    }}
                  >
                    {pendingTotalText}
                  </span>
                )}
              </div>
            </div>

            {/* 2. Income - Expenses */}
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-4">
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

            {/* 4. Próximos X días (Cashflow) */}
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
                  {viewModel.copy.upcomingTitle}
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
                <>
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
                  <div className="mt-3 space-y-2">
                    {viewModel.cashflow.items.slice(0, 10).map((item) => {
                      const dayLabel = item.date.toLocaleDateString(locale, {
                        weekday: "short",
                      });
                      return (
                        <div
                          key={item.id}
                          className="flex items-center justify-between text-sm"
                        >
                          <span style={{ color: colors.text.secondary }}>
                            {dayLabel}: {item.title}
                          </span>
                          <span
                            style={{
                              color:
                                item.type === "income"
                                  ? colors.state.positive
                                  : colors.state.negative,
                              fontWeight: 500,
                            }}
                          >
                            {item.type === "expense" ? "-" : "+"}
                            {formatMoneyWithSymbol(
                              item.amountMinor,
                              account.base_currency,
                              currencySymbol
                            )}
                          </span>
                        </div>
                      );
                    })}
                    {viewModel.cashflow.items.length > 10 && (
                      <p className="text-xs" style={{ color: colors.text.secondary }}>
                        {t(dictionary, "home.upcomingMoreMessage")}
                      </p>
                    )}
                  </div>
                </>
              )}
            </div>

            {/* Semana - visible on mobile only, desktop shows in right column */}
            <div
              className="md:hidden border-t pt-4"
              style={{ borderColor: colors.state.neutral }}
            >
              <WeekStrip
                days={viewModel.weekStrip.days}
                locale={locale}
                selectedDate={selectedDay}
                onSelectDate={handleSelectDay}
                onViewMonth={() => setIsMonthViewOpen(true)}
                onPrevWeek={() => shiftWeek(-7)}
                onNextWeek={() => shiftWeek(7)}
                weekTitle={viewModel.copy.weekTitle}
                weekLabel={weekLabel}
                viewMonthCta={viewModel.copy.viewMonthCta}
                dotsLegend={viewModel.copy.dotsLegend}
              />
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

          {/* RIGHT COLUMN: WeekStrip + DayDetail (40% on desktop) */}
          <div className="hidden md:flex md:w-2/5 md:flex-col md:gap-6">
            {/* WeekStrip - desktop only */}
            <WeekStrip
              days={viewModel.weekStrip.days}
              locale={locale}
              selectedDate={selectedDay}
              onSelectDate={handleSelectDay}
              onViewMonth={() => setIsMonthViewOpen(true)}
              onPrevWeek={() => shiftWeek(-7)}
              onNextWeek={() => shiftWeek(7)}
              weekTitle={viewModel.copy.weekTitle}
              weekLabel={weekLabel}
              viewMonthCta={viewModel.copy.viewMonthCta}
              dotsLegend={viewModel.copy.dotsLegend}
            />
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
        onAddForDay={handleAddForDay}
        onViewMonth={() => setIsMonthViewOpen(true)}
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
          addForDayCta: viewModel.copy.addForDayCta,
          viewMonthCta: viewModel.copy.viewMonthCta,
        }}
      />

      {/* Month View Panel */}
      <MonthViewPanel
        open={isMonthViewOpen}
        onOpenChange={setIsMonthViewOpen}
        accountId={account.id}
        locale={locale}
        dictionary={dictionary}
        baseCurrency={account.base_currency}
        currencySymbol={currencySymbol}
        fallbackTitle={t(dictionary, "home.recentFallbackTitle")}
        obligations={obligationItems}
        transactions={monthlyTxItems}
        initialMonth={selectedDay ?? weekReference ?? now}
        canEdit={viewModel.permissions.canEdit}
        updatingId={updatingId}
        onToggleObligation={handleToggleObligation}
      />
    </>
  );
}
