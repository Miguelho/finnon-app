import { View, Text, StyleSheet, Pressable, ScrollView } from "react-native";
import { PERIODS, type Period } from "@poleursus/shared";
import { typography, spacing, radii } from "../../theme/tokens";
import { useUserTheme } from "../../../../contexts/UserThemeContext";
import { useCopy, t } from "../../../../lib/i18n";

interface PeriodSelectorProps {
  selected: Period;
  onSelect: (period: Period) => void;
}

export function PeriodSelector({ selected, onSelect }: PeriodSelectorProps) {
  const { dictionary } = useCopy();
  const { tokens: userTokens, primaryActionColor, primaryActionTextColor } =
    useUserTheme();
  const periodLabelKey: Record<Period, string> = {
    week: "common.periodWeek",
    month: "common.periodMonth",
    quarter: "common.periodQuarter",
    year: "common.periodYear",
  };

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.scroll}
      contentContainerStyle={styles.container}
    >
      {PERIODS.map(({ key }) => {
        const isActive = selected === key;
        return (
          <Pressable
            key={key}
            style={[
              styles.chip,
              isActive && { backgroundColor: primaryActionColor },
            ]}
            onPress={() => onSelect(key)}
          >
            <Text
              style={[
                styles.chipText,
                { color: userTokens.textSecondary },
                isActive && { color: primaryActionTextColor },
              ]}
            >
              {t(dictionary, periodLabelKey[key] as any)}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    marginBottom: spacing["4xl"],
  },
  container: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing['4xl'],
    paddingRight: spacing['5xl'],
  },
  chip: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing['2xl'],
    borderRadius: radii.full,
  },
  chipText: {
    fontFamily: typography.family.sansMedium,
    fontSize: typography.size.base,
  },
});
