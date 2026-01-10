"use client";
import {
  themeTokens,
  type CashFlowArrowProps,
} from "@poleursus/shared";

const tokens = themeTokens.light;

// Fixed tip size
const TIP_WIDTH = 8;
const TIP_HEIGHT = 10;

export function CashFlowArrow({
  direction,
  heightPx = 8,
  style = "chevron",
  bodyColor = tokens.colors.text.secondary,
  accentColor,
  showAccent = true,
  accessibilityLabel,
}: Omit<CashFlowArrowProps, "widthPx"> & { widthPx?: number }) {
  const tipColor = showAccent && accentColor ? accentColor : bodyColor;
  const isRight = direction === "right";

  const ariaProps = accessibilityLabel
    ? { role: "img" as const, "aria-label": accessibilityLabel }
    : { "aria-hidden": true as const };

  // Chevron tip SVG (fixed size, doesn't stretch)
  const chevronTip = (
    <svg
      width={TIP_WIDTH}
      height={TIP_HEIGHT}
      viewBox="0 0 8 10"
      style={{ display: "block", flexShrink: 0 }}
    >
      {isRight ? (
        <path
          d="M1 1 L7 5 L1 9"
          stroke={tipColor}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      ) : (
        <path
          d="M7 1 L1 5 L7 9"
          stroke={tipColor}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      )}
    </svg>
  );

  // Line element (grows with container)
  const line = (
    <div
      style={{
        flex: 1,
        height: 2,
        backgroundColor: bodyColor,
        borderRadius: 1,
      }}
    />
  );

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 2,
        width: "100%",
        height: heightPx,
        flexDirection: isRight ? "row" : "row-reverse",
      }}
      {...ariaProps}
    >
      {line}
      {chevronTip}
    </div>
  );
}
