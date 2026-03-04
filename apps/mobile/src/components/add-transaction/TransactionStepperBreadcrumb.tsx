import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Check } from "lucide-react-native";
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
      {steps.map((step, index) => {
        const isClickable = step.status === "completed";
        return (
          <View key={step.number} style={styles.stepWrapper}>
            {/* Connector line */}
            {index < steps.length - 1 && (
              <View
                style={[
                  styles.connector,
                  {
                    backgroundColor:
                      step.status === "completed"
                        ? primaryActionColor
                        : userTokens.border,
                  },
                ]}
              />
            )}

            {/* Step indicator */}
            <TouchableOpacity
              onPress={() => isClickable && onStepClick(step.number)}
              disabled={!isClickable}
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
                <Check size={14} color={primaryActionTextColor} strokeWidth={3} />
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

            {/* Step label */}
            {step.status === "active" && (
              <Text
                style={[styles.stepLabel, { color: userTokens.textPrimary }]}
                numberOfLines={1}
              >
                {step.label}
              </Text>
            )}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "flex-start",
    width: "100%",
  },
  stepWrapper: {
    flex: 1,
    alignItems: "center",
    position: "relative",
    minHeight: 56,
  },
  connector: {
    position: "absolute",
    top: 16,
    left: "50%",
    width: "100%",
    height: 2,
  },
  stepButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1,
  },
  stepNumber: {
    fontSize: tokens.typography.size.md,
    fontWeight: tokens.typography.weight.semibold,
  },
  stepLabel: {
    marginTop: tokens.spacing.sm,
    fontSize: tokens.typography.size.md,
    fontWeight: tokens.typography.weight.medium,
    maxWidth: 120,
    textAlign: "center",
  },
});
