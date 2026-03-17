import { useEffect, useMemo, useRef } from "react";
import { Animated, Easing, StyleSheet, View, type ViewStyle } from "react-native";
import { semanticColorTokens } from "@poleursus/shared";
import Svg, {
  Circle,
  ClipPath,
  Defs,
  LinearGradient,
  Rect,
  Stop,
} from "react-native-svg";

type HuchaLiquidCanvasProps = {
  valueMinor: bigint;
  maxMinor: bigint;
  size?: number;
  style?: ViewStyle;
};

const AnimatedSvgRect = Animated.createAnimatedComponent(Rect);
const SAVINGS_CIRCLE_COLOR = semanticColorTokens.savings.primary;
const SAVINGS_CIRCLE_GRADIENT_TOP = "#8EB2FF";

const clampRatio = (value: number) => {
  if (!Number.isFinite(value) || value <= 0) return 0;
  if (value >= 1) return 1;
  return value;
};

export function HuchaLiquidCanvas({
  valueMinor,
  maxMinor,
  size = 88,
  style,
}: HuchaLiquidCanvasProps) {
  const clipId = useRef(`hucha-clip-${Math.random().toString(36).slice(2)}`).current;
  const fillProgress = useRef(
    new Animated.Value(maxMinor > 0n ? Math.min(0.92, Number(valueMinor) / Number(maxMinor)) : 0.5)
  ).current;
  const circleRadius = size * 0.41;
  const trackWidth = size * 0.068;
  const diameter = circleRadius * 2;
  const cx = size / 2;
  const cy = size / 2;

  const levelTarget = useMemo(
    () =>
      clampRatio(maxMinor > 0n ? Math.min(0.92, Number(valueMinor) / Number(maxMinor)) : 0.5),
    [maxMinor, valueMinor]
  );

  useEffect(() => {
    const animation = Animated.timing(fillProgress, {
      toValue: levelTarget,
      duration: 900,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    });

    animation.start();
    return () => {
      animation.stop();
    };
  }, [fillProgress, levelTarget]);

  const fillY = fillProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [cy + circleRadius, cy - circleRadius],
  });
  const fillHeight = fillProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, circleRadius * 2 + 2],
  });

  return (
    <View style={[styles.canvas, { width: size, height: size }, style]}>
      <Svg width={size} height={size}>
        <Defs>
          <LinearGradient id={`${clipId}-gradient`} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={SAVINGS_CIRCLE_GRADIENT_TOP} stopOpacity="0.8" />
            <Stop offset="1" stopColor={SAVINGS_CIRCLE_COLOR} stopOpacity="0.93" />
          </LinearGradient>
          <ClipPath id={clipId}>
            <Circle cx={cx} cy={cy} r={circleRadius - 1} />
          </ClipPath>
        </Defs>

        <Circle
          cx={cx}
          cy={cy}
          r={circleRadius}
          fill="none"
          stroke="rgba(255,255,255,0.07)"
          strokeWidth={trackWidth}
        />

        <AnimatedSvgRect
          x={cx - circleRadius}
          y={fillY as never}
          width={diameter}
          height={fillHeight as never}
          fill={`url(#${clipId}-gradient)`}
          clipPath={`url(#${clipId})`}
        />

        <Circle
          cx={cx}
          cy={cy}
          r={circleRadius}
          fill="none"
          stroke="rgba(91,141,255,0.35)"
          strokeWidth={1.8}
        />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  canvas: {
    position: "relative",
  },
});
