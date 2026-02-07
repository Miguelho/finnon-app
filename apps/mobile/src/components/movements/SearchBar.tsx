import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Pressable,
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { movementsDesignTokens } from "../../types/movements";

type SearchBarProps = {
  value: string;
  onChange: (text: string) => void;
  onClear: () => void;
};

const colors = movementsDesignTokens.colors;

export function SearchBar({ value, onChange, onClear }: SearchBarProps) {
  const [isFocused, setIsFocused] = useState(false);
  const showBadge = isFocused || value.trim().length > 0;

  return (
    <View style={styles.container}>
      <View style={styles.inputWrapper}>
        <MaterialCommunityIcons
          name="magnify"
          size={18}
          color={colors.textTertiary}
        />
        <TextInput
          style={styles.input}
          placeholder="Buscar movimiento, comercio, importe..."
          placeholderTextColor={colors.textTertiary}
          value={value}
          onChangeText={onChange}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
        />
        {showBadge && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>Búsqueda global</Text>
          </View>
        )}
        {value.trim().length > 0 && (
          <Pressable onPress={onClear} hitSlop={8}>
            <MaterialCommunityIcons
              name="close-circle"
              size={18}
              color={colors.textTertiary}
            />
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: "100%",
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: colors.surface,
    borderRadius: movementsDesignTokens.radius.md,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  input: {
    flex: 1,
    fontSize: movementsDesignTokens.typography.sizes.md,
    fontFamily: "DMSans",
    color: colors.textPrimary,
  },
  badge: {
    backgroundColor: colors.accentBlueBg,
    borderRadius: movementsDesignTokens.radius.full,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  badgeText: {
    fontSize: movementsDesignTokens.typography.sizes.xs,
    color: colors.accentBlue,
    fontFamily: "DMSans-Medium",
  },
});
