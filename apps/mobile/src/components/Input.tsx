import {
  TextInput,
  Text,
  View,
  StyleSheet,
  type NativeSyntheticEvent,
  type TextInputFocusEventData,
} from "react-native";
import { themeTokens } from "@poleursus/shared";
import { useUserTheme } from "../contexts/UserThemeContext";

const tokens = themeTokens.light;
const colors = tokens.colors;

interface InputProps {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  keyboardType?: "default" | "email-address" | "numeric";
  maxLength?: number;
  disabled?: boolean;
  error?: string;
  helperText?: string;
  multiline?: boolean;
  numberOfLines?: number;
  onFocus?: (event: NativeSyntheticEvent<TextInputFocusEventData>) => void;
}

export function Input({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType = "default",
  maxLength,
  disabled,
  error,
  helperText,
  multiline,
  numberOfLines,
  onFocus,
}: InputProps) {
  const { tokens: userTokens } = useUserTheme();

  return (
    <View style={styles.container}>
      <Text style={[styles.label, { color: userTokens.textPrimary }]}>{label}</Text>
      <TextInput
        style={[
          styles.input,
          {
            borderColor: userTokens.border,
            backgroundColor: userTokens.surface,
            color: userTokens.textPrimary,
          },
          error && styles.inputError,
          disabled && styles.inputDisabled,
          disabled && { backgroundColor: userTokens.surfaceAlt },
          multiline && styles.inputMultiline,
        ]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={userTokens.textSecondary}
        keyboardType={keyboardType}
        maxLength={maxLength}
        editable={!disabled}
        autoCapitalize="none"
        autoCorrect={false}
        multiline={multiline}
        numberOfLines={numberOfLines}
        onFocus={onFocus}
      />
      {error && <Text style={styles.errorText}>{error}</Text>}
      {helperText && !error && (
        <Text style={[styles.helperText, { color: userTokens.textSecondary }]}>
          {helperText}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: tokens.typography.weight.semibold,
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderRadius: tokens.radii.md,
    paddingVertical: 12,
    paddingHorizontal: 16,
    fontSize: 16,
  },
  inputError: {
    borderColor: colors.state.negative,
  },
  inputDisabled: {
    opacity: 0.6,
  },
  inputMultiline: {
    minHeight: 80,
    textAlignVertical: "top",
    paddingTop: 12,
  },
  errorText: {
    color: colors.state.negative,
    fontSize: 12,
    marginTop: 4,
  },
  helperText: {
    fontSize: 12,
    fontWeight: tokens.typography.weight.medium,
    marginTop: 4,
  },
});
