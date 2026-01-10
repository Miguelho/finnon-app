import { View } from "react-native";
import { Path, Svg } from "react-native-svg";
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

  // Chevron tip SVG (fixed size, doesn't stretch)
  const chevronTip = (
    <Svg
      width={TIP_WIDTH}
      height={TIP_HEIGHT}
      viewBox="0 0 8 10"
      style={{ flexShrink: 0 }}
    >
      {isRight ? (
        <Path
          d="M1 1 L7 5 L1 9"
          stroke={tipColor}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      ) : (
        <Path
          d="M7 1 L1 5 L7 9"
          stroke={tipColor}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      )}
    </Svg>
  );

  // Line element (grows with container)
  const line = (
    <View
      style={{
        flex: 1,
        height: 2,
        backgroundColor: bodyColor,
        borderRadius: 1,
      }}
    />
  );

  return (
    <View
      style={{
        flexDirection: isRight ? "row" : "row-reverse",
        alignItems: "center",
        gap: 2,
        width: "100%",
        height: heightPx,
      }}
      accessibilityLabel={accessibilityLabel}
      accessible={Boolean(accessibilityLabel)}
    >
      {line}
      {chevronTip}
    </View>
  );
}
