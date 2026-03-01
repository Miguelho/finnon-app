import { useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { CATEGORY_PALETTE, normalizeHexColor, themeTokens } from "@poleursus/shared";
import { useUserTheme } from "../contexts/UserThemeContext";
import { useCopy, t } from "../lib/i18n";

const tokens = themeTokens.light;

type CategoryColorPickerProps = {
  value: string | null | undefined;
  onChange: (nextColor: string) => void;
};

export function CategoryColorPicker({ value, onChange }: CategoryColorPickerProps) {
  const { dictionary } = useCopy();
  const { tokens: userTokens, primaryActionColor } = useUserTheme();
  const [customValue, setCustomValue] = useState("");
  const normalizedValue = normalizeHexColor(value);
  const isPreset = useMemo(
    () =>
      Boolean(
        normalizedValue &&
          CATEGORY_PALETTE.includes(normalizedValue as (typeof CATEGORY_PALETTE)[number])
      ),
    [normalizedValue]
  );

  useEffect(() => {
    if (normalizedValue && !isPreset) {
      setCustomValue(normalizedValue);
      return;
    }
    setCustomValue("");
  }, [isPreset, normalizedValue]);

  return (
    <View style={styles.container}>
      <View style={styles.swatches}>
        {CATEGORY_PALETTE.map((color) => {
          const isSelected = normalizedValue === color;
          return (
            <Pressable
              key={color}
              onPress={() => onChange(color)}
              style={[
                styles.swatch,
                { backgroundColor: color, borderColor: userTokens.border },
                isSelected && {
                  borderColor: primaryActionColor,
                  transform: [{ scale: 1.06 }],
                },
              ]}
              accessibilityRole="button"
              accessibilityLabel={`${t(dictionary, "categories.colorLabel")} ${color}`}
            >
              {isSelected ? <View style={styles.innerRing} /> : null}
            </Pressable>
          );
        })}
      </View>

      <Text style={[styles.customLabel, { color: userTokens.textSecondary }]}>
        {t(dictionary, "categories.customColorLabel")}
      </Text>
      <TextInput
        value={customValue}
        onChangeText={(nextValue) => {
          setCustomValue(nextValue);
          const normalized = normalizeHexColor(nextValue);
          if (normalized) onChange(normalized);
        }}
        placeholder="#D4943A"
        autoCapitalize="characters"
        autoCorrect={false}
        maxLength={7}
        style={[
          styles.customInput,
          {
            backgroundColor: userTokens.surfaceAlt,
            borderColor: userTokens.border,
            color: userTokens.textPrimary,
          },
          !isPreset && normalizedValue && { borderColor: primaryActionColor },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 10,
  },
  swatches: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  swatch: {
    width: 28,
    height: 28,
    borderRadius: 16,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  innerRing: {
    width: 10,
    height: 10,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: "#FFFFFF",
  },
  customLabel: {
    fontSize: tokens.typography.size.xs,
    fontFamily: "DMSans-Medium",
  },
  customInput: {
    height: 44,
    borderWidth: 1,
    borderRadius: tokens.radii.md,
    paddingHorizontal: 12,
    fontFamily: "JetBrainsMono-Medium",
    fontSize: tokens.typography.size.sm,
    letterSpacing: 0.2,
  },
});
