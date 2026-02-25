import { StyleSheet, View, type ViewStyle } from "react-native";
import Svg, { Circle } from "react-native-svg";
import type { ReactNode } from "react";

type ProjectProgressRingProps = {
  progress: number;
  size?: number;
  strokeWidth?: number;
  trackColor: string;
  progressColor: string;
  center?: ReactNode;
  style?: ViewStyle;
};

const clampProgress = (value: number) => {
  if (!Number.isFinite(value)) return 0;
  if (value <= 0) return 0;
  if (value >= 1) return 1;
  return value;
};

export function ProjectProgressRing({
  progress,
  size = 88,
  strokeWidth = 8,
  trackColor,
  progressColor,
  center,
  style,
}: ProjectProgressRingProps) {
  const normalized = clampProgress(progress);
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference - normalized * circumference;

  return (
    <View style={[{ width: size, height: size }, style]}>
      <Svg width={size} height={size} style={styles.svg}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={trackColor}
          strokeWidth={strokeWidth}
        />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={progressColor}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
        />
      </Svg>
      {center ? <View style={styles.center}>{center}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  svg: {
    transform: [{ rotate: "-90deg" }],
  },
  center: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: "center",
    justifyContent: "center",
  },
});
