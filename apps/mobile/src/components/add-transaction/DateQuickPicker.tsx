import { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
} from "react-native";
import { Calendar } from "phosphor-react-native";
import { themeTokens, getToday, getYesterday, getTomorrow, formatDateForDisplay } from "@poleursus/shared";
import { useCopy, t } from "../../lib/i18n";
import { MonthMap } from "../home/MonthMap";
import { useUserTheme } from "../../contexts/UserThemeContext";

const tokens = themeTokens.light;

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
  const { tokens: userTokens, primaryActionColor, primaryActionTextColor } = useUserTheme();
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
      <Text style={[styles.label, { color: userTokens.textPrimary }]}>
        {t(dictionary, "addTransaction.dateLabel")}
      </Text>

      {/* Quick option chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chipsRow}
      >
        {quickOptions.map((option) => (
          <TouchableOpacity
            key={option.labelKey}
            onPress={() => handleQuickSelect(option.getValue)}
            style={[
              styles.chip,
              {
                borderColor: userTokens.border,
                backgroundColor: userTokens.surface,
              },
              isSelected(option.getValue) && styles.chipSelected,
              isSelected(option.getValue) && {
                backgroundColor: primaryActionColor,
                borderColor: primaryActionColor,
              },
            ]}
          >
            <Text
              style={[
                styles.chipText,
                { color: userTokens.textPrimary },
                isSelected(option.getValue) && styles.chipTextSelected,
                isSelected(option.getValue) && { color: primaryActionTextColor },
              ]}
            >
              {t(dictionary, `addTransaction.${option.labelKey}`)}
            </Text>
          </TouchableOpacity>
        ))}

        {/* Calendar button */}
        <TouchableOpacity
          onPress={handleCalendarOpen}
          style={[
            styles.chip,
            { borderColor: userTokens.border, backgroundColor: userTokens.surface },
          ]}
        >
          <Calendar size={14} color={userTokens.textPrimary} style={styles.chipIcon} />
          <Text style={[styles.chipText, { color: userTokens.textPrimary }]}>
            {t(dictionary, "addTransaction.datePickOther")}
          </Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Selected date display */}
      {value && (
        <Text style={[styles.selectedDate, { color: userTokens.textSecondary }]}>
          {formatDateForDisplay(value, locale)}
        </Text>
      )}

      {/* Error message */}
      {error && <Text style={[styles.errorText, { color: userTokens.dangerText }]}>{error}</Text>}

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
          <View
            style={[
              styles.sheetContainer,
              {
                backgroundColor: userTokens.surface,
                borderTopColor: userTokens.border,
              },
            ]}
          >
            <View style={[styles.sheetHandle, { backgroundColor: userTokens.border }]} />
            <View style={styles.sheetHeader}>
              <Text style={[styles.sheetTitle, { color: userTokens.textPrimary }]}>
                {t(dictionary, "addTransaction.dateLabel")}
              </Text>
              <TouchableOpacity onPress={() => setIsCalendarOpen(false)}>
                <Text style={[styles.sheetAction, { color: primaryActionColor }]}>
                  {t(dictionary, "common.close")}
                </Text>
              </TouchableOpacity>
            </View>
            <View style={styles.monthNav}>
              <TouchableOpacity
                onPress={goToPreviousMonth}
                style={[
                  styles.navButton,
                  { borderColor: userTokens.border, backgroundColor: userTokens.surfaceAlt },
                ]}
              >
                <Text style={[styles.navText, { color: userTokens.textPrimary }]}>{"<"}</Text>
              </TouchableOpacity>
              <Text style={[styles.monthLabel, { color: userTokens.textPrimary }]}>
                {monthLabel}
              </Text>
              <TouchableOpacity
                onPress={goToNextMonth}
                style={[
                  styles.navButton,
                  { borderColor: userTokens.border, backgroundColor: userTokens.surfaceAlt },
                ]}
              >
                <Text style={[styles.navText, { color: userTokens.textPrimary }]}>{">"}</Text>
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
    gap: tokens.spacing.sm,
  },
  label: {
    fontSize: tokens.typography.size.sm,
    fontWeight: tokens.typography.weight.semibold,
    marginBottom: tokens.spacing.xs,
  },
  chipsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: tokens.spacing.sm,
    paddingRight: tokens.spacing.sm,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: tokens.spacing.sm,
    borderRadius: tokens.radii.pill,
    borderWidth: 1,
    minHeight: 36,
  },
  chipSelected: {
  },
  chipIcon: {
    marginRight: tokens.spacing.xs,
  },
  chipText: {
    fontSize: tokens.typography.size.sm,
    fontWeight: tokens.typography.weight.medium,
  },
  chipTextSelected: {
  },
  selectedDate: {
    fontSize: tokens.typography.size.md,
    fontWeight: tokens.typography.weight.medium,
    marginTop: tokens.spacing.xs,
  },
  errorText: {
    fontSize: tokens.typography.size.sm,
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
    paddingHorizontal: tokens.spacing.lg,
    paddingTop: tokens.spacing.sm,
    paddingBottom: tokens.spacing.xl,
    borderTopLeftRadius: tokens.radii.lg,
    borderTopRightRadius: tokens.radii.lg,
    borderTopWidth: 1,
    gap: tokens.spacing.md,
  },
  sheetHandle: {
    alignSelf: "center",
    width: 48,
    height: 4,
    borderRadius: tokens.radii.pill,
  },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  sheetTitle: {
    fontSize: tokens.typography.size.lg,
    fontWeight: tokens.typography.weight.semibold,
  },
  sheetAction: {
    fontSize: tokens.typography.size.sm,
    fontWeight: tokens.typography.weight.medium,
  },
  monthNav: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  navButton: {
    paddingHorizontal: tokens.spacing.sm,
    paddingVertical: tokens.spacing.xs,
    borderRadius: tokens.radii.md,
    borderWidth: 1,
  },
  navText: {
    fontSize: tokens.typography.size.lg,
    fontWeight: tokens.typography.weight.semibold,
  },
  monthLabel: {
    fontSize: tokens.typography.size.md,
    fontWeight: tokens.typography.weight.medium,
    textTransform: "capitalize",
  },
});
