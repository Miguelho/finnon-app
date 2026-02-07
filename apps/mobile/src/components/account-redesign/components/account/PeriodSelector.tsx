import { View, Text, StyleSheet, Pressable } from "react-native";
import { PERIODS, type Period } from "@poleursus/shared";
import { colors, typography, spacing, radii } from "../../theme/tokens";

interface PeriodSelectorProps {
  selected: Period;
  onSelect: (period: Period) => void;
}

export function PeriodSelector({ selected, onSelect }: PeriodSelectorProps) {
  return (
    <View style={styles.container}>
      {PERIODS.map(({ key, label }) => {
        const isActive = selected === key;
        return (
          <Pressable
            key={key}
            style={[styles.chip, isActive && styles.chipActive]}
            onPress={() => onSelect(key)}
          >
            <Text style={[styles.chipText, isActive && styles.chipTextActive]}>
              {label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing['4xl'],
    marginBottom: spacing['4xl'],
  },
  chip: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing['2xl'],
    borderRadius: radii.full,
  },
  chipActive: {
    backgroundColor: colors.textPrimary,
  },
  chipText: {
    fontFamily: typography.family.sansMedium,
    fontSize: typography.size.base,
    color: colors.textTertiary,
  },
  chipTextActive: {
    color: '#FFFFFF',
  },
});
