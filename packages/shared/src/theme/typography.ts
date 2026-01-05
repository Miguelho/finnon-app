import type { ThemeTokens } from "./tokens";

export const createTypographyStyles = (tokens: ThemeTokens) => ({
  display: {
    fontSize: tokens.typography.size.display,
    fontWeight: tokens.typography.weight.bold,
  },
  h2: {
    fontSize: tokens.typography.size.lg,
    fontWeight: tokens.typography.weight.semibold,
  },
  h3: {
    fontSize: tokens.typography.size.md,
    fontWeight: tokens.typography.weight.semibold,
  },
  body: {
    fontSize: tokens.typography.size.sm,
    fontWeight: tokens.typography.weight.medium,
  },
  meta: {
    fontSize: tokens.typography.size.xs,
    fontWeight: tokens.typography.weight.medium,
  },
});
