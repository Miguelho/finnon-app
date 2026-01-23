import { useState, useMemo, useRef, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ScrollView,
  Keyboard,
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
}

export function MerchantAutocomplete({
  label,
  value,
  onChangeText,
  suggestions,
  placeholder,
  disabled,
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
        onFocus={() => setIsFocused(true)}
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
    marginBottom: 16,
    zIndex: 10,
  },
  label: {
    fontSize: 14,
    fontWeight: tokens.typography.weight.semibold,
    marginBottom: 8,
    color: colors.text.primary,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.state.neutral,
    borderRadius: tokens.radii.md,
    paddingVertical: 12,
    paddingHorizontal: 16,
    fontSize: 16,
    backgroundColor: colors.bg.surface,
    color: colors.text.primary,
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
    borderRadius: tokens.radii.md,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 4,
    maxHeight: 180,
    overflow: "hidden",
  },
  suggestionsList: {
    maxHeight: 180,
  },
  suggestionItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.state.neutral,
  },
  suggestionItemPressed: {
    backgroundColor: colors.bg.secondary,
  },
  suggestionText: {
    fontSize: 14,
    fontWeight: tokens.typography.weight.medium,
    color: colors.text.primary,
  },
  frequencyText: {
    fontSize: 12,
    color: colors.text.muted,
  },
});
