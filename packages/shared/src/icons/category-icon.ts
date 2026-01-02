export type CategoryIconTone = "primary" | "muted" | "positive" | "negative";

export type CategoryIconProps = {
  iconId?: string | null;
  size?: number;
  tone?: CategoryIconTone;
  accessibilityLabel?: string;
};
