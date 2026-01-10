import { useMemo, useState } from "react";
import {
  View,
  Text,
  Pressable,
  Modal,
  StyleSheet,
  TouchableOpacity,
} from "react-native";
import { themeTokens } from "@poleursus/shared";
import { MonthMap } from "./home/MonthMap";
import { useCopy, t } from "../lib/i18n";

const tokens = themeTokens.light;
const colors = tokens.colors;

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

type DatePickerFieldProps = {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  helperText?: string;
  error?: string;
  disabled?: boolean;
  allowClear?: boolean;
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
}: DatePickerFieldProps) {
  const { locale, dictionary } = useCopy();
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

  const displayValue = value || placeholder || "";

  return (
    <View style={styles.container}>
      {label ? (
        <View style={styles.labelRow}>
          <Text style={styles.label}>{label}</Text>
          {allowClear && value ? (
            <TouchableOpacity onPress={handleClear} disabled={disabled}>
              <Text style={styles.clearText}>
                {t(dictionary, "common.clear")}
              </Text>
            </TouchableOpacity>
          ) : null}
        </View>
      ) : null}
      <Pressable
        style={[
          styles.input,
          error && styles.inputError,
          disabled && styles.inputDisabled,
        ]}
        onPress={openPicker}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ disabled: !!disabled }}
      >
        <Text
          style={[
            styles.valueText,
            !value && styles.placeholderText,
            disabled && styles.valueDisabled,
          ]}
        >
          {displayValue}
        </Text>
      </Pressable>
      {error && <Text style={styles.errorText}>{error}</Text>}
      {helperText && !error && <Text style={styles.helperText}>{helperText}</Text>}

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
          <View style={styles.sheetContainer}>
            <View style={styles.sheetHandle} />
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>{label}</Text>
              <TouchableOpacity onPress={() => setIsOpen(false)}>
                <Text style={styles.sheetAction}>
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
                <Text style={styles.navText}>{"<"}</Text>
              </TouchableOpacity>
              <Text style={styles.monthLabel}>{monthLabel}</Text>
              <TouchableOpacity
                onPress={goToNextMonth}
                style={styles.navButton}
                accessibilityLabel={t(dictionary, "transactions.nextMonth")}
              >
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
    color: colors.text.primary,
  },
  clearText: {
    fontSize: tokens.typography.size.sm,
    fontWeight: tokens.typography.weight.medium,
    color: colors.action.primary,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.state.neutral,
    borderRadius: tokens.radii.md,
    paddingVertical: tokens.spacing.md,
    paddingHorizontal: tokens.spacing.lg,
    backgroundColor: colors.bg.surface,
  },
  inputError: {
    borderColor: colors.state.negative,
  },
  inputDisabled: {
    backgroundColor: colors.bg.secondary,
    opacity: 0.7,
  },
  valueText: {
    fontSize: tokens.typography.size.md,
    color: colors.text.primary,
  },
  placeholderText: {
    color: colors.text.muted,
  },
  valueDisabled: {
    color: colors.text.muted,
  },
  errorText: {
    color: colors.state.negative,
    fontSize: tokens.typography.size.xs,
    marginTop: tokens.spacing.xs,
  },
  helperText: {
    color: colors.text.secondary,
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
