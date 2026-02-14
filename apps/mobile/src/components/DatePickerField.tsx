import { useMemo, useState } from "react";
import {
  View,
  Text,
  Pressable,
  Modal,
  StyleSheet,
  TouchableOpacity,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from "react-native";
import { themeTokens, startOfMonth } from "@poleursus/shared";
import { MonthMap } from "./home/MonthMap";
import { useCopy, t } from "../lib/i18n";
import { useUserTheme } from "../contexts/UserThemeContext";

const tokens = themeTokens.light;

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

type DatePickerFieldProps = {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  helperText?: string;
  error?: string;
  disabled?: boolean;
  allowClear?: boolean;
  formatValue?: (value: string) => string;
  containerStyle?: StyleProp<ViewStyle>;
  inputStyle?: StyleProp<ViewStyle>;
  valueTextStyle?: StyleProp<TextStyle>;
  placeholderTextColor?: string;
  sheetBackgroundColor?: string;
  sheetBorderColor?: string;
  sheetActionColor?: string;
  onOpen?: () => void;
  hideLabel?: boolean;
};

export function DatePickerField({
  label,
  value,
  onChangeText,
  placeholder,
  helperText,
  error,
  disabled,
  allowClear,
  formatValue,
  containerStyle,
  inputStyle,
  valueTextStyle,
  placeholderTextColor,
  sheetBackgroundColor,
  sheetBorderColor,
  sheetActionColor,
  onOpen,
  hideLabel = false,
}: DatePickerFieldProps) {
  const { locale, dictionary } = useCopy();
  const { tokens: userTokens } = useUserTheme();
  const selectedDate = useMemo(() => parseIsoDate(value), [value]);
  const [isOpen, setIsOpen] = useState(false);
  const [visibleMonth, setVisibleMonth] = useState(() =>
    startOfMonth(selectedDate ?? new Date())
  );

  const monthLabel = useMemo(
    () =>
      new Intl.DateTimeFormat(locale, {
        month: "long",
        year: "numeric",
      }).format(visibleMonth),
    [locale, visibleMonth]
  );

  const openPicker = () => {
    if (disabled) return;
    const baseDate = selectedDate ?? new Date();
    setVisibleMonth(startOfMonth(baseDate));
    setIsOpen(true);
    onOpen?.();
  };

  const handleSelectDate = (date: Date) => {
    onChangeText(formatIsoDate(date));
    setIsOpen(false);
  };

  const handleClear = () => {
    onChangeText("");
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

  const formattedValue = value
    ? formatValue?.(value) ?? value
    : "";
  const displayValue = formattedValue || placeholder || "";

  return (
    <View style={[styles.container, containerStyle]}>
      {label && !hideLabel ? (
        <View style={styles.labelRow}>
          <Text style={[styles.label, { color: userTokens.textPrimary }]}>{label}</Text>
          {allowClear && value ? (
            <TouchableOpacity onPress={handleClear} disabled={disabled}>
              <Text
                style={[
                  styles.clearText,
                  { color: sheetActionColor ?? userTokens.primary },
                ]}
              >
                {t(dictionary, "common.clear")}
              </Text>
            </TouchableOpacity>
          ) : null}
        </View>
      ) : null}
      <Pressable
        style={[
          styles.input,
          {
            borderColor: userTokens.border,
            backgroundColor: userTokens.surface,
          },
          inputStyle,
          error && { borderColor: userTokens.dangerBorder },
          disabled && styles.inputDisabled,
          disabled && { backgroundColor: userTokens.surfaceAlt },
        ]}
        onPress={openPicker}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ disabled: !!disabled }}
      >
        <Text
          style={[
            styles.valueText,
            { color: userTokens.textPrimary },
            valueTextStyle,
            !value && {
              color: placeholderTextColor ?? userTokens.textTertiary,
            },
            disabled && { color: userTokens.textTertiary },
          ]}
        >
          {displayValue}
        </Text>
      </Pressable>
      {error && (
        <Text style={[styles.errorText, { color: userTokens.dangerText }]}>
          {error}
        </Text>
      )}
      {helperText && !error && (
        <Text style={[styles.helperText, { color: userTokens.textSecondary }]}>
          {helperText}
        </Text>
      )}

      <Modal
        transparent
        visible={isOpen}
        animationType="slide"
        onRequestClose={() => setIsOpen(false)}
      >
        <View style={styles.sheetOverlay}>
          <Pressable
            style={styles.sheetBackdrop}
            onPress={() => setIsOpen(false)}
          />
          <View
            style={[
              styles.sheetContainer,
              {
                backgroundColor: sheetBackgroundColor ?? userTokens.surface,
                borderTopColor: sheetBorderColor ?? userTokens.border,
              },
            ]}
          >
            <View style={styles.sheetHandle} />
            <View style={styles.sheetHeader}>
              <Text style={[styles.sheetTitle, { color: userTokens.textPrimary }]}>
                {label || t(dictionary, "addTransaction.dateLabel")}
              </Text>
              <TouchableOpacity onPress={() => setIsOpen(false)}>
                <Text
                  style={[
                    styles.sheetAction,
                    { color: sheetActionColor ?? userTokens.primary },
                  ]}
                >
                  {t(dictionary, "common.close")}
                </Text>
              </TouchableOpacity>
            </View>
            <View style={styles.monthNav}>
              <TouchableOpacity
                onPress={goToPreviousMonth}
                style={styles.navButton}
                accessibilityLabel={t(dictionary, "transactions.previousMonth")}
              >
                <Text style={[styles.navText, { color: userTokens.textPrimary }]}>
                  {"<"}
                </Text>
              </TouchableOpacity>
              <Text style={[styles.monthLabel, { color: userTokens.textPrimary }]}>
                {monthLabel}
              </Text>
              <TouchableOpacity
                onPress={goToNextMonth}
                style={styles.navButton}
                accessibilityLabel={t(dictionary, "transactions.nextMonth")}
              >
                <Text style={[styles.navText, { color: userTokens.textPrimary }]}>
                  {">"}
                </Text>
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
    marginBottom: tokens.spacing.lg,
  },
  labelRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: tokens.spacing.sm,
  },
  label: {
    fontSize: tokens.typography.size.sm,
    fontWeight: tokens.typography.weight.semibold,
  },
  clearText: {
    fontSize: tokens.typography.size.sm,
    fontWeight: tokens.typography.weight.medium,
  },
  input: {
    borderWidth: 1,
    borderRadius: tokens.radii.md,
    paddingVertical: tokens.spacing.md,
    paddingHorizontal: tokens.spacing.lg,
  },
  inputDisabled: {
    opacity: 0.7,
  },
  valueText: {
    fontSize: tokens.typography.size.md,
  },
  errorText: {
    fontSize: tokens.typography.size.xs,
    marginTop: tokens.spacing.xs,
  },
  helperText: {
    fontSize: tokens.typography.size.xs,
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
    backgroundColor: "#9CA3AF",
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
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: tokens.spacing.sm,
  },
  navText: {
    fontSize: tokens.typography.size.lg,
    fontWeight: tokens.typography.weight.semibold,
  },
  monthLabel: {
    fontSize: tokens.typography.size.md,
    fontWeight: tokens.typography.weight.medium,
  },
});
