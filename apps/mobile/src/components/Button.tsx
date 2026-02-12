import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { themeTokens } from "@poleursus/shared";
import { useUserTheme } from "../contexts/UserThemeContext";

const tokens = themeTokens.light;
const colors = tokens.colors;

interface ButtonProps {
  onPress: () => void;
  title: string;
  disabled?: boolean;
  loading?: boolean;
  variant?: "primary" | "secondary";
}

export function Button({
  onPress,
  title,
  disabled,
  loading,
  variant = "primary",
}: ButtonProps) {
  const {
    tokens: userTokens,
    primaryActionColor,
    primaryActionTextColor,
  } = useUserTheme();

  return (
    <TouchableOpacity
      style={[
        styles.button,
        variant === "primary" && { backgroundColor: primaryActionColor },
        variant === "secondary" && styles.buttonSecondary,
        variant === "secondary" && {
          borderColor: userTokens.border,
          backgroundColor: userTokens.surface,
        },
        disabled && styles.buttonDisabled,
      ]}
      onPress={onPress}
      disabled={disabled || loading}
    >
      {loading ? (
        <ActivityIndicator
          color={
            variant === "primary" ? primaryActionTextColor : userTokens.textPrimary
          }
        />
      ) : (
        <Text
          style={[
            styles.buttonText,
            variant === "primary" && { color: primaryActionTextColor },
            variant === "secondary" && styles.buttonTextSecondary,
            variant === "secondary" && { color: userTokens.textPrimary },
          ]}
        >
          {title}
        </Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: tokens.radii.md,
    alignItems: "center",
  },
  buttonSecondary: {
    borderWidth: 1,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: colors.bg.primary,
    fontSize: 16,
    fontWeight: tokens.typography.weight.semibold,
  },
  buttonTextSecondary: {
  },
});
