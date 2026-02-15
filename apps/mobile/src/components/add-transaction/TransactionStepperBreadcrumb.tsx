import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Check } from "phosphor-react-native";
import { themeTokens, type StepStatus } from "@poleursus/shared";
import { useUserTheme } from "../../contexts/UserThemeContext";

const tokens = themeTokens.light;

interface Step {
  number: number;
  label: string;
  status: StepStatus;
}

interface TransactionStepperBreadcrumbProps {
  steps: Step[];
  onStepClick: (step: number) => void;
}

export function TransactionStepperBreadcrumb({
  steps,
  onStepClick,
}: TransactionStepperBreadcrumbProps) {
  const { tokens: userTokens, primaryActionColor, primaryActionTextColor } =
    useUserTheme();

  return (
    <View style={styles.container}>
      {steps.map((step, index) => (
        <View key={step.number} style={styles.stepWrapper}>
          {/* Connector line */}
          {index > 0 && (
            <View
              style={[
                styles.connector,
                { backgroundColor: userTokens.border },
                step.status !== "pending" && {
                  backgroundColor: primaryActionColor,
                },
              ]}
            />
          )}

          {/* Step indicator */}
          <TouchableOpacity
            onPress={() => onStepClick(step.number)}
            disabled={step.status === "pending"}
            style={[
              styles.stepButton,
              {
                borderColor: userTokens.border,
                backgroundColor: userTokens.surface,
              },
              step.status === "active" && {
                borderColor: primaryActionColor,
              },
              step.status === "completed" && {
                borderColor: primaryActionColor,
                backgroundColor: primaryActionColor,
              },
            ]}
            accessibilityRole="button"
            accessibilityLabel={`${step.label} - ${step.status}`}
          >
            {step.status === "completed" ? (
              <Check size={14} color={primaryActionTextColor} weight="bold" />
            ) : (
              <Text
                style={[
                  styles.stepNumber,
                  { color: userTokens.textTertiary },
                  step.status === "active" && {
                    color: primaryActionColor,
                  },
                ]}
              >
                {step.number}
              </Text>
            )}
          </TouchableOpacity>

          {/* Step label (only show for active step on small screens) */}
          {step.status === "active" && (
            <Text style={[styles.stepLabel, { color: userTokens.textPrimary }]} numberOfLines={1}>
              {step.label}
            </Text>
          )}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    gap: tokens.spacing.md,
  },
  stepWrapper: {
    flexDirection: "row",
    alignItems: "center",
    gap: tokens.spacing.md,
  },
  connector: {
    width: 28,
    height: 2,
    marginRight: tokens.spacing.md,
  },
  stepButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  stepNumber: {
    fontSize: tokens.typography.size.md,
    fontWeight: tokens.typography.weight.semibold,
  },
  stepLabel: {
    fontSize: tokens.typography.size.md,
    fontWeight: tokens.typography.weight.medium,
    maxWidth: 120,
  },
});
