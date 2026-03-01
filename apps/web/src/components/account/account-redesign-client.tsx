"use client";

import { useEffect, useMemo, useRef, useState, type TouchEvent } from "react";
import Link from "next/link";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Check, ChevronDown, ChevronUp, Info, Search, Settings, TrendingUp, X } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { CURRENCIES, PERIODS, formatMonthLabel, getRecentMonthKeys, getMinorUnits, type Period } from "@poleursus/shared";
import { CategoryIcon } from "@/components/category-icon";
import type { AccountRedesignData, AccountRedesignPeriod } from "@/components/account/account-redesign-types";
import { formatCurrency, formatDelta } from "@/components/account/account-redesign-utils";
import { useWebUserTheme } from "@/components/theme/web-user-theme-provider";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import styles from "@/components/account/account-redesign.module.css";

type ChartMode = "both" | "income" | "expenses" | "net";

const CHART_HEIGHT = 200;
const DEFAULT_VISIBLE_CONTRIBUTION_CATEGORIES = 2;

const periodLabelKey: Record<Period, string> = {
  week: "common.periodWeek",
  month: "common.periodMonth",
  quarter: "common.periodQuarter",
  year: "common.periodYear",
};

type AccountRedesignClientProps = {
  dataByPeriod: Record<AccountRedesignPeriod, AccountRedesignData>;
  dataByMonth: Record<string, AccountRedesignData>;
  monthKeys: string[];
  currentUserId?: string | null;
};

function PeriodMonthSelector({
  selectedPeriod,
  selectedMonth,
  onPeriodChange,
  onMonthChange,
  locale,
  monthKeys,
}: {
  selectedPeriod: Period;
  selectedMonth: string;
  onPeriodChange: (period: Period) => void;
  onMonthChange: (monthKey: string) => void;
  locale: string;
  monthKeys: string[];
}) {
  const t = useTranslations();
  const [open, setOpen] = useState(false);
  const months = monthKeys.length > 0 ? monthKeys : getRecentMonthKeys(12);
  const selectedMonthLabel = useMemo(
    () => formatMonthLabel(selectedMonth, locale),
    [selectedMonth, locale]
  );

  return (
    <div className="flex flex-wrap items-center justify-center gap-1">
      {PERIODS.map(({ key }) => {
        if (key === "month") {
          const isActive = selectedPeriod === "month";
          return (
            <DropdownMenu key={key} open={open} onOpenChange={setOpen}>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className={`flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-medium transition ${
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-primary"
                  }`}
                  onClick={() => {
                    if (!isActive) {
                      onPeriodChange("month");
                    }
                  }}
                >
                  <span className="capitalize">{selectedMonthLabel}</span>
                  <ChevronDown size={12} />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="max-h-64 w-52 overflow-auto p-2" align="center">
                {months.map((monthKey) => {
                  const isSelected = monthKey === selectedMonth;
                  return (
                    <button
                      key={monthKey}
                      type="button"
                      className={`flex w-full items-center justify-between rounded-md px-3 py-2 text-sm capitalize transition ${
                        isSelected
                          ? "bg-primary/10 font-semibold text-primary"
                          : "text-foreground hover:bg-muted/60"
                      }`}
                      onClick={() => {
                        onMonthChange(monthKey);
                        onPeriodChange("month");
                        setOpen(false);
                      }}
                    >
                      <span>{formatMonthLabel(monthKey, locale)}</span>
                      {isSelected ? <Check size={14} /> : null}
                    </button>
                  );
                })}
              </DropdownMenuContent>
            </DropdownMenu>
          );
        }

        const isActive = selectedPeriod === key;
        return (
          <button
            key={key}
            type="button"
            onClick={() => onPeriodChange(key)}
            className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
              isActive
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-primary"
            }`}
          >
            {t(periodLabelKey[key] as any)}
          </button>
        );
      })}
    </div>
  );
}

export function AccountRedesignClient({
  dataByPeriod,
  dataByMonth,
  monthKeys,
  currentUserId = null,
}: AccountRedesignClientProps) {
  const t = useTranslations();
  const locale = useLocale();
  const { resolvedMode } = useWebUserTheme();
  const [selectedPeriod, setSelectedPeriod] = useState<Period>("month");
  const [selectedMonth, setSelectedMonth] = useState(
    monthKeys[0] ?? getRecentMonthKeys(12)[0] ?? ""
  );
  const [chartMode, setChartMode] = useState<ChartMode>("both");
  const [isChartExpanded, setIsChartExpanded] = useState(false);
  const [isBalanceTooltipOpen, setIsBalanceTooltipOpen] = useState(false);
  const [expandedContributionSections, setExpandedContributionSections] = useState<{
    expense: boolean;
    income: boolean;
  }>({
    expense: false,
    income: false,
  });
  const [isContributionDetailOpen, setIsContributionDetailOpen] = useState(false);
  const swipeStartYRef = useRef<number | null>(null);
  const swipeCurrentYRef = useRef<number | null>(null);
  const contributionDetailScrollRef = useRef<HTMLDivElement | null>(null);
  const balanceTooltipButtonRef = useRef<HTMLButtonElement | null>(null);
  const balanceTooltipRef = useRef<HTMLDivElement | null>(null);

  const data =
    selectedPeriod === "month"
      ? dataByMonth[selectedMonth] ?? dataByPeriod.month
      : dataByPeriod[selectedPeriod];
  const contributionData = data.contributionBalance;
  const contributors = data.contributors;
  const isCollaborative =
    contributors.length >= 2 && !!contributionData && contributionData.members.length >= 2;
  const contributorByUserId = useMemo(
    () => new Map(contributors.map((contributor) => [contributor.userId, contributor])),
    [contributors]
  );

  const currencySymbol = useMemo(() => {
    const code = data.account.currency;
    return CURRENCIES.find((currency) => currency.code === code)?.symbol ?? code;
  }, [data.account.currency]);
  const currencyDecimals = useMemo(() => getMinorUnits(data.account.currency), [data.account.currency]);

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

  const chartTitle = useMemo(() => {
    const keyByPeriod: Record<Period, string> = {
      week: "account.redesign.evolutionWeeklyTitle",
      month: "account.redesign.evolutionMonthlyTitle",
      quarter: "account.redesign.evolutionQuarterlyTitle",
      year: "account.redesign.evolutionYearlyTitle",
    };
    return t(keyByPeriod[selectedPeriod]);
  }, [selectedPeriod, t]);
  const chartCollapsedTitle = useMemo(() => {
    const adjKeyByPeriod: Record<Period, string> = {
      week: "account.evolution_adj_weekly",
      month: "account.evolution_adj_monthly",
      quarter: "account.evolution_adj_quarterly",
      year: "account.evolution_adj_yearly",
    };
    return t("account.view_evolution", {
      period_adj: t(adjKeyByPeriod[selectedPeriod]),
    });
  }, [selectedPeriod, t]);

  const chartMax = useMemo(() => {
    return data.monthlyHistory.reduce((max, point) => {
      if (chartMode === "both") {
        return Math.max(max, point.income, point.expense);
      }
      if (chartMode === "income") {
        return Math.max(max, point.income);
      }
      if (chartMode === "expenses") {
        return Math.max(max, point.expense);
      }
      return Math.max(max, Math.abs(point.income - point.expense));
    }, 0);
  }, [chartMode, data.monthlyHistory]);

  const getBarHeight = (value: number) => {
    if (chartMax === 0) return 3;
    return Math.max(3, (value / chartMax) * CHART_HEIGHT);
  };
  const showChartLegend = isCollaborative && (chartMode === "income" || chartMode === "expenses");

  const periodLabel = useMemo(() => {
    const keyByPeriod: Record<Period, string> = {
      week: "account.redesign.periodWeek",
      month: "account.redesign.periodMonth",
      quarter: "account.redesign.periodQuarter",
      year: "account.redesign.periodYear",
    };
    return t(keyByPeriod[selectedPeriod]);
  }, [selectedPeriod, t]);

  const contributionBanner = useMemo(() => {
    if (!isCollaborative || !contributionData) return null;
    const sorted = [...contributionData.members].sort((a, b) => b.totalPaid - a.totalPaid);
    if (sorted.length < 2) return null;

    const leader = sorted[0];
    const trailing = sorted[sorted.length - 1];
    const diff = leader.totalPaid - trailing.totalPaid;
    const thresholdMajor = 100 / Math.pow(10, currencyDecimals);
    const isLeaderCurrentUser = leader.userId === currentUserId;
    if (diff < thresholdMajor) {
      return {
        text: t("account.redesign.contributionBannerEqual", { period: periodLabel }),
        color: leader.color,
        initials: leader.initials,
      };
    }

    return {
      text: t(
        isLeaderCurrentUser
          ? "account.redesign.contributionBannerSelf"
          : "account.redesign.contributionBanner",
        {
          name: leader.name,
          amount: formatCurrency(diff, {
            currency: currencySymbol,
            decimals: currencyDecimals,
          }).full,
          otherName: trailing.name,
          period: periodLabel,
        }
      ),
      color: leader.color,
      initials: leader.initials,
    };
  }, [contributionData, currencyDecimals, currencySymbol, currentUserId, isCollaborative, periodLabel, t]);

  const contributionDetail = useMemo(() => {
    if (!isCollaborative || !contributionData) return null;
    const members = contributionData.members;
    const maxValue = members.reduce(
      (max, member) => Math.max(max, member.totalPaid, member.totalResponsible),
      0
    );
    return { members, maxValue };
  }, [contributionData, isCollaborative]);

  const transactionsHref = useMemo(() => {
    const params = new URLSearchParams();
    params.set("period", selectedPeriod);
    if (selectedPeriod === "month" && selectedMonth) {
      params.set("month", selectedMonth);
    }
    return `/transactions?${params.toString()}`;
  }, [selectedMonth, selectedPeriod]);

  useEffect(() => {
    if (!isBalanceTooltipOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        balanceTooltipRef.current?.contains(target) ||
        balanceTooltipButtonRef.current?.contains(target)
      ) {
        return;
      }
      setIsBalanceTooltipOpen(false);
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsBalanceTooltipOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isBalanceTooltipOpen]);

  const handleContributionDetailTouchStart = (event: TouchEvent<HTMLDivElement>) => {
    const firstTouch = event.touches[0];
    if (!firstTouch) return;
    swipeStartYRef.current = firstTouch.clientY;
    swipeCurrentYRef.current = firstTouch.clientY;
  };

  const handleContributionDetailTouchMove = (event: TouchEvent<HTMLDivElement>) => {
    const firstTouch = event.touches[0];
    if (!firstTouch) return;
    swipeCurrentYRef.current = firstTouch.clientY;
  };

  const handleContributionDetailTouchEnd = () => {
    const startY = swipeStartYRef.current;
    const currentY = swipeCurrentYRef.current;
    swipeStartYRef.current = null;
    swipeCurrentYRef.current = null;
    if (startY === null || currentY === null) return;

    const swipedDown = currentY - startY > 72;
    const atTop = (contributionDetailScrollRef.current?.scrollTop ?? 0) <= 0;
    if (swipedDown && atTop) {
      setIsContributionDetailOpen(false);
    }
  };

  const renderFlowContribution = (type: "income" | "expense") => {
    if (!isCollaborative) return null;
    const values = data.flow.byUser[type];
    if (!values || values.length === 0) return null;
    const total = values.reduce((acc, item) => acc + Math.max(0, item.amount), 0);
    if (total <= 0) return null;

    return (
      <div className={styles.miniContrib}>
        <div className={styles.miniContribBar}>
          {values.map((item) => {
            const color = contributorByUserId.get(item.userId)?.color ?? "#2563EB";
            const width = (Math.max(0, item.amount) / total) * 100;
            return (
              <div
                key={`${type}-${item.userId}`}
                className={styles.miniContribSeg}
                style={{ width: `${width}%`, backgroundColor: color }}
              />
            );
          })}
        </div>
        <div className={styles.miniContribLegend}>
          {values
            .filter((item) => item.amount > 0)
            .map((item) => {
              const contributor = contributorByUserId.get(item.userId);
              return (
                <div key={`${type}-legend-${item.userId}`} className={styles.miniContribUser}>
                  <span
                    className={styles.miniContribAvatar}
                    style={{ backgroundColor: contributor?.color ?? "#2563EB" }}
                  >
                    {contributor?.initials ?? "?"}
                  </span>
                  <span>
                    {
                      formatCurrency(item.amount, {
                        currency: currencySymbol,
                        decimals: currencyDecimals,
                      }).full
                    }
                  </span>
                </div>
              );
            })}
        </div>
      </div>
    );
  };

  const renderContributionSection = (type: "expense" | "income") => {
    const categories =
      type === "expense"
        ? contributionData?.expenseCategories ?? []
        : contributionData?.incomeCategories ?? [];
    const sortedCategories = [...categories].sort((a, b) => b.totalAmount - a.totalAmount);
    const leadingCategories = sortedCategories.slice(0, DEFAULT_VISIBLE_CONTRIBUTION_CATEGORIES);
    const extraCategories = sortedCategories.slice(DEFAULT_VISIBLE_CONTRIBUTION_CATEGORIES);
    const hasExtraCategories = extraCategories.length > 0;
    const isExpanded = expandedContributionSections[type];
    const title =
      isCollaborative
        ? type === "expense"
          ? t("account.redesign.expensesByContributionTitle")
          : t("account.redesign.incomesByContributionTitle")
        : type === "expense"
          ? t("account.redesign.categorySpendingTitle")
          : t("account.redesign.incomeByCategoryTitle");
    const totalClassName =
      type === "expense" ? styles.contributionTotalExpense : styles.contributionTotalIncome;
    const getCategoryHref = (categoryId: string) => {
      const params = new URLSearchParams();
      params.set("period", selectedPeriod);
      if (selectedPeriod === "month" && selectedMonth) {
        params.set("month", selectedMonth);
      }
      params.set("type", type);
      if (categoryId !== "uncategorized") {
        params.set("category", categoryId);
      }
      return `/transactions?${params.toString()}`;
    };
    const toggleSectionExpanded = () => {
      setExpandedContributionSections((current) => ({
        ...current,
        [type]: !current[type],
      }));
    };

    const renderCategoryItem = (
      category: (typeof sortedCategories)[number],
      options: { showDivider: boolean; keyPrefix?: string }
    ) => {
      const firstContributor = contributors[0];
      const secondContributor = contributors[1];
      const firstShare = category.shares.find((share) => share.userId === firstContributor?.userId);
      const secondShare = category.shares.find((share) => share.userId === secondContributor?.userId);
      const leftLabel =
        firstShare && firstShare.amount > 0
          ? `${formatCurrency(firstShare.amount, {
              currency: currencySymbol,
              decimals: currencyDecimals,
            }).full} · ${Math.round(firstShare.percentage)}%`
          : "—";
      const rightLabel =
        secondShare && secondShare.amount > 0
          ? `${Math.round(secondShare.percentage)}% · ${formatCurrency(secondShare.amount, {
              currency: currencySymbol,
              decimals: currencyDecimals,
            }).full}`
          : "—";

      return (
        <Link
          key={`${options.keyPrefix ?? "base"}-${type}-${category.id}`}
          href={getCategoryHref(category.id)}
          className={`${styles.contributionCategoryItem} ${
            options.showDivider ? styles.contributionCategoryItemBorder : ""
          }`}
        >
          <div className={styles.contributionCategoryRow1}>
            <div
              className={styles.contributionCategoryIcon}
              style={{
                backgroundColor: `var(--category-${type === "expense" ? "default" : "interests"})`,
              }}
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
            <div className={styles.contributionCategoryInfo}>
              <div className={styles.contributionCategoryName}>{category.name}</div>
              <div className={styles.contributionCategoryCount}>
                {t("account.redesign.movementCount", {
                  count: category.transactionCount,
                })}
              </div>
            </div>
            <div className={`${styles.contributionCategoryTotal} ${totalClassName}`}>
              {
                formatCurrency(category.totalAmount, {
                  currency: currencySymbol,
                  decimals: currencyDecimals,
                }).full
              }
            </div>
          </div>

          {isCollaborative ? (
            <div className={styles.contributionCategoryRow2}>
              <div className={styles.contributionBarLabel}>{leftLabel}</div>
              <div className={styles.contributionBarTrack}>
                {category.shares
                  .filter((share) => share.amount > 0)
                  .map((share) => (
                    <div
                      key={`${category.id}-${share.userId}`}
                      className={styles.contributionBarSegment}
                      style={{
                        width: `${Math.max(0, share.percentage)}%`,
                        backgroundColor: contributorByUserId.get(share.userId)?.color ?? "#2563EB",
                      }}
                    />
                  ))}
              </div>
              <div className={`${styles.contributionBarLabel} ${styles.contributionBarLabelRight}`}>
                {rightLabel}
              </div>
            </div>
          ) : null}
        </Link>
      );
    };

    return (
      <section
        className={`${styles.contributionCardSection} ${
          type === "expense" ? styles.contributionExpenseSection : styles.contributionIncomeSection
        }`}
      >
        <div className={styles.contributionCard}>
          <div className={styles.contributionCardTitle}>{title}</div>
          <div className={styles.contributionCategoryList}>
            {leadingCategories.map((category, index) =>
              renderCategoryItem(category, {
                showDivider:
                  index < leadingCategories.length - 1 || (isExpanded && extraCategories.length > 0),
              })
            )}

            {hasExtraCategories ? (
              <div
                className={`${styles.contributionExtraCategories} ${
                  isExpanded ? styles.contributionExtraCategoriesExpanded : ""
                }`}
              >
                <div className={styles.contributionExtraCategoriesInner}>
                  {extraCategories.map((category, index) =>
                    renderCategoryItem(category, {
                      showDivider: index < extraCategories.length - 1,
                      keyPrefix: "extra",
                    })
                  )}
                </div>
              </div>
            ) : null}

            {hasExtraCategories ? (
              <button
                type="button"
                className={styles.contributionExpandButton}
                onClick={toggleSectionExpanded}
                aria-expanded={isExpanded}
              >
                <span>
                  {isExpanded
                    ? t("account.view_less")
                    : t("account.view_more_categories", { n: extraCategories.length })}
                </span>
                {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </button>
            ) : null}
          </div>
        </div>
      </section>
    );
  };

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

          <div className={styles.headerRight}>
            {isCollaborative ? (
              <div className={styles.memberMeta}>
                <div className={styles.memberLegend}>
                  {contributors.map((contributor) => (
                    <div key={contributor.userId} className={styles.memberLegendItem}>
                      <span
                        className={styles.memberLegendDot}
                        style={{ backgroundColor: contributor.color }}
                      />
                      <span>{contributor.shortName}</span>
                    </div>
                  ))}
                </div>
                <div className={styles.memberAvatars}>
                  {contributors.map((contributor) => (
                    <span
                      key={`${contributor.userId}-avatar`}
                      className={styles.memberAvatar}
                      style={{ backgroundColor: contributor.color }}
                    >
                      {contributor.initials}
                    </span>
                  ))}
                </div>
              </div>
            ) : null}

            <div className={styles.headerActions}>
              <Link
                href={transactionsHref}
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
        </div>

        <div className={styles.balanceSection}>
          <div className={styles.balanceHero}>
            <div className={styles.balanceLabelRow}>
              <div className={styles.balanceLabel}>{t("account.redesign.balanceTotalLabel")}</div>
              <div className="relative">
                <button
                  ref={balanceTooltipButtonRef}
                  type="button"
                  className={styles.balanceTooltipButton}
                  aria-label={t("account.redesign.balanceTotalTooltip")}
                  aria-expanded={isBalanceTooltipOpen}
                  onClick={() => setIsBalanceTooltipOpen((prev) => !prev)}
                  onMouseEnter={() => setIsBalanceTooltipOpen(true)}
                  onFocus={() => setIsBalanceTooltipOpen(true)}
                >
                  <Info size={14} />
                </button>
                {isBalanceTooltipOpen ? (
                  <div
                    ref={balanceTooltipRef}
                    className="absolute right-0 top-full z-20 mt-2 w-64 rounded-lg border border-border bg-background p-3 text-xs text-foreground shadow-sm"
                  >
                    {t("account.redesign.balanceTotalTooltip")}
                  </div>
                ) : null}
              </div>
            </div>
            <div className={styles.balanceAmount}>
              {currencySymbol}
              {balance.whole}
              <span className={styles.balanceCents}>{balance.cents}</span>
            </div>
          </div>

          {contributionBanner && contributionDetail ? (
            <div className={styles.contributionBannerSection}>
              <DialogPrimitive.Root
                open={isContributionDetailOpen}
                onOpenChange={setIsContributionDetailOpen}
              >
                <div className={styles.contributionBannerWrapper}>
                  <DialogPrimitive.Trigger asChild>
                    <button
                      type="button"
                      className={styles.contributionBannerButton}
                      aria-label={t("account.redesign.balanceDetailOpenAriaLabel")}
                    >
                      <span
                        className={styles.contributionBanner}
                        style={{
                          backgroundColor: `${contributionBanner.color}22`,
                          borderColor: `${contributionBanner.color}44`,
                        }}
                      >
                        <span
                          className={styles.contributionBannerAvatar}
                          style={{ backgroundColor: contributionBanner.color }}
                        >
                          {contributionBanner.initials}
                        </span>
                        <span className={styles.contributionBannerText}>{contributionBanner.text}</span>
                      </span>
                    </button>
                  </DialogPrimitive.Trigger>
                </div>

                <DialogPrimitive.Portal>
                  <DialogPrimitive.Overlay className={styles.contributionDetailOverlay} />
                  <DialogPrimitive.Content
                    className={styles.contributionDetailContent}
                    onTouchStart={handleContributionDetailTouchStart}
                    onTouchMove={handleContributionDetailTouchMove}
                    onTouchEnd={handleContributionDetailTouchEnd}
                  >
                    <div className={styles.contributionDetailHandle} aria-hidden />

                    <DialogPrimitive.Title className={styles.contributionDetailTitle}>
                      {t("account.redesign.balanceDetailTitle")}
                    </DialogPrimitive.Title>
                    <p className={styles.contributionDetailPeriodContext}>
                      {t("account.redesign.balanceDetailPeriodContext", { period: periodLabel })}
                    </p>

                    <DialogPrimitive.Close asChild>
                      <button
                        type="button"
                        className={styles.contributionDetailCloseButton}
                        aria-label={t("account.redesign.balanceDetailCloseAriaLabel")}
                      >
                        <X size={16} />
                      </button>
                    </DialogPrimitive.Close>

                    <div className={styles.contributionDetailBody} ref={contributionDetailScrollRef}>
                      {contributionDetail.members.map((member, index) => {
                        const net = formatCurrency(member.net, {
                          currency: currencySymbol,
                          decimals: currencyDecimals,
                          showSign: true,
                        });
                        const paid = formatCurrency(member.totalPaid, {
                          currency: currencySymbol,
                          decimals: currencyDecimals,
                        });
                        const responsibility = formatCurrency(member.totalResponsible, {
                          currency: currencySymbol,
                          decimals: currencyDecimals,
                        });
                        const paidWidth =
                          contributionDetail.maxValue > 0
                            ? Math.min(100, (member.totalPaid / contributionDetail.maxValue) * 100)
                            : 0;
                        const responsibilityWidth =
                          contributionDetail.maxValue > 0
                            ? Math.min(
                                100,
                                (member.totalResponsible / contributionDetail.maxValue) * 100
                              )
                            : 0;

                        return (
                          <div key={member.userId} className={styles.contributionDetailMember}>
                            <div className={styles.contributionDetailMemberHeader}>
                              <div className={styles.contributionDetailIdentity}>
                                <span
                                  className={styles.contributionDetailAvatar}
                                  style={{ backgroundColor: member.color }}
                                >
                                  {member.initials}
                                </span>
                                <span className={styles.contributionDetailName}>{member.name}</span>
                              </div>
                              <span
                                className={`${styles.contributionDetailBalanceBadge} ${
                                  member.net > 0
                                    ? styles.contributionDetailBalanceBadgePositive
                                    : member.net < 0
                                      ? styles.contributionDetailBalanceBadgeNegative
                                      : styles.contributionDetailBalanceBadgeNeutral
                                }`}
                              >
                                {net.full}
                              </span>
                            </div>

                            <div className={styles.contributionDetailBars}>
                              <div className={styles.contributionDetailBarRow}>
                                <span className={styles.contributionDetailBarLabel}>
                                  {t("account.redesign.balanceDetailPaid")}
                                </span>
                                <span className={styles.contributionDetailBarTrack}>
                                  <span
                                    className={styles.contributionDetailBarFill}
                                    style={{
                                      width: `${paidWidth}%`,
                                      backgroundColor: member.color,
                                    }}
                                  />
                                </span>
                                <span className={styles.contributionDetailBarAmount}>{paid.full}</span>
                              </div>
                              <div className={styles.contributionDetailBarRow}>
                                <span className={styles.contributionDetailBarLabel}>
                                  {t("account.redesign.balanceDetailResponsibility")}
                                </span>
                                <span className={styles.contributionDetailBarTrack}>
                                  <span
                                    className={`${styles.contributionDetailBarFill} ${styles.contributionDetailBarFillResponsibility}`}
                                    style={{
                                      width: `${responsibilityWidth}%`,
                                      backgroundColor: member.color,
                                    }}
                                  />
                                </span>
                                <span className={styles.contributionDetailBarAmount}>
                                  {responsibility.full}
                                </span>
                              </div>
                            </div>

                            {index < contributionDetail.members.length - 1 ? (
                              <div className={styles.contributionDetailSeparator} />
                            ) : null}
                          </div>
                        );
                      })}

                      <div className={styles.contributionDetailSummary}>
                        <div
                          className={styles.contributionBanner}
                          style={{
                            backgroundColor: `${contributionBanner.color}22`,
                            borderColor: `${contributionBanner.color}44`,
                          }}
                        >
                          <span
                            className={styles.contributionBannerAvatar}
                            style={{ backgroundColor: contributionBanner.color }}
                          >
                            {contributionBanner.initials}
                          </span>
                          <span
                            className={`${styles.contributionBannerText} ${styles.contributionDetailSummaryText}`}
                          >
                            {contributionBanner.text}
                          </span>
                        </div>
                      </div>
                    </div>
                  </DialogPrimitive.Content>
                </DialogPrimitive.Portal>
              </DialogPrimitive.Root>
            </div>
          ) : null}
        </div>

        <div className={styles.periodSelector}>
          <PeriodMonthSelector
            selectedPeriod={selectedPeriod}
            selectedMonth={selectedMonth}
            onPeriodChange={setSelectedPeriod}
            onMonthChange={setSelectedMonth}
            locale={locale}
            monthKeys={monthKeys}
          />
        </div>

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
            {renderFlowContribution("income")}
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
            {renderFlowContribution("expense")}
          </div>
        </div>

        <div className={styles.chartSection}>
          <div className={styles.chartContainer}>
            {isChartExpanded ? (
              <div className={styles.chartHeaderExpanded}>
                <button
                  type="button"
                  className={styles.chartExpandedTitleButton}
                  onClick={() => setIsChartExpanded(false)}
                  aria-label={chartCollapsedTitle}
                >
                  <span className={styles.chartCollapsedTitleContent}>
                    <span className={styles.chartCollapseIcon} aria-hidden>
                      <TrendingUp size={14} />
                    </span>
                    <span className={styles.chartTitle}>{chartTitle}</span>
                  </span>
                </button>

                <div className={styles.chartExpandedHeaderRight}>
                  <div className={styles.chartHeaderRight}>
                    {showChartLegend ? (
                      <div className={styles.chartUserLegend}>
                        {contributors.map((contributor) => (
                          <div
                            key={`chart-legend-${contributor.userId}`}
                            className={styles.chartUserLegendItem}
                          >
                            <span
                              className={styles.chartUserDot}
                              style={{ backgroundColor: contributor.color }}
                            />
                            <span>{contributor.shortName}</span>
                          </div>
                        ))}
                      </div>
                    ) : null}
                    <div className={styles.chartToggleScroll}>
                      <div className={styles.chartToggle}>
                        {(
                          [
                            { key: "both", label: t("account.redesign.monthlyEvolutionModeBoth") },
                            { key: "income", label: t("account.redesign.monthlyEvolutionModeIncome") },
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
                  </div>

                  <button
                    type="button"
                    className={styles.chartCollapseButton}
                    onClick={() => setIsChartExpanded(false)}
                    aria-label={chartCollapsedTitle}
                  >
                    <ChevronUp size={16} />
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                className={styles.chartCollapsedTrigger}
                onClick={() => setIsChartExpanded(true)}
                aria-label={chartCollapsedTitle}
                aria-expanded={isChartExpanded}
              >
                <span className={styles.chartCollapsedTitleContent}>
                  <span className={styles.chartCollapseIcon} aria-hidden>
                    <TrendingUp size={14} />
                  </span>
                  <span className={styles.chartTitle}>{chartCollapsedTitle}</span>
                </span>
                <ChevronDown size={16} />
              </button>
            )}

            <div
              className={`${styles.chartExpandable} ${
                isChartExpanded ? styles.chartExpandableExpanded : ""
              }`}
            >
              <div className={styles.chartExpandableInner}>
                {data.monthlyHistory.length === 0 ? (
                  <div className={styles.chartEmptyState}>
                    <span className={styles.chartEmptyIcon}>📊</span>
                    <span className={styles.chartEmptyText}>
                      {t("account.redesign.monthlyEvolutionEmpty")}
                    </span>
                  </div>
                ) : (
                  <div className={styles.chartArea}>
                    {data.monthlyHistory.map((point) => {
                      const segmentedValues =
                        chartMode === "income" ? point.incomeByUser : point.expenseByUser;
                      const segmentedTotal = segmentedValues.reduce(
                        (acc, value) => acc + Math.max(0, value.amount),
                        0
                      );

                      return (
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

                            {chartMode === "income" || chartMode === "expenses" ? (
                              isCollaborative ? (
                                <div
                                  className={`${styles.chartStackedBar} ${
                                    point.isCurrent ? styles.chartBarCurrent : ""
                                  }`}
                                  style={{ height: `${getBarHeight(segmentedTotal)}px` }}
                                >
                                  {segmentedValues
                                    .filter((value) => value.amount > 0)
                                    .map((value) => (
                                      <div
                                        key={`${point.label}-${value.userId}`}
                                        className={styles.chartSegment}
                                        style={{
                                          height:
                                            segmentedTotal > 0
                                              ? `${(value.amount / segmentedTotal) * 100}%`
                                              : "0%",
                                          backgroundColor:
                                            contributorByUserId.get(value.userId)?.color ??
                                            "#2563EB",
                                        }}
                                      />
                                    ))}
                                </div>
                              ) : (
                                <div
                                  className={`${styles.chartBar} ${
                                    chartMode === "income" ? styles.incomeBar : styles.expenseBar
                                  } ${point.isCurrent ? styles.chartBarCurrent : ""}`}
                                  style={{
                                    height: `${
                                      chartMode === "income"
                                        ? getBarHeight(point.income)
                                        : getBarHeight(point.expense)
                                    }px`,
                                  }}
                                />
                              )
                            ) : null}

                            {chartMode === "net" ? (
                              <div
                                className={`${styles.chartBar} ${
                                  point.income - point.expense >= 0
                                    ? styles.incomeBar
                                    : styles.expenseBar
                                } ${point.isCurrent ? styles.chartBarCurrent : ""}`}
                                style={{
                                  height: `${getBarHeight(Math.abs(point.income - point.expense))}px`,
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
                      );
                    })}
                  </div>
                )}

                {showChartLegend ? (
                  <div className={styles.chartUserLegendMobile}>
                    {contributors.map((contributor) => (
                      <div
                        key={`chart-legend-mobile-${contributor.userId}`}
                        className={styles.chartUserLegendItem}
                      >
                        <span
                          className={styles.chartUserDot}
                          style={{ backgroundColor: contributor.color }}
                        />
                        <span>{contributor.shortName}</span>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </div>

        {renderContributionSection("expense")}
        {renderContributionSection("income")}
      </div>
    </div>
  );
}
