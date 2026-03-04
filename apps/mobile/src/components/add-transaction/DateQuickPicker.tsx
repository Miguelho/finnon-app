import { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  Pressable,
  StyleSheet,
} from "react-native";
import { Calendar } from "lucide-react-native";
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

const withAlpha = (hex: string, alpha: number) => {
  const normalized = hex.replace("#", "");
  const safeAlpha = Math.max(0, Math.min(1, alpha));
  const chunk =
    normalized.length === 3
      ? normalized
          .split("")
          .map((char) => `${char}${char}`)
          .join("")
      : normalized;
  const red = Number.parseInt(chunk.slice(0, 2), 16);
  const green = Number.parseInt(chunk.slice(2, 4), 16);
  const blue = Number.parseInt(chunk.slice(4, 6), 16);

  if ([red, green, blue].some((value) => Number.isNaN(value))) {
    return `rgba(0,0,0,${safeAlpha})`;
  }

  return `rgba(${red},${green},${blue},${safeAlpha})`;
};

const startOfMonth = (date: Date) =>
  new Date(date.getFullYear(), date.getMonth(), 1);

export function DateQuickPicker({ value, onChange, error }: DateQuickPickerProps) {
  const { locale, dictionary } = useCopy();
  const { tokens: userTokens, primaryActionColor } = useUserTheme();
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
      <Text style={[styles.label, { color: userTokens.textSecondary }]}>
        {t(dictionary, "addTransaction.dateLabel")}
      </Text>

      {/* Quick option chips */}
      <View style={styles.chipsRow}>
        {quickOptions.map((option) => (
          <TouchableOpacity
            key={option.labelKey}
            onPress={() => handleQuickSelect(option.getValue)}
            style={[
              styles.chip,
              styles.chipFlexible,
              {
                borderColor: userTokens.border,
                backgroundColor: userTokens.surfaceAlt,
              },
              isSelected(option.getValue) && styles.chipSelected,
              isSelected(option.getValue) && {
                backgroundColor: withAlpha(primaryActionColor, 0.15),
                borderColor: withAlpha(primaryActionColor, 0.5),
              },
            ]}
          >
            <Text
              style={[
                styles.chipText,
                { color: userTokens.textSecondary },
                isSelected(option.getValue) && styles.chipTextSelected,
                isSelected(option.getValue) && { color: primaryActionColor },
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
            styles.chipFlexible,
            { borderColor: userTokens.border, backgroundColor: userTokens.surfaceAlt },
          ]}
        >
          <Calendar size={14} color={userTokens.textSecondary} style={styles.chipIcon} />
          <Text style={[styles.chipText, { color: userTokens.textSecondary }]}>
            {t(dictionary, "addTransaction.datePickOther")}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Selected date display */}
      {value && (
        <View
          style={[
            styles.selectedDateWrap,
            { borderColor: userTokens.border, backgroundColor: userTokens.surface },
          ]}
        >
          <Calendar size={15} color={userTokens.textSecondary} />
          <Text style={[styles.selectedDate, { color: userTokens.textPrimary }]}>
            {formatDateForDisplay(value, locale)}
          </Text>
        </View>
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
    gap: tokens.spacing.md,
  },
  label: {
    fontSize: 11,
    fontWeight: tokens.typography.weight.semibold,
    textTransform: "uppercase",
    letterSpacing: 0.7,
    marginBottom: 2,
  },
  chipsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: tokens.spacing.sm,
    width: "100%",
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: tokens.spacing.xs,
    borderRadius: tokens.radii.md,
    borderWidth: 1,
    minHeight: 32,
  },
  chipFlexible: {
    flex: 1,
  },
  chipSelected: {
  },
  chipIcon: {
    marginRight: tokens.spacing.xs,
  },
  chipText: {
    fontSize: tokens.typography.size.xs,
    fontWeight: tokens.typography.weight.medium,
    textAlign: "center",
  },
  chipTextSelected: {
  },
  selectedDateWrap: {
    minHeight: 36,
    borderWidth: 1,
    borderRadius: tokens.radii.md,
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: tokens.spacing.xs,
    flexDirection: "row",
    alignItems: "center",
    gap: tokens.spacing.sm,
  },
  selectedDate: {
    fontSize: tokens.typography.size.md,
    fontWeight: tokens.typography.weight.medium,
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
