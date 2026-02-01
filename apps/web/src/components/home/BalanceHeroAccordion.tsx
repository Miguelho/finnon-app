"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ChevronDown } from "lucide-react";
import {
  createTypographyStyles,
  formatMoneyWithSymbol,
  themeTokens,
  type CashflowItem,
  type HomeViewModel,
  type Obligation,
} from "@poleursus/shared";

type BalanceHeroAccordionProps = {
  balanceTodayMinor: bigint;
  real: HomeViewModel["balanceHero"]["real"];
  scheduledRange: HomeViewModel["balanceHero"]["scheduledRange"];
  scheduledItems: CashflowItem[];
  noDate: HomeViewModel["balanceHero"]["noDate"];
  balanceEndOfMonthEstimatedMinor: bigint;
  exposureTotalMinor: bigint;
  currency: string;
  currencySymbol: string;
  locale: string;
  monthLabel?: string;
  copy: HomeViewModel["copy"];
  canEdit: boolean;
  onViewAllScheduled?: () => void;
  onAssignNoDate?: (item: Obligation) => void;
  onMarkNoDateSettled?: (item: Obligation) => void;
};

const tokens = themeTokens.light;
const colors = tokens.colors;
const typography = createTypographyStyles(tokens);

const formatSignedBalance = (
  amountMinor: bigint,
  currency: string,
  currencySymbol: string
) => {
  const absoluteMinor = amountMinor < 0n ? -amountMinor : amountMinor;
  const sign = amountMinor < 0n ? "-" : "";
  return `${sign}${formatMoneyWithSymbol(absoluteMinor, currency, currencySymbol)}`;
};

const getNetColor = (amountMinor: bigint) => {
  if (amountMinor > 0n) return colors.state.positive;
  if (amountMinor < 0n) return colors.state.negative;
  return colors.text.secondary;
};

export function BalanceHeroAccordion({
  balanceTodayMinor,
  real,
  scheduledRange,
  scheduledItems,
  noDate,
  balanceEndOfMonthEstimatedMinor,
  exposureTotalMinor,
  currency,
  currencySymbol,
  locale,
  monthLabel,
  copy,
  canEdit,
  onViewAllScheduled,
  onAssignNoDate,
  onMarkNoDateSettled,
}: BalanceHeroAccordionProps) {
  const [isOpen, setIsOpen] = useState(false);
  const contentId = useId();
  const contentRef = useRef<HTMLDivElement | null>(null);
  const [contentHeight, setContentHeight] = useState(0);

  const scheduledTopItems = useMemo(
    () => scheduledItems.slice(0, 3),
    [scheduledItems]
  );
  const noDateTopItems = useMemo(() => noDate.items.slice(0, 3), [noDate.items]);

  useEffect(() => {
    if (!contentRef.current) return;
    if (!isOpen) {
      setContentHeight(0);
      return;
    }
    setContentHeight(contentRef.current.scrollHeight);
  }, [isOpen, scheduledItems.length, noDate.items.length]);

  const chipData = [
    {
      label: copy.balanceHeroRealChip,
      value: formatSignedBalance(real.netMinor, currency, currencySymbol),
      tone: getNetColor(real.netMinor),
    },
    {
      label: copy.balanceHeroScheduledChip,
      value: formatSignedBalance(scheduledRange.netMinor, currency, currencySymbol),
      tone: getNetColor(scheduledRange.netMinor),
    },
    {
      label: copy.balanceHeroNoDateChip,
      value: formatSignedBalance(noDate.netMinor, currency, currencySymbol),
      tone: getNetColor(noDate.netMinor),
    },
  ];

  return (
    <div
      className="rounded-2xl border"
      style={{ borderColor: colors.state.neutral, backgroundColor: colors.bg.surface }}
    >
      <button
        type="button"
        className="w-full px-4 py-4 text-left md:px-5"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-expanded={isOpen}
        aria-controls={contentId}
      >
        <div
          className="grid gap-2"
          style={{
            gridTemplateColumns:
              "1fr minmax(var(--balance-col-min), var(--balance-col-max))",
          }}
        >
          <p
            style={{
              fontSize: typography.h3.fontSize,
              fontWeight: typography.h3.fontWeight,
              color: colors.text.primary,
            }}
          >
            {copy.balanceTodayLabel}
          </p>
          <div className="flex items-center justify-end gap-2">
            <span className="text-xs" style={{ color: colors.text.secondary }}>
              {isOpen ? copy.balanceBreakdownCloseCta : copy.balanceBreakdownCta}
            </span>
            <ChevronDown
              size={18}
              className="transition-transform duration-200"
              style={{
                color: colors.text.secondary,
                transform: isOpen ? "rotate(180deg)" : "rotate(0deg)",
              }}
              aria-hidden="true"
            />
          </div>
          {monthLabel ? (
            <p className="text-xs" style={{ color: colors.text.secondary }}>
              {monthLabel}
            </p>
          ) : (
            <span />
          )}
          <p
            className="justify-self-end text-right"
            style={{
              fontSize: typography.display.fontSize,
              fontWeight: typography.display.fontWeight,
              color: colors.text.primary,
            }}
          >
            {formatSignedBalance(balanceTodayMinor, currency, currencySymbol)}
          </p>
          <div className="col-span-2 flex flex-wrap gap-2">
            {chipData.map((chip) => (
              <span
                key={chip.label}
                className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs"
                style={{
                  borderColor: colors.state.neutral,
                  backgroundColor: colors.bg.secondary,
                  color: colors.text.secondary,
                }}
              >
                <span>{chip.label}</span>
                <span style={{ color: chip.tone }}>{chip.value}</span>
              </span>
            ))}
          </div>
        </div>
      </button>

      <div
        style={{
          height: contentHeight,
          overflow: "hidden",
          transition: "height 200ms ease-out",
        }}
        aria-hidden={!isOpen}
      >
        <div
          id={contentId}
          ref={contentRef}
          className="space-y-4 border-t px-4 pb-5 pt-4 md:px-5"
          style={{ pointerEvents: isOpen ? "auto" : "none" }}
        >
          <div
            className="rounded-xl border p-4"
            style={{ borderColor: colors.state.neutral, backgroundColor: colors.bg.secondary }}
          >
            <h4
              style={{
                fontSize: typography.h3.fontSize,
                fontWeight: typography.h3.fontWeight,
                color: colors.text.primary,
              }}
            >
              {copy.realLabel}
            </h4>
            <div className="mt-3 grid grid-cols-2 gap-4 text-sm">
              <div className="space-y-1">
                <p style={{ color: colors.text.secondary }}>{copy.realReceivedLabel}</p>
                <p style={{ color: colors.state.positive }}>
                  {formatMoneyWithSymbol(real.receivableMinor, currency, currencySymbol)}
                </p>
              </div>
              <div className="space-y-1">
                <p style={{ color: colors.text.secondary }}>{copy.realPaidLabel}</p>
                <p style={{ color: colors.state.negative }}>
                  {formatMoneyWithSymbol(real.payableMinor, currency, currencySymbol)}
                </p>
              </div>
            </div>
            <div
              className="mt-3 flex items-center justify-between border-t pt-3 text-sm"
              style={{ borderColor: colors.state.neutral }}
            >
              <span style={{ color: colors.text.secondary }}>{copy.netLabel}</span>
              <span style={{ color: getNetColor(real.netMinor) }}>
                {formatSignedBalance(real.netMinor, currency, currencySymbol)}
              </span>
            </div>
          </div>

          <div
            className="rounded-xl border p-4"
            style={{ borderColor: colors.state.neutral, backgroundColor: colors.bg.secondary }}
          >
            <h4
              style={{
                fontSize: typography.h3.fontSize,
                fontWeight: typography.h3.fontWeight,
                color: colors.text.primary,
              }}
            >
              {copy.scheduledLabel}
            </h4>
            <div className="mt-3 grid grid-cols-2 gap-4 text-sm">
              <div className="space-y-1">
                <p style={{ color: colors.text.secondary }}>{copy.receivableLabel}</p>
                <p style={{ color: colors.state.positive }}>
                  {formatMoneyWithSymbol(
                    scheduledRange.receivableMinor,
                    currency,
                    currencySymbol
                  )}
                </p>
              </div>
              <div className="space-y-1">
                <p style={{ color: colors.text.secondary }}>{copy.payableLabel}</p>
                <p style={{ color: colors.state.negative }}>
                  {formatMoneyWithSymbol(
                    scheduledRange.payableMinor,
                    currency,
                    currencySymbol
                  )}
                </p>
              </div>
            </div>
            <div
              className="mt-3 flex items-center justify-between border-t pt-3 text-sm"
              style={{ borderColor: colors.state.neutral }}
            >
              <span style={{ color: colors.text.secondary }}>{copy.netLabel}</span>
              <span style={{ color: getNetColor(scheduledRange.netMinor) }}>
                {formatSignedBalance(scheduledRange.netMinor, currency, currencySymbol)}
              </span>
            </div>
            {scheduledTopItems.length > 0 ? (
              <div className="mt-3 space-y-2 text-sm">
                {scheduledTopItems.map((item) => {
                  const dayLabel = item.date.toLocaleDateString(locale, {
                    day: "2-digit",
                    month: "short",
                  });
                  const amount = formatMoneyWithSymbol(
                    item.amountMinor,
                    currency,
                    currencySymbol
                  );
                  return (
                    <div key={item.id} className="flex items-center justify-between">
                      <span style={{ color: colors.text.secondary }}>
                        {dayLabel}: {item.title}
                      </span>
                      <span
                        style={{
                          color:
                            item.type === "income"
                              ? colors.state.positive
                              : colors.state.negative,
                        }}
                      >
                        {item.type === "expense" ? "-" : "+"}
                        {amount}
                      </span>
                    </div>
                  );
                })}
                <div className="flex items-center justify-between">
                  {onViewAllScheduled ? (
                    <button
                      type="button"
                      className="text-xs font-semibold"
                      style={{ color: colors.action.primary }}
                      onClick={onViewAllScheduled}
                    >
                      {copy.viewAllCta}
                    </button>
                  ) : (
                    <Link
                      href="/transactions"
                      className="text-xs font-semibold"
                      style={{ color: colors.action.primary }}
                    >
                      {copy.viewAllCta}
                    </Link>
                  )}
                </div>
              </div>
            ) : null}
          </div>

          <div
            className="rounded-xl border p-4"
            style={{ borderColor: colors.state.neutral, backgroundColor: colors.bg.secondary }}
          >
            <h4
              style={{
                fontSize: typography.h3.fontSize,
                fontWeight: typography.h3.fontWeight,
                color: colors.text.primary,
              }}
            >
              {copy.noDateLabel}
            </h4>
            <div className="mt-3 grid grid-cols-2 gap-4 text-sm">
              <div className="space-y-1">
                <p style={{ color: colors.text.secondary }}>{copy.receivableLabel}</p>
                <p style={{ color: colors.state.positive }}>
                  {formatMoneyWithSymbol(noDate.receivableMinor, currency, currencySymbol)}
                </p>
              </div>
              <div className="space-y-1">
                <p style={{ color: colors.text.secondary }}>{copy.payableLabel}</p>
                <p style={{ color: colors.state.negative }}>
                  {formatMoneyWithSymbol(noDate.payableMinor, currency, currencySymbol)}
                </p>
              </div>
            </div>
            <div
              className="mt-3 flex items-center justify-between border-t pt-3 text-sm"
              style={{ borderColor: colors.state.neutral }}
            >
              <span style={{ color: colors.text.secondary }}>{copy.netLabel}</span>
              <span style={{ color: getNetColor(noDate.netMinor) }}>
                {formatSignedBalance(noDate.netMinor, currency, currencySymbol)}
              </span>
            </div>
            {noDateTopItems.length > 0 ? (
              <div className="mt-3 space-y-2 text-sm">
                {noDateTopItems.map((item) => (
                  <div
                    key={item.id}
                    className="flex flex-wrap items-center justify-between gap-2"
                  >
                    <span style={{ color: colors.text.secondary }}>{item.name}</span>
                    <span style={{ color: colors.state.negative }}>
                      -{formatMoneyWithSymbol(item.amount_base_minor ?? item.amount_minor, currency, currencySymbol)}
                    </span>
                    <div className="flex items-center gap-3 text-xs">
                      {onAssignNoDate ? (
                        <button
                          type="button"
                          className="font-semibold"
                          style={{ color: colors.action.primary }}
                          disabled={!canEdit}
                          onClick={() => onAssignNoDate(item)}
                        >
                          {copy.setDateCta}
                        </button>
                      ) : null}
                      {onMarkNoDateSettled ? (
                        <button
                          type="button"
                          className="font-semibold"
                          style={{ color: colors.text.secondary }}
                          disabled={!canEdit}
                          onClick={() => onMarkNoDateSettled(item)}
                        >
                          {copy.markSettledCta}
                        </button>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            ) : null}
          </div>

          <div className="space-y-1 text-sm">
            <div className="flex items-center justify-between">
              <span style={{ color: colors.text.secondary }}>
                {copy.endOfMonthEstimateLabel}
              </span>
              <span style={{ color: getNetColor(balanceEndOfMonthEstimatedMinor) }}>
                {formatSignedBalance(
                  balanceEndOfMonthEstimatedMinor,
                  currency,
                  currencySymbol
                )}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span style={{ color: colors.text.secondary }}>
                {copy.exposureTotalLabel}
              </span>
              <span style={{ color: getNetColor(exposureTotalMinor) }}>
                {formatSignedBalance(exposureTotalMinor, currency, currencySymbol)}
              </span>
            </div>
            <p className="text-xs" style={{ color: colors.text.muted }}>
              {copy.includesNoDate}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
