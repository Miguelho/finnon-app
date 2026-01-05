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
  const notch = Math.round(dimension * 0.45);

  return (
    <span className="inline-flex items-center">
      <span
        aria-hidden="true"
        style={{
          width: dimension,
          height: dimension,
          borderRadius: Math.round(dimension * 0.2),
          backgroundColor: colors.text.primary,
          position: "relative",
          overflow: "hidden",
          display: "inline-block",
        }}
      >
        <span
          style={{
            position: "absolute",
            top: 0,
            right: 0,
            width: notch,
            height: notch,
            backgroundColor: colors.bg.primary,
            borderBottomLeftRadius: Math.round(notch * 0.4),
          }}
        />
      </span>
      {mode === "iconWordmark" && (
        <span
          style={{
            marginLeft: tokens.spacing.sm,
            color: colors.text.primary,
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
