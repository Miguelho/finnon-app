"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search, Settings } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { CURRENCIES, getMinorUnits, type Period } from "@poleursus/shared";
import { CategoryIcon } from "@/components/category-icon";
import type { AccountRedesignData, AccountRedesignPeriod } from "@/components/account/account-redesign-types";
import { formatCurrency, formatDelta } from "@/components/account/account-redesign-utils";
import { PeriodSelector } from "@/components/shared/PeriodSelector";
import { useWebUserTheme } from "@/components/theme/web-user-theme-provider";
import styles from "@/components/account/account-redesign.module.css";

type ChartMode = "both" | "expenses" | "net";

const CHART_HEIGHT = 80;

type AccountRedesignClientProps = {
  dataByPeriod: Record<AccountRedesignPeriod, AccountRedesignData>;
};

export function AccountRedesignClient({ dataByPeriod }: AccountRedesignClientProps) {
  const t = useTranslations();
  const locale = useLocale();
  const { resolvedMode } = useWebUserTheme();
  const [selectedPeriod, setSelectedPeriod] = useState<Period>("month");
  const [chartMode, setChartMode] = useState<ChartMode>("both");

  const data = dataByPeriod[selectedPeriod];

  const currencySymbol = useMemo(() => {
    const code = data.account.currency;
    return CURRENCIES.find((currency) => currency.code === code)?.symbol ?? code;
  }, [data.account.currency]);

  const currencyDecimals = useMemo(() => getMinorUnits(data.account.currency), [
    data.account.currency,
  ]);

  const balance = formatCurrency(data.account.balance, {
    currency: currencySymbol,
    decimals: currencyDecimals,
  });

  const income = formatCurrency(data.flow.totalIncome, {
    currency: currencySymbol,
    decimals: currencyDecimals,
  });
  const expense = formatCurrency(data.flow.totalExpense, {
    currency: currencySymbol,
    decimals: currencyDecimals,
  });

  const incomeDelta = formatDelta(data.flow.incomeDelta);
  const expenseDelta = formatDelta(data.flow.expenseDelta);

  const chartMax = useMemo(() => {
    return data.monthlyHistory.reduce((max, point) => {
      if (chartMode === "both") {
        return Math.max(max, point.income, point.expense);
      }
      if (chartMode === "expenses") {
        return Math.max(max, point.expense);
      }
      return Math.max(max, Math.abs(point.income - point.expense));
    }, 0);
  }, [data.monthlyHistory, chartMode]);

  const getBarHeight = (value: number) => {
    if (chartMax === 0) return 3;
    return Math.max(3, (value / chartMax) * CHART_HEIGHT);
  };

  const maxCategoryAmount = useMemo(() => {
    return data.categories.reduce((max, category) => Math.max(max, category.amount), 0);
  }, [data.categories]);

  return (
    <div className={styles.root}>
      <div className={styles.screen}>
        <div className={styles.header}>
          <div className={styles.headerLeft}>
            <div className={styles.accountIcon}>{data.account.icon}</div>
            <div>
              <div className={styles.accountName}>{data.account.name}</div>
              <div className={styles.accountType}>
                {data.account.type} · {data.account.currency}
              </div>
            </div>
          </div>
          <div className={styles.headerActions}>
            <Link
              href="/transactions"
              className={styles.iconBtn}
              aria-label={t("account.redesign.searchAriaLabel")}
            >
              <Search size={16} />
            </Link>
            <Link
              href={`/account/${data.account.id}/settings/general`}
              className={styles.iconBtn}
              aria-label={t("account.redesign.settingsAriaLabel")}
            >
              <Settings size={16} />
            </Link>
          </div>
        </div>

        <div className={styles.balanceHero}>
          <div className={styles.balanceLabel}>{t("account.redesign.balanceTotalLabel")}</div>
          <div className={styles.balanceAmount}>
            {currencySymbol}
            {balance.whole}
            <span className={styles.balanceCents}>{balance.cents}</span>
          </div>
        </div>

        <PeriodSelector selected={selectedPeriod} onChange={setSelectedPeriod} />

        <div className={styles.flowRow}>
          <div className={`${styles.flowCard} ${styles.flowCardIncome}`}>
            <div className={styles.flowCardHeader}>
              <span className={`${styles.flowArrow} ${styles.flowArrowUp}`}>↑</span>
              <span className={`${styles.flowLabel} ${styles.flowLabelIncome}`}>
                {t("account.redesign.incomeLabel")}
              </span>
            </div>
            <div className={`${styles.flowAmount} ${styles.flowAmountIncome}`}>
              {currencySymbol}
              {income.whole}
            </div>
            {incomeDelta ? (
              <div className={`${styles.flowDelta} ${styles.flowLabelIncome}`}>
                {t("account.redesign.vsPreviousMonth", { value: incomeDelta })}
              </div>
            ) : null}
          </div>
          <div className={`${styles.flowCard} ${styles.flowCardExpense}`}>
            <div className={styles.flowCardHeader}>
              <span className={`${styles.flowArrow} ${styles.flowArrowDown}`}>↓</span>
              <span className={`${styles.flowLabel} ${styles.flowLabelExpense}`}>
                {t("account.redesign.expenseLabel")}
              </span>
            </div>
            <div className={`${styles.flowAmount} ${styles.flowAmountExpense}`}>
              {currencySymbol}
              {expense.whole}
            </div>
            {expenseDelta ? (
              <div className={`${styles.flowDelta} ${styles.flowLabelExpense}`}>
                {t("account.redesign.vsPreviousMonth", { value: expenseDelta })}
              </div>
            ) : null}
          </div>
        </div>

        <div className={styles.chartSection}>
          <div className={styles.chartContainer}>
            <div className={styles.chartHeader}>
              <span className={styles.chartTitle}>
                {t("account.redesign.monthlyEvolutionTitle")}
              </span>
              <div className={styles.chartToggle}>
                {(
                  [
                    { key: "both", label: t("account.redesign.monthlyEvolutionModeBoth") },
                    { key: "expenses", label: t("account.redesign.monthlyEvolutionModeExpenses") },
                    { key: "net", label: t("account.redesign.monthlyEvolutionModeNet") },
                  ] as const
                ).map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    className={`${styles.chartToggleBtn} ${
                      chartMode === item.key ? styles.chartToggleBtnActive : ""
                    }`}
                    onClick={() => setChartMode(item.key)}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            {data.monthlyHistory.length === 0 ? (
              <div className={styles.chartEmptyState}>
                <span className={styles.chartEmptyIcon}>📊</span>
                <span className={styles.chartEmptyText}>
                  {t("account.redesign.monthlyEvolutionEmpty")}
                </span>
              </div>
            ) : (
              <div className={styles.chartArea}>
                {data.monthlyHistory.map((point) => (
                  <div key={point.label} className={styles.chartBarGroup}>
                    <div className={styles.chartBars}>
                      {chartMode === "both" ? (
                        <>
                          <div
                            className={`${styles.chartBar} ${styles.incomeBar} ${
                              point.isCurrent ? styles.chartBarCurrent : ""
                            }`}
                            style={{ height: `${getBarHeight(point.income)}px` }}
                          />
                          <div
                            className={`${styles.chartBar} ${styles.expenseBar} ${
                              point.isCurrent ? styles.chartBarCurrent : ""
                            }`}
                            style={{ height: `${getBarHeight(point.expense)}px` }}
                          />
                        </>
                      ) : null}
                      {chartMode === "expenses" ? (
                        <div
                          className={`${styles.chartBar} ${styles.expenseBar} ${
                            point.isCurrent ? styles.chartBarCurrent : ""
                          }`}
                          style={{ height: `${getBarHeight(point.expense)}px` }}
                        />
                      ) : null}
                      {chartMode === "net" ? (
                        <div
                          className={`${styles.chartBar} ${
                            point.income - point.expense >= 0
                              ? styles.incomeBar
                              : styles.expenseBar
                          } ${point.isCurrent ? styles.chartBarCurrent : ""}`}
                          style={{
                            height: `${getBarHeight(
                              Math.abs(point.income - point.expense)
                            )}px`,
                          }}
                        />
                      ) : null}
                    </div>
                    <span
                      className={`${styles.chartBarLabel} ${
                        point.isCurrent ? styles.chartBarLabelCurrent : ""
                      }`}
                    >
                      {point.label}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <section className={styles.categoriesSection}>
          <div className={styles.sectionHeader}>
            <span className={styles.sectionTitle}>
              {t("account.redesign.categorySpendingTitle")}
            </span>
            <Link
              href={`/transactions?period=${selectedPeriod}`}
              className={styles.sectionAction}
            >
              {t("account.redesign.viewAllCategories")}
            </Link>
          </div>

          <div className={styles.categoryList}>
            {data.categories.slice(0, 4).map((category) => {
              const formatted = formatCurrency(category.amount, {
                currency: currencySymbol,
                decimals: currencyDecimals,
              });
              const barWidth = maxCategoryAmount
                ? (category.amount / maxCategoryAmount) * 100
                : 0;
              const isLink = category.id !== "uncategorized";
              const content = (
                <>
                  <div
                    className={styles.categoryIcon}
                    style={{ backgroundColor: `var(--category-${category.colorKey})` }}
                  >
                    <CategoryIcon
                      iconId={category.iconId ?? "Tag"}
                      size={16}
                      tone="primary"
                      color={
                        resolvedMode === "dark"
                          ? "var(--account-category-icon, #FFFFFF)"
                          : "var(--account-category-icon, hsl(var(--foreground)))"
                      }
                    />
                  </div>
                  <div className={styles.categoryInfo}>
                    <div className={styles.categoryName}>{category.name}</div>
                    <div className={styles.categoryCount}>
                      {t("account.redesign.movementCount", {
                        count: category.transactionCount,
                      })}
                    </div>
                  </div>
                  <div className={styles.categoryRight}>
                    <div className={styles.categoryAmount}>
                      {currencySymbol}
                      {formatted.whole}
                      {formatted.cents}
                    </div>
                    <div className={styles.categoryBarTrack}>
                      <div
                        className={styles.categoryBarFill}
                        style={{ width: `${barWidth}%` }}
                      />
                    </div>
                  </div>
                  {isLink ? <span className={styles.categoryChevron}>›</span> : null}
                </>
              );

              return isLink ? (
                <Link
                  key={category.id}
                  href={`/transactions?period=${selectedPeriod}&category=${category.id}`}
                  className={styles.categoryItem}
                >
                  {content}
                </Link>
              ) : (
                <div key={category.id} className={styles.categoryItem}>
                  {content}
                </div>
              );
            })}
          </div>
        </section>

        <section className={styles.transactionsSection}>
          <div className={styles.sectionHeader}>
            <span className={styles.sectionTitle}>
              {t("account.redesign.latestMovementsTitle")}
            </span>
            <Link
              href={`/transactions?period=${selectedPeriod}`}
              className={styles.sectionAction}
            >
              {t("account.redesign.viewAllMovements")}
            </Link>
          </div>

          <div className={styles.transactionList}>
            {data.recentTransactions.slice(0, 4).map((tx) => {
              const formatted = formatCurrency(Math.abs(tx.amount), {
                currency: currencySymbol,
                decimals: currencyDecimals,
              });
              const isIncome = tx.amount > 0;
              const txIconClassName = isIncome
                ? `${styles.txIcon} ${styles.txIconIncome}`
                : `${styles.txIcon} ${styles.txIconExpense}`;
              return (
                <div key={tx.id} className={styles.transactionItem}>
                  <div className={txIconClassName}>
                    <CategoryIcon
                      iconId={tx.categoryIconId ?? "Tag"}
                      size={14}
                      tone={isIncome ? "positive" : "negative"}
                    />
                  </div>
                  <div className={styles.txInfo}>
                    <div className={styles.txName}>{tx.description}</div>
                    <div className={styles.txMeta}>
                      {tx.categoryName} · {formatDate(tx.date, locale)}
                    </div>
                  </div>
                  <div
                    className={`${styles.txAmount} ${
                      isIncome ? styles.txAmountPositive : styles.txAmountNegative
                    }`}
                  >
                    {isIncome ? "+" : "-"}
                    {currencySymbol}
                    {formatted.whole}
                    {formatted.cents}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}

function formatDate(value: string, locale: string) {
  const [yearPart, monthPart, dayPart] = value.split("-");
  const rawYear = Number(yearPart);
  const rawMonth = Number(monthPart);
  const rawDay = Number(dayPart);
  const safeYear = Number.isFinite(rawYear) ? rawYear : 1970;
  const safeMonth = Number.isFinite(rawMonth) ? rawMonth : 1;
  const safeDay = Number.isFinite(rawDay) ? rawDay : 1;
  const date = new Date(safeYear, safeMonth - 1, safeDay);
  return new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "short",
  })
    .format(date)
    .replace(",", "")
    .replace(/\.$/, "");
}
