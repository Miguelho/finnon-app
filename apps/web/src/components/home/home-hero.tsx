"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import {
  buildHomeViewModel,
  CURRENCIES,
  formatMoneyWithSymbol,
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
  const currencySymbol =
    CURRENCIES.find((currency) => currency.code === account.base_currency)
      ?.symbol ?? account.base_currency;

  const upcomingItems = viewModel.upcoming.items.slice(0, 5);
  const balanceMinor = viewModel.accountSummary.balanceMinor;
  const balanceAbs = balanceMinor < 0n ? -balanceMinor : balanceMinor;
  const balanceColor =
    balanceMinor < 0n ? colors.state.negative : colors.state.positive;

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
    <section
      className="rounded-2xl border p-6"
      style={{
        borderColor: colors.state.neutral,
        backgroundColor: colors.bg.surface,
      }}
    >
      <div className="space-y-2">
        <p className="text-xs" style={{ color: colors.text.secondary }}>
          {viewModel.copy.balanceLabel}
        </p>
        <p className="text-3xl font-semibold" style={{ color: balanceColor }}>
          {balanceMinor < 0n ? "-" : "+"}
          {formatMoneyWithSymbol(
            balanceAbs,
            account.base_currency,
            currencySymbol
          )}
        </p>
        <div className="flex flex-wrap gap-4 text-sm">
          <span style={{ color: colors.text.secondary }}>
            {viewModel.copy.incomeLabel}{" "}
            {formatMoneyWithSymbol(
              viewModel.accountSummary.incomeMinor,
              account.base_currency,
              currencySymbol
            )}
          </span>
          <span style={{ color: colors.text.secondary }}>
            {viewModel.copy.expenseLabel}{" "}
            {formatMoneyWithSymbol(
              viewModel.accountSummary.expenseMinor,
              account.base_currency,
              currencySymbol
            )}
          </span>
        </div>
      </div>

      <div
        className="mt-5 border-t pt-4"
        style={{ borderColor: colors.state.neutral }}
      >
        <h2 className="text-lg font-semibold">
          {t(dictionary, "dashboard.thisMonth")}
        </h2>

        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <div>
            <p className="text-xs" style={{ color: colors.text.secondary }}>
              {viewModel.copy.committedLabel}
            </p>
            <p className="text-2xl font-semibold">
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
            <p className="text-2xl font-semibold">
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
            <p className="text-2xl font-semibold">
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
            className="mt-4 space-y-2 border-t pt-4"
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

      <div
        className="mt-5 border-t pt-4"
        style={{ borderColor: colors.state.neutral }}
      >
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-base font-semibold">
            {viewModel.copy.upcomingObligationsTitle}
          </h3>
          {upcomingItems.length > 0 && (
            <Button variant="link" asChild style={{ color: colors.action.primary }}>
              <Link href="/transactions">{viewModel.copy.upcomingCta}</Link>
            </Button>
          )}
        </div>

        {upcomingItems.length === 0 ? (
          viewModel.monthlyHero.hasObligations ? (
            <p className="text-sm" style={{ color: colors.text.secondary }}>
              {viewModel.emptyStates.upcoming}
            </p>
          ) : (
            <div className="space-y-2">
              <p className="text-sm" style={{ color: colors.text.secondary }}>
                {viewModel.emptyStates.obligations.title}
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
                <Link href="/transactions?new=1&kind=obligation">
                  {viewModel.emptyStates.obligations.cta}
                </Link>
              </Button>
            </div>
          )
        ) : (
          <div className="mt-3 space-y-2">
            {upcomingItems.map((item) => (
              <div
                key={item.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border px-4 py-3"
                style={{
                  borderColor: colors.state.neutral,
                  backgroundColor: colors.bg.secondary,
                }}
              >
                <div>
                  <p className="text-sm font-semibold">{item.name}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
                    <span style={{ color: colors.text.secondary }}>
                      {item.dueDate.toLocaleDateString(locale, {
                        day: "2-digit",
                        month: "short",
                      })}
                    </span>
                    <span
                      className="rounded-full px-2 py-0.5 text-[10px] font-semibold"
                      style={{
                        backgroundColor:
                          item.status === "paid"
                            ? colors.action.secondary
                            : colors.bg.surface,
                        border: `1px solid ${colors.state.neutral}`,
                        color: colors.text.secondary,
                      }}
                    >
                      {item.status === "paid"
                        ? t(dictionary, "obligations.create.statusPaid")
                        : t(dictionary, "obligations.create.statusPending")}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <p className="text-sm font-semibold">
                    {formatMoneyWithSymbol(
                      item.amountMinor,
                      account.base_currency,
                      currencySymbol
                    )}
                  </p>
                  <Button
                    size="sm"
                    variant={item.status === "paid" ? "outline" : "default"}
                    onClick={() => handleToggleObligation(item)}
                    disabled={
                      updatingId === item.id || !viewModel.permissions.canEdit
                    }
                    style={{
                      backgroundColor:
                        item.status === "paid"
                          ? colors.action.secondary
                          : colors.action.primary,
                      color:
                        item.status === "paid"
                          ? colors.text.primary
                          : colors.bg.primary,
                      borderColor: colors.action.primary,
                    }}
                  >
                    {item.status === "paid"
                      ? viewModel.copy.markPending
                      : viewModel.copy.markPaid}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div
        className="mt-5 border-t pt-4"
        style={{ borderColor: colors.state.neutral }}
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-base font-semibold">
            {viewModel.copy.cashflowTitle}
          </h3>
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
          <p className="mt-3 text-sm" style={{ color: colors.text.secondary }}>
            {viewModel.emptyStates.upcoming}
          </p>
        ) : (
          <div className="mt-3 grid gap-4 md:grid-cols-2">
            <div>
              <p className="text-xs" style={{ color: colors.text.secondary }}>
                {viewModel.copy.incomeLabel}
              </p>
              <p className="text-lg font-semibold" style={{ color: colors.state.positive }}>
                +{formatMoneyWithSymbol(
                  viewModel.cashflow.incomeMinor,
                  account.base_currency,
                  currencySymbol
                )}
              </p>
            </div>
            <div>
              <p className="text-xs" style={{ color: colors.text.secondary }}>
                {viewModel.copy.expenseLabel}
              </p>
              <p className="text-lg font-semibold" style={{ color: colors.state.negative }}>
                -{formatMoneyWithSymbol(
                  viewModel.cashflow.expenseMinor,
                  account.base_currency,
                  currencySymbol
                )}
              </p>
            </div>
          </div>
        )}
      </div>

      {viewModel.permissions.isGuestReadOnly && (
        <div
          className="mt-5 flex flex-wrap items-center gap-3 border-t pt-4"
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
    </section>
  );
}
