"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  SlidePanel,
  SlidePanelContent,
  SlidePanelHeader,
  SlidePanelTitle,
  SlidePanelBody,
} from "@/components/ui/slide-panel";
import { MonthMap } from "@/components/home/month-map";
import {
  createTypographyStyles,
  formatMoneyWithSymbol,
  getEventsForMonth,
  getExpandedMonthRange,
  getMonthKey,
  getSummaryForDay,
  t,
  themeTokens,
  type CalendarEvent,
  type CopyDictionary,
  type Obligation,
  type Transaction,
} from "@poleursus/shared";

type MonthViewPanelProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accountId: string;
  locale: string;
  dictionary: CopyDictionary;
  baseCurrency: string;
  currencySymbol: string;
  fallbackTitle: string;
  obligations: Obligation[];
  transactions: Transaction[];
  initialMonth?: Date;
  canEdit: boolean;
  updatingId: string | null;
  onToggleObligation: (item: { id: string; status: "pending" | "paid" }) => void;
};

export function MonthViewPanel({
  open,
  onOpenChange,
  accountId,
  locale,
  dictionary,
  baseCurrency,
  currencySymbol,
  fallbackTitle,
  obligations,
  transactions,
  initialMonth,
  canEdit,
  updatingId,
  onToggleObligation,
}: MonthViewPanelProps) {
  const supabase = useMemo(() => createClient(), []);
  const [viewMonth, setViewMonth] = useState<Date>(initialMonth ?? new Date());
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const [monthData, setMonthData] = useState<{
    transactions: Transaction[];
    obligations: Obligation[];
  }>({
    transactions,
    obligations,
  });
  const monthCache = useRef<
    Record<string, { transactions: Transaction[]; obligations: Obligation[] }>
  >({});
  const colors = themeTokens.light.colors;
  const typography = createTypographyStyles(themeTokens.light);

  useEffect(() => {
    const seedMonth = initialMonth ?? new Date();
    const monthKey = getMonthKey(seedMonth);
    monthCache.current[monthKey] = {
      transactions,
      obligations,
    };
    if (getMonthKey(viewMonth) === monthKey) {
      setMonthData({ transactions, obligations });
    }
  }, [initialMonth, obligations, transactions, viewMonth]);

  useEffect(() => {
    if (!open) return;
    setSelectedDay(null);
    if (initialMonth) {
      setViewMonth(initialMonth);
    }
  }, [open, initialMonth]);

  useEffect(() => {
    let cancelled = false;
    const monthKey = getMonthKey(viewMonth);
    const cached = monthCache.current[monthKey];
    if (cached) {
      setMonthData(cached);
      return;
    }

    async function loadMonthData() {
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
            .eq("account_id", accountId)
            .gte("date", startDate)
            .lte("date", endDate)
            .order("date", { ascending: false })
            .order("created_at", { ascending: false }),
          supabase
            .from("obligations")
            .select(
              "id, account_id, name, amount_minor, amount_base_minor, currency, due_date, status, paid_at"
            )
            .eq("account_id", accountId)
            .gte("due_date", startDate)
            .lte("due_date", endDate)
            .order("due_date", { ascending: true }),
        ]);

        if (!cancelled) {
          const nextData = {
            transactions: (txResult.data as Transaction[]) ?? [],
            obligations: (oblResult.data as Obligation[]) ?? [],
          };
          monthCache.current[monthKey] = nextData;
          setMonthData(nextData);
        }
      } catch (error) {
        console.error("[MonthViewPanel] Error loading month data:", error);
      }
    }

    void loadMonthData();
    return () => {
      cancelled = true;
    };
  }, [accountId, supabase, viewMonth]);

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
  const events: CalendarEvent[] = getEventsForMonth(
    viewMonth,
    monthData.obligations,
    monthData.transactions,
    baseCurrency,
    fallbackTitle,
    calendarEventRange
  );

  const daySummary = useMemo(() => {
    if (!selectedDay) return null;
    return getSummaryForDay(
      selectedDay,
      monthData.obligations,
      monthData.transactions,
      baseCurrency,
      fallbackTitle
    );
  }, [selectedDay, monthData, baseCurrency, fallbackTitle]);

  const handleSelectDay = (date: Date) => {
    setSelectedDay(date);
  };

  const handleBackToCalendar = () => {
    setSelectedDay(null);
  };

  const handleToggleObligationLocal = (item: {
    id: string;
    status: "pending" | "paid";
  }) => {
    onToggleObligation(item);
    setMonthData((prev) => {
      const nextStatus = item.status === "paid" ? "pending" : "paid";
      const nextObligations = prev.obligations.map((obligation) =>
        obligation.id === item.id
          ? { ...obligation, status: nextStatus }
          : obligation
      );
      const nextData = { ...prev, obligations: nextObligations };
      monthCache.current[getMonthKey(viewMonth)] = nextData;
      return nextData;
    });
  };

  const netColor =
    daySummary && daySummary.netMinor < 0n
      ? colors.state.negative
      : colors.text.primary;

  return (
    <SlidePanel open={open} onOpenChange={onOpenChange}>
      <SlidePanelContent>
        <SlidePanelHeader>
          {selectedDay ? (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleBackToCalendar}
                className="p-1 hover:opacity-70"
                style={{ color: colors.text.secondary }}
              >
                <ArrowLeft size={20} />
              </button>
              <SlidePanelTitle>
                {selectedDay.toLocaleDateString(locale, {
                  weekday: "short",
                  day: "2-digit",
                  month: "short",
                })}
              </SlidePanelTitle>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handlePrevMonth}
                className="p-1 hover:opacity-70"
                style={{ color: colors.text.secondary }}
              >
                <ChevronLeft size={20} />
              </button>
              <SlidePanelTitle
                style={{
                  textTransform: "capitalize",
                  minWidth: "180px",
                  textAlign: "center",
                }}
              >
                {viewMonthLabel}
              </SlidePanelTitle>
              <button
                type="button"
                onClick={handleNextMonth}
                className="p-1 hover:opacity-70"
                style={{ color: colors.text.secondary }}
              >
                <ChevronRight size={20} />
              </button>
            </div>
          )}
        </SlidePanelHeader>
        <SlidePanelBody>
          {selectedDay && daySummary ? (
            <div className="space-y-5">
              <p
                style={{
                  fontSize: typography.meta.fontSize,
                  fontWeight: typography.meta.fontWeight,
                  color: colors.text.secondary,
                }}
              >
                {t(dictionary, "home.daySummaryTitle")}
              </p>

              <div className="flex flex-wrap gap-6">
                <div>
                  <p
                    style={{
                      fontSize: typography.meta.fontSize,
                      fontWeight: typography.meta.fontWeight,
                      color: colors.text.secondary,
                    }}
                  >
                    {t(dictionary, "common.balanceLabel")}
                  </p>
                  <p
                    style={{
                      fontSize: typography.body.fontSize,
                      fontWeight: typography.body.fontWeight,
                      color: netColor,
                    }}
                  >
                    {daySummary.netMinor < 0n ? "-" : "+"}
                    {formatMoneyWithSymbol(
                      daySummary.netMinor < 0n ? -daySummary.netMinor : daySummary.netMinor,
                      baseCurrency,
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
                    {t(dictionary, "common.incomeLabel")}
                  </p>
                  <p
                    style={{
                      fontSize: typography.body.fontSize,
                      fontWeight: typography.body.fontWeight,
                      color: colors.text.primary,
                    }}
                  >
                    +{formatMoneyWithSymbol(
                      daySummary.incomeMinor,
                      baseCurrency,
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
                    {t(dictionary, "common.expenseLabel")}
                  </p>
                  <p
                    style={{
                      fontSize: typography.body.fontSize,
                      fontWeight: typography.body.fontWeight,
                      color: colors.text.primary,
                    }}
                  >
                    -{formatMoneyWithSymbol(
                      daySummary.expenseMinor,
                      baseCurrency,
                      currencySymbol
                    )}
                  </p>
                </div>
              </div>

              {!daySummary.hasActivity && (
                <p style={{ color: colors.text.secondary }}>
                  {t(dictionary, "home.dayEmpty")}
                </p>
              )}

              {daySummary.obligations.length > 0 && (
                <div className="space-y-2">
                  <p
                    style={{
                      fontSize: typography.h3.fontSize,
                      fontWeight: typography.h3.fontWeight,
                      color: colors.text.primary,
                    }}
                  >
                    {t(dictionary, "home.dayObligationsTitle")}
                  </p>
                  {daySummary.obligations.map((item) => (
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
                            ? t(dictionary, "obligations.create.statusPaid")
                            : t(dictionary, "obligations.create.statusPending")}
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
                            baseCurrency,
                            currencySymbol
                          )}
                        </p>
                        <button
                          type="button"
                          onClick={() =>
                            handleToggleObligationLocal({
                              id: item.id,
                              status: item.status,
                            })
                          }
                          disabled={!canEdit || updatingId === item.id}
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
                            opacity: canEdit && updatingId !== item.id ? 1 : 0.6,
                          }}
                        >
                          {item.status === "paid"
                            ? t(dictionary, "home.markPending")
                            : t(dictionary, "home.markPaid")}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {daySummary.recurring.length > 0 && (
                <div className="space-y-2">
                  <p
                    style={{
                      fontSize: typography.h3.fontSize,
                      fontWeight: typography.h3.fontWeight,
                      color: colors.text.primary,
                    }}
                  >
                    {t(dictionary, "home.dayRecurringTitle")}
                  </p>
                  {daySummary.recurring.map((item) => (
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
                          baseCurrency,
                          currencySymbol
                        )}
                      </p>
                    </div>
                  ))}
                </div>
              )}

              {daySummary.transactions.length > 0 && (
                <div className="space-y-2">
                  <p
                    style={{
                      fontSize: typography.h3.fontSize,
                      fontWeight: typography.h3.fontWeight,
                      color: colors.text.primary,
                    }}
                  >
                    {t(dictionary, "home.dayTransactionsTitle")}
                  </p>
                  {daySummary.transactions.map((item) => (
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
                          baseCurrency,
                          currencySymbol
                        )}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <>
              <MonthMap
                month={viewMonth}
                locale={locale}
                events={events}
                highlightRange={calendarEventRange}
                selectedDate={selectedDay}
                onSelectDate={handleSelectDay}
              />
              {events.length === 0 && (
                <p
                  className="mt-4 text-center text-sm"
                  style={{ color: colors.text.secondary }}
                >
                  {t(dictionary, "home.dayEmpty")}
                </p>
              )}
            </>
          )}
        </SlidePanelBody>
      </SlidePanelContent>
    </SlidePanel>
  );
}
