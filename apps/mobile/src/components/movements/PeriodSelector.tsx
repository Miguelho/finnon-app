import { View, Text, Pressable, StyleSheet } from "react-native";
import { PERIODS, type Period } from "@poleursus/shared";
import { movementsDesignTokens } from "../../types/movements";

interface PeriodSelectorProps {
  selected: Period;
  onSelect: (period: Period) => void;
}

const colors = movementsDesignTokens.colors;

export function PeriodSelector({ selected, onSelect }: PeriodSelectorProps) {
  return (
    <View style={styles.container}>
      {PERIODS.map(({ key, label }) => {
        const isActive = selected === key;
        return (
          <Pressable
            key={key}
            style={({ pressed }) => [
              styles.chip,
              isActive && styles.chipActive,
              pressed && styles.chipPressed,
            ]}
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
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
  },
  chipActive: {
    backgroundColor: colors.textPrimary,
    borderColor: colors.textPrimary,
  },
  chipPressed: {
    opacity: 0.85,
  },
  chipText: {
    fontSize: movementsDesignTokens.typography.sizes.sm,
    color: colors.textSecondary,
    fontFamily: "DMSans-Medium",
  },
  chipTextActive: {
    color: colors.surface,
  },
});
