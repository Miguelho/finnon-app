import { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  SafeAreaView,
} from "react-native";
import { ChevronLeft, ChevronRight, X } from "lucide-react-native";
import { MonthMap } from "./MonthMap";
import {
  createTypographyStyles,
  getEventsForMonth,
  getExpandedMonthRange,
  getMonthKey,
  themeTokens,
  type CalendarEvent,
  type Obligation,
  type Transaction,
} from "@poleursus/shared";
import { supabase } from "../../lib/supabase";

type MonthViewModalProps = {
  visible: boolean;
  onClose: () => void;
  accountId: string;
  locale: string;
  baseCurrency: string;
  fallbackTitle: string;
  obligations: Obligation[];
  transactions: Transaction[];
  initialMonth?: Date;
  onSelectDate: (date: Date) => void;
};

const tokens = themeTokens.light;
const colors = tokens.colors;
const typography = createTypographyStyles(tokens);

export function MonthViewModal({
  visible,
  onClose,
  accountId,
  locale,
  baseCurrency,
  fallbackTitle,
  obligations,
  transactions,
  initialMonth,
  onSelectDate,
}: MonthViewModalProps) {
  const [viewMonth, setViewMonth] = useState<Date>(initialMonth ?? new Date());
  const [monthData, setMonthData] = useState<{
    transactions: Transaction[];
    obligations: Obligation[];
  }>({
    transactions,
    obligations,
  });
  const monthCache = useRef<
    Record<string, { transactions: Transaction[]; obligations: Obligation[] }>
  >({});

  useEffect(() => {
    const seedMonth = initialMonth ?? new Date();
    const monthKey = getMonthKey(seedMonth);
    monthCache.current[monthKey] = { transactions, obligations };
    if (getMonthKey(viewMonth) === monthKey) {
      setMonthData({ transactions, obligations });
    }
  }, [initialMonth, obligations, transactions, viewMonth]);

  useEffect(() => {
    if (!visible) return;
    if (initialMonth) {
      setViewMonth(initialMonth);
    }
  }, [visible, initialMonth]);

  useEffect(() => {
    let cancelled = false;
    const monthKey = getMonthKey(viewMonth);
    const cached = monthCache.current[monthKey];
    if (cached) {
      setMonthData(cached);
      return;
    }

    async function loadMonthData() {
      const expandedRange = getExpandedMonthRange(viewMonth);
      const startDate = expandedRange.start.toISOString().slice(0, 10);
      const endDate = expandedRange.end.toISOString().slice(0, 10);

      try {
        const { data: txData } = await supabase
          .from("transactions")
          .select(
            "id, account_id, type, amount_minor, amount_base_minor, currency, category_id, date, merchant, notes, created_by, created_at, category:categories(id, name, icon_id)"
          )
          .eq("account_id", accountId)
          .gte("date", startDate)
          .lte("date", endDate)
          .order("date", { ascending: false })
          .order("created_at", { ascending: false });

        const { data: obligationsData } = await supabase
          .from("obligations")
          .select(
            "id, account_id, name, amount_minor, amount_base_minor, currency, due_date, status, paid_at"
          )
          .eq("account_id", accountId)
          .gte("due_date", startDate)
          .lte("due_date", endDate)
          .order("due_date", { ascending: true });

        if (!cancelled) {
          const nextData = {
            transactions: (txData as Transaction[]) ?? [],
            obligations: (obligationsData as Obligation[]) ?? [],
          };
          monthCache.current[monthKey] = nextData;
          setMonthData(nextData);
        }
      } catch (error) {
        console.error("[MonthViewModal] Error loading month data:", error);
      }
    }

    void loadMonthData();
    return () => {
      cancelled = true;
    };
  }, [accountId, viewMonth]);

  const handlePrevMonth = () => {
    setViewMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setViewMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  };

  const viewMonthLabel = viewMonth.toLocaleDateString(locale, {
    month: "long",
    year: "numeric",
  });

  const calendarEventRange = getExpandedMonthRange(viewMonth);
  const events: CalendarEvent[] = getEventsForMonth(
    viewMonth,
    monthData.obligations,
    monthData.transactions,
    baseCurrency,
    fallbackTitle,
    calendarEventRange
  );

  const handleSelectDay = (date: Date) => {
    onSelectDate(date);
    // Modal stays open so user can see day detail without reopening
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <X size={24} color={colors.text.primary} />
          </TouchableOpacity>
          <View style={styles.navRow}>
            <TouchableOpacity onPress={handlePrevMonth} style={styles.navButton}>
              <ChevronLeft size={24} color={colors.text.secondary} />
            </TouchableOpacity>
            <Text style={styles.monthLabel}>{viewMonthLabel}</Text>
            <TouchableOpacity onPress={handleNextMonth} style={styles.navButton}>
              <ChevronRight size={24} color={colors.text.secondary} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Calendar */}
        <View style={styles.content}>
          <MonthMap
            month={viewMonth}
            locale={locale}
            events={events}
            highlightRange={calendarEventRange}
            selectedDate={null}
            onSelectDate={handleSelectDay}
          />
          {events.length === 0 && (
            <Text style={styles.emptyText}>
              No hay movimientos este mes.
            </Text>
          )}
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg.primary,
  },
  header: {
    paddingHorizontal: tokens.spacing.lg,
    paddingVertical: tokens.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.state.neutral,
  },
  closeButton: {
    alignSelf: "flex-end",
    padding: tokens.spacing.xs,
  },
  navRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: tokens.spacing.sm,
  },
  navButton: {
    padding: tokens.spacing.xs,
  },
  monthLabel: {
    fontSize: typography.h2.fontSize,
    fontWeight: typography.h2.fontWeight as "700",
    color: colors.text.primary,
    textTransform: "capitalize",
    minWidth: 180,
    textAlign: "center",
  },
  content: {
    flex: 1,
    padding: tokens.spacing.lg,
  },
  emptyText: {
    marginTop: tokens.spacing.lg,
    fontSize: typography.body.fontSize,
    color: colors.text.secondary,
    textAlign: "center",
  },
});
