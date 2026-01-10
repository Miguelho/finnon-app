/**
 * Arrow style variants for cash flow visualization
 */
export type ArrowStyle = "chevron" | "taper" | "capsuleNotch";

/**
 * Direction the arrow points
 */
export type ArrowDirection = "left" | "right";

/**
 * Props for the CashFlowArrow component (platform-agnostic)
 */
export type CashFlowArrowProps = {
  /** Direction the arrow points */
  direction: ArrowDirection;
  /** Width of the arrow in pixels */
  widthPx: number;
  /** Height of the arrow in pixels (default: 8) */
  heightPx?: number;
  /** Arrow style variant */
  style?: ArrowStyle;
  /** Body color (default: colors.text.secondary) */
  bodyColor?: string;
  /** Accent color for the tip (positive/negative) */
  accentColor?: string;
  /** Whether to show directional accent on tip */
  showAccent?: boolean;
  /** Accessibility label */
  accessibilityLabel?: string;
};
