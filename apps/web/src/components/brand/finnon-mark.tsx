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

  return (
    <span className="inline-flex items-center">
      <picture
        style={{
          width: dimension,
          height: dimension,
          display: "inline-block",
          lineHeight: 0,
        }}
      >
        <source
          srcSet="/brand/icono-dark.png"
          media="(prefers-color-scheme: dark)"
          type="image/png"
        />
        <img
          src="/brand/icono.png"
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
      </picture>
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
