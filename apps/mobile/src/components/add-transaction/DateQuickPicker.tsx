import { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  Pressable,
  StyleSheet,
} from "react-native";
import { Calendar } from "phosphor-react-native";
import { themeTokens, getToday, getYesterday, getTomorrow, formatDateForDisplay } from "@poleursus/shared";
import { useCopy, t } from "../../lib/i18n";
import { MonthMap } from "../home/MonthMap";

const tokens = themeTokens.light;
const colors = tokens.colors;

interface DateQuickPickerProps {
  value: string;
  onChange: (date: string) => void;
  error?: string;
}

type QuickOption = {
  labelKey: "dateToday" | "dateYesterday" | "dateTomorrow";
  getValue: () => string;
};

const quickOptions: QuickOption[] = [
  { labelKey: "dateToday", getValue: getToday },
  { labelKey: "dateYesterday", getValue: getYesterday },
  { labelKey: "dateTomorrow", getValue: getTomorrow },
];

const parseIsoDate = (value: string) => {
  const [year, month, day] = value.split("-").map((part) => Number(part));
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day);
};

const formatIsoDate = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const startOfMonth = (date: Date) =>
  new Date(date.getFullYear(), date.getMonth(), 1);

export function DateQuickPicker({ value, onChange, error }: DateQuickPickerProps) {
  const { locale, dictionary } = useCopy();
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [visibleMonth, setVisibleMonth] = useState(() =>
    startOfMonth(parseIsoDate(value) ?? new Date())
  );

  const selectedDate = parseIsoDate(value);

  const isSelected = (getValue: () => string) => value === getValue();

  const handleQuickSelect = (getValue: () => string) => {
    onChange(getValue());
  };

  const handleCalendarOpen = () => {
    const baseDate = selectedDate ?? new Date();
    setVisibleMonth(startOfMonth(baseDate));
    setIsCalendarOpen(true);
  };

  const handleSelectDate = (date: Date) => {
    onChange(formatIsoDate(date));
    setIsCalendarOpen(false);
  };

  const goToPreviousMonth = () => {
    setVisibleMonth((current) =>
      startOfMonth(new Date(current.getFullYear(), current.getMonth() - 1, 1))
    );
  };

  const goToNextMonth = () => {
    setVisibleMonth((current) =>
      startOfMonth(new Date(current.getFullYear(), current.getMonth() + 1, 1))
    );
  };

  const monthLabel = new Intl.DateTimeFormat(locale, {
    month: "long",
    year: "numeric",
  }).format(visibleMonth);

  return (
    <View style={styles.container}>
      <Text style={styles.label}>{t(dictionary, "addTransaction.dateLabel")}</Text>

      {/* Quick option chips */}
      <View style={styles.chipsRow}>
        {quickOptions.map((option) => (
          <TouchableOpacity
            key={option.labelKey}
            onPress={() => handleQuickSelect(option.getValue)}
            style={[
              styles.chip,
              isSelected(option.getValue) && styles.chipSelected,
            ]}
          >
            <Text
              style={[
                styles.chipText,
                isSelected(option.getValue) && styles.chipTextSelected,
              ]}
            >
              {t(dictionary, `addTransaction.${option.labelKey}`)}
            </Text>
          </TouchableOpacity>
        ))}

        {/* Calendar button */}
        <TouchableOpacity onPress={handleCalendarOpen} style={styles.chip}>
          <Calendar size={16} color={colors.text.primary} style={styles.chipIcon} />
          <Text style={styles.chipText}>
            {t(dictionary, "addTransaction.datePickOther")}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Selected date display */}
      {value && (
        <Text style={styles.selectedDate}>
          {formatDateForDisplay(value, locale)}
        </Text>
      )}

      {/* Error message */}
      {error && <Text style={styles.errorText}>{error}</Text>}

      {/* Calendar Modal */}
      <Modal
        transparent
        visible={isCalendarOpen}
        animationType="slide"
        onRequestClose={() => setIsCalendarOpen(false)}
      >
        <View style={styles.sheetOverlay}>
          <Pressable
            style={styles.sheetBackdrop}
            onPress={() => setIsCalendarOpen(false)}
          />
          <View style={styles.sheetContainer}>
            <View style={styles.sheetHandle} />
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>
                {t(dictionary, "addTransaction.dateLabel")}
              </Text>
              <TouchableOpacity onPress={() => setIsCalendarOpen(false)}>
                <Text style={styles.sheetAction}>
                  {t(dictionary, "common.close")}
                </Text>
              </TouchableOpacity>
            </View>
            <View style={styles.monthNav}>
              <TouchableOpacity onPress={goToPreviousMonth} style={styles.navButton}>
                <Text style={styles.navText}>{"<"}</Text>
              </TouchableOpacity>
              <Text style={styles.monthLabel}>{monthLabel}</Text>
              <TouchableOpacity onPress={goToNextMonth} style={styles.navButton}>
                <Text style={styles.navText}>{">"}</Text>
              </TouchableOpacity>
            </View>
            <MonthMap
              month={visibleMonth}
              locale={locale}
              events={[]}
              highlightRange={
                selectedDate
                  ? { start: selectedDate, end: selectedDate }
                  : undefined
              }
              selectedDate={selectedDate ?? undefined}
              onSelectDate={handleSelectDate}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: tokens.spacing.md,
  },
  label: {
    fontSize: tokens.typography.size.md,
    fontWeight: tokens.typography.weight.semibold,
    color: colors.text.primary,
    marginBottom: tokens.spacing.xs,
  },
  chipsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: tokens.spacing.md,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: tokens.spacing.lg,
    paddingVertical: tokens.spacing.md,
    borderRadius: tokens.radii.pill,
    borderWidth: 1,
    borderColor: colors.state.neutral,
    backgroundColor: colors.bg.surface,
    minHeight: 44,
  },
  chipSelected: {
    backgroundColor: colors.action.primary,
    borderColor: colors.action.primary,
  },
  chipIcon: {
    marginRight: tokens.spacing.sm,
  },
  chipText: {
    fontSize: tokens.typography.size.md,
    fontWeight: tokens.typography.weight.medium,
    color: colors.text.primary,
  },
  chipTextSelected: {
    color: colors.bg.primary,
  },
  selectedDate: {
    fontSize: tokens.typography.size.md,
    color: colors.text.secondary,
    marginTop: tokens.spacing.xs,
  },
  errorText: {
    fontSize: tokens.typography.size.sm,
    color: colors.state.negative,
    marginTop: tokens.spacing.xs,
  },
  sheetOverlay: {
    flex: 1,
    justifyContent: "flex-end",
  },
  sheetBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.35)",
  },
  sheetContainer: {
    backgroundColor: colors.bg.surface,
    paddingHorizontal: tokens.spacing.lg,
    paddingTop: tokens.spacing.sm,
    paddingBottom: tokens.spacing.xl,
    borderTopLeftRadius: tokens.radii.lg,
    borderTopRightRadius: tokens.radii.lg,
    gap: tokens.spacing.md,
  },
  sheetHandle: {
    alignSelf: "center",
    width: 48,
    height: 4,
    borderRadius: tokens.radii.pill,
    backgroundColor: colors.state.neutral,
  },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  sheetTitle: {
    fontSize: tokens.typography.size.lg,
    fontWeight: tokens.typography.weight.semibold,
    color: colors.text.primary,
  },
  sheetAction: {
    fontSize: tokens.typography.size.sm,
    fontWeight: tokens.typography.weight.medium,
    color: colors.text.secondary,
  },
  monthNav: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  navButton: {
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: tokens.spacing.sm,
  },
  navText: {
    fontSize: tokens.typography.size.lg,
    fontWeight: tokens.typography.weight.semibold,
    color: colors.text.primary,
  },
  monthLabel: {
    fontSize: tokens.typography.size.md,
    fontWeight: tokens.typography.weight.medium,
    color: colors.text.primary,
  },
});
