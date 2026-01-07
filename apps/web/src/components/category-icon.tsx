"use client";
import {
  categoryIconPaths,
  type CategoryIconProps,
  type CategoryIconTone,
  themeTokens,
} from "@poleursus/shared";

const colors = themeTokens.light.colors;
const toneColors: Record<CategoryIconTone, string> = {
  primary: colors.text.primary,
  muted: colors.text.muted,
  positive: colors.state.positive,
  negative: colors.state.negative,
};

export function CategoryIcon({
  iconId,
  size = 20,
  tone = "primary",
  accessibilityLabel,
}: CategoryIconProps) {
  const path = categoryIconPaths[iconId ?? ""] ?? categoryIconPaths.default;
  const toneColor = toneColors[tone];
  const ariaProps = accessibilityLabel
    ? { role: "img", "aria-label": accessibilityLabel }
    : { "aria-hidden": true };

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      style={{ color: toneColor }}
      focusable="false"
      {...ariaProps}
    >
      <path d={path} fill="currentColor" />
    </svg>
  );
}
