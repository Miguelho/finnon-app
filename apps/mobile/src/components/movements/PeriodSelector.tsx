import { View, Text, Pressable, StyleSheet } from "react-native";
import { PERIODS, type Period } from "@poleursus/shared";
import { movementsDesignTokens } from "../../types/movements";
import { useUserTheme } from "../../contexts/UserThemeContext";

interface PeriodSelectorProps {
  selected: Period;
  onSelect: (period: Period) => void;
}

export function PeriodSelector({ selected, onSelect }: PeriodSelectorProps) {
  const {
    tokens: userTokens,
    primaryActionColor,
    primaryActionTextColor,
  } = useUserTheme();

  return (
    <View style={styles.container}>
      {PERIODS.map(({ key, label }) => {
        const isActive = selected === key;
        return (
          <Pressable
            key={key}
            style={({ pressed }) => [
              styles.chip,
              {
                backgroundColor: userTokens.surface,
                borderColor: userTokens.border,
              },
              isActive && {
                backgroundColor: primaryActionColor,
                borderColor: primaryActionColor,
              },
              pressed && styles.chipPressed,
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
  chipPressed: {
    opacity: 0.85,
  },
  chipText: {
    fontSize: movementsDesignTokens.typography.sizes.sm,
    fontFamily: "DMSans-Medium",
  },
});
