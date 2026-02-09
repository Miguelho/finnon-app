import { View, StyleSheet, type ViewStyle } from "react-native";
import { onboardingColors, onboardingRadii } from "./onboarding-theme";

interface OnboardingSurfaceProps {
  children: React.ReactNode;
  style?: ViewStyle | ViewStyle[];
}

export function OnboardingSurface({ children, style }: OnboardingSurfaceProps) {
  return <View style={[styles.surface, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  surface: {
    backgroundColor: onboardingColors.white,
    borderRadius: onboardingRadii.lg,
    borderWidth: 1,
    borderColor: onboardingColors.border,
    padding: 24,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 6,
    elevation: 2,
  },
});
