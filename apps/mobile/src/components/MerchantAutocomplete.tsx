import { useState, useMemo, useRef, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ScrollView,
  Keyboard,
  type NativeSyntheticEvent,
  type TextInputFocusEventData,
} from "react-native";
import {
  themeTokens,
  filterMerchantSuggestions,
  type MerchantSuggestion,
} from "@poleursus/shared";
import { useUserTheme } from "../contexts/UserThemeContext";

const tokens = themeTokens.light;

export interface MerchantAutocompleteProps {
  label: string;
  helperText?: string;
  value: string;
  onChangeText: (text: string) => void;
  suggestions: MerchantSuggestion[];
  placeholder?: string;
  disabled?: boolean;
  onFocus?: (event: NativeSyntheticEvent<TextInputFocusEventData>) => void;
}

export function MerchantAutocomplete({
  label,
  helperText,
  value,
  onChangeText,
  suggestions,
  placeholder,
  disabled,
  onFocus,
}: MerchantAutocompleteProps) {
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef<TextInput>(null);
  const { tokens: userTokens, primaryActionColor } = useUserTheme();

  const filteredSuggestions = useMemo(
    () => filterMerchantSuggestions(suggestions, value),
    [suggestions, value]
  );

  const showSuggestions = isFocused && filteredSuggestions.length > 0;

  const handleSelect = useCallback(
    (merchant: string) => {
      onChangeText(merchant);
      setIsFocused(false);
      Keyboard.dismiss();
    },
    [onChangeText]
  );

  return (
    <View style={styles.container}>
      <Text style={[styles.label, { color: userTokens.textPrimary }]}>{label}</Text>
      {helperText ? (
        <Text style={[styles.helperText, { color: userTokens.textSecondary }]}>
          {helperText}
        </Text>
      ) : null}
      <TextInput
        ref={inputRef}
        style={[
          styles.input,
          {
            borderColor: isFocused ? primaryActionColor : userTokens.border,
            backgroundColor: userTokens.surface,
            color: userTokens.textPrimary,
          },
          disabled && styles.inputDisabled,
          disabled && { backgroundColor: userTokens.surfaceAlt },
        ]}
        value={value}
        onChangeText={onChangeText}
        onFocus={(event) => {
          setIsFocused(true);
          onFocus?.(event);
        }}
        onBlur={() => {
          // Delay to allow press on suggestion
          setTimeout(() => setIsFocused(false), 150);
        }}
        placeholder={placeholder}
        placeholderTextColor={userTokens.textTertiary}
        editable={!disabled}
        autoCapitalize="words"
        autoCorrect={false}
      />

      {showSuggestions && (
        <View
          style={[
            styles.suggestionsContainer,
            {
              backgroundColor: userTokens.surface,
              borderColor: userTokens.border,
            },
          ]}
        >
          <ScrollView
            style={styles.suggestionsList}
            keyboardShouldPersistTaps="handled"
            nestedScrollEnabled
          >
            {filteredSuggestions.map((item) => (
              <Pressable
                key={item.normalized}
                style={({ pressed }) => [
                  styles.suggestionItem,
                  { borderBottomColor: userTokens.border },
                  pressed && styles.suggestionItemPressed,
                  pressed && { backgroundColor: userTokens.surfaceAlt },
                ]}
                onPress={() => handleSelect(item.merchant)}
              >
                <Text style={[styles.suggestionText, { color: userTokens.textPrimary }]}>
                  {item.merchant}
                </Text>
                <Text style={[styles.frequencyText, { color: userTokens.textTertiary }]}>
                  ({item.frequency}x)
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 0,
    zIndex: 10,
  },
  label: {
    fontSize: tokens.typography.size.lg,
    fontWeight: tokens.typography.weight.semibold,
    marginBottom: tokens.spacing.md,
  },
  helperText: {
    fontSize: tokens.typography.size.sm,
    fontWeight: tokens.typography.weight.medium,
    marginBottom: tokens.spacing.md,
  },
  input: {
    borderWidth: 1,
    borderRadius: tokens.radii.lg,
    paddingVertical: tokens.spacing.lg,
    paddingHorizontal: tokens.spacing.xl,
    fontSize: tokens.typography.size.lg,
    minHeight: 56,
  },
  inputDisabled: {
    opacity: 0.6,
  },
  suggestionsContainer: {
    position: "absolute",
    top: "100%",
    left: 0,
    right: 0,
    marginTop: 4,
    borderWidth: 1,
    borderRadius: tokens.radii.lg,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 4,
    maxHeight: 200,
    overflow: "hidden",
  },
  suggestionsList: {
    maxHeight: 200,
  },
  suggestionItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: tokens.spacing.md,
    paddingHorizontal: tokens.spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    minHeight: 48,
  },
  suggestionItemPressed: {
  },
  suggestionText: {
    fontSize: tokens.typography.size.md,
    fontWeight: tokens.typography.weight.medium,
  },
  frequencyText: {
    fontSize: tokens.typography.size.sm,
  },
});
