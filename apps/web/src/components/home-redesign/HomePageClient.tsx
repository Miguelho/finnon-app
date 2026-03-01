"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  CATEGORY_PALETTE,
  buildCalendarDayData,
  buildProjectColorMap,
  computeProjectProgress,
  computeSavingsDistribution,
  getProjectColor,
  getMonthCalendarDisplayDays,
  getWeekCalendarDisplayDays,
  getWeekStartMonday,
  type AvatarColorToken,
  type Project,
  type ProjectContribution,
  type UserAvatarColorId,
} from "@poleursus/shared";
import { PageContainer } from "@/components/layout/page-container";
import { AddActionTrigger } from "@/components/navigation/add-action-trigger";
import { UserAvatar } from "@/components/user-avatar";
import { CategoryIcon } from "@/components/category-icon";
import { createClient } from "@/lib/supabase/client";
import { BalanceRow } from "./BalanceHeader";
import { Calendar } from "./Calendar";
import { ProjectsRow } from "./SavingsMonthCard";
import { formatCurrencyParts, formatFullDate, toDateKey, toMinor } from "./utils";

type TransactionRow = {
  id: string;
  type: "income" | "expense";
  amount_minor: string | number | null;
  amount_base_minor: string | number | null;
  date: string;
  merchant: string | null;
  notes?: string | null;
  created_by?: string | null;
  created_at?: string | null;
  category?: {
    id: string;
    name: string;
    icon_id: string | null;
    color?: string | null;
  } | null;
};

type ObligationRow = {
  id: string;
  name: string;
  amount_minor: string | number | null;
  amount_base_minor: string | number | null;
  due_date: string | null;
  status: "pending" | "paid" | null;
};

type ProfileRow = {
  user_id: string;
  email: string | null;
  display_name: string | null;
  avatar_path: string | null;
  avatar_fallback_text: string | null;
  avatar_fallback_bg_token: AvatarColorToken | null;
  avatar_color: UserAvatarColorId | null;
};

type HomeMovement = {
  id: string;
  name: string;
  categoryId: string | null;
  iconId: string | null;
  categoryName: string | null;
  createdByUserId?: string | null;
  type: "income" | "expense";
  amountMinor: bigint;
  isProgrammed?: boolean;
};

type HomeMovementGroup = {
  id: string;
  name: string;
  iconId: string | null;
  totalMinor: bigint;
  items: HomeMovement[];
};

type HomePageClientProps = {
  account: {
    id: string;
    canEdit: boolean;
    currencySymbol: string;
    baseCurrency: string;
    locale: "es" | "en";
  };
  accounts: Array<{
    id: string;
    name: string;
    balanceMinor: string;
    color: string;
  }>;
  monthlyTransactions: TransactionRow[];
  upcomingTransactions: TransactionRow[];
  obligations: ObligationRow[];
  profiles: ProfileRow[];
  projects: Project[];
  projectContributions: ProjectContribution[];
};

const plusDays = (date: Date, days: number) => {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
};

const absMinor = (value: bigint) => (value < 0n ? -value : value);

const toSignedMinor = (amountMinor: bigint, type: "income" | "expense") => {
  const absoluteAmount = absMinor(amountMinor);
  return type === "income" ? absoluteAmount : -absoluteAmount;
};

const WEEKDAY_LABELS = {
  es: ["L", "M", "X", "J", "V", "S", "D"],
  en: ["M", "T", "W", "T", "F", "S", "S"],
};

const MONTHS_SHORT = {
  es: ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"],
  en: ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"],
};

const MONTHS_LONG = {
  es: [
    "enero",
    "febrero",
    "marzo",
    "abril",
    "mayo",
    "junio",
    "julio",
    "agosto",
    "septiembre",
    "octubre",
    "noviembre",
    "diciembre",
  ],
  en: [
    "january",
    "february",
    "march",
    "april",
    "may",
    "june",
    "july",
    "august",
    "september",
    "october",
    "november",
    "december",
  ],
};

const TRANSACTIONS_SELECT_WITH_CATEGORY_COLOR =
  "id, account_id, type, amount_minor, amount_base_minor, currency, category_id, date, merchant, notes, created_by, created_at, category:categories(id, name, icon_id, color)";
const TRANSACTIONS_SELECT_LEGACY =
  "id, account_id, type, amount_minor, amount_base_minor, currency, category_id, date, merchant, notes, created_by, created_at, category:categories(id, name, icon_id)";

const isMissingCategoryColorError = (error: any) =>
  error?.code === "42703" &&
  typeof error?.message === "string" &&
  error.message.includes("categories") &&
  error.message.includes("color");

export function HomePageClient({
  account,
  accounts,
  monthlyTransactions,
  upcomingTransactions,
  obligations,
  profiles,
  projects,
  projectContributions,
}: HomePageClientProps) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const locale = account.locale;
  const weekdayLabels = WEEKDAY_LABELS[locale];
  const monthsShort = MONTHS_SHORT[locale];
  const monthsLong = MONTHS_LONG[locale];
  const today = useMemo(() => new Date(), []);
  const [transactions, setTransactions] = useState<TransactionRow[]>(monthlyTransactions);
  const [futureTransactions, setFutureTransactions] = useState<TransactionRow[]>(upcomingTransactions);
  const [creatorProfiles, setCreatorProfiles] = useState<ProfileRow[]>(profiles);
  const [calendarObligations, setCalendarObligations] = useState<ObligationRow[]>(obligations);
  const [calendarView, setCalendarView] = useState<"week" | "month">("week");
  const [weekReference, setWeekReference] = useState<Date>(today);
  const [monthReference, setMonthReference] = useState<Date>(today);
  const [selectedDayKey, setSelectedDayKey] = useState<string>(toDateKey(today));

  useEffect(() => {
    setCreatorProfiles(profiles);
  }, [profiles]);

  useEffect(() => {
    let cancelled = false;

    const normalizeCategory = <T extends { category?: unknown }>(row: T) => ({
      ...row,
      category: Array.isArray(row.category)
        ? (row.category[0] ?? null)
        : (row.category ?? null),
    });

    const loadCalendarData = async () => {
      const monthStart = new Date(monthReference.getFullYear(), monthReference.getMonth(), 1);
      const monthEnd = new Date(monthReference.getFullYear(), monthReference.getMonth() + 1, 0);
      const monthGridStart = getWeekStartMonday(monthStart);
      const monthGridEnd = plusDays(getWeekStartMonday(plusDays(monthEnd, 1)), 6);
      const weekStart = getWeekStartMonday(weekReference);
      const weekEnd = plusDays(weekStart, 6);

      const queryStart = monthGridStart < weekStart ? monthGridStart : weekStart;
      const queryEnd = monthGridEnd > weekEnd ? monthGridEnd : weekEnd;
      const startDate = toDateKey(queryStart);
      const endDate = toDateKey(queryEnd);
      const upcomingStartDate = toDateKey(today);
      const upcomingEndDate = toDateKey(plusDays(today, 30));

      try {
        const loadTransactions = async ({
          start,
          end,
          ascending,
        }: {
          start: string;
          end: string;
          ascending: boolean;
        }) => {
          const runQuery = (selectClause: string) => {
            let query = supabase
              .from("transactions")
              .select(selectClause)
              .eq("account_id", account.id)
              .gte("date", start)
              .lte("date", end)
              .order("date", { ascending });

            if (!ascending) {
              query = query.order("created_at", { ascending: false });
            }

            return query;
          };

          let { data, error } = await runQuery(TRANSACTIONS_SELECT_WITH_CATEGORY_COLOR);

          if (isMissingCategoryColorError(error)) {
            console.warn(
              "[HomePageClient][web] categories.color missing, retrying transactions query without color."
            );
            ({ data, error } = await runQuery(TRANSACTIONS_SELECT_LEGACY));
          }

          if (error) throw error;

          const rows = (data ?? []) as Array<TransactionRow & { category?: unknown }>;
          return rows.map(normalizeCategory) as TransactionRow[];
        };

        const [monthData, upcomingData, obligationsData] = await Promise.all([
          loadTransactions({
            start: startDate,
            end: endDate,
            ascending: false,
          }),
          loadTransactions({
            start: upcomingStartDate,
            end: upcomingEndDate,
            ascending: true,
          }),
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

        const creatorUserIds = Array.from(
          new Set(
            [...monthData, ...upcomingData]
              .map((transaction) => transaction.created_by)
              .filter((value): value is string => Boolean(value))
          )
        );
        const { data: profileRows, error: profilesError } =
          creatorUserIds.length > 0
            ? await supabase
                .from("profiles")
                .select(
                  "user_id, email, display_name, avatar_path, avatar_fallback_text, avatar_fallback_bg_token, avatar_color"
                )
                .in("user_id", creatorUserIds)
            : { data: [], error: null };
        if (profilesError) {
          console.warn("[HomePageClient][web] load profiles error:", profilesError);
        }

        if (cancelled) return;
        setTransactions(monthData);
        setFutureTransactions(upcomingData);
        setCreatorProfiles((profileRows ?? []) as ProfileRow[]);
        setCalendarObligations((obligationsData.data ?? []) as ObligationRow[]);
      } catch (error) {
        console.error("[HomePageClient][web] load calendar error:", error);
      }
    };

    void loadCalendarData();

    return () => {
      cancelled = true;
    };
  }, [account.id, monthReference, weekReference, supabase, today]);

  const allTransactions = useMemo(() => {
    const map = new Map<string, TransactionRow>();
    transactions.forEach((item) => map.set(item.id, item));
    futureTransactions.forEach((item) => map.set(item.id, item));
    return Array.from(map.values());
  }, [transactions, futureTransactions]);

  const todayKey = toDateKey(today);
  const monthTransactionsToDate = useMemo(() => {
    const monthPrefix = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
    return transactions.filter((tx) => {
      const key = toDateKey(tx.date);
      return Boolean(key) && key.startsWith(monthPrefix) && key <= todayKey;
    });
  }, [transactions, today, todayKey]);

  const monthlyBalanceMinor = useMemo(
    () =>
      monthTransactionsToDate.reduce((total, tx) => {
        const amount = toMinor(tx.amount_base_minor ?? tx.amount_minor);
        return tx.type === "income" ? total + amount : total - amount;
      }, 0n),
    [monthTransactionsToDate]
  );

  const savingsDistribution = useMemo(
    () =>
      computeSavingsDistribution({
        projects,
        savingsMinor: monthlyBalanceMinor,
      }),
    [projects, monthlyBalanceMinor]
  );

  const calendarMap = useMemo(() => {
    const entries = [
      ...allTransactions.map((tx) => ({
        date: tx.date,
        type: tx.type,
        amount_minor: tx.amount_minor,
        amount_base_minor: tx.amount_base_minor,
        category_id: tx.category?.id ?? null,
        category_name: tx.category?.name ?? null,
        category_color: tx.category?.color ?? null,
      })),
      ...calendarObligations
        .filter((obligation) => obligation.status !== "paid" && Boolean(obligation.due_date))
        .map((obligation) => ({
          date: obligation.due_date as string,
          type: "expense" as const,
          amount_minor: obligation.amount_minor,
          amount_base_minor: obligation.amount_base_minor,
          category_id: "obligation",
          category_name: locale === "en" ? "Scheduled" : "Programado",
          category_color: "#CB6E55",
        })),
    ];

    return buildCalendarDayData(entries);
  }, [allTransactions, calendarObligations, locale]);

  const monthDays = useMemo(() => {
    return getMonthCalendarDisplayDays(
      calendarMap,
      monthReference.getFullYear(),
      monthReference.getMonth(),
      todayKey,
      weekdayLabels
    );
  }, [calendarMap, monthReference, todayKey, weekdayLabels]);

  const weekDays = useMemo(() => {
    return getWeekCalendarDisplayDays(
      calendarMap,
      weekReference,
      todayKey,
      weekdayLabels
    );
  }, [calendarMap, weekReference, todayKey, weekdayLabels]);

  const weekPeriodLabel = useMemo(() => {
    const monday = getWeekStartMonday(weekReference);
    const sunday = plusDays(monday, 6);
    const startMonth = monthsShort[monday.getMonth()] ?? "";
    const endMonth = monthsShort[sunday.getMonth()] ?? "";
    if (monday.getMonth() === sunday.getMonth()) {
      return `${monday.getDate()}–${sunday.getDate()} ${endMonth}`;
    }
    return `${monday.getDate()} ${startMonth} – ${sunday.getDate()} ${endMonth}`;
  }, [weekReference, monthsShort]);

  const monthPeriodLabel = useMemo(() => {
    const monthName = monthsLong[monthReference.getMonth()] ?? "";
    return `${monthName.charAt(0).toUpperCase()}${monthName.slice(1)} ${monthReference.getFullYear()}`;
  }, [monthReference, monthsLong]);

  const selectedDayMovementGroups = useMemo<HomeMovementGroup[]>(() => {
    const dayTx = allTransactions
      .filter((tx) => toDateKey(tx.date) === selectedDayKey)
      .map((tx) => ({
        id: tx.id,
        name: tx.merchant?.trim() || tx.category?.name || (locale === "en" ? "Movement" : "Movimiento"),
        categoryId: tx.category?.id ?? null,
        iconId: tx.category?.icon_id ?? null,
        categoryName: tx.category?.name ?? null,
        createdByUserId: tx.created_by ?? null,
        type: tx.type,
        amountMinor: absMinor(toMinor(tx.amount_base_minor ?? tx.amount_minor)),
      }));

    const dayObligations = calendarObligations
      .filter((obligation) => obligation.status !== "paid")
      .filter((obligation) => toDateKey(obligation.due_date as string) === selectedDayKey)
      .map((obligation) => ({
        id: `obligation-${obligation.id}`,
        name: obligation.name,
        categoryId: "obligation",
        iconId: null,
        categoryName: locale === "en" ? "Scheduled" : "Programado",
        createdByUserId: null,
        type: "expense" as const,
        amountMinor: absMinor(toMinor(obligation.amount_base_minor ?? obligation.amount_minor)),
        isProgrammed: true,
      }));

    const grouped = new Map<string, HomeMovementGroup>();
    [...dayTx, ...dayObligations].forEach((movement) => {
      const groupKey = movement.categoryId ?? "uncategorized";
      const groupName =
        movement.categoryName ??
        (locale === "en" ? "Uncategorized" : "Sin categoría");
      const existing = grouped.get(groupKey);
      if (!existing) {
        grouped.set(groupKey, {
          id: groupKey,
          name: groupName,
          iconId: movement.iconId,
          totalMinor: toSignedMinor(movement.amountMinor, movement.type),
          items: [movement],
        });
        return;
      }
      existing.items.push(movement);
      existing.totalMinor += toSignedMinor(movement.amountMinor, movement.type);
      if (!existing.iconId && movement.iconId) {
        existing.iconId = movement.iconId;
      }
    });

    return Array.from(grouped.values());
  }, [allTransactions, calendarObligations, selectedDayKey, locale]);

  const selectedDayLabel = useMemo(
    () => formatFullDate(selectedDayKey, locale),
    [selectedDayKey, locale]
  );
  const profileByUserId = useMemo(
    () => new Map(creatorProfiles.map((profile) => [profile.user_id, profile])),
    [creatorProfiles]
  );

  const contributionsByProject = useMemo(() => {
    const byProject = new Map<string, ProjectContribution[]>();
    projectContributions.forEach((entry) => {
      const list = byProject.get(entry.project_id) ?? [];
      list.push(entry);
      byProject.set(entry.project_id, list);
    });
    return byProject;
  }, [projectContributions]);

  const activeProjects = useMemo(
    () => projects.filter((project) => !project.is_hucha && (project.status === "active" || project.status === "completed")),
    [projects]
  );
  const projectColorMap = useMemo(() => buildProjectColorMap(projects), [projects]);

  const projectsRowData = useMemo(
    () =>
      activeProjects.map((project) => {
        const progress = computeProjectProgress({
          project,
          contributions: contributionsByProject.get(project.id) ?? [],
        });
        return {
          id: project.id,
          name: project.name,
          emoji: project.emoji || "🎯",
          currentAmountMinor: progress.savedMinor,
          goalAmountMinor: progress.targetMinor > 0n ? progress.targetMinor : 1n,
          color: getProjectColor(project, projectColorMap),
        };
      }),
    [activeProjects, contributionsByProject, projectColorMap]
  );

  const huchaProject = useMemo(
    () => projects.find((project) => project.is_hucha) ?? null,
    [projects]
  );

  const huchaAmountMinor = useMemo(() => {
    if (!huchaProject) return savingsDistribution.huchaMinor;
    const rows = contributionsByProject.get(huchaProject.id) ?? [];
    return rows.reduce((total, row) => {
      if (!(row.confirmed ?? false)) return total;
      return total + toMinor(row.actual_amount_base_minor);
    }, 0n);
  }, [huchaProject, contributionsByProject, savingsDistribution.huchaMinor]);

  const accountItems = useMemo(
    () =>
      accounts.map((item) => ({
        id: item.id,
        name: item.name,
        balanceMinor: toMinor(item.balanceMinor),
        color: item.color,
      })),
    [accounts]
  );

  const selectedBalanceMinor =
    accountItems.find((item) => item.id === account.id)?.balanceMinor ?? 0n;

  const handlePrevPeriod = () => {
    if (calendarView === "week") {
      const next = new Date(weekReference);
      next.setDate(next.getDate() - 7);
      setWeekReference(next);
      setSelectedDayKey((current) => {
        const currentDate = new Date(current);
        if (Number.isNaN(currentDate.getTime())) return toDateKey(next);
        currentDate.setDate(currentDate.getDate() - 7);
        return toDateKey(currentDate);
      });
      return;
    }
    const next = new Date(monthReference);
    next.setMonth(next.getMonth() - 1);
    setMonthReference(next);
  };

  const handleNextPeriod = () => {
    if (calendarView === "week") {
      const next = new Date(weekReference);
      next.setDate(next.getDate() + 7);
      setWeekReference(next);
      setSelectedDayKey((current) => {
        const currentDate = new Date(current);
        if (Number.isNaN(currentDate.getTime())) return toDateKey(next);
        currentDate.setDate(currentDate.getDate() + 7);
        return toDateKey(currentDate);
      });
      return;
    }
    const next = new Date(monthReference);
    next.setMonth(next.getMonth() + 1);
    setMonthReference(next);
  };

  return (
    <PageContainer className="pb-20 pt-7">
      <div className="space-y-3">
        <BalanceRow
          totalBalanceMinor={selectedBalanceMinor}
          currencySymbol={account.currencySymbol}
          accounts={accountItems}
          locale={locale}
          onPress={() => router.push("/account")}
        />

        <ProjectsRow
          projects={projectsRowData}
          huchaAmountMinor={huchaAmountMinor}
          totalSavingsMinor={savingsDistribution.savingsMinor}
          currentMonth={monthPeriodLabel}
          currencySymbol={account.currencySymbol}
          locale={locale}
          onPress={() => router.push("/projects")}
        />

        <Calendar
          view={calendarView}
          onViewChange={setCalendarView}
          periodLabel={calendarView === "week" ? weekPeriodLabel : monthPeriodLabel}
          monthDays={monthDays}
          weekDays={weekDays}
          selectedDayKey={selectedDayKey}
          onSelectDay={setSelectedDayKey}
          onPrevPeriod={handlePrevPeriod}
          onNextPeriod={handleNextPeriod}
          currencySymbol={account.currencySymbol}
        />

        <div className="rounded-[14px] border border-border bg-card p-3">
          <p className="text-[13px] font-semibold text-[var(--account-text-primary)]">
            {locale === "en" ? "Day movements" : "Transacciones del día"}
          </p>
          <p className="mt-[2px] text-[11px] text-[var(--account-text-secondary)]">
            {selectedDayLabel}
          </p>

          {selectedDayMovementGroups.length === 0 ? (
            <p className="mt-2 text-[12px] text-[var(--account-text-tertiary)]">
              {locale === "en" ? "No movements for this day." : "No hay movimientos para este día."}
            </p>
          ) : (
            <div className="mt-2 space-y-0">
              {selectedDayMovementGroups.map((group) => {
                const isGroupIncome = group.totalMinor > 0n;
                const isGroupExpense = group.totalMinor < 0n;
                const groupParts = formatCurrencyParts(absMinor(group.totalMinor), account.currencySymbol, locale);
                return (
                  <div key={group.id} className="border-b border-border py-2 last:border-b-0">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex min-w-0 flex-1 items-center gap-2.5">
                        <div className="flex h-7 w-7 items-center justify-center rounded-[8px] bg-[var(--account-surface-alt)]">
                          <CategoryIcon iconKey={group.iconId ?? "Tag"} size={14} tone="muted" />
                        </div>
                        <p className="truncate text-[13px] font-medium text-[var(--account-text-primary)]">
                          {group.name}
                        </p>
                      </div>
                      <p
                        className="text-[12px] font-semibold"
                        style={{
                          color: isGroupIncome ? "#6DC9A0" : isGroupExpense ? "#E0956A" : "var(--account-text-secondary)",
                        }}
                      >
                        {isGroupIncome ? "+" : isGroupExpense ? "−" : ""}
                        {groupParts.full}
                      </p>
                    </div>

                    <div className="ml-[38px] mt-1.5 space-y-1.5">
                      {group.items.map((movement) => {
                        const parts = formatCurrencyParts(movement.amountMinor, account.currencySymbol, locale);
                        const authorProfile = movement.createdByUserId
                          ? profileByUserId.get(movement.createdByUserId) ?? null
                          : null;
                        const authorName =
                          authorProfile?.display_name?.trim() ||
                          authorProfile?.avatar_fallback_text?.trim() ||
                          authorProfile?.email?.trim() ||
                          (movement.isProgrammed
                            ? (locale === "en" ? "Scheduled" : "Programado")
                            : (locale === "en" ? "Unknown" : "Desconocido"));
                        return (
                          <div key={movement.id} className="flex items-center justify-between gap-3">
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-[12px] text-[var(--account-text-primary)]">
                                {movement.name}
                              </p>
                              <div className="mt-0.5 flex items-center gap-1.5">
                                {authorProfile ? (
                                  <UserAvatar
                                    userId={authorProfile.user_id}
                                    email={authorProfile.email ?? null}
                                    displayName={authorProfile.display_name ?? null}
                                    avatarPath={authorProfile.avatar_path ?? null}
                                    fallbackText={authorProfile.avatar_fallback_text ?? null}
                                    fallbackBgToken={authorProfile.avatar_fallback_bg_token ?? null}
                                    avatarColor={authorProfile.avatar_color ?? null}
                                    size={16}
                                  />
                                ) : null}
                                <p className="truncate text-[10px] text-[var(--account-text-secondary)]">
                                  {authorName}
                                </p>
                              </div>
                            </div>
                            <p
                              className="text-[11px] font-semibold"
                              style={{ color: movement.type === "income" ? "#6DC9A0" : "#E0956A" }}
                            >
                              {movement.type === "income" ? "+" : "−"}
                              {parts.full}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <AddActionTrigger
        canEdit={account.canEdit}
        accountId={account.id}
        currency={account.baseCurrency}
        locale={locale}
        variant="hidden"
      />
    </PageContainer>
  );
}
