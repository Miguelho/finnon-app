import { TextInput, Text, View, StyleSheet } from "react-native";

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
}: InputProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={[
          styles.input,
          error && styles.inputError,
          disabled && styles.inputDisabled,
          multiline && styles.inputMultiline,
        ]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        keyboardType={keyboardType}
        maxLength={maxLength}
        editable={!disabled}
        autoCapitalize="none"
        autoCorrect={false}
        multiline={multiline}
        numberOfLines={numberOfLines}
      />
      {error && <Text style={styles.errorText}>{error}</Text>}
      {helperText && !error && <Text style={styles.helperText}>{helperText}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 8,
    color: "#000",
  },
  input: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    fontSize: 16,
    backgroundColor: "#fff",
  },
  inputError: {
    borderColor: "#ff3b30",
  },
  inputDisabled: {
    backgroundColor: "#f5f5f5",
    opacity: 0.6,
  },
  inputMultiline: {
    minHeight: 80,
    textAlignVertical: "top",
    paddingTop: 12,
  },
  errorText: {
    color: "#ff3b30",
    fontSize: 12,
    marginTop: 4,
  },
  helperText: {
    color: "#666",
    fontSize: 12,
    marginTop: 4,
  },
});
