import { View, StyleSheet } from "react-native";
import { getProgressState, type OnboardingProgressStep } from "@poleursus/shared";
import { onboardingColors } from "./onboarding-theme";

interface OnboardingProgressProps {
  current: OnboardingProgressStep;
}

export function OnboardingProgress({ current }: OnboardingProgressProps) {
  const steps = getProgressState(current);

  return (
    <View style={styles.container}>
      {steps.map((step) => (
        <View key={step.step} style={styles.item}>
          <View
            style={[
              styles.bar,
              step.state === "completed" && styles.barCompleted,
              step.state === "active" && styles.barActive,
              step.state === "pending" && styles.barPending,
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
    backgroundColor: onboardingColors.border,
    marginHorizontal: 4,
  },
  barCompleted: {
    backgroundColor: onboardingColors.green,
  },
  barActive: {
    backgroundColor: onboardingColors.dark,
  },
  barPending: {
    backgroundColor: onboardingColors.border,
  },
});
