import { useMemo } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useTranslations } from "next-intl";
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
  view: CalendarView;
  onViewChange: (view: CalendarView) => void;
  weekData: WeekData;
  monthData: MonthData;
  selectedDay: DayDetailData | null;
  onSelectDay: (dateKey: string) => void;
  onPrevPeriod?: () => void;
  onNextPeriod?: () => void;
  currencySymbol: string;
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
  locale = "es-ES",
  monoClassName,
}: CalendarProps) {
  const t = useTranslations();
  const isWeek = view === "week";
  const selectedKey = selectedDay?.dateKey ?? "";
  const data = isWeek ? weekData : monthData;
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

        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            onClick={onPrevPeriod}
            className="flex h-7 w-7 items-center justify-center rounded-full border border-border text-muted-foreground transition-colors hover:bg-muted/50"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </button>
          <span className="text-[13px] font-medium text-muted-foreground">
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
              return (
                <button
                  type="button"
                  key={day.date}
                  onClick={() => onSelectDay(day.date)}
                  className={`flex flex-col items-center rounded-lg px-1 py-2 transition-all ${
                    isToday
                      ? "bg-primary text-primary-foreground"
                      : isSelected
                      ? "bg-primary/10"
                      : "hover:bg-muted/50"
                  }`}
                >
                  <span
                    className={`text-[11px] font-medium uppercase tracking-wide ${
                      isToday
                        ? "text-primary-foreground/70"
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
                        ? "text-primary-foreground"
                        : isSelected
                        ? "text-primary"
                        : "text-foreground"
                    }`}
                  >
                    {day.dayNumber}
                  </span>
                  <div className="mt-1.5 flex min-h-[6px] gap-[3px]">
                    {day.dots?.map((dot, i) => (
                      <span
                        key={i}
                        className={`h-[5px] w-[5px] rounded-full ${
                          dot.type === "income" ? "bg-green-600" : "bg-red-600"
                        }`}
                      />
                    ))}
                  </div>
                </button>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center justify-center gap-4 px-5 pb-1">
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              {t("mobile.home.calendarIncome")}{" "}
              <span
                className={`font-medium text-green-600 ${monoClassName ?? ""}`}
              >
                +{weekData.netIncome}
              </span>
            </span>
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              {t("mobile.home.calendarExpenses")}{" "}
              <span
                className={`font-medium text-red-600 ${monoClassName ?? ""}`}
              >
                -{weekData.netExpense}
              </span>
            </span>
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              {t("mobile.home.calendarNet")}{" "}
              <span
                className={`font-semibold text-foreground ${monoClassName ?? ""}`}
              >
                {weekData.net}
              </span>
            </span>
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
            return (
              <button
                type="button"
                key={i}
                onClick={() => !day.isOtherMonth && onSelectDay(day.date)}
                className={`rounded-md px-1 py-1.5 text-center transition-all ${
                  day.isOtherMonth
                    ? "opacity-30"
                    : day.isToday
                    ? "bg-primary"
                    : isSelected
                    ? "bg-primary/10 ring-1 ring-primary/20"
                    : "hover:bg-muted/50"
                }`}
              >
                <span
                  className={`text-sm font-medium ${
                    day.isToday
                      ? "text-primary-foreground"
                      : isSelected
                      ? "text-primary"
                      : "text-foreground"
                  }`}
                >
                  {day.dayNumber}
                </span>
                <div className="mt-0.5 flex min-h-[5px] justify-center gap-0.5">
                  {day.dots?.map((dot, j) => (
                    <span
                      key={j}
                      className={`h-1 w-1 rounded-full ${
                        dot.type === "income" ? "bg-green-600" : "bg-red-600"
                      }`}
                    />
                  ))}
                </div>
              </button>
            );
          })}
        </div>
      )}

      {selectedDay && (
        <DayDetail
          day={selectedDay}
          currencySymbol={currencySymbol}
          locale={locale}
          monoClassName={monoClassName}
          emptyLabel={t("mobile.home.calendarEmptyDay")}
        />
      )}
    </div>
  );
}

type DayDetailProps = {
  day: DayDetailData;
  currencySymbol: string;
  locale: string;
  emptyLabel: string;
  monoClassName?: string;
};

function DayDetail({
  day,
  currencySymbol,
  locale,
  emptyLabel,
  monoClassName,
}: DayDetailProps) {
  return (
    <div className="border-t border-border px-5 py-4">
      <p className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {day.formattedLabel}
      </p>
      {day.movements.length > 0 ? (
        day.movements.map((movement) => (
          <MovementRow
            key={movement.id}
            movement={movement}
            currencySymbol={currencySymbol}
            locale={locale}
            monoClassName={monoClassName}
          />
        ))
      ) : (
        <p className="text-sm text-muted-foreground">{emptyLabel}</p>
      )}
    </div>
  );
}

type MovementRowProps = {
  movement: DayMovement;
  currencySymbol: string;
  locale: string;
  monoClassName?: string;
};

function MovementRow({ movement, currencySymbol, locale, monoClassName }: MovementRowProps) {
  const isIncome = movement.type === "income";
  const { integer, decimals } = formatCurrencyParts(
    movement.amountMinor,
    currencySymbol,
    locale
  );

  return (
    <div className="flex items-center justify-between border-t border-border/50 py-2.5 first:border-t-0">
      <div className="flex items-center gap-3">
        <div
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] text-base ${
            isIncome ? "bg-green-500/15" : "bg-red-500/15"
          }`}
        >
          {isIncome ? "↑" : "↓"}
        </div>
        <div>
          <p className="text-sm font-medium text-foreground">
            {movement.name}
            {movement.badge ? (
              <span className="ml-2 rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                {movement.badge}
              </span>
            ) : null}
          </p>
          <p className="text-xs text-muted-foreground">{movement.category ?? ""}</p>
        </div>
      </div>
      <span
        className={`shrink-0 text-sm font-medium ${
          isIncome ? "text-green-600" : "text-red-600"
        } ${monoClassName ?? ""}`}
      >
        {isIncome ? "+" : "-"}
        {integer},{decimals}
      </span>
    </div>
  );
}
