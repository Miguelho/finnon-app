import type { CSSProperties } from "react";
import {
  createTypographyStyles,
  themeTokens,
  type CalendarEvent,
  type DateRange,
} from "@poleursus/shared";

type MonthMapProps = {
  month: Date;
  locale: string;
  events: CalendarEvent[];
  highlightRange: DateRange;
  selectedDate?: Date | null;
  onSelectDate: (date: Date) => void;
};

const tokens = themeTokens.light;
const colors = tokens.colors;
const typography = createTypographyStyles(tokens);

const buildDayKey = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const startOfMonth = (date: Date) =>
  new Date(date.getFullYear(), date.getMonth(), 1);

const endOfMonth = (date: Date) =>
  new Date(date.getFullYear(), date.getMonth() + 1, 0);

const isSameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

const toMondayIndex = (weekday: number) => (weekday + 6) % 7;

const getMarkerStyle = (type: CalendarEvent["type"]) => {
  switch (type) {
    case "obligation_paid":
      return { color: colors.action.primary, shape: "square" as const };
    case "obligation_pending":
      return { color: colors.state.warning, shape: "square" as const };
    case "recurring_income":
      return { color: colors.state.positive, shape: "ring" as const };
    case "recurring_expense":
      return { color: colors.state.negative, shape: "ring" as const };
    case "one_off_income":
      return { color: colors.state.positive, shape: "dot" as const };
    case "one_off_expense":
    default:
      return { color: colors.state.negative, shape: "dot" as const };
  }
};

export function MonthMap({
  month,
  locale,
  events,
  highlightRange,
  selectedDate,
  onSelectDate,
}: MonthMapProps) {
  const monthStart = startOfMonth(month);
  const monthEnd = endOfMonth(month);
  const weekdayStart = toMondayIndex(monthStart.getDay());
  const totalDays = monthEnd.getDate();
  const totalCells = Math.ceil((weekdayStart + totalDays) / 7) * 7;

  const eventsByDay = new Map<string, CalendarEvent[]>();
  events.forEach((event) => {
    const list = eventsByDay.get(event.dayKey) ?? [];
    list.push(event);
    eventsByDay.set(event.dayKey, list);
  });

  const formatter = new Intl.DateTimeFormat(locale, { weekday: "short" });
  const weekdayLabels = Array.from({ length: 7 }, (_, index) =>
    formatter.format(new Date(2023, 0, 2 + index))
  );

  const cells = Array.from({ length: totalCells }, (_, index) => {
    const dayOffset = index - weekdayStart + 1;
    return new Date(month.getFullYear(), month.getMonth(), dayOffset);
  });

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-7 gap-2">
        {weekdayLabels.map((label) => (
          <span
            key={label}
            className="text-center text-xs"
            style={{ color: colors.text.muted }}
          >
            {label}
          </span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-2">
        {cells.map((date) => {
          const isCurrentMonth = date >= monthStart && date <= monthEnd;
          const dayKey = buildDayKey(date);
          const dayEvents = eventsByDay.get(dayKey) ?? [];
          const markers = dayEvents.slice(0, 3);
          const overflowCount = dayEvents.length - markers.length;
          const isHighlighted =
            isCurrentMonth &&
            date >= highlightRange.start &&
            date <= highlightRange.end;
          const isSelected = selectedDate ? isSameDay(date, selectedDate) : false;

          return (
            <button
              key={dayKey}
              type="button"
              onClick={() => isCurrentMonth && onSelectDate(date)}
              disabled={!isCurrentMonth}
              className="flex h-16 flex-col items-center justify-between rounded-lg border px-1 py-1.5 text-xs"
              style={{
                borderColor: isSelected
                  ? colors.action.primary
                  : isHighlighted
                    ? colors.action.secondary
                    : colors.state.neutral,
                backgroundColor: isHighlighted
                  ? colors.action.secondary
                  : colors.bg.secondary,
                color: isCurrentMonth ? colors.text.primary : colors.text.muted,
                opacity: isCurrentMonth ? 1 : 0.6,
              }}
            >
              <span
                style={{
                  fontSize: typography.meta.fontSize,
                  fontWeight: typography.meta.fontWeight,
                }}
              >
                {date.getDate()}
              </span>
              <span className="flex items-center gap-1">
                {markers.map((event) => {
                  const marker = getMarkerStyle(event.type);
                  const baseStyle: CSSProperties = {
                    width: 6,
                    height: 6,
                  };
                  if (marker.shape === "ring") {
                    baseStyle.borderRadius = 999;
                    baseStyle.border = `1px solid ${marker.color}`;
                  } else {
                    baseStyle.borderRadius = marker.shape === "square" ? 2 : 999;
                    baseStyle.backgroundColor = marker.color;
                  }
                  return (
                    <span
                      key={`${event.id}-${event.type}`}
                      style={baseStyle}
                    />
                  );
                })}
                {overflowCount > 0 && (
                  <span
                    style={{
                      fontSize: typography.meta.fontSize,
                      fontWeight: typography.meta.fontWeight,
                      color: colors.text.muted,
                    }}
                  >
                    +{overflowCount}
                  </span>
                )}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
