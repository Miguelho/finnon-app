import { View, StyleSheet } from "react-native";
import { getProgressState, type OnboardingProgressStep } from "@poleursus/shared";
import { useUserTheme } from "../../../src/contexts/UserThemeContext";

interface OnboardingProgressProps {
  current: OnboardingProgressStep;
}

export function OnboardingProgress({ current }: OnboardingProgressProps) {
  const steps = getProgressState(current);
  const { tokens: userTokens, primaryActionColor } = useUserTheme();

  return (
    <View style={styles.container}>
      {steps.map((step) => (
        <View key={step.step} style={styles.item}>
          <View
            style={[
              styles.bar,
              { backgroundColor: userTokens.border },
              step.state === "completed" && { backgroundColor: "#16a34a" },
              step.state === "active" && { backgroundColor: primaryActionColor },
            ]}
          />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  item: {
    flexDirection: "row",
    alignItems: "center",
  },
  bar: {
    width: 40,
    height: 4,
    borderRadius: 2,
    marginHorizontal: 4,
  },
});
