import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { themeTokens } from "@poleursus/shared";
import { formatCurrencyParts } from "./utils";
import { useCopy, t } from "../../lib/i18n";
import { useUserTheme } from "../../contexts/UserThemeContext";

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
};

export type DayMovement = {
  id: string;
  name: string;
  amountMinor: bigint;
  type: "income" | "expense";
  category?: string | null;
  badge?: string | null;
};

export type DayDetailData = {
  dateKey: string;
  formattedLabel: string;
  movements: DayMovement[];
};

export type NextProgrammedItem = {
  id: string;
  name: string;
  amountMinor: bigint;
  type: "income" | "expense";
  dateLabel: string;
  category?: string | null;
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
  nextProgrammed?: NextProgrammedItem | null;
  onViewAllProgrammed?: () => void;
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
  nextProgrammed,
  onViewAllProgrammed,
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
  const incomeIconBg = withAlpha(incomeColor, resolvedMode === "dark" ? 0.28 : 0.15);
  const expenseIconBg = withAlpha(expenseColor, resolvedMode === "dark" ? 0.28 : 0.15);
  const incomeIconBorder = withAlpha(incomeColor, resolvedMode === "dark" ? 0.5 : 0.32);
  const expenseIconBorder = withAlpha(expenseColor, resolvedMode === "dark" ? 0.5 : 0.32);
  const isWeek = view === "week";
  const selectedKey = selectedDay?.dateKey ?? "";
  const data = isWeek ? weekData : monthData;
  const monthLabels = locale === "en" ? ["M", "T", "W", "T", "F", "S", "S"] : ["L", "M", "X", "J", "V", "S", "D"];

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
          style={[
            styles.toggleButton,
            isWeek && { backgroundColor: primaryActionColor },
          ]}
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
          style={[
            styles.toggleButton,
            !isWeek && { backgroundColor: primaryActionColor },
          ]}
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
          <Text style={[styles.navLabel, { color: userTokens.textSecondary }]}>
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
              return (
                <TouchableOpacity
                  key={day.date}
                  style={[
                    styles.dayCell,
                    day.isToday && { backgroundColor: primaryActionColor },
                    isSelected &&
                      !day.isToday && {
                        backgroundColor: withAlpha(primaryActionColor, 0.12),
                        borderWidth: 1,
                        borderColor: withAlpha(primaryActionColor, 0.3),
                      },
                  ]}
                  onPress={() => onSelectDay(day.date)}
                >
                  <Text
                    style={[
                      styles.dayLabel,
                      { color: userTokens.textSecondary },
                      isSelected && !day.isToday && { color: primaryActionColor },
                      day.isToday && {
                        color: primaryActionTextColor,
                        opacity: 0.7,
                      },
                    ]}
                  >
                    {day.dayLabel}
                  </Text>
                  <Text
                    style={[
                      styles.dayNumber,
                      { color: userTokens.textPrimary },
                      isSelected && !day.isToday && { color: primaryActionColor },
                      day.isToday && { color: primaryActionTextColor },
                    ]}
                  >
                    {day.dayNumber}
                  </Text>
                  <View style={styles.dotRow}>
                    {day.dots && day.dots.length > 0 ? (
                      <View
                        style={[
                          styles.dot,
                          {
                            backgroundColor: isSelected
                              ? primaryActionColor
                              : modeColors.state.negative,
                            marginRight: 0,
                          },
                        ]}
                      />
                    ) : null}
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>

          <View style={styles.weekSummary}>
            <Text style={[styles.weekSummaryText, { color: userTokens.textSecondary }]}>
              {t(dictionary, "mobile.home.calendarIncome")}{" "}
              <Text style={[styles.weekSummaryValue, styles.amountPositive]}>
                +{weekData.netIncome}
              </Text>
            </Text>
            <Text style={[styles.weekSummaryText, { color: userTokens.textSecondary }]}>
              {t(dictionary, "mobile.home.calendarExpenses")}{" "}
              <Text style={[styles.weekSummaryValue, styles.amountNegative]}>
                -{weekData.netExpense}
              </Text>
            </Text>
            <Text style={[styles.weekSummaryText, { color: userTokens.textSecondary }]}>
              {t(dictionary, "mobile.home.calendarNet")}{" "}
              <Text
                style={[
                  styles.weekSummaryValue,
                  styles.amountNet,
                  { color: userTokens.textPrimary },
                ]}
              >
                {weekData.net}
              </Text>
            </Text>
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
            return (
              <TouchableOpacity
                key={`${day.date}-${index}`}
                style={[
                  styles.monthCell,
                  day.isOtherMonth && styles.monthCellMuted,
                  day.isToday && { backgroundColor: primaryActionColor },
                  isSelected &&
                    !day.isToday && {
                      backgroundColor: withAlpha(primaryActionColor, 0.12),
                      borderWidth: 1,
                      borderColor: withAlpha(primaryActionColor, 0.3),
                    },
                ]}
                onPress={() => !day.isOtherMonth && onSelectDay(day.date)}
              >
                <Text
                  style={[
                    styles.monthNumber,
                    { color: userTokens.textPrimary },
                    isSelected && !day.isToday && { color: primaryActionColor },
                    day.isToday && { color: primaryActionTextColor },
                  ]}
                >
                  {day.dayNumber}
                </Text>
                <View style={styles.dotRowSmall}>
                  {day.dots && day.dots.length > 0 ? (
                    <View
                      style={[
                        styles.dotSmall,
                        {
                          backgroundColor: isSelected
                            ? primaryActionColor
                            : modeColors.state.negative,
                          marginRight: 0,
                        },
                      ]}
                    />
                  ) : null}
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      {selectedDay && (
        <DayDetail
          day={selectedDay}
          currencySymbol={currencySymbol}
          emptyLabel={t(dictionary, "mobile.home.calendarEmptyDay")}
          primaryActionColor={primaryActionColor}
          userTextPrimary={userTokens.textPrimary}
          userTextSecondary={userTokens.textSecondary}
          userBorder={userTokens.border}
          incomeColor={incomeColor}
          expenseColor={expenseColor}
          incomeIconBg={incomeIconBg}
          expenseIconBg={expenseIconBg}
          incomeIconBorder={incomeIconBorder}
          expenseIconBorder={expenseIconBorder}
        />
      )}

      {nextProgrammed ? (
        <NextProgrammed
          item={nextProgrammed}
          onViewAll={onViewAllProgrammed}
          currencySymbol={currencySymbol}
          userBorder={userTokens.border}
          userTextPrimary={userTokens.textPrimary}
          userTextSecondary={userTokens.textSecondary}
          primaryActionColor={primaryActionColor}
        />
      ) : null}
    </View>
  );
}

type DayDetailProps = {
  day: DayDetailData;
  currencySymbol: string;
  emptyLabel: string;
  primaryActionColor: string;
  userTextPrimary: string;
  userTextSecondary: string;
  userBorder: string;
  incomeColor: string;
  expenseColor: string;
  incomeIconBg: string;
  expenseIconBg: string;
  incomeIconBorder: string;
  expenseIconBorder: string;
};

function DayDetail({
  day,
  currencySymbol,
  emptyLabel,
  primaryActionColor,
  userTextPrimary,
  userTextSecondary,
  userBorder,
  incomeColor,
  expenseColor,
  incomeIconBg,
  expenseIconBg,
  incomeIconBorder,
  expenseIconBorder,
}: DayDetailProps) {
  return (
    <View style={[styles.dayDetail, { borderTopColor: userBorder }]}>
      <Text style={[styles.dayDetailLabel, { color: userTextSecondary }]}>
        {day.formattedLabel}
      </Text>
      {day.movements.length > 0 ? (
        day.movements.map((movement) => (
          <MovementRow
            key={movement.id}
            movement={movement}
            currencySymbol={currencySymbol}
            primaryActionColor={primaryActionColor}
            userTextPrimary={userTextPrimary}
            userTextSecondary={userTextSecondary}
            userBorder={userBorder}
            incomeColor={incomeColor}
            expenseColor={expenseColor}
            incomeIconBg={incomeIconBg}
            expenseIconBg={expenseIconBg}
            incomeIconBorder={incomeIconBorder}
            expenseIconBorder={expenseIconBorder}
          />
        ))
      ) : (
        <Text style={[styles.dayDetailEmpty, { color: userTextSecondary }]}>
          {emptyLabel}
        </Text>
      )}
    </View>
  );
}

type MovementRowProps = {
  movement: DayMovement;
  currencySymbol: string;
  primaryActionColor: string;
  userTextPrimary: string;
  userTextSecondary: string;
  userBorder: string;
  incomeColor: string;
  expenseColor: string;
  incomeIconBg: string;
  expenseIconBg: string;
  incomeIconBorder: string;
  expenseIconBorder: string;
};

function MovementRow({
  movement,
  currencySymbol,
  primaryActionColor,
  userTextPrimary,
  userTextSecondary,
  userBorder,
  incomeColor,
  expenseColor,
  incomeIconBg,
  expenseIconBg,
  incomeIconBorder,
  expenseIconBorder,
}: MovementRowProps) {
  const isIncome = movement.type === "income";
  const { integer, decimals } = formatCurrencyParts(
    movement.amountMinor,
    currencySymbol
  );

  return (
    <View style={[styles.movementRow, { borderTopColor: userBorder }]}>
      <View style={styles.movementInfo}>
        <View
          style={[
            styles.movementIcon,
            {
              backgroundColor: isIncome ? incomeIconBg : expenseIconBg,
              borderColor: isIncome ? incomeIconBorder : expenseIconBorder,
            },
          ]}
        >
          <Text
            style={[
              styles.movementIconText,
              { color: isIncome ? incomeColor : expenseColor },
            ]}
          >
            {isIncome ? "↑" : "↓"}
          </Text>
        </View>
        <View style={styles.movementText}>
          <Text style={[styles.movementTitle, { color: userTextPrimary }]} numberOfLines={1}>
            {movement.name}
            {movement.badge ? (
              <Text style={[styles.movementBadge, { color: primaryActionColor }]}>
                {" "}
                {movement.badge}
              </Text>
            ) : null}
          </Text>
          <Text style={[styles.movementCategory, { color: userTextSecondary }]} numberOfLines={1}>
            {movement.category ?? ""}
          </Text>
        </View>
      </View>
      <Text style={[styles.movementAmount, isIncome ? styles.amountPositive : styles.amountNegative]}>
        {isIncome ? "+" : "-"}
        {integer},{decimals}
      </Text>
    </View>
  );
}

type NextProgrammedProps = {
  item: NextProgrammedItem;
  onViewAll?: () => void;
  currencySymbol: string;
  userBorder: string;
  userTextPrimary: string;
  userTextSecondary: string;
  primaryActionColor: string;
};

function NextProgrammed({
  item,
  onViewAll,
  currencySymbol,
  userBorder,
  userTextPrimary,
  userTextSecondary,
  primaryActionColor,
}: NextProgrammedProps) {
  const { dictionary } = useCopy();
  const isIncome = item.type === "income";
  const { integer, decimals } = formatCurrencyParts(item.amountMinor, currencySymbol);

  return (
    <View style={[styles.nextProgrammed, { borderTopColor: userBorder }]}>
      <View style={styles.nextProgrammedHeader}>
        <Text style={[styles.nextProgrammedLabel, { color: userTextSecondary }]}>
          {t(dictionary, "mobile.home.calendarNextProgrammed")}
        </Text>
        <TouchableOpacity onPress={onViewAll}>
          <Text style={[styles.nextProgrammedLink, { color: primaryActionColor }]}>
            {t(dictionary, "mobile.home.programmedViewAll")}
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.nextProgrammedRow}>
        <View style={styles.nextProgrammedInfo}>
          <View style={styles.nextProgrammedIcon}>
            <Text style={styles.nextProgrammedIconText}>⏱</Text>
          </View>
          <View>
            <Text style={[styles.nextProgrammedTitle, { color: userTextPrimary }]}>
              {item.name}
            </Text>
            <Text style={[styles.nextProgrammedDate, { color: userTextSecondary }]}>
              {item.dateLabel}
              {item.category ? ` · ${item.category}` : ""}
            </Text>
          </View>
        </View>

        <Text
          style={[
            styles.nextProgrammedAmount,
            { color: isIncome ? colors.state.positive : userTextSecondary },
          ]}
        >
          {isIncome ? "+" : "-"}
          {integer},{decimals}
        </Text>
      </View>
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
    marginHorizontal: tokens.spacing.xs,
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
  dotIncome: {
    backgroundColor: colors.state.positive,
  },
  dotExpense: {
    backgroundColor: colors.state.negative,
  },
  weekSummary: {
    flexDirection: "row",
    justifyContent: "center",
    flexWrap: "wrap",
    paddingHorizontal: tokens.spacing.lg,
    paddingBottom: tokens.spacing.sm,
  },
  weekSummaryText: {
    fontSize: tokens.typography.size.xs,
    color: colors.text.muted,
    fontFamily: "DMSans",
    marginHorizontal: tokens.spacing.sm,
  },
  weekSummaryValue: {
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
  dayDetailLabel: {
    fontSize: tokens.typography.size.xs,
    fontWeight: tokens.typography.weight.medium,
    textTransform: "uppercase",
    letterSpacing: 0.6,
    color: colors.text.muted,
    fontFamily: "DMSans-Medium",
    marginBottom: tokens.spacing.sm,
  },
  dayDetailEmpty: {
    fontSize: tokens.typography.size.sm,
    color: colors.text.secondary,
    fontFamily: "DMSans",
  },
  movementRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: tokens.spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.state.neutral,
  },
  movementInfo: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  movementIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    marginRight: tokens.spacing.sm,
  },
  movementIconText: {
    fontSize: 16,
    fontFamily: "DMSans-SemiBold",
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
  nextProgrammed: {
    borderTopWidth: 1,
    paddingHorizontal: tokens.spacing.lg,
    paddingVertical: tokens.spacing.md,
  },
  nextProgrammedHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: tokens.spacing.sm,
  },
  nextProgrammedLabel: {
    fontSize: tokens.typography.size.xs,
    textTransform: "uppercase",
    letterSpacing: 0.6,
    fontFamily: "DMSans-Medium",
  },
  nextProgrammedLink: {
    fontSize: tokens.typography.size.xs,
    fontWeight: tokens.typography.weight.semibold,
    fontFamily: "DMSans-SemiBold",
  },
  nextProgrammedRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: tokens.spacing.sm,
  },
  nextProgrammedInfo: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  nextProgrammedIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    marginRight: tokens.spacing.sm,
    backgroundColor: "rgba(255, 183, 77, 0.12)",
  },
  nextProgrammedIconText: {
    fontSize: 16,
    color: "#FFB74D",
    fontFamily: "DMSans-SemiBold",
  },
  nextProgrammedTitle: {
    fontSize: tokens.typography.size.sm,
    fontWeight: tokens.typography.weight.medium,
    fontFamily: "DMSans-Medium",
  },
  nextProgrammedDate: {
    fontSize: tokens.typography.size.xs,
    fontFamily: "DMSans-Regular",
  },
  nextProgrammedAmount: {
    fontSize: tokens.typography.size.sm,
    fontWeight: tokens.typography.weight.medium,
    fontFamily: "JetBrainsMono-Medium",
  },
});
