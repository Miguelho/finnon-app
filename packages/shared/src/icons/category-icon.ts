import { type CategoryIconKey } from "./category-icons";

export type CategoryIconTone = "primary" | "muted" | "positive" | "negative";
export type CategoryIconWeight = "regular" | "fill";

export type CategoryIconProps = {
  iconKey?: CategoryIconKey | string | null;
  size?: number;
  tone?: CategoryIconTone;
  weight?: CategoryIconWeight;
  accessibilityLabel?: string;
};
