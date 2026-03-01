import { useMemo, useState } from "react";
import {
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Check, ChevronDown } from "lucide-react-native";
import {
  PERIODS,
  formatMonthLabel,
  getRecentMonthKeys,
  type Period,
} from "@poleursus/shared";
import { typography, spacing, radii } from "../../theme/tokens";
import { useUserTheme } from "../../../../contexts/UserThemeContext";
import { useCopy, t } from "../../../../lib/i18n";

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
  const { tokens: userTokens, primaryActionColor, primaryActionTextColor } =
    useUserTheme();
  const [monthPickerOpen, setMonthPickerOpen] = useState(false);
  const months = useMemo(() => getRecentMonthKeys(12), []);
  const selectedMonthLabel = useMemo(
    () => formatMonthLabel(selectedMonth, locale),
    [selectedMonth, locale]
  );

  return (
    <View style={styles.wrapper}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.scroll}
        contentContainerStyle={styles.container}
      >
        {PERIODS.map(({ key }) => {
          if (key === "month") {
            const isActive = selectedPeriod === "month";
            return (
              <Pressable
                key={key}
                style={[
                  styles.monthChip,
                  {
                    backgroundColor: isActive
                      ? primaryActionColor
                      : userTokens.surface,
                  },
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
              style={[
                styles.chip,
                {
                  backgroundColor: isActive
                    ? primaryActionColor
                    : userTokens.surface,
                },
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
      </ScrollView>

      <Modal
        transparent
        visible={monthPickerOpen}
        onRequestClose={() => setMonthPickerOpen(false)}
        animationType="fade"
      >
        <Pressable style={styles.overlay} onPress={() => setMonthPickerOpen(false)} />
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
                          ? typography.family.sansSemiBold
                          : typography.family.sansMedium,
                        textTransform: "capitalize",
                      },
                    ]}
                  >
                    {formatMonthLabel(monthKey, locale)}
                  </Text>
                  {isSelected ? <Check size={14} color={primaryActionColor} /> : null}
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
    marginBottom: spacing["4xl"],
  },
  scroll: {
    marginBottom: spacing.sm,
  },
  container: {
    flexDirection: "row",
    justifyContent: "center",
    gap: spacing.xs,
    paddingHorizontal: spacing["4xl"],
    paddingRight: spacing["5xl"],
  },
  chip: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing["2xl"],
    borderRadius: radii.full,
  },
  monthChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing["2xl"],
    borderRadius: radii.full,
  },
  chipText: {
    fontFamily: typography.family.sansMedium,
    fontSize: typography.size.base,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 0, 0, 0.2)",
  },
  dropdown: {
    position: "absolute",
    top: "18%",
    left: 20,
    right: 20,
    maxHeight: "58%",
    borderRadius: radii.lg,
    borderWidth: 1,
    paddingVertical: spacing.sm,
  },
  dropdownItem: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    marginHorizontal: spacing.xs,
    borderRadius: radii.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  dropdownItemText: {
    fontSize: typography.size.base,
  },
});
