"use client";
import {
  categoryIconPaths,
  type CategoryIconProps,
  type CategoryIconTone,
} from "@poleursus/shared";

const toneClasses: Record<CategoryIconTone, string> = {
  primary: "text-foreground",
  muted: "text-muted-foreground",
  positive: "text-emerald-600",
  negative: "text-destructive",
};

export function CategoryIcon({
  iconId,
  size = 20,
  tone = "primary",
  accessibilityLabel,
}: CategoryIconProps) {
  const path = categoryIconPaths[iconId ?? ""] ?? categoryIconPaths.default;
  const toneClass = toneClasses[tone];
  const ariaProps = accessibilityLabel
    ? { role: "img", "aria-label": accessibilityLabel }
    : { "aria-hidden": true };

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      className={toneClass}
      focusable="false"
      {...ariaProps}
    >
      <path d={path} fill="currentColor" />
    </svg>
  );
}
