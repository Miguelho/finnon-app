import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Pressable,
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { withAlpha } from "@poleursus/shared";
import { movementsDesignTokens } from "../../types/movements";
import { useUserTheme } from "../../contexts/UserThemeContext";
import { useCopy, t } from "../../lib/i18n";

type SearchBarProps = {
  value: string;
  onChange: (text: string) => void;
  onClear: () => void;
};

export function SearchBar({ value, onChange, onClear }: SearchBarProps) {
  const { dictionary } = useCopy();
  const { tokens: userTokens, primaryActionColor } = useUserTheme();
  const [isFocused, setIsFocused] = useState(false);
  const showBadge = isFocused || value.trim().length > 0;

  return (
    <View style={styles.container}>
      <View
        style={[
          styles.inputWrapper,
          {
            backgroundColor: userTokens.surface,
            borderColor: userTokens.border,
          },
        ]}
      >
        <MaterialCommunityIcons
          name="magnify"
          size={18}
          color={userTokens.textSecondary}
        />
        <TextInput
          style={[styles.input, { color: userTokens.textPrimary }]}
          placeholder={t(dictionary, "transactions.ui.searchPlaceholder")}
          placeholderTextColor={userTokens.textSecondary}
          value={value}
          onChangeText={onChange}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
        />
        {showBadge && (
          <View
            style={[
              styles.badge,
              { backgroundColor: withAlpha(primaryActionColor, 0.14) },
            ]}
          >
            <Text style={[styles.badgeText, { color: primaryActionColor }]}>
              {t(dictionary, "transactions.ui.searchInPeriod")}
            </Text>
          </View>
        )}
        {value.trim().length > 0 && (
          <Pressable onPress={onClear} hitSlop={8}>
            <MaterialCommunityIcons
              name="close-circle"
              size={18}
              color={userTokens.textSecondary}
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
    borderRadius: movementsDesignTokens.radius.md,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  input: {
    flex: 1,
    fontSize: movementsDesignTokens.typography.sizes.md,
    fontFamily: "DMSans",
  },
  badge: {
    borderRadius: movementsDesignTokens.radius.full,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  badgeText: {
    fontSize: movementsDesignTokens.typography.sizes.xs,
    fontFamily: "DMSans-Medium",
  },
});
