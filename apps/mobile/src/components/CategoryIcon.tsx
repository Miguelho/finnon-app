import * as React from "react";
import { Path, Svg } from "react-native-svg";
import {
  categoryIconPaths,
  themeTokens,
  type CategoryIconProps,
  type CategoryIconTone,
} from "@poleursus/shared";

const tokens = themeTokens.light;

const toneColors: Record<CategoryIconTone, string> = {
  primary: tokens.colors.text.primary,
  muted: tokens.colors.text.muted,
  positive: tokens.colors.state.positive,
  negative: tokens.colors.state.negative,
};

export function CategoryIcon({
  iconId,
  size = 20,
  tone = "primary",
  accessibilityLabel,
}: CategoryIconProps) {
  const path = categoryIconPaths[iconId ?? ""] ?? categoryIconPaths.default;
  const color = toneColors[tone];

  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      accessibilityLabel={accessibilityLabel}
      accessible={Boolean(accessibilityLabel)}
    >
      <Path d={path} fill={color} />
    </Svg>
  );
}
