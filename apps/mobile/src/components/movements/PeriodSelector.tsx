import { useMemo, useState } from "react";
import {
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { ChevronDown, Check } from "lucide-react-native";
import {
  PERIODS,
  formatMonthLabel,
  getRecentMonthKeys,
  type Period,
} from "@poleursus/shared";
import { movementsDesignTokens } from "../../types/movements";
import { useUserTheme } from "../../contexts/UserThemeContext";
import { useCopy, t } from "../../lib/i18n";

interface PeriodSelectorProps {
  selectedPeriod: Period;
  selectedMonth: string;
  onSelectPeriod: (period: Period) => void;
  onSelectMonth: (monthKey: string) => void;
  locale?: string;
}

const periodLabelKey: Record<Period, string> = {
  week: "common.periodWeek",
  month: "common.periodMonth",
  quarter: "common.periodQuarter",
  year: "common.periodYear",
};

export function PeriodSelector({
  selectedPeriod,
  selectedMonth,
  onSelectPeriod,
  onSelectMonth,
  locale = "es",
}: PeriodSelectorProps) {
  const { dictionary } = useCopy();
  const {
    tokens: userTokens,
    primaryActionColor,
    primaryActionTextColor,
  } = useUserTheme();
  const [monthPickerOpen, setMonthPickerOpen] = useState(false);
  const months = useMemo(() => getRecentMonthKeys(12), []);
  const selectedMonthLabel = useMemo(
    () => formatMonthLabel(selectedMonth, locale),
    [selectedMonth, locale]
  );

  return (
    <View style={styles.wrapper}>
      <View style={styles.container}>
        {PERIODS.map(({ key }) => {
          if (key === "month") {
            const isActive = selectedPeriod === "month";
            return (
              <Pressable
                key={key}
                style={({ pressed }) => [
                  styles.monthPill,
                  {
                    backgroundColor: isActive
                      ? primaryActionColor
                      : userTokens.surface,
                    borderColor: isActive
                      ? primaryActionColor
                      : userTokens.border,
                  },
                  pressed && styles.chipPressed,
                ]}
                onPress={() => {
                  if (isActive) {
                    setMonthPickerOpen(true);
                  } else {
                    onSelectPeriod("month");
                  }
                }}
                onLongPress={() => setMonthPickerOpen(true)}
              >
                <Text
                  style={[
                    styles.chipText,
                    {
                      color: isActive
                        ? primaryActionTextColor
                        : userTokens.textSecondary,
                      textTransform: "capitalize",
                    },
                  ]}
                >
                  {selectedMonthLabel}
                </Text>
                <ChevronDown
                  size={12}
                  color={
                    isActive ? primaryActionTextColor : userTokens.textSecondary
                  }
                />
              </Pressable>
            );
          }

          const isActive = selectedPeriod === key;
          return (
            <Pressable
              key={key}
              style={({ pressed }) => [
                styles.chip,
                {
                  backgroundColor: isActive
                    ? primaryActionColor
                    : userTokens.surface,
                  borderColor: isActive
                    ? primaryActionColor
                    : userTokens.border,
                },
                pressed && styles.chipPressed,
              ]}
              onPress={() => onSelectPeriod(key)}
            >
              <Text
                style={[
                  styles.chipText,
                  {
                    color: isActive
                      ? primaryActionTextColor
                      : userTokens.textSecondary,
                  },
                ]}
              >
                {t(dictionary, periodLabelKey[key] as any)}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Modal
        transparent
        visible={monthPickerOpen}
        onRequestClose={() => setMonthPickerOpen(false)}
        animationType="fade"
      >
        <Pressable
          style={styles.overlay}
          onPress={() => setMonthPickerOpen(false)}
        />
        <View
          style={[
            styles.dropdown,
            {
              backgroundColor: userTokens.surface,
              borderColor: userTokens.border,
            },
          ]}
        >
          <FlatList
            data={months}
            keyExtractor={(item) => item}
            renderItem={({ item: monthKey }) => {
              const isSelected = monthKey === selectedMonth;
              return (
                <Pressable
                  style={({ pressed }) => [
                    styles.dropdownItem,
                    isSelected && {
                      backgroundColor: `${primaryActionColor}18`,
                    },
                    pressed && { opacity: 0.7 },
                  ]}
                  onPress={() => {
                    onSelectMonth(monthKey);
                    onSelectPeriod("month");
                    setMonthPickerOpen(false);
                  }}
                >
                  <Text
                    style={[
                      styles.dropdownItemText,
                      {
                        color: isSelected
                          ? primaryActionColor
                          : userTokens.textPrimary,
                        fontFamily: isSelected
                          ? "DMSans-SemiBold"
                          : "DMSans-Medium",
                        textTransform: "capitalize",
                      },
                    ]}
                  >
                    {formatMonthLabel(monthKey, locale)}
                  </Text>
                  {isSelected && (
                    <Check size={14} color={primaryActionColor} />
                  )}
                </Pressable>
              );
            }}
          />
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    gap: 6,
  },
  container: {
    flexDirection: "row",
    justifyContent: "center",
    flexWrap: "wrap",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  chip: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: movementsDesignTokens.radius.full,
    borderWidth: 1,
  },
  monthPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: movementsDesignTokens.radius.full,
    borderWidth: 1,
  },
  chipPressed: {
    opacity: 0.85,
  },
  chipText: {
    fontSize: movementsDesignTokens.typography.sizes.sm,
    fontFamily: "DMSans-Medium",
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.3)",
  },
  dropdown: {
    position: "absolute",
    top: "30%",
    left: 40,
    right: 40,
    maxHeight: 340,
    borderRadius: 16,
    borderWidth: 1,
    paddingVertical: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 8,
  },
  dropdownItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    marginHorizontal: 8,
  },
  dropdownItemText: {
    fontSize: movementsDesignTokens.typography.sizes.md,
  },
});
