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

const tokens = themeTokens.light;
const colors = tokens.colors;

export interface MerchantAutocompleteProps {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  suggestions: MerchantSuggestion[];
  placeholder?: string;
  disabled?: boolean;
  onFocus?: (event: NativeSyntheticEvent<TextInputFocusEventData>) => void;
}

export function MerchantAutocomplete({
  label,
  value,
  onChangeText,
  suggestions,
  placeholder,
  disabled,
  onFocus,
}: MerchantAutocompleteProps) {
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef<TextInput>(null);

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
      <Text style={styles.label}>{label}</Text>
      <TextInput
        ref={inputRef}
        style={[styles.input, disabled && styles.inputDisabled]}
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
        editable={!disabled}
        autoCapitalize="words"
        autoCorrect={false}
      />

      {showSuggestions && (
        <View style={styles.suggestionsContainer}>
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
                  pressed && styles.suggestionItemPressed,
                ]}
                onPress={() => handleSelect(item.merchant)}
              >
                <Text style={styles.suggestionText}>{item.merchant}</Text>
                <Text style={styles.frequencyText}>({item.frequency}x)</Text>
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
    color: colors.text.primary,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.state.neutral,
    borderRadius: tokens.radii.lg,
    paddingVertical: tokens.spacing.lg,
    paddingHorizontal: tokens.spacing.xl,
    fontSize: tokens.typography.size.lg,
    backgroundColor: colors.bg.surface,
    color: colors.text.primary,
    minHeight: 56,
  },
  inputDisabled: {
    backgroundColor: colors.bg.secondary,
    opacity: 0.6,
  },
  suggestionsContainer: {
    position: "absolute",
    top: "100%",
    left: 0,
    right: 0,
    marginTop: 4,
    backgroundColor: colors.bg.surface,
    borderWidth: 1,
    borderColor: colors.state.neutral,
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
    borderBottomColor: colors.state.neutral,
    minHeight: 48,
  },
  suggestionItemPressed: {
    backgroundColor: colors.bg.secondary,
  },
  suggestionText: {
    fontSize: tokens.typography.size.md,
    fontWeight: tokens.typography.weight.medium,
    color: colors.text.primary,
  },
  frequencyText: {
    fontSize: tokens.typography.size.sm,
    color: colors.text.muted,
  },
});
