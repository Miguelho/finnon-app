"use client";

import { createTypographyStyles, themeTokens } from "@poleursus/shared";
import { useWebUserTheme } from "@/components/theme/web-user-theme-provider";

type FinnonMarkProps = {
  size?: "sm" | "md" | "lg";
  mode?: "iconOnly" | "iconWordmark";
};

const tokens = themeTokens.light;
const typography = createTypographyStyles(tokens);
const MARK_SIZES: Record<NonNullable<FinnonMarkProps["size"]>, number> = {
  sm: 16,
  md: 22,
  lg: 28,
};

export function FinnonMark({ size = "md", mode = "iconOnly" }: FinnonMarkProps) {
  const { resolvedMode } = useWebUserTheme();
  const dimension = MARK_SIZES[size];
  const iconSrc = resolvedMode === "dark" ? "/brand/icono-dark.png" : "/brand/icono.png";

  return (
    <span className="inline-flex items-center">
      <img
        src={iconSrc}
        alt=""
        aria-hidden="true"
        width={dimension}
        height={dimension}
        style={{
          borderRadius: Math.round(dimension * 0.2),
          display: "block",
          width: dimension,
          height: dimension,
        }}
      />
      {mode === "iconWordmark" && (
        <span
          style={{
            marginLeft: tokens.spacing.sm,
            color: "currentColor",
            fontSize: typography.body.fontSize,
            fontWeight: typography.body.fontWeight,
            textTransform: "capitalize",
          }}
        >
          Finnon
        </span>
      )}
    </span>
  );
}
