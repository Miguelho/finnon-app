"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import {
  buildAccountViewModel,
  CURRENCIES,
  formatMoneyWithSymbol,
  getIconById,
  themeTokens,
  type AccountSummaryData,
  type UserRole,
} from "@poleursus/shared";
import { AccountSwitcher } from "@/components/home/account-switcher";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

const tokens = themeTokens.light;

type AccountSummaryClientProps = {
  summaryData: AccountSummaryData;
  currentUserId: string;
  role: UserRole;
  accounts: {
    id: string;
    name: string;
    base_currency: string;
    memberCount?: number;
  }[];
  activeAccountId: string;
};

export function AccountSummaryClient({
  summaryData,
  currentUserId,
  role,
  accounts,
  activeAccountId,
}: AccountSummaryClientProps) {
  const t = useTranslations();
  const locale = useLocale();

  // Build a minimal dictionary for the viewmodel
  const dictionary = useMemo(() => {
    return {
      account: {
        title: t("account.title"),
        participantsLabel: t("account.participantsLabel", { count: summaryData.participants.length }),
        participantsEmpty: t("account.participantsEmpty"),
        youLabel: t("account.youLabel"),
        summary: {
          balanceLabel: t("account.summary.balanceLabel"),
          incomeLabel: t("account.summary.incomeLabel"),
          expenseLabel: t("account.summary.expenseLabel"),
          categoriesTitle: t("account.summary.categoriesTitle"),
          categoriesViewAll: t("account.summary.categoriesViewAll"),
          categoriesCount: t("account.summary.categoriesCount", { count: summaryData.categories_count }),
          categoryBreakdownTitle: t("account.summary.categoryBreakdownTitle"),
          emptyCategories: t("account.summary.emptyCategories"),
          switchAccount: t("account.summary.switchAccount"),
          createAccount: t("account.summary.createAccount"),
          baseCurrencySubtitle: t("account.summary.baseCurrencySubtitle"),
        },
      },
    };
  }, [t, summaryData.participants.length, summaryData.categories_count]);

  const currencySymbol = useMemo(() => {
    const currency = summaryData.account.base_currency;
    return CURRENCIES.find((c) => c.code === currency)?.symbol ?? currency;
  }, [summaryData.account.base_currency]);

  const viewModel = useMemo(() => {
    return buildAccountViewModel({
      data: summaryData,
      dictionary: dictionary as any,
      currentUserId,
      role,
    });
  }, [summaryData, dictionary, currentUserId, role]);

  return (
    <div className="space-y-6">
      {/* Account Header */}
      <div className="text-center">
        <h2 className="text-3xl font-bold tracking-tight">
          {viewModel.account.name}
        </h2>
        <p className="text-muted-foreground">
          {viewModel.account.baseCurrency} · {viewModel.copy.baseCurrencySubtitle}
        </p>
      </div>

      {/* Financial Summary */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="text-xs uppercase tracking-wide">
              {viewModel.copy.balanceLabel}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {formatMoneyWithSymbol(
                viewModel.totals.balanceMinor,
                viewModel.account.baseCurrency,
                currencySymbol
              )}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="text-xs uppercase tracking-wide">
              {viewModel.copy.incomeLabel}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-green-600 dark:text-green-400">
              {formatMoneyWithSymbol(
                viewModel.totals.incomeMinor,
                viewModel.account.baseCurrency,
                currencySymbol
              )}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="text-xs uppercase tracking-wide">
              {viewModel.copy.expenseLabel}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-red-600 dark:text-red-400">
              {formatMoneyWithSymbol(
                viewModel.totals.expenseMinor,
                viewModel.account.baseCurrency,
                currencySymbol
              )}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Participants */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{viewModel.copy.participantsLabel}</CardTitle>
        </CardHeader>
        <CardContent>
          {viewModel.participants.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {viewModel.copy.participantsEmpty}
            </p>
          ) : (
            <div className="space-y-2">
              {viewModel.participants.map((participant) => {
                const isCurrentUser = participant.userId === currentUserId;
                const displayName = isCurrentUser
                  ? viewModel.copy.youLabel
                  : participant.displayName ||
                    participant.email ||
                    `User ${participant.userId.slice(0, 6)}`;

                return (
                  <div
                    key={participant.userId}
                    className="flex items-center rounded-md border px-3 py-2"
                  >
                    <div className="flex items-center gap-3">
                      <ParticipantAvatar
                        email={participant.email}
                        fallbackText={participant.avatarFallbackText}
                      />
                      <div>
                        <p className="text-sm font-medium">{displayName}</p>
                        {!isCurrentUser && participant.email && (
                          <p className="text-xs text-muted-foreground">
                            {participant.email}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Categories */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-lg">{viewModel.copy.categoriesTitle}</CardTitle>
            <CardDescription>{viewModel.copy.categoriesCount}</CardDescription>
          </div>
          <Link
            href="/categories"
            className="text-sm text-primary hover:underline"
          >
            {viewModel.copy.categoriesViewAll}
          </Link>
        </CardHeader>
        <CardContent>
          {viewModel.categories.breakdown.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {viewModel.copy.emptyCategories}
            </p>
          ) : (
            <div className="space-y-2">
              {viewModel.categories.breakdown.map((category) => {
                const icon = category.iconId ? getIconById(category.iconId) : null;
                return (
                  <div
                    key={category.id}
                    className="flex items-center justify-between rounded-md border px-3 py-2"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-lg">
                        {icon?.emoji || (category.type === "income" ? "+" : "-")}
                      </span>
                      <span className="text-sm font-medium">{category.name}</span>
                    </div>
                    <span
                      className={cn(
                        "text-sm font-medium",
                        category.type === "income"
                          ? "text-green-600 dark:text-green-400"
                          : "text-red-600 dark:text-red-400"
                      )}
                    >
                      {formatMoneyWithSymbol(
                        category.totalMinor,
                        viewModel.account.baseCurrency,
                        currencySymbol
                      )}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="fixed bottom-6 right-6 z-20">
        <AccountSwitcher
          accounts={accounts}
          initialActiveAccountId={activeAccountId}
        />
      </div>
    </div>
  );
}

function ParticipantAvatar({
  email,
  fallbackText,
}: {
  email: string | null;
  fallbackText: string | null;
}) {
  const initial = fallbackText || (email ? email[0].toUpperCase() : "?");
  const avatarShadow = `0 6px 16px ${tokens.colors.action.primary}33`;

  return (
    <div
      className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-sm font-semibold"
      style={{ boxShadow: avatarShadow }}
    >
      {initial}
    </div>
  );
}
