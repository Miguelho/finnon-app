import { View, Text, StyleSheet } from "react-native";
import { createTypographyStyles, themeTokens } from "@poleursus/shared";

type FinnonMarkProps = {
  size?: "sm" | "md" | "lg";
  mode?: "iconOnly" | "iconWordmark";
};

const tokens = themeTokens.light;
const colors = tokens.colors;
const typography = createTypographyStyles(tokens);

const MARK_SIZES: Record<NonNullable<FinnonMarkProps["size"]>, number> = {
  sm: 16,
  md: 22,
  lg: 28,
};

export function FinnonMark({ size = "md", mode = "iconOnly" }: FinnonMarkProps) {
  const dimension = MARK_SIZES[size];
  const notchSize = Math.round(dimension * 0.45);

  return (
    <View style={styles.container}>
      <View
        style={[
          styles.mark,
          {
            width: dimension,
            height: dimension,
            borderRadius: Math.round(dimension * 0.2),
          },
        ]}
      >
        <View
          style={[
            styles.notch,
            {
              width: notchSize,
              height: notchSize,
              borderBottomLeftRadius: Math.round(notchSize * 0.4),
            },
          ]}
        />
      </View>
      {mode === "iconWordmark" && (
        <Text style={styles.wordmark}>Finnon</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
  },
  mark: {
    backgroundColor: colors.text.primary,
    overflow: "hidden",
  },
  notch: {
    position: "absolute",
    top: 0,
    right: 0,
    backgroundColor: colors.bg.primary,
  },
  wordmark: {
    marginLeft: tokens.spacing.sm,
    ...typography.body,
    color: colors.text.primary,
    textTransform: "capitalize",
  },
});
