import { useMemo, useState } from "react";
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import {
  getHeatLevel,
  themeTokens,
  type CalendarDayData,
} from "@poleursus/shared";
import { useCopy } from "../../lib/i18n";
import { useUserTheme } from "../../contexts/UserThemeContext";
import { formatCurrencyParts } from "./utils";

const tokens = themeTokens.light;
const WEEK_BAR_LAYOUT = {
  phone: {
    stackMaxHeight: 44,
    incomeMaxHeight: 18,
    columnMinHeight: 146,
    frameMinHeight: 52,
    barWidth: 18,
  },
  tablet: {
    stackMaxHeight: 56,
    incomeMaxHeight: 24,
    columnMinHeight: 170,
    frameMinHeight: 74,
    barWidth: 22,
  },
} as const;

type CalendarDay = CalendarDayData & {
  dayNumber: number;
  isToday: boolean;
  isOtherMonth: boolean;
  dayLabel: string;
};

type CalendarProps = {
  view: "week" | "month";
  onViewChange: (view: "week" | "month") => void;
  periodLabel: string;
  monthDays: CalendarDay[];
  weekDays: CalendarDay[];
  selectedDayKey: string;
  onSelectDay: (dateKey: string) => void;
  onPrevPeriod?: () => void;
  onNextPeriod?: () => void;
  currencySymbol: string;
};

const HEAT_COLORS = {
  grafito: [
    "transparent",
    "rgba(212, 148, 58, 0.10)",
    "rgba(212, 140, 50, 0.20)",
    "rgba(215, 130, 42, 0.34)",
    "rgba(218, 118, 35, 0.52)",
    "rgba(222, 105, 28, 0.70)",
  ],
  oceano: [
    "transparent",
    "rgba(220, 140, 100, 0.10)",
    "rgba(218, 125, 85, 0.22)",
    "rgba(215, 110, 70, 0.36)",
    "rgba(212, 95, 55, 0.54)",
    "rgba(210, 80, 42, 0.72)",
  ],
} as const;

const HEAT_NUMBER_COLORS = {
  grafito: {
    0: "#908D88",
    1: "#EDEBE8",
    2: "#EDEBE8",
    3: "#F5E6D8",
    4: "#FFF4EA",
    5: "#FFFFFF",
  },
  oceano: {
    0: "#7A90A8",
    1: "#E2EAF2",
    2: "#E2EAF2",
    3: "#F0DDD0",
    4: "#FFF0E6",
    5: "#FFFFFF",
  },
} as const;

const TODAY_RING = {
  grafito: "rgba(237, 235, 232, 0.45)",
  oceano: "rgba(226, 234, 242, 0.40)",
} as const;

const TODAY_BG = {
  grafito: "rgba(255, 255, 255, 0.06)",
  oceano: "rgba(140, 180, 230, 0.08)",
} as const;

const TODAY_BORDER = {
  grafito: "rgba(255, 255, 255, 0.12)",
  oceano: "rgba(140, 180, 230, 0.15)",
} as const;

const INCOME = "#6DC9A0";
const INCOME_BRIGHT = "#8EDBB5";
const INCOME_BG = "rgba(109, 201, 160, 0.10)";

const EXPENSE_TEXT = {
  grafito: "#E0956A",
  oceano: "#E8A07A",
} as const;

const EXPENSE_BG = {
  grafito: "rgba(224, 149, 106, 0.10)",
  oceano: "rgba(232, 160, 122, 0.10)",
} as const;

const toMinorInt = (value: number) => {
  if (!Number.isFinite(value)) return 0n;
  return BigInt(Math.max(0, Math.round(value)));
};

const toSignedMinorInt = (value: number) => {
  if (!Number.isFinite(value)) return 0n;
  return BigInt(Math.round(value));
};

const getSignedAmountLabel = (minor: bigint, currencySymbol: string) => {
  if (minor === 0n) return "—";
  const abs = minor < 0n ? -minor : minor;
  const sign = minor > 0n ? "+" : "−";
  return `${sign}${formatCurrencyParts(abs, currencySymbol).full}`;
};

const clampNumber = (value: number, min: number, max: number) => {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
};

function CalendarTooltip({
  day,
  currencySymbol,
  onClose,
  expenseColor,
}: {
  day: CalendarDay;
  currencySymbol: string;
  onClose: () => void;
  expenseColor: string;
}) {
  const { tokens: userTokens } = useUserTheme();
  const { integer: expenseInt, decimals: expenseDec } = formatCurrencyParts(
    toMinorInt(day.totalExpense),
    currencySymbol
  );
  const { integer: incomeInt, decimals: incomeDec } = formatCurrencyParts(
    toMinorInt(day.totalIncome),
    currencySymbol
  );
  const { integer: netInt, decimals: netDec } = formatCurrencyParts(
    day.net >= 0 ? toMinorInt(day.net) : toMinorInt(-day.net),
    currencySymbol
  );
  const netSign = day.net > 0 ? "+" : day.net < 0 ? "−" : "";

  return (
    <Modal transparent visible animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.tooltipOverlay} onPress={onClose}>
        <View
          style={[
            styles.tooltipCard,
            { backgroundColor: userTokens.surfaceAlt, borderColor: userTokens.border },
          ]}
        >
          <View style={styles.tooltipRow}>
            <Text style={[styles.tooltipLabel, { color: userTokens.textSecondary }]}>Expense</Text>
            <Text style={[styles.tooltipValue, { color: expenseColor }]}>
              −{expenseInt},{expenseDec}
            </Text>
          </View>
          <View style={styles.tooltipRow}>
            <Text style={[styles.tooltipLabel, { color: userTokens.textSecondary }]}>
              Income
            </Text>
            <Text style={[styles.tooltipValue, { color: INCOME }]}>
              +{incomeInt},{incomeDec}
            </Text>
          </View>
          <View style={[styles.tooltipDivider, { backgroundColor: userTokens.border }]} />
          <View style={styles.tooltipRow}>
            <Text style={[styles.tooltipLabel, { color: userTokens.textSecondary }]}>Neto</Text>
            <Text
              style={[
                styles.tooltipValue,
                { color: day.net >= 0 ? INCOME : expenseColor },
              ]}
            >
              {netSign}
              {netInt},{netDec}
            </Text>
          </View>
        </View>
      </Pressable>
    </Modal>
  );
}

export function Calendar({
  view,
  onViewChange,
  periodLabel,
  monthDays,
  weekDays,
  selectedDayKey,
  onSelectDay,
  onPrevPeriod,
  onNextPeriod,
  currencySymbol,
}: CalendarProps) {
  const isWeek = view === "week";
  const { width, height } = useWindowDimensions();
  const { locale } = useCopy();
  const { tokens: userTokens, theme } = useUserTheme();
  const [tooltipDay, setTooltipDay] = useState<CalendarDay | null>(null);
  const activeTheme = theme === "oceano" ? "oceano" : "grafito";
  const visibleDays = isWeek ? weekDays : monthDays;
  const isTablet = Math.min(width, height) >= 600;
  const weeklyLayout = isTablet ? WEEK_BAR_LAYOUT.tablet : WEEK_BAR_LAYOUT.phone;

  const monthTotals = useMemo(() => {
    const monthVisibleDays = monthDays.filter((day) => !day.isOtherMonth);
    const income = monthVisibleDays.reduce((sum, day) => sum + day.totalIncome, 0);
    const expense = monthVisibleDays.reduce((sum, day) => sum + day.totalExpense, 0);
    return {
      income: toMinorInt(income),
      expense: toMinorInt(expense),
    };
  }, [monthDays]);

  const weekTotals = useMemo(() => {
    const income = weekDays.reduce((sum, day) => sum + day.totalIncome, 0);
    const expense = weekDays.reduce((sum, day) => sum + day.totalExpense, 0);
    return {
      income: toMinorInt(income),
      expense: toMinorInt(expense),
    };
  }, [weekDays]);

  const periodTotals = isWeek ? weekTotals : monthTotals;

  const selectedDayData = useMemo(() => {
    return (
      visibleDays.find((day) => day.date === selectedDayKey) ??
      monthDays.find((day) => day.date === selectedDayKey) ??
      null
    );
  }, [visibleDays, monthDays, selectedDayKey]);

  const selectedDayTotals = useMemo(
    () => ({
      income: toMinorInt(selectedDayData?.totalIncome ?? 0),
      expense: toMinorInt(selectedDayData?.totalExpense ?? 0),
    }),
    [selectedDayData]
  );

  const monthHeatReference = useMemo(
    () => monthDays.filter((day) => !day.isOtherMonth),
    [monthDays]
  );
  const monthRows = useMemo(() => {
    const rows: CalendarDay[][] = [];
    for (let index = 0; index < monthDays.length; index += 7) {
      rows.push(monthDays.slice(index, index + 7));
    }
    return rows;
  }, [monthDays]);

  const weeklyMaxExpense = useMemo(
    () => Math.max(1, ...weekDays.map((day) => day.totalExpense)),
    [weekDays]
  );

  const weeklyMaxIncome = useMemo(
    () => Math.max(1, ...weekDays.map((day) => day.totalIncome)),
    [weekDays]
  );

  const weeklyLegend = useMemo(() => {
    const map = new Map<string, { label: string; color: string }>();
    weekDays.forEach((day) => {
      day.expensesByCategory.forEach((category) => {
        if (!map.has(category.categoryId)) {
          map.set(category.categoryId, {
            label: category.categoryName,
            color: category.categoryColor,
          });
        }
      });
    });
    return Array.from(map.values());
  }, [weekDays]);

  const monthLabels =
    locale === "en"
      ? ["M", "T", "W", "T", "F", "S", "S"]
      : ["L", "M", "X", "J", "V", "S", "D"];

  return (
    <View style={[styles.card, { backgroundColor: userTokens.surface, borderColor: userTokens.border }]}>
      <View style={styles.topRow}>
        <View style={[styles.toggleWrap, { backgroundColor: "rgba(255,255,255,0.04)" }]}>
          <TouchableOpacity
            style={[styles.toggleButton, isWeek && styles.toggleButtonActive]}
            onPress={() => onViewChange("week")}
          >
            <Text style={[styles.toggleText, { color: userTokens.textSecondary }, isWeek && { color: userTokens.textPrimary }]}>
              Week
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.toggleButton, !isWeek && styles.toggleButtonActive]}
            onPress={() => onViewChange("month")}
          >
            <Text
              style={[
                styles.toggleText,
                { color: userTokens.textSecondary },
                !isWeek && { color: userTokens.textPrimary },
              ]}
            >
              Month
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.navRow}>
          <TouchableOpacity onPress={onPrevPeriod} style={styles.navArrowPressable} hitSlop={8}>
            <Text style={[styles.navArrow, { color: userTokens.textTertiary }]}>‹</Text>
          </TouchableOpacity>
          <Text numberOfLines={1} style={[styles.navLabel, { color: userTokens.textPrimary }]}>
            {periodLabel}
          </Text>
          <TouchableOpacity onPress={onNextPeriod} style={styles.navArrowPressable} hitSlop={8}>
            <Text style={[styles.navArrow, { color: userTokens.textTertiary }]}>›</Text>
          </TouchableOpacity>
        </View>
      </View>

      {isWeek ? (
        <View>
          <View style={styles.weekGrid}>
            {weekDays.map((day) => {
              const isSelected = day.date === selectedDayKey;
              const dayTotal = day.totalExpense;
              const stackHeight = Math.max(
                dayTotal > 0
                  ? clampNumber(
                      (dayTotal / weeklyMaxExpense) * weeklyLayout.stackMaxHeight,
                      0,
                      weeklyLayout.stackMaxHeight
                    )
                  : 0,
                0
              );
              const incomeHeight =
                day.totalIncome > 0
                  ? clampNumber(
                      (day.totalIncome / weeklyMaxIncome) * weeklyLayout.incomeMaxHeight,
                      3,
                      weeklyLayout.incomeMaxHeight
                    )
                  : 0;

              return (
                <TouchableOpacity
                  key={day.date}
                  style={[
                    styles.weekColumn,
                    { minHeight: weeklyLayout.columnMinHeight },
                    day.isToday && {
                      backgroundColor: TODAY_BG[activeTheme],
                      borderColor: TODAY_BORDER[activeTheme],
                    },
                    isSelected && !day.isToday && { borderColor: userTokens.border },
                  ]}
                  onPress={() => onSelectDay(day.date)}
                >
                  <Text style={[styles.weekDayLabel, { color: userTokens.textTertiary }]}>
                    {day.dayLabel}
                  </Text>
                  <Text
                    style={[
                      styles.weekDayNumber,
                      {
                        color: day.totalIncome > 0 ? INCOME : userTokens.textPrimary,
                        fontFamily: day.totalIncome > 0 ? "DMSans-Medium" : "DMSans",
                      },
                    ]}
                  >
                    {day.dayNumber}
                  </Text>

                  <View style={[styles.weekBarFrame, { minHeight: weeklyLayout.frameMinHeight }]}>
                    <View style={styles.weekStackWrap}>
                      <View
                        style={[
                          styles.weekStack,
                          {
                            height: weeklyLayout.stackMaxHeight,
                            width: weeklyLayout.barWidth,
                          },
                        ]}
                      >
                        <View style={{ justifyContent: "flex-end", height: "100%" }}>
                          {day.expensesByCategory.map((category) => {
                            const segment =
                              dayTotal > 0 ? (category.amount / dayTotal) * stackHeight : 0;
                            return (
                              <View
                                key={`${day.date}-${category.categoryId}`}
                                style={[
                                  styles.weekSegment,
                                  {
                                    height: clampNumber(
                                      Math.max(segment, dayTotal > 0 ? 2 : 0),
                                      0,
                                      weeklyLayout.stackMaxHeight
                                    ),
                                    backgroundColor: category.categoryColor,
                                  },
                                ]}
                              />
                            );
                          })}
                        </View>
                      </View>
                      <View
                        style={[
                          styles.weekIncomeBar,
                          {
                            width: weeklyLayout.barWidth,
                            height: incomeHeight,
                            opacity: day.totalIncome > 0 ? 0.52 : 0,
                          },
                        ]}
                      />
                    </View>
                  </View>

                  <Text
                    style={[
                      styles.weekNet,
                      {
                        color:
                          day.net > 0
                            ? INCOME
                            : day.net < 0
                              ? EXPENSE_TEXT[activeTheme]
                              : userTokens.textTertiary,
                      },
                    ]}
                    numberOfLines={1}
                  >
                    {getSignedAmountLabel(toSignedMinorInt(day.net), currencySymbol)}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <View style={[styles.weekLegend, { borderTopColor: userTokens.border }]}>
            {weeklyLegend.map((item) => (
              <View key={`${item.label}-${item.color}`} style={styles.weekLegendItem}>
                <View style={[styles.legendDot, { backgroundColor: item.color }]} />
                <Text style={[styles.weekLegendLabel, { color: userTokens.textTertiary }]}>
                  {item.label}
                </Text>
              </View>
            ))}
            <View style={styles.weekLegendItem}>
              <View style={[styles.legendDot, { backgroundColor: INCOME }]} />
              <Text style={[styles.weekLegendLabel, { color: userTokens.textTertiary }]}>
                Income
              </Text>
            </View>
          </View>
        </View>
      ) : (
        <View>
          <View style={styles.monthHeader}>
            {monthLabels.map((label, index) => (
              <Text key={`${label}-${index}`} style={[styles.monthHeaderText, { color: userTokens.textTertiary }]}>
                {label}
              </Text>
            ))}
          </View>

          <View style={styles.monthGrid}>
            {monthRows.map((week, rowIndex) => (
              <View key={`month-row-${rowIndex}`} style={styles.monthGridRow}>
                {week.map((day) => {
                  const heatLevel = getHeatLevel(day.totalExpense, monthHeatReference);
                  const isSelected = day.date === selectedDayKey;
                  const hasIncome = day.totalIncome > 0 || day.net > 0;
                  const baseColor = HEAT_NUMBER_COLORS[activeTheme][heatLevel];
                  const numberColor = hasIncome
                    ? heatLevel >= 4
                      ? INCOME_BRIGHT
                      : INCOME
                    : baseColor;
                  const numberFont = hasIncome || day.isToday ? "DMSans-Medium" : "DMSans";

                  return (
                    <Pressable
                      key={day.date}
                      style={styles.monthCellWrap}
                      onPress={() => onSelectDay(day.date)}
                      onLongPress={() => setTooltipDay(day)}
                    >
                      <View
                        style={[
                          styles.monthCell,
                          {
                            backgroundColor: HEAT_COLORS[activeTheme][heatLevel],
                            opacity: day.isOtherMonth ? 0.18 : 1,
                          },
                          day.isToday && {
                            borderWidth: 1.5,
                            borderColor: TODAY_RING[activeTheme],
                          },
                          isSelected && { borderWidth: 1, borderColor: userTokens.textTertiary },
                        ]}
                      >
                        <Text
                          style={[
                            styles.monthNumber,
                            {
                              color: numberColor,
                              fontFamily: numberFont,
                              textShadowColor:
                                hasIncome && heatLevel >= 4
                                  ? "rgba(109,201,160,0.25)"
                                  : "transparent",
                              textShadowRadius: hasIncome && heatLevel >= 4 ? 8 : 0,
                              textShadowOffset: { width: 0, height: 0 },
                            },
                          ]}
                        >
                          {day.dayNumber}
                        </Text>
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            ))}
          </View>

          <View style={[styles.monthLegend, { borderTopColor: userTokens.border }]}>
            <Text style={[styles.monthLegendLabel, { color: userTokens.textTertiary }]}>Less</Text>
            <View style={styles.monthLegendScale}>
              {[0, 1, 2, 3, 4, 5].map((level) => (
                <View
                  key={`heat-${level}`}
                  style={[
                    styles.monthLegendBlock,
                    {
                      backgroundColor:
                        level === 0
                          ? "rgba(255,255,255,0.04)"
                          : HEAT_COLORS[activeTheme][level as 1 | 2 | 3 | 4 | 5],
                    },
                  ]}
                />
              ))}
            </View>
            <Text style={[styles.monthLegendLabel, { color: userTokens.textTertiary }]}>
              More expense
            </Text>
            <Text style={[styles.monthLegendIncome, { color: INCOME }]}>5</Text>
            <Text style={[styles.monthLegendLabel, { color: userTokens.textTertiary }]}>
              = income
            </Text>
          </View>
        </View>
      )}

      <View style={styles.summaryAxis}>
        <View style={styles.summaryBlockLeft}>
          <Text style={[styles.summaryTitle, { color: userTokens.textTertiary }]}>
            {locale === "en" ? "Day" : "Día"}
          </Text>
          <View style={styles.summaryPillsLeft}>
            <View style={[styles.pill, { backgroundColor: INCOME_BG }]}>
              <Text numberOfLines={1} style={[styles.pillText, { color: INCOME }]}>
                ↑ {formatCurrencyParts(selectedDayTotals.income, currencySymbol).full}
              </Text>
            </View>
            <View style={[styles.pill, { backgroundColor: EXPENSE_BG[activeTheme] }]}>
              <Text numberOfLines={1} style={[styles.pillText, { color: EXPENSE_TEXT[activeTheme] }]}>
                ↓ {formatCurrencyParts(selectedDayTotals.expense, currencySymbol).full}
              </Text>
            </View>
          </View>
        </View>
        <View style={styles.summaryBlockRight}>
          <Text style={[styles.summaryTitle, { color: userTokens.textTertiary }]}>
            {isWeek ? "Week" : "Month"}
          </Text>
          <View style={styles.summaryPillsRight}>
            <View style={[styles.pill, { backgroundColor: INCOME_BG }]}>
              <Text style={[styles.pillText, { color: INCOME }]}>
                ↑ {formatCurrencyParts(periodTotals.income, currencySymbol).full}
              </Text>
            </View>
            <View style={[styles.pill, { backgroundColor: EXPENSE_BG[activeTheme] }]}>
              <Text style={[styles.pillText, { color: EXPENSE_TEXT[activeTheme] }]}>
                ↓ {formatCurrencyParts(periodTotals.expense, currencySymbol).full}
              </Text>
            </View>
          </View>
        </View>
      </View>

      {tooltipDay ? (
        <CalendarTooltip
          day={tooltipDay}
          currencySymbol={currencySymbol}
          expenseColor={EXPENSE_TEXT[activeTheme]}
          onClose={() => setTooltipDay(null)}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    gap: 10,
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  toggleWrap: {
    flexDirection: "row",
    borderRadius: 999,
    padding: 2,
  },
  toggleButton: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  toggleButtonActive: {
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  toggleText: {
    fontSize: 11,
    fontFamily: "DMSans-Medium",
  },
  navRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  navArrowPressable: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
  },
  navArrow: {
    fontSize: 18,
    lineHeight: 20,
    fontFamily: "DMSans-Medium",
  },
  navLabel: {
    fontSize: 13,
    fontFamily: "DMSans-Medium",
    minWidth: 120,
    textAlign: "center",
  },
  monthHeader: {
    flexDirection: "row",
    marginBottom: 2,
  },
  monthHeaderText: {
    width: `${100 / 7}%`,
    textAlign: "center",
    fontSize: 9,
    letterSpacing: 0.3,
    fontFamily: "DMSans-Medium",
  },
  monthGrid: {
    gap: 0,
  },
  monthGridRow: {
    flexDirection: "row",
  },
  monthCellWrap: {
    flex: 1,
    padding: 2,
  },
  monthCell: {
    borderRadius: 8,
    aspectRatio: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  monthNumber: {
    fontSize: 13,
    lineHeight: 15,
  },
  monthLegend: {
    marginTop: 4,
    paddingTop: 8,
    borderTopWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    flexWrap: "wrap",
    gap: 6,
  },
  monthLegendLabel: {
    fontSize: 9,
    fontFamily: "DMSans",
  },
  monthLegendScale: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  monthLegendBlock: {
    width: 10,
    height: 10,
    borderRadius: 3,
  },
  monthLegendIncome: {
    fontSize: 11,
    fontFamily: "DMSans-Bold",
  },
  summaryAxis: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 8,
  },
  summaryBlockLeft: {
    flex: 1,
    minWidth: 0,
    alignItems: "flex-start",
  },
  summaryBlockRight: {
    flex: 1,
    minWidth: 0,
    alignItems: "flex-end",
  },
  summaryTitle: {
    marginBottom: 3,
    fontSize: 9,
    letterSpacing: 0.45,
    textTransform: "uppercase",
    fontFamily: "DMSans-Medium",
  },
  summaryPillsLeft: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 6,
    flexWrap: "nowrap",
  },
  summaryPillsRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flexWrap: "wrap",
    justifyContent: "flex-end",
  },
  pill: {
    borderRadius: 999,
    paddingHorizontal: 11,
    paddingVertical: 5,
    maxWidth: "100%",
  },
  pillText: {
    fontSize: 11,
    fontFamily: "DMSans-SemiBold",
  },
  weekGrid: {
    flexDirection: "row",
    gap: 4,
  },
  weekColumn: {
    flex: 1,
    alignItems: "center",
    borderRadius: 14,
    paddingTop: 7,
    paddingBottom: 8,
    borderWidth: 1,
    borderColor: "transparent",
    minHeight: 146,
  },
  weekDayLabel: {
    fontSize: 8,
    letterSpacing: 0.5,
    textTransform: "uppercase",
    fontFamily: "DMSans-SemiBold",
  },
  weekDayNumber: {
    marginTop: 2,
    fontSize: 16,
    lineHeight: 18,
  },
  weekBarFrame: {
    marginTop: 2,
    minHeight: 48,
    justifyContent: "flex-end",
    width: "100%",
    alignItems: "center",
  },
  weekStackWrap: {
    width: "100%",
    alignItems: "center",
  },
  weekStack: {
    width: 18,
    justifyContent: "flex-end",
    overflow: "hidden",
    borderRadius: 4,
  },
  weekSegment: {
    width: "100%",
    borderTopWidth: 1,
    borderTopColor: "rgba(0,0,0,0.06)",
  },
  weekIncomeBar: {
    marginTop: 2,
    width: 18,
    borderRadius: 3,
    backgroundColor: INCOME,
  },
  weekNet: {
    marginTop: 4,
    fontSize: 8,
    fontFamily: "DMSans-SemiBold",
  },
  weekLegend: {
    borderTopWidth: 1,
    paddingTop: 9,
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 8,
  },
  weekLegendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  legendDot: {
    width: 6,
    height: 6,
    borderRadius: 2,
  },
  weekLegendLabel: {
    fontSize: 9,
    fontFamily: "DMSans",
  },
  tooltipOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.2)",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
  },
  tooltipCard: {
    width: 220,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  tooltipRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginVertical: 2,
  },
  tooltipLabel: {
    fontSize: 12,
    fontFamily: "DMSans",
  },
  tooltipValue: {
    fontSize: 12,
    fontFamily: "DMSans-SemiBold",
  },
  tooltipDivider: {
    height: 1,
    marginVertical: 6,
  },
});
