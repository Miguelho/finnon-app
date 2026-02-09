import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { themeTokens } from "@poleursus/shared";
import { formatCurrencyParts } from "./utils";
import { useCopy, t } from "../../lib/i18n";

const tokens = themeTokens.light;
const colors = tokens.colors;

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
}: CalendarProps) {
  const { dictionary, locale } = useCopy();
  const isWeek = view === "week";
  const selectedKey = selectedDay?.dateKey ?? "";
  const data = isWeek ? weekData : monthData;
  const monthLabels = locale === "en" ? ["M", "T", "W", "T", "F", "S", "S"] : ["L", "M", "X", "J", "V", "S", "D"];

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>{t(dictionary, "mobile.home.calendarTitle")}</Text>
      </View>

      <View style={styles.toggleRow}>
        <TouchableOpacity
          style={[styles.toggleButton, isWeek && styles.toggleButtonActive]}
          onPress={() => onViewChange("week")}
        >
          <Text style={[styles.toggleText, isWeek && styles.toggleTextActive]}>
            {t(dictionary, "mobile.home.calendarWeek")}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.toggleButton, !isWeek && styles.toggleButtonActive]}
          onPress={() => onViewChange("month")}
        >
          <Text style={[styles.toggleText, !isWeek && styles.toggleTextActive]}>
            {t(dictionary, "mobile.home.calendarMonth")}
          </Text>
        </TouchableOpacity>

        <View style={styles.navRow}>
          <TouchableOpacity style={styles.navButton} onPress={onPrevPeriod}>
            <Text style={styles.navButtonText}>‹</Text>
          </TouchableOpacity>
          <Text style={styles.navLabel}>{data?.period}</Text>
          <TouchableOpacity style={styles.navButton} onPress={onNextPeriod}>
            <Text style={styles.navButtonText}>›</Text>
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
                    day.isToday && styles.dayCellToday,
                    isSelected && !day.isToday && styles.dayCellSelected,
                  ]}
                  onPress={() => onSelectDay(day.date)}
                >
                  <Text
                    style={[
                      styles.dayLabel,
                      day.isToday && styles.dayLabelToday,
                    ]}
                  >
                    {day.dayLabel}
                  </Text>
                  <Text
                    style={[
                      styles.dayNumber,
                      day.isToday && styles.dayNumberToday,
                    ]}
                  >
                    {day.dayNumber}
                  </Text>
                  <View style={styles.dotRow}>
                    {day.dots?.map((dot, index) => (
                      <View
                        key={`${day.date}-${index}`}
                        style={[
                          styles.dot,
                          dot.type === "income" ? styles.dotIncome : styles.dotExpense,
                        ]}
                      />
                    ))}
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>

          <View style={styles.weekSummary}>
            <Text style={styles.weekSummaryText}>
              {t(dictionary, "mobile.home.calendarIncome")}{" "}
              <Text style={[styles.weekSummaryValue, styles.amountPositive]}>
                +{weekData.netIncome}
              </Text>
            </Text>
            <Text style={styles.weekSummaryText}>
              {t(dictionary, "mobile.home.calendarExpenses")}{" "}
              <Text style={[styles.weekSummaryValue, styles.amountNegative]}>
                -{weekData.netExpense}
              </Text>
            </Text>
            <Text style={styles.weekSummaryText}>
              {t(dictionary, "mobile.home.calendarNet")}{" "}
              <Text style={[styles.weekSummaryValue, styles.amountNet]}>
                {weekData.net}
              </Text>
            </Text>
          </View>
        </>
      )}

      {!isWeek && (
        <View style={styles.monthGrid}>
          {monthLabels.map((label, index) => (
            <Text key={`${label}-${index}`} style={styles.monthLabel}>
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
                  day.isToday && styles.monthCellToday,
                  isSelected && !day.isToday && styles.dayCellSelected,
                ]}
                onPress={() => !day.isOtherMonth && onSelectDay(day.date)}
              >
                <Text
                  style={[
                    styles.monthNumber,
                    day.isToday && styles.monthNumberToday,
                  ]}
                >
                  {day.dayNumber}
                </Text>
                <View style={styles.dotRowSmall}>
                  {day.dots?.map((dot, dotIndex) => (
                    <View
                      key={`${day.date}-dot-${dotIndex}`}
                      style={[
                        styles.dotSmall,
                        dot.type === "income" ? styles.dotIncome : styles.dotExpense,
                      ]}
                    />
                  ))}
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
        />
      )}
    </View>
  );
}

type DayDetailProps = {
  day: DayDetailData;
  currencySymbol: string;
  emptyLabel: string;
};

function DayDetail({ day, currencySymbol, emptyLabel }: DayDetailProps) {
  return (
    <View style={styles.dayDetail}>
      <Text style={styles.dayDetailLabel}>{day.formattedLabel}</Text>
      {day.movements.length > 0 ? (
        day.movements.map((movement) => (
          <MovementRow
            key={movement.id}
            movement={movement}
            currencySymbol={currencySymbol}
          />
        ))
      ) : (
        <Text style={styles.dayDetailEmpty}>{emptyLabel}</Text>
      )}
    </View>
  );
}

type MovementRowProps = {
  movement: DayMovement;
  currencySymbol: string;
};

function MovementRow({ movement, currencySymbol }: MovementRowProps) {
  const isIncome = movement.type === "income";
  const { integer, decimals } = formatCurrencyParts(
    movement.amountMinor,
    currencySymbol
  );

  return (
    <View style={styles.movementRow}>
      <View style={styles.movementInfo}>
        <View
          style={[
            styles.movementIcon,
            isIncome ? styles.movementIconIncome : styles.movementIconExpense,
          ]}
        >
          <Text style={styles.movementIconText}>{isIncome ? "↑" : "↓"}</Text>
        </View>
        <View style={styles.movementText}>
          <Text style={styles.movementTitle} numberOfLines={1}>
            {movement.name}
            {movement.badge ? (
              <Text style={styles.movementBadge}> {movement.badge}</Text>
            ) : null}
          </Text>
          <Text style={styles.movementCategory} numberOfLines={1}>
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
  toggleButtonActive: {
    backgroundColor: colors.text.primary,
  },
  toggleText: {
    fontSize: 13,
    fontWeight: tokens.typography.weight.medium,
    color: colors.text.muted,
    fontFamily: "DMSans-Medium",
  },
  toggleTextActive: {
    color: colors.bg.primary,
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
  dayCellToday: {
    backgroundColor: colors.text.primary,
  },
  dayCellSelected: {
    backgroundColor: colors.action.secondary,
  },
  dayLabel: {
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 0.6,
    color: colors.text.muted,
    fontFamily: "DMSans-Medium",
  },
  dayLabelToday: {
    color: "rgba(255,255,255,0.6)",
  },
  dayNumber: {
    fontSize: 18,
    fontWeight: tokens.typography.weight.semibold,
    color: colors.text.primary,
    fontFamily: "DMSans-SemiBold",
  },
  dayNumberToday: {
    color: colors.bg.primary,
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
  monthCellToday: {
    backgroundColor: colors.text.primary,
  },
  monthNumber: {
    fontSize: tokens.typography.size.sm,
    fontWeight: tokens.typography.weight.medium,
    color: colors.text.primary,
    fontFamily: "DMSans-Medium",
  },
  monthNumberToday: {
    color: colors.bg.primary,
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
    alignItems: "center",
    justifyContent: "center",
    marginRight: tokens.spacing.sm,
  },
  movementIconIncome: {
    backgroundColor: "#F0FDF4",
  },
  movementIconExpense: {
    backgroundColor: "#FEF2F2",
  },
  movementIconText: {
    fontSize: 16,
    color: colors.text.primary,
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
    color: colors.action.primary,
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
});
