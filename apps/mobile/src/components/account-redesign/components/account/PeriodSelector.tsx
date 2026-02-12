import { View, Text, StyleSheet, Pressable } from "react-native";
import { PERIODS, type Period } from "@poleursus/shared";
import { typography, spacing, radii } from "../../theme/tokens";
import { useUserTheme } from "../../../../contexts/UserThemeContext";

interface PeriodSelectorProps {
  selected: Period;
  onSelect: (period: Period) => void;
}

export function PeriodSelector({ selected, onSelect }: PeriodSelectorProps) {
  const { tokens: userTokens, primaryActionColor, primaryActionTextColor } =
    useUserTheme();

  return (
    <View style={styles.container}>
      {PERIODS.map(({ key, label }) => {
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
  chipText: {
    fontFamily: typography.family.sansMedium,
    fontSize: typography.size.base,
  },
});
