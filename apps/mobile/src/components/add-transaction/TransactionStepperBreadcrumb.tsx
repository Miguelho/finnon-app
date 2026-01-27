import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Check } from "phosphor-react-native";
import { themeTokens, type StepStatus } from "@poleursus/shared";

const tokens = themeTokens.light;
const colors = tokens.colors;

interface Step {
  number: 1 | 2 | 3;
  label: string;
  status: StepStatus;
}

interface TransactionStepperBreadcrumbProps {
  steps: Step[];
  onStepClick: (step: 1 | 2 | 3) => void;
}

export function TransactionStepperBreadcrumb({
  steps,
  onStepClick,
}: TransactionStepperBreadcrumbProps) {
  return (
    <View style={styles.container}>
      {steps.map((step, index) => (
        <View key={step.number} style={styles.stepWrapper}>
          {/* Connector line */}
          {index > 0 && (
            <View
              style={[
                styles.connector,
                step.status !== "pending" && styles.connectorCompleted,
              ]}
            />
          )}

          {/* Step indicator */}
          <TouchableOpacity
            onPress={() => onStepClick(step.number)}
            disabled={step.status === "pending"}
            style={[
              styles.stepButton,
              step.status === "active" && styles.stepButtonActive,
              step.status === "completed" && styles.stepButtonCompleted,
            ]}
            accessibilityRole="button"
            accessibilityLabel={`${step.label} - ${step.status}`}
          >
            {step.status === "completed" ? (
              <Check size={14} color={colors.bg.primary} weight="bold" />
            ) : (
              <Text
                style={[
                  styles.stepNumber,
                  step.status === "active" && styles.stepNumberActive,
                ]}
              >
                {step.number}
              </Text>
            )}
          </TouchableOpacity>

          {/* Step label (only show for active step on small screens) */}
          {step.status === "active" && (
            <Text style={styles.stepLabel} numberOfLines={1}>
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
    backgroundColor: colors.state.neutral,
    marginRight: tokens.spacing.md,
  },
  connectorCompleted: {
    backgroundColor: colors.action.primary,
  },
  stepButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: colors.state.neutral,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.bg.surface,
  },
  stepButtonActive: {
    borderColor: colors.action.primary,
    backgroundColor: colors.bg.surface,
  },
  stepButtonCompleted: {
    borderColor: colors.action.primary,
    backgroundColor: colors.action.primary,
  },
  stepNumber: {
    fontSize: tokens.typography.size.md,
    fontWeight: tokens.typography.weight.semibold,
    color: colors.text.muted,
  },
  stepNumberActive: {
    color: colors.action.primary,
  },
  stepLabel: {
    fontSize: tokens.typography.size.md,
    fontWeight: tokens.typography.weight.medium,
    color: colors.text.primary,
    maxWidth: 120,
  },
});
