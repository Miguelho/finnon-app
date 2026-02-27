import { useEffect, useMemo, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { ArrowUp, ArrowDown, Equal, ChevronDown } from "lucide-react-native";
import {
  themeTokens,
  type AvatarColorToken,
  type UserAvatarColorId,
} from "@poleursus/shared";
import { formatCurrencyParts } from "./utils";
import { useCopy, t } from "../../lib/i18n";
import { useUserTheme } from "../../contexts/UserThemeContext";
import { UserAvatar } from "../UserAvatar";
import { CategoryIcon } from "../CategoryIcon";

const tokens = themeTokens.light;
const colors = tokens.colors;

function withAlpha(hexColor: string, alpha: number): string {
  const normalized = hexColor.replace("#", "");
  const expanded =
    normalized.length === 3
      ? normalized
          .split("")
          .map((chunk) => chunk + chunk)
          .join("")
      : normalized;

  if (expanded.length !== 6) return hexColor;

  const red = parseInt(expanded.slice(0, 2), 16);
  const green = parseInt(expanded.slice(2, 4), 16);
  const blue = parseInt(expanded.slice(4, 6), 16);

  if ([red, green, blue].some((value) => Number.isNaN(value))) {
    return hexColor;
  }

  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

export type CalendarDot = {
  type: "income" | "expense";
};

export type WeekDayData = {
  date: string;
  dayLabel: string;
  dayNumber: number;
  isToday: boolean;
  dots?: CalendarDot[];
};

export type MonthDayData = {
  date: string;
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
  view: "week" | "month";
  onViewChange: (view: "week" | "month") => void;
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
}: CalendarProps) {
  const { dictionary, locale } = useCopy();
  const {
    tokens: userTokens,
    primaryActionColor,
    primaryActionTextColor,
    resolvedMode,
  } = useUserTheme();
  const modeColors = themeTokens[resolvedMode].colors;
  const incomeColor = modeColors.state.positive;
  const expenseColor = modeColors.state.negative;
  const whiteColor = tokens.colors.bg.surface;
  const isWeek = view === "week";
  const selectedKey = selectedDay?.dateKey ?? "";
  const data = isWeek ? weekData : monthData;
  const totals = isWeek ? weekData : monthData;
  const monthLabels =
    locale === "en"
      ? ["M", "T", "W", "T", "F", "S", "S"]
      : ["L", "M", "X", "J", "V", "S", "D"];

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: userTokens.surface, borderColor: userTokens.border },
      ]}
    >
      <View style={styles.headerRow}>
        <Text style={[styles.title, { color: userTokens.textPrimary }]}>
          {t(dictionary, "mobile.home.calendarTitle")}
        </Text>
      </View>

      <View style={styles.toggleRow}>
        <TouchableOpacity
          style={[styles.toggleButton, isWeek && { backgroundColor: primaryActionColor }]}
          onPress={() => onViewChange("week")}
        >
          <Text
            style={[
              styles.toggleText,
              { color: userTokens.textSecondary },
              isWeek && { color: primaryActionTextColor },
            ]}
          >
            {t(dictionary, "mobile.home.calendarWeek")}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.toggleButton, !isWeek && { backgroundColor: primaryActionColor }]}
          onPress={() => onViewChange("month")}
        >
          <Text
            style={[
              styles.toggleText,
              { color: userTokens.textSecondary },
              !isWeek && { color: primaryActionTextColor },
            ]}
          >
            {t(dictionary, "mobile.home.calendarMonth")}
          </Text>
        </TouchableOpacity>

        <View style={styles.navRow}>
          <TouchableOpacity
            style={[styles.navButton, { borderColor: userTokens.border }]}
            onPress={onPrevPeriod}
          >
            <Text style={[styles.navButtonText, { color: userTokens.textSecondary }]}>
              ‹
            </Text>
          </TouchableOpacity>
          <Text
            style={[styles.navLabel, { color: userTokens.textSecondary }]}
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            {data?.period}
          </Text>
          <TouchableOpacity
            style={[styles.navButton, { borderColor: userTokens.border }]}
            onPress={onNextPeriod}
          >
            <Text style={[styles.navButtonText, { color: userTokens.textSecondary }]}>
              ›
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {isWeek && (
        <>
          <View style={styles.weekGrid}>
            {weekData.days.map((day) => {
              const isSelected = day.date === selectedKey;
              const dayDotTypes = getDotTypes(day.dots);
              return (
                <TouchableOpacity
                  key={day.date}
                  style={[
                    styles.dayCell,
                    day.isToday && {
                      borderWidth: 1,
                      borderColor: withAlpha(primaryActionColor, 0.45),
                    },
                    isSelected &&
                      !day.isToday && {
                        borderWidth: 1,
                        borderColor: withAlpha(primaryActionColor, 0.35),
                      },
                  ]}
                  onPress={() => onSelectDay(day.date)}
                >
                  <Text
                    style={[
                      styles.dayLabel,
                      { color: userTokens.textSecondary },
                      isSelected && !day.isToday && { color: primaryActionColor },
                      day.isToday && { color: primaryActionColor, opacity: 0.8 },
                    ]}
                  >
                    {day.dayLabel}
                  </Text>
                  <Text
                    style={[
                      styles.dayNumber,
                      { color: userTokens.textPrimary },
                      isSelected && !day.isToday && { color: primaryActionColor },
                      day.isToday && { color: primaryActionColor },
                    ]}
                  >
                    {day.dayNumber}
                  </Text>
                  <View style={styles.dotRow}>
                    {dayDotTypes.map((dotType) => (
                      <View
                        key={`${day.date}-${dotType}`}
                        style={[
                          styles.dot,
                          {
                            backgroundColor:
                              dotType === "income" ? incomeColor : expenseColor,
                            marginRight: 0,
                          },
                        ]}
                      />
                    ))}
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>

        </>
      )}

      {!isWeek && (
        <View style={styles.monthGrid}>
          {monthLabels.map((label, index) => (
            <Text
              key={`${label}-${index}`}
              style={[styles.monthLabel, { color: userTokens.textSecondary }]}
            >
              {label}
            </Text>
          ))}
          {monthData.days.map((day, index) => {
            const isSelected = day.date === selectedKey;
            const dayDotTypes = getDotTypes(day.dots);
            return (
              <TouchableOpacity
                key={`${day.date}-${index}`}
                style={[
                  styles.monthCell,
                  day.isOtherMonth && styles.monthCellMuted,
                  day.isToday && {
                    borderWidth: 1,
                    borderColor: withAlpha(primaryActionColor, 0.45),
                  },
                  isSelected &&
                    !day.isToday && {
                      borderWidth: 1,
                      borderColor: withAlpha(primaryActionColor, 0.35),
                    },
                ]}
                onPress={() => !day.isOtherMonth && onSelectDay(day.date)}
              >
                <Text
                  style={[
                    styles.monthNumber,
                    { color: userTokens.textPrimary },
                    isSelected && !day.isToday && { color: primaryActionColor },
                    day.isToday && { color: primaryActionColor },
                  ]}
                >
                  {day.dayNumber}
                </Text>
                <View style={styles.dotRowSmall}>
                  {dayDotTypes.map((dotType) => (
                    <View
                      key={`${day.date}-${dotType}`}
                      style={[
                        styles.dotSmall,
                        {
                          backgroundColor:
                            dotType === "income" ? incomeColor : expenseColor,
                          marginRight: 0,
                        },
                      ]}
                    />
                  ))}
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      <View style={styles.totalsRow}>
        <View
          style={[
            styles.totalChip,
            {
              borderColor: withAlpha(incomeColor, 0.32),
              backgroundColor: withAlpha(incomeColor, 0.14),
            },
          ]}
        >
          <ArrowUp size={13} color={incomeColor} strokeWidth={2.3} />
          <Text style={[styles.totalValue, { color: incomeColor }]}>+{totals.netIncome}</Text>
        </View>
        <View
          style={[
            styles.totalChip,
            {
              borderColor: withAlpha(expenseColor, 0.32),
              backgroundColor: withAlpha(expenseColor, 0.14),
            },
          ]}
        >
          <ArrowDown size={13} color={expenseColor} strokeWidth={2.3} />
          <Text style={[styles.totalValue, { color: expenseColor }]}>-{totals.netExpense}</Text>
        </View>
        <View
          style={[
            styles.totalChip,
            {
              borderColor: withAlpha(whiteColor, 0.4),
              backgroundColor: withAlpha(whiteColor, 0.2),
            },
          ]}
        >
          <Equal size={13} color={whiteColor} strokeWidth={2.3} />
          <Text style={[styles.totalValue, { color: userTokens.textPrimary }]}>{totals.net}</Text>
        </View>
      </View>

      {selectedDay ? (
        <ContextMovementsPanel
          day={selectedDay}
          upcoming={upcomingMovements}
          past={pastMovements}
          currencySymbol={currencySymbol}
          onViewAllMovements={onViewAllMovements}
          onCreateMovement={onCreateMovement}
        />
      ) : null}
    </View>
  );
}

type ContextMovementsPanelProps = {
  day: DayDetailData;
  upcoming: ContextMovement[];
  past: ContextMovement[];
  currencySymbol: string;
  onViewAllMovements?: () => void;
  onCreateMovement?: () => void;
};

function ContextMovementsPanel({
  day,
  upcoming,
  past,
  currencySymbol,
  onViewAllMovements,
  onCreateMovement,
}: ContextMovementsPanelProps) {
  const { dictionary } = useCopy();
  const { tokens: userTokens, primaryActionColor } = useUserTheme();
  const noCategoryLabel = t(dictionary, "common.noneOption");
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
    <View style={[styles.dayDetail, { borderTopColor: userTokens.border }]}>
      <View style={styles.dayHeader}>
        <Text style={[styles.dayDetailLabel, { color: userTokens.textSecondary }]}>
          {day.formattedLabel}
        </Text>
        {onViewAllMovements ? (
          <TouchableOpacity onPress={onViewAllMovements}>
            <Text style={[styles.viewAllLink, { color: primaryActionColor }]}>
              {t(dictionary, "mobile.home.programmedViewAll")}
            </Text>
          </TouchableOpacity>
        ) : null}
      </View>

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
            hasTopBorder={index > 0}
            userBorder={userTokens.border}
            userTextPrimary={userTokens.textPrimary}
            userTextSecondary={userTokens.textSecondary}
            primaryActionColor={primaryActionColor}
            emphasis="primary"
          />
        ))
      ) : onCreateMovement ? (
        <TouchableOpacity
          style={[
            styles.emptyCta,
            {
              borderColor: userTokens.border,
              backgroundColor: userTokens.surfaceAlt,
            },
          ]}
          onPress={onCreateMovement}
          activeOpacity={0.82}
        >
          <View
            style={[
              styles.emptySmiley,
              {
                borderColor: userTokens.border,
                backgroundColor: userTokens.surface,
              },
            ]}
          >
            <Text style={[styles.emptySmileyText, { color: userTokens.textSecondary }]}>
              :(
            </Text>
          </View>
          <Text style={[styles.emptyCtaText, { color: primaryActionColor }]}>
            {t(dictionary, "mobile.home.calendarCreateMovementCta")}
          </Text>
        </TouchableOpacity>
      ) : (
        <Text style={[styles.dayDetailEmpty, { color: userTokens.textSecondary }]}>
          {t(dictionary, "mobile.home.calendarEmptyDay")}
        </Text>
      )}

      <SectionTitle
        title={t(dictionary, "mobile.home.movementsUpcomingTitle")}
        color={userTokens.textSecondary}
        withTopSpacing
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
            hasTopBorder={index > 0}
            userBorder={userTokens.border}
            userTextPrimary={userTokens.textPrimary}
            userTextSecondary={userTokens.textSecondary}
            primaryActionColor={primaryActionColor}
            emphasis={contextEmphasis}
            showDateLabelInDetails
          />
        ))
      ) : (
        <Text style={[styles.dayDetailEmpty, { color: userTokens.textSecondary }]}>
          {t(dictionary, "mobile.home.movementsUpcomingEmpty")}
        </Text>
      )}

      <SectionTitle
        title={t(dictionary, "mobile.home.calendarPastMovementsTitle")}
        color={userTokens.textSecondary}
        withTopSpacing
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
            hasTopBorder={index > 0}
            userBorder={userTokens.border}
            userTextPrimary={userTokens.textPrimary}
            userTextSecondary={userTokens.textSecondary}
            primaryActionColor={primaryActionColor}
            emphasis={contextEmphasis}
            showDateLabelInDetails
          />
        ))
      ) : (
        <Text style={[styles.dayDetailEmpty, { color: userTokens.textSecondary }]}>
          {t(dictionary, "mobile.home.movementsRecentEmpty")}
        </Text>
      )}
    </View>
  );
}

type DayCategoryGroupRowProps = {
  group: DayCategoryGroup;
  isExpanded: boolean;
  onToggle: () => void;
  currencySymbol: string;
  hasTopBorder: boolean;
  userBorder: string;
  userTextPrimary: string;
  userTextSecondary: string;
  primaryActionColor: string;
  emphasis: "primary" | "secondary";
  showDateLabelInDetails?: boolean;
};

function DayCategoryGroupRow({
  group,
  isExpanded,
  onToggle,
  currencySymbol,
  hasTopBorder,
  userBorder,
  userTextPrimary,
  userTextSecondary,
  primaryActionColor,
  emphasis,
  showDateLabelInDetails = false,
}: DayCategoryGroupRowProps) {
  const absNetMinor = getAbsMinor(group.netMinor);
  const { integer, decimals } = formatCurrencyParts(absNetMinor, currencySymbol);
  const amountPrefix = group.netMinor > 0n ? "+" : group.netMinor < 0n ? "-" : "";
  const isSecondary = emphasis === "secondary";
  const amountStyle =
    group.netMinor > 0n
      ? styles.categoryGroupAmountPositive
      : group.netMinor < 0n
        ? styles.categoryGroupAmountNegative
        : styles.categoryGroupAmountNeutral;

  return (
    <View
      style={[
        hasTopBorder && styles.categoryGroupTopBorder,
        hasTopBorder && { borderTopColor: userBorder },
        isSecondary && styles.rowSecondary,
      ]}
    >
      <TouchableOpacity style={styles.categoryGroupHeader} onPress={onToggle} activeOpacity={0.82}>
        <View style={styles.categoryGroupLeading}>
          <View
            style={[
              styles.categoryGroupIconWrap,
              { borderColor: userBorder, backgroundColor: withAlpha(userTextSecondary, 0.08) },
            ]}
          >
            <CategoryIcon iconKey={group.categoryIconId ?? "Tag"} size={19} tone="muted" />
          </View>
          <View style={styles.categoryGroupMain}>
            <Text
              style={[styles.categoryGroupTitle, { color: userTextPrimary }]}
              numberOfLines={1}
            >
              {group.label}
              <Text style={[styles.categoryGroupCount, { color: userTextSecondary }]}>
                {" "}
                x{group.movements.length}
              </Text>
            </Text>
            {group.contributorCount > 0 ? (
              <ContributorsPreview
                creators={group.contributorPreviews}
                totalContributors={group.contributorCount}
                userBorder={userBorder}
              />
            ) : null}
          </View>
        </View>
        <View style={styles.categoryGroupActions}>
          <Text style={[styles.categoryGroupAmount, amountStyle]}>
            {amountPrefix}
            {integer},{decimals}
          </Text>
          <ChevronDown
            size={14}
            color={userTextSecondary}
            style={[
              styles.categoryGroupChevron,
              isExpanded && styles.categoryGroupChevronExpanded,
            ]}
          />
        </View>
      </TouchableOpacity>

      {isExpanded ? (
        <View style={[styles.categoryGroupDetails, { borderColor: userBorder }]}>
          {group.movements.map((movement, index) => (
            <MovementRow
              key={`detail-${group.key}-${movement.id}`}
              movement={movement}
              currencySymbol={currencySymbol}
              hasBorder={index > 0}
              emphasis={emphasis}
              showDateLabel={showDateLabelInDetails}
              userBorder={userBorder}
              userTextPrimary={userTextPrimary}
              userTextSecondary={userTextSecondary}
              primaryActionColor={primaryActionColor}
            />
          ))}
        </View>
      ) : null}
    </View>
  );
}

type ContributorsPreviewProps = {
  creators: MovementCreator[];
  totalContributors: number;
  userBorder: string;
};

function ContributorsPreview({
  creators,
  totalContributors,
  userBorder,
}: ContributorsPreviewProps) {
  const extra = Math.max(totalContributors - creators.length, 0);

  return (
    <View style={styles.categoryContributorsWrap}>
      <View style={styles.categoryContributorsRow}>
        {creators.map((creator, index) => {
          const key =
            creator.userId?.trim() ||
            creator.email?.trim() ||
            creator.label?.trim() ||
            `${index}`;
          return (
            <View
              key={`${key}-${index}`}
              style={[
                styles.categoryContributorItem,
                index > 0 && styles.categoryContributorItemOverlap,
                { borderColor: userBorder },
              ]}
            >
              <UserAvatar
                email={creator.email ?? null}
                displayName={creator.displayName ?? null}
                userId={creator.userId ?? null}
                avatarPath={creator.avatarPath ?? null}
                fallbackText={creator.fallbackText ?? null}
                fallbackBgToken={creator.fallbackBgToken ?? null}
                avatarColor={creator.avatarColor ?? null}
                label={creator.label}
                size={18}
              />
            </View>
          );
        })}
      </View>
      {extra > 0 ? (
        <Text style={styles.categoryContributorsOverflow}>+{extra}</Text>
      ) : null}
    </View>
  );
}

type SectionTitleProps = {
  title: string;
  color: string;
  withTopSpacing?: boolean;
};

function SectionTitle({ title, color, withTopSpacing = false }: SectionTitleProps) {
  return (
    <Text
      style={[
        styles.sectionTitle,
        withTopSpacing && styles.sectionTitleTopSpacing,
        { color },
      ]}
    >
      {title}
    </Text>
  );
}

type MovementRowProps = {
  movement: DayMovement | ContextMovement;
  currencySymbol: string;
  hasBorder: boolean;
  emphasis: "primary" | "secondary";
  showDateLabel?: boolean;
  userBorder: string;
  userTextPrimary: string;
  userTextSecondary: string;
  primaryActionColor: string;
};

function MovementRow({
  movement,
  currencySymbol,
  hasBorder,
  emphasis,
  showDateLabel = false,
  userBorder,
  userTextPrimary,
  userTextSecondary,
  primaryActionColor,
}: MovementRowProps) {
  const isIncome = movement.type === "income";
  const isSecondary = emphasis === "secondary";
  const avatarSize = isSecondary ? 32 : 36;
  const { integer, decimals } = formatCurrencyParts(movement.amountMinor, currencySymbol);
  const dateLabel =
    showDateLabel && "dateLabel" in movement ? movement.dateLabel : null;
  const metaParts = [dateLabel, movement.category]
    .filter((part): part is string => Boolean(part && part.trim()));

  return (
    <View
      style={[
        styles.movementRow,
        hasBorder && styles.rowBorder,
        hasBorder && { borderTopColor: userBorder },
        isSecondary && styles.rowSecondary,
      ]}
    >
      <View style={styles.movementInfo}>
        <View style={styles.movementAvatar}>
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
          />
        </View>

        <View style={styles.movementText}>
          <Text
            style={[
              styles.movementTitle,
              isSecondary ? { color: userTextSecondary } : { color: userTextPrimary },
            ]}
            numberOfLines={1}
          >
            {movement.name}
            {movement.badge ? (
              <Text
                style={[
                  styles.movementBadge,
                  {
                    color: isSecondary ? userTextSecondary : primaryActionColor,
                    backgroundColor: isSecondary ? withAlpha(userTextSecondary, 0.12) : "transparent",
                  },
                ]}
              >
                {" "}
                {movement.badge}
              </Text>
            ) : null}
          </Text>
          {metaParts.length > 0 ? (
            <Text style={[styles.movementCategory, { color: userTextSecondary }]} numberOfLines={1}>
              {metaParts.join(" · ")}
            </Text>
          ) : null}
        </View>
      </View>

      <Text
        style={[
          styles.movementAmount,
          isIncome ? styles.amountPositive : styles.amountNegative,
          isSecondary && styles.amountSecondary,
        ]}
      >
        {isIncome ? "+" : "-"}
        {integer},{decimals}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderColor: colors.state.neutral,
    borderRadius: tokens.radii.lg,
    backgroundColor: colors.bg.surface,
    overflow: "hidden",
  },
  headerRow: {
    paddingHorizontal: tokens.spacing.lg,
    paddingTop: tokens.spacing.md,
  },
  title: {
    fontSize: 15,
    fontWeight: tokens.typography.weight.semibold,
    color: colors.text.primary,
    fontFamily: "DMSans-SemiBold",
  },
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: tokens.spacing.lg,
    marginTop: tokens.spacing.sm,
  },
  toggleButton: {
    borderRadius: tokens.radii.pill,
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: 4,
    marginRight: tokens.spacing.xs,
  },
  toggleText: {
    fontSize: 13,
    fontWeight: tokens.typography.weight.medium,
    color: colors.text.muted,
    fontFamily: "DMSans-Medium",
  },
  navRow: {
    marginLeft: "auto",
    flexDirection: "row",
    alignItems: "center",
    width: 182,
    justifyContent: "space-between",
  },
  navButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.state.neutral,
    alignItems: "center",
    justifyContent: "center",
  },
  navButtonText: {
    fontSize: 16,
    color: colors.text.secondary,
    fontFamily: "DMSans-Medium",
  },
  navLabel: {
    width: 118,
    textAlign: "center",
    fontSize: 13,
    fontWeight: tokens.typography.weight.medium,
    color: colors.text.secondary,
    fontFamily: "DMSans-Medium",
  },
  weekGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: tokens.spacing.lg,
    paddingVertical: tokens.spacing.md,
  },
  dayCell: {
    width: "14.285%",
    alignItems: "center",
    paddingVertical: tokens.spacing.sm,
    borderRadius: tokens.radii.md,
  },
  dayLabel: {
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 0.6,
    color: colors.text.muted,
    fontFamily: "DMSans-Medium",
  },
  dayNumber: {
    fontSize: 18,
    fontWeight: tokens.typography.weight.semibold,
    color: colors.text.primary,
    fontFamily: "DMSans-SemiBold",
  },
  dotRow: {
    flexDirection: "row",
    minHeight: 6,
    marginTop: 6,
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 999,
    marginRight: 3,
  },
  totalsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: tokens.spacing.xs,
    paddingHorizontal: tokens.spacing.lg,
    paddingTop: 4,
    paddingBottom: tokens.spacing.sm,
  },
  totalChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderRadius: tokens.radii.pill,
    paddingHorizontal: tokens.spacing.sm,
    paddingVertical: 5,
  },
  totalValue: {
    fontSize: tokens.typography.size.xs,
    fontWeight: tokens.typography.weight.semibold,
    fontFamily: "JetBrainsMono-Medium",
  },
  amountPositive: {
    color: colors.state.positive,
  },
  amountNegative: {
    color: colors.state.negative,
  },
  amountNet: {
    color: colors.text.primary,
  },
  monthGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: tokens.spacing.lg,
    paddingVertical: tokens.spacing.sm,
  },
  monthLabel: {
    width: "14.285%",
    textAlign: "center",
    fontSize: 10,
    textTransform: "uppercase",
    letterSpacing: 0.6,
    color: colors.text.muted,
    fontFamily: "DMSans-Medium",
    paddingVertical: 4,
  },
  monthCell: {
    width: "14.285%",
    alignItems: "center",
    paddingVertical: 6,
    borderRadius: tokens.radii.sm,
  },
  monthCellMuted: {
    opacity: 0.3,
  },
  monthNumber: {
    fontSize: tokens.typography.size.sm,
    fontWeight: tokens.typography.weight.medium,
    color: colors.text.primary,
    fontFamily: "DMSans-Medium",
  },
  dotRowSmall: {
    flexDirection: "row",
    minHeight: 5,
    marginTop: 2,
  },
  dotSmall: {
    width: 4,
    height: 4,
    borderRadius: 999,
    marginRight: 2,
  },
  dayDetail: {
    borderTopWidth: 1,
    borderTopColor: colors.state.neutral,
    paddingHorizontal: tokens.spacing.lg,
    paddingVertical: tokens.spacing.md,
  },
  dayHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: tokens.spacing.xs,
  },
  dayDetailLabel: {
    fontSize: tokens.typography.size.xs,
    fontWeight: tokens.typography.weight.medium,
    textTransform: "uppercase",
    letterSpacing: 0.6,
    color: colors.text.muted,
    fontFamily: "DMSans-Medium",
  },
  sectionTitle: {
    marginTop: tokens.spacing.xs,
    marginBottom: 2,
    fontSize: 10,
    fontWeight: tokens.typography.weight.semibold,
    textTransform: "uppercase",
    letterSpacing: 1,
    fontFamily: "DMSans-SemiBold",
  },
  sectionTitleTopSpacing: {
    marginTop: tokens.spacing.md,
  },
  categoryGroupTopBorder: {
    borderTopWidth: 1,
    marginTop: 2,
    paddingTop: tokens.spacing.xs,
  },
  categoryGroupHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderRadius: tokens.radii.sm,
    paddingHorizontal: 2,
    paddingVertical: tokens.spacing.xs,
  },
  categoryGroupLeading: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    marginRight: tokens.spacing.sm,
  },
  categoryGroupIconWrap: {
    width: 36,
    height: 36,
    borderRadius: tokens.radii.md,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    marginRight: tokens.spacing.xs,
  },
  categoryGroupMain: {
    flex: 1,
  },
  categoryGroupTitle: {
    flex: 1,
    fontSize: tokens.typography.size.sm,
    fontFamily: "DMSans-SemiBold",
  },
  categoryGroupCount: {
    fontSize: 11,
    fontFamily: "DMSans-SemiBold",
  },
  categoryGroupActions: {
    flexDirection: "row",
    alignItems: "center",
  },
  categoryContributorsWrap: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 3,
  },
  categoryContributorsRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  categoryContributorItem: {
    borderWidth: 1,
    borderRadius: 999,
  },
  categoryContributorItemOverlap: {
    marginLeft: -6,
  },
  categoryContributorsOverflow: {
    marginLeft: 3,
    fontSize: 10,
    fontFamily: "DMSans-SemiBold",
    color: colors.text.secondary,
  },
  categoryGroupAmount: {
    marginRight: 4,
    fontSize: tokens.typography.size.sm,
    fontFamily: "JetBrainsMono-Medium",
  },
  categoryGroupAmountPositive: {
    color: colors.state.positive,
  },
  categoryGroupAmountNegative: {
    color: colors.state.negative,
  },
  categoryGroupAmountNeutral: {
    color: colors.text.secondary,
  },
  categoryGroupChevron: {
    transform: [{ rotate: "0deg" }],
  },
  categoryGroupChevronExpanded: {
    transform: [{ rotate: "180deg" }],
  },
  categoryGroupDetails: {
    borderWidth: 1,
    borderRadius: tokens.radii.md,
    backgroundColor: withAlpha(colors.bg.secondary, 0.5),
    paddingHorizontal: tokens.spacing.sm,
    paddingVertical: 2,
    marginTop: 2,
  },
  dayDetailEmpty: {
    paddingVertical: tokens.spacing.sm,
    fontSize: tokens.typography.size.sm,
    color: colors.text.secondary,
    fontFamily: "DMSans",
  },
  emptyCta: {
    flexDirection: "row",
    alignItems: "center",
    gap: tokens.spacing.sm,
    borderWidth: 1,
    borderStyle: "dashed",
    borderRadius: tokens.radii.md,
    paddingHorizontal: tokens.spacing.sm,
    paddingVertical: tokens.spacing.sm,
  },
  emptySmiley: {
    width: 34,
    height: 34,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  emptySmileyText: {
    fontSize: 15,
    fontFamily: "JetBrainsMono-Medium",
  },
  emptyCtaText: {
    fontSize: tokens.typography.size.sm,
    fontFamily: "DMSans-SemiBold",
  },
  viewAllLink: {
    fontSize: tokens.typography.size.xs,
    fontWeight: tokens.typography.weight.semibold,
    fontFamily: "DMSans-SemiBold",
  },
  movementRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: tokens.spacing.sm,
  },
  rowBorder: {
    borderTopWidth: 1,
  },
  rowSecondary: {
    opacity: 0.7,
  },
  movementInfo: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  movementAvatar: {
    marginRight: tokens.spacing.sm,
  },
  movementText: {
    flex: 1,
  },
  movementTitle: {
    fontSize: tokens.typography.size.sm,
    fontWeight: tokens.typography.weight.medium,
    color: colors.text.primary,
    fontFamily: "DMSans-Medium",
  },
  movementBadge: {
    fontSize: 10,
    paddingHorizontal: 4,
  },
  movementCategory: {
    fontSize: tokens.typography.size.xs,
    color: colors.text.secondary,
    fontFamily: "DMSans",
  },
  movementAmount: {
    fontSize: tokens.typography.size.sm,
    fontWeight: tokens.typography.weight.medium,
    fontFamily: "JetBrainsMono-Medium",
    marginLeft: tokens.spacing.sm,
  },
  amountSecondary: {
    opacity: 0.8,
  },
});
