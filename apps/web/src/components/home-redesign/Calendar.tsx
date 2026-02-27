import { useEffect, useMemo, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ArrowUp,
  ArrowDown,
  Equal,
} from "lucide-react";
import { useTranslations } from "next-intl";
import type { AvatarColorToken, UserAvatarColorId } from "@poleursus/shared";
import { UserAvatar } from "@/components/user-avatar";
import { CategoryIcon } from "@/components/category-icon";
import { formatCurrencyParts } from "./utils";

type CalendarView = "week" | "month";

export type CalendarDot = {
  type: "income" | "expense";
};

export type WeekDayData = {
  date: string; // YYYY-MM-DD
  dayLabel: string;
  dayNumber: number;
  isToday: boolean;
  dots?: CalendarDot[];
};

export type MonthDayData = {
  date: string; // YYYY-MM-DD
  dayNumber: number;
  isToday: boolean;
  isOtherMonth: boolean;
  dots?: CalendarDot[];
};

export type WeekData = {
  days: WeekDayData[];
  period: string;
  netIncome: string;
  netExpense: string;
  net: string;
};

export type MonthData = {
  days: MonthDayData[];
  period: string;
  netIncome: string;
  netExpense: string;
  net: string;
};

export type DayMovement = {
  id: string;
  name: string;
  amountMinor: bigint;
  type: "income" | "expense";
  category?: string | null;
  categoryIconId?: string | null;
  badge?: string | null;
  createdBy?: {
    userId?: string | null;
    email?: string | null;
    displayName?: string | null;
    avatarPath?: string | null;
    fallbackText?: string | null;
    fallbackBgToken?: AvatarColorToken | null;
    avatarColor?: UserAvatarColorId | null;
    label?: string;
  };
};

export type ContextMovement = DayMovement & {
  dateLabel: string;
};

export type DayDetailData = {
  dateKey: string;
  formattedLabel: string;
  movements: DayMovement[];
};

type MovementCreator = NonNullable<DayMovement["createdBy"]>;

type DayCategoryGroup = {
  key: string;
  label: string;
  movements: DayMovement[];
  netMinor: bigint;
  categoryIconId: string | null;
  contributorPreviews: MovementCreator[];
  contributorCount: number;
};

const getDotTypes = (dots?: CalendarDot[]): Array<"income" | "expense"> => {
  const hasIncome = dots?.some((dot) => dot.type === "income") ?? false;
  const hasExpense = dots?.some((dot) => dot.type === "expense") ?? false;
  const dotTypes: Array<"income" | "expense"> = [];
  if (hasIncome) dotTypes.push("income");
  if (hasExpense) dotTypes.push("expense");
  return dotTypes;
};

const getAbsMinor = (value: bigint): bigint => (value < 0n ? -value : value);

const groupDayMovementsByCategory = (
  movements: DayMovement[],
  noCategoryLabel: string
): DayCategoryGroup[] => {
  const groups = new Map<
    string,
    DayCategoryGroup & { contributorMap: Map<string, MovementCreator> }
  >();

  movements.forEach((movement) => {
    const categoryLabel = movement.category?.trim() || noCategoryLabel;
    const key = categoryLabel.toLocaleLowerCase();
    const existing = groups.get(key);
    const signedAmount =
      movement.type === "income" ? movement.amountMinor : -movement.amountMinor;

    if (existing) {
      existing.movements.push(movement);
      existing.netMinor += signedAmount;
      if (!existing.categoryIconId && movement.categoryIconId) {
        existing.categoryIconId = movement.categoryIconId;
      }
      const contributor = movement.createdBy;
      if (contributor) {
        const contributorKey =
          contributor.userId?.trim() ||
          contributor.email?.trim() ||
          contributor.displayName?.trim() ||
          contributor.fallbackText?.trim() ||
          contributor.label?.trim();
        if (contributorKey && !existing.contributorMap.has(contributorKey)) {
          existing.contributorMap.set(contributorKey, contributor);
        }
      }
      return;
    }

    const contributorMap = new Map<string, MovementCreator>();
    const contributor = movement.createdBy;
    if (contributor) {
      const contributorKey =
        contributor.userId?.trim() ||
        contributor.email?.trim() ||
        contributor.displayName?.trim() ||
        contributor.fallbackText?.trim() ||
        contributor.label?.trim();
      if (contributorKey) contributorMap.set(contributorKey, contributor);
    }

    groups.set(key, {
      key,
      label: categoryLabel,
      movements: [movement],
      netMinor: signedAmount,
      categoryIconId: movement.categoryIconId ?? null,
      contributorPreviews: [],
      contributorCount: 0,
      contributorMap,
    });
  });

  return Array.from(groups.values())
    .map((group) => {
      const contributors = Array.from(group.contributorMap.values());
      return {
        key: group.key,
        label: group.label,
        movements: group.movements,
        netMinor: group.netMinor,
        categoryIconId: group.categoryIconId,
        contributorPreviews: contributors.slice(0, 3),
        contributorCount: contributors.length,
      };
    })
    .sort((left, right) => {
      const leftAbs = getAbsMinor(left.netMinor);
      const rightAbs = getAbsMinor(right.netMinor);
      if (leftAbs !== rightAbs) return rightAbs > leftAbs ? 1 : -1;
      if (left.movements.length !== right.movements.length) {
        return right.movements.length - left.movements.length;
      }
      return left.label.localeCompare(right.label);
    });
};

type CalendarProps = {
  view: CalendarView;
  onViewChange: (view: CalendarView) => void;
  weekData: WeekData;
  monthData: MonthData;
  selectedDay: DayDetailData | null;
  onSelectDay: (dateKey: string) => void;
  onPrevPeriod?: () => void;
  onNextPeriod?: () => void;
  currencySymbol: string;
  upcomingMovements: ContextMovement[];
  pastMovements: ContextMovement[];
  onViewAllMovements?: () => void;
  onCreateMovement?: () => void;
  locale?: string;
  monoClassName?: string;
};

export function Calendar({
  view,
  onViewChange,
  weekData,
  monthData,
  selectedDay,
  onSelectDay,
  onPrevPeriod,
  onNextPeriod,
  currencySymbol,
  upcomingMovements,
  pastMovements,
  onViewAllMovements,
  onCreateMovement,
  locale = "es-ES",
  monoClassName,
}: CalendarProps) {
  const t = useTranslations();
  const isWeek = view === "week";
  const selectedKey = selectedDay?.dateKey ?? "";
  const data = isWeek ? weekData : monthData;
  const totals = isWeek ? weekData : monthData;
  const monthLabels = useMemo(() => {
    const formatter = new Intl.DateTimeFormat(locale, { weekday: "narrow" });
    const baseMonday = new Date(2024, 0, 1); // Monday
    return [0, 1, 2, 3, 4, 5, 6].map((offset) =>
      formatter.format(new Date(baseMonday.getTime() + offset * 86400000))
    );
  }, [locale]);

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <div className="flex items-center justify-between px-5 pt-4">
        <h3 className="text-[15px] font-semibold text-foreground">
          {t("mobile.home.calendarTitle")}
        </h3>
      </div>

      <div className="mt-3 flex items-center gap-1.5 px-5">
        <button
          type="button"
          onClick={() => onViewChange("week")}
          className={`rounded-2xl px-3 py-1 text-[13px] font-medium transition-all ${
            isWeek
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:text-primary"
          }`}
        >
          {t("mobile.home.calendarWeek")}
        </button>
        <button
          type="button"
          onClick={() => onViewChange("month")}
          className={`rounded-2xl px-3 py-1 text-[13px] font-medium transition-all ${
            !isWeek
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:text-primary"
          }`}
        >
          {t("mobile.home.calendarMonth")}
        </button>

        <div className="ml-auto flex w-[182px] items-center justify-between">
          <button
            type="button"
            onClick={onPrevPeriod}
            className="flex h-7 w-7 items-center justify-center rounded-full border border-border text-muted-foreground transition-colors hover:bg-muted/50"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </button>
          <span className="w-[118px] truncate text-center text-[13px] font-medium text-muted-foreground">
            {data?.period}
          </span>
          <button
            type="button"
            onClick={onNextPeriod}
            className="flex h-7 w-7 items-center justify-center rounded-full border border-border text-muted-foreground transition-colors hover:bg-muted/50"
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {isWeek && weekData && (
        <>
          <div className="grid grid-cols-7 gap-0.5 px-5 pb-3 pt-4">
            {weekData.days.map((day) => {
              const isSelected = day.date === selectedKey;
              const isToday = day.isToday;
              const dayDotTypes = getDotTypes(day.dots);
              return (
                <button
                  type="button"
                  key={day.date}
                  onClick={() => onSelectDay(day.date)}
                  className={`flex flex-col items-center rounded-lg border px-1 py-2 transition-all ${
                    isToday
                      ? "border-primary/60"
                      : isSelected
                        ? "border-primary/40"
                        : "border-transparent hover:bg-muted/50"
                  }`}
                >
                  <span
                    className={`text-[11px] font-medium uppercase tracking-wide ${
                      isToday
                        ? "text-primary/80"
                        : isSelected
                          ? "text-primary"
                          : "text-muted-foreground"
                    }`}
                  >
                    {day.dayLabel}
                  </span>
                  <span
                    className={`text-lg font-semibold leading-tight ${
                      isToday
                        ? "text-primary"
                        : isSelected
                          ? "text-primary"
                          : "text-foreground"
                    }`}
                  >
                    {day.dayNumber}
                  </span>
                  <div className="mt-1.5 flex min-h-[6px] items-center gap-[3px]">
                    {dayDotTypes.map((dotType) => (
                      <span
                        key={`${day.date}-${dotType}`}
                        className={`h-[5px] w-[5px] rounded-full ${
                          dotType === "income"
                            ? "bg-[var(--account-income)]"
                            : "bg-[var(--account-expense)]"
                        }`}
                      />
                    ))}
                  </div>
                </button>
              );
            })}
          </div>

        </>
      )}

      {!isWeek && monthData && (
        <div className="grid grid-cols-7 gap-px px-5 pb-5 pt-3">
          {monthLabels.map((label, index) => (
            <div
              key={`${label}-${index}`}
              className="py-1 text-center text-[10px] font-medium uppercase tracking-wide text-muted-foreground"
            >
              {label}
            </div>
          ))}
          {monthData.days.map((day, i) => {
            const isSelected = day.date === selectedKey;
            const dayDotTypes = getDotTypes(day.dots);
            return (
              <button
                type="button"
                key={i}
                onClick={() => !day.isOtherMonth && onSelectDay(day.date)}
                className={`rounded-md border px-1 py-1.5 text-center transition-all ${
                  day.isOtherMonth
                    ? "border-transparent opacity-30"
                    : day.isToday
                      ? "border-primary/60"
                      : isSelected
                        ? "border-primary/40"
                        : "border-transparent hover:bg-muted/50"
                }`}
              >
                <span
                  className={`text-sm font-medium ${
                    day.isToday
                      ? "text-primary"
                      : isSelected
                        ? "text-primary"
                        : "text-foreground"
                  }`}
                >
                  {day.dayNumber}
                </span>
                <div className="mt-0.5 flex min-h-[5px] justify-center gap-0.5">
                  {dayDotTypes.map((dotType) => (
                    <span
                      key={`${day.date}-${dotType}`}
                      className={`h-1 w-1 rounded-full ${
                        dotType === "income"
                          ? "bg-[var(--account-income)]"
                          : "bg-[var(--account-expense)]"
                      }`}
                    />
                  ))}
                </div>
              </button>
            );
          })}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-center gap-2 px-5 pb-3 pt-1">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--account-income-light)] bg-[var(--account-income-bg)] px-2.5 py-1">
          <ArrowUp className="h-3.5 w-3.5 text-[var(--account-income)]" />
          <span
            className={`text-xs font-semibold text-[var(--account-income)] ${monoClassName ?? ""}`}
          >
            +{totals.netIncome}
          </span>
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--account-expense-light)] bg-[var(--account-expense-bg)] px-2.5 py-1">
          <ArrowDown className="h-3.5 w-3.5 text-[var(--account-expense)]" />
          <span
            className={`text-xs font-semibold text-[var(--account-expense)] ${monoClassName ?? ""}`}
          >
            -{totals.netExpense}
          </span>
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-white/40 bg-white/20 px-2.5 py-1">
          <Equal className="h-3.5 w-3.5 text-white" />
          <span className={`text-xs font-semibold text-foreground ${monoClassName ?? ""}`}>
            {totals.net}
          </span>
        </span>
      </div>

      {selectedDay && (
        <ContextMovementsPanel
          day={selectedDay}
          upcoming={upcomingMovements}
          past={pastMovements}
          currencySymbol={currencySymbol}
          locale={locale}
          onViewAllMovements={onViewAllMovements}
          onCreateMovement={onCreateMovement}
        />
      )}
    </div>
  );
}

type ContextMovementsPanelProps = {
  day: DayDetailData;
  upcoming: ContextMovement[];
  past: ContextMovement[];
  currencySymbol: string;
  locale: string;
  onViewAllMovements?: () => void;
  onCreateMovement?: () => void;
};

function ContextMovementsPanel({
  day,
  upcoming,
  past,
  currencySymbol,
  locale,
  onViewAllMovements,
  onCreateMovement,
}: ContextMovementsPanelProps) {
  const t = useTranslations();
  const noCategoryLabel = t("common.noneOption");
  const groupedDayMovements = useMemo(
    () => groupDayMovementsByCategory(day.movements, noCategoryLabel),
    [day.movements, noCategoryLabel]
  );
  const groupedUpcomingMovements = useMemo(
    () => groupDayMovementsByCategory(upcoming, noCategoryLabel),
    [upcoming, noCategoryLabel]
  );
  const groupedPastMovements = useMemo(
    () => groupDayMovementsByCategory(past, noCategoryLabel),
    [past, noCategoryLabel]
  );
  const [expandedDayCategoryKey, setExpandedDayCategoryKey] = useState<string | null>(null);
  const [expandedUpcomingCategoryKey, setExpandedUpcomingCategoryKey] = useState<string | null>(
    null
  );
  const [expandedPastCategoryKey, setExpandedPastCategoryKey] = useState<string | null>(
    null
  );
  const hasDayMovements = groupedDayMovements.length > 0;
  const contextEmphasis = hasDayMovements ? "secondary" : "primary";

  useEffect(() => {
    setExpandedDayCategoryKey(null);
    setExpandedUpcomingCategoryKey(null);
    setExpandedPastCategoryKey(null);
  }, [day.dateKey]);

  return (
    <div className="border-t border-border px-5 py-4">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {day.formattedLabel}
        </p>
        {onViewAllMovements ? (
          <button
            type="button"
            onClick={onViewAllMovements}
            className="text-xs font-semibold text-primary hover:underline"
          >
            {t("mobile.home.programmedViewAll")}
          </button>
        ) : null}
      </div>

      {hasDayMovements ? (
        groupedDayMovements.map((group, index) => (
          <DayCategoryGroupRow
            key={`day-category-${group.key}`}
            group={group}
            isExpanded={expandedDayCategoryKey === group.key}
            onToggle={() =>
              setExpandedDayCategoryKey((current) =>
                current === group.key ? null : group.key
              )
            }
            currencySymbol={currencySymbol}
            locale={locale}
            hasTopBorder={index > 0}
            emphasis="primary"
          />
        ))
      ) : onCreateMovement ? (
        <button
          type="button"
          onClick={onCreateMovement}
          className="flex w-full items-center justify-center rounded-lg border border-dashed border-border bg-muted/30 px-3 py-3 text-center shadow-sm transition-[background-color,box-shadow] hover:bg-muted/50 hover:shadow-md active:bg-muted/60 active:shadow-inner"
        >
          <span className="text-sm font-semibold text-primary text-center">
            {t("mobile.home.calendarCreateMovementCta")}
          </span>
        </button>
      ) : (
        <p className="py-2 text-sm text-muted-foreground">
          {t("mobile.home.calendarEmptyDay")}
        </p>
      )}

      <SectionTitle
        title={t("mobile.home.movementsUpcomingTitle")}
        className="mt-4"
      />
      {groupedUpcomingMovements.length > 0 ? (
        groupedUpcomingMovements.map((group, index) => (
          <DayCategoryGroupRow
            key={`upcoming-category-${group.key}`}
            group={group}
            isExpanded={expandedUpcomingCategoryKey === group.key}
            onToggle={() =>
              setExpandedUpcomingCategoryKey((current) =>
                current === group.key ? null : group.key
              )
            }
            currencySymbol={currencySymbol}
            locale={locale}
            hasTopBorder={index > 0}
            emphasis={contextEmphasis}
            showDateLabelInDetails
          />
        ))
      ) : (
        <p className="py-2 text-sm text-muted-foreground">
          {t("mobile.home.movementsUpcomingEmpty")}
        </p>
      )}

      <SectionTitle
        title={t("mobile.home.calendarPastMovementsTitle")}
        className="mt-4"
      />
      {groupedPastMovements.length > 0 ? (
        groupedPastMovements.map((group, index) => (
          <DayCategoryGroupRow
            key={`past-category-${group.key}`}
            group={group}
            isExpanded={expandedPastCategoryKey === group.key}
            onToggle={() =>
              setExpandedPastCategoryKey((current) =>
                current === group.key ? null : group.key
              )
            }
            currencySymbol={currencySymbol}
            locale={locale}
            hasTopBorder={index > 0}
            emphasis={contextEmphasis}
            showDateLabelInDetails
          />
        ))
      ) : (
        <p className="py-2 text-sm text-muted-foreground">
          {t("mobile.home.movementsRecentEmpty")}
        </p>
      )}
    </div>
  );
}

type DayCategoryGroupRowProps = {
  group: DayCategoryGroup;
  isExpanded: boolean;
  onToggle: () => void;
  currencySymbol: string;
  locale: string;
  hasTopBorder: boolean;
  emphasis: "primary" | "secondary";
  showDateLabelInDetails?: boolean;
};

function DayCategoryGroupRow({
  group,
  isExpanded,
  onToggle,
  currencySymbol,
  locale,
  hasTopBorder,
  emphasis,
  showDateLabelInDetails = false,
}: DayCategoryGroupRowProps) {
  const absNetMinor = getAbsMinor(group.netMinor);
  const { integer, decimals } = formatCurrencyParts(absNetMinor, currencySymbol, locale);
  const isIncome = group.netMinor > 0n;
  const isExpense = group.netMinor < 0n;
  const amountPrefix = group.netMinor > 0n ? "+" : group.netMinor < 0n ? "-" : "";
  const amountClass =
    isIncome
      ? "text-[var(--account-income)]"
      : isExpense
        ? "text-[var(--account-expense)]"
        : "text-muted-foreground";
  const iconWrapClass = isIncome
    ? "border-[var(--account-income-light)] bg-[var(--account-income-bg)]"
    : isExpense
      ? "border-[var(--account-expense-light)] bg-[var(--account-expense-bg)]"
      : "border-border/70 bg-muted/20";
  const iconTone = isIncome ? "positive" : isExpense ? "negative" : "muted";
  const rowInteractionClass = isIncome
    ? "hover:bg-[var(--account-income-bg)] active:bg-[var(--account-income-bg)]"
    : isExpense
      ? "hover:bg-[var(--account-expense-bg)] active:bg-[var(--account-expense-bg)]"
      : "hover:bg-muted/50 active:bg-muted/60";
  const isSecondary = emphasis === "secondary";

  return (
    <div
      className={`${hasTopBorder ? "border-t border-border/50 pt-2" : ""} ${
        isSecondary ? "opacity-70" : ""
      }`}
    >
      <button
        type="button"
        onClick={onToggle}
        className={`flex w-full items-center justify-between gap-2 rounded-md px-1 py-2 text-left transition-colors duration-150 ${rowInteractionClass}`}
      >
        <div className="flex min-w-0 flex-1 items-center gap-2.5">
          <span
            className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md border ${iconWrapClass}`}
          >
            <CategoryIcon iconId={group.categoryIconId ?? "Tag"} size={15} tone={iconTone} />
          </span>
          {group.contributorCount > 0 ? (
            <ContributorsPreview
              creators={group.contributorPreviews}
              totalContributors={group.contributorCount}
            />
          ) : null}
          <div className="flex min-w-0 flex-1 items-center justify-center gap-1.5">
            <p className="truncate text-center text-sm font-semibold text-foreground">
              {group.label}
            </p>
            <span className="shrink-0 text-xs font-semibold text-muted-foreground">
              x{group.movements.length}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <span className={`text-sm font-semibold ${amountClass}`}>
            {amountPrefix}
            {integer},{decimals}
          </span>
          <ChevronDown
            className={`h-4 w-4 text-muted-foreground transition-transform ${
              isExpanded ? "rotate-180" : "rotate-0"
            }`}
          />
        </div>
      </button>

      {isExpanded ? (
        <div className="rounded-lg border border-border/60 bg-muted/20 px-2.5 py-1">
          {group.movements.map((movement, index) => (
            <MovementRow
              key={`detail-${group.key}-${movement.id}`}
              movement={movement}
              currencySymbol={currencySymbol}
              locale={locale}
              emphasis={emphasis}
              hasTopBorder={index > 0}
              showDateLabel={showDateLabelInDetails}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

type ContributorsPreviewProps = {
  creators: MovementCreator[];
  totalContributors: number;
};

function ContributorsPreview({ creators, totalContributors }: ContributorsPreviewProps) {
  const extra = Math.max(totalContributors - creators.length, 0);

  return (
    <div className="flex items-center">
      <div className="flex items-center">
        {creators.map((creator, index) => {
          const key =
            creator.userId?.trim() ||
            creator.email?.trim() ||
            creator.label?.trim() ||
            `${index}`;
          return (
            <div key={`${key}-${index}`} className={index > 0 ? "-ml-1.5" : ""}>
              <UserAvatar
                email={creator.email ?? null}
                displayName={creator.displayName ?? null}
                userId={creator.userId ?? null}
                avatarPath={creator.avatarPath ?? null}
                fallbackText={creator.fallbackText ?? null}
                fallbackBgToken={creator.fallbackBgToken ?? null}
                avatarColor={creator.avatarColor ?? null}
                label={creator.label}
                size={20}
                className="border border-card"
              />
            </div>
          );
        })}
      </div>
      {extra > 0 ? (
        <span className="ml-1 text-[10px] font-semibold text-muted-foreground">+{extra}</span>
      ) : null}
    </div>
  );
}

type SectionTitleProps = {
  title: string;
  className?: string;
};

function SectionTitle({ title, className }: SectionTitleProps) {
  return (
    <p
      className={`mb-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground ${
        className ?? ""
      }`}
    >
      {title}
    </p>
  );
}

type MovementRowProps = {
  movement: DayMovement | ContextMovement;
  currencySymbol: string;
  locale: string;
  emphasis: "primary" | "secondary";
  hasTopBorder?: boolean;
  showDateLabel?: boolean;
};

function MovementRow({
  movement,
  currencySymbol,
  locale,
  emphasis,
  hasTopBorder = true,
  showDateLabel = false,
}: MovementRowProps) {
  const isIncome = movement.type === "income";
  const isSecondary = emphasis === "secondary";
  const avatarSize = isSecondary ? 32 : 36;
  const { integer, decimals } = formatCurrencyParts(
    movement.amountMinor,
    currencySymbol,
    locale
  );
  const dateLabel =
    showDateLabel && "dateLabel" in movement ? movement.dateLabel : null;
  const metaParts = [dateLabel, movement.category]
    .filter((part): part is string => Boolean(part && part.trim()));

  return (
    <div
      className={`flex items-center justify-between py-2.5 ${
        hasTopBorder ? "border-t border-border/50" : ""
      } ${isSecondary ? "opacity-70" : ""}`}
    >
      <div className="flex min-w-0 items-center gap-3">
        <UserAvatar
          email={movement.createdBy?.email ?? null}
          displayName={movement.createdBy?.displayName ?? null}
          userId={movement.createdBy?.userId ?? null}
          avatarPath={movement.createdBy?.avatarPath ?? null}
          fallbackText={movement.createdBy?.fallbackText ?? null}
          fallbackBgToken={movement.createdBy?.fallbackBgToken ?? null}
          avatarColor={movement.createdBy?.avatarColor ?? null}
          label={movement.createdBy?.label}
          size={avatarSize}
          className="shrink-0"
        />
        <div className="min-w-0">
          <p
            className={`truncate ${
              isSecondary
                ? "text-sm font-medium text-muted-foreground"
                : "text-sm font-semibold text-foreground"
            }`}
          >
            {movement.name}
            {movement.badge ? (
              <span
                className={`ml-2 rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                  isSecondary
                    ? "bg-muted text-muted-foreground"
                    : "bg-primary/10 text-primary"
                }`}
              >
                {movement.badge}
              </span>
            ) : null}
          </p>
          {metaParts.length > 0 ? (
            <p className="truncate text-xs text-muted-foreground">
              {metaParts.join(" · ")}
            </p>
          ) : null}
        </div>
      </div>
      <span
        className={`shrink-0 text-sm font-semibold ${
          isIncome ? "text-[var(--account-income)]" : "text-[var(--account-expense)]"
        }`}
      >
        {isIncome ? "+" : "-"}
        {integer},{decimals}
      </span>
    </div>
  );
}
