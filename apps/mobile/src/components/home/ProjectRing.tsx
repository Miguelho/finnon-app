import { StyleSheet, Text, View } from "react-native";
import { withAlpha } from "@poleursus/shared";
import Svg, { Circle } from "react-native-svg";
import { useUserTheme } from "../../contexts/UserThemeContext";
import { clampProgress } from "./homeResponsive";

type ProjectRingProps = {
  progress: number;
  color: string;
  radius: number;
  strokeWidth: number;
  emoji: string;
};

export function ProjectRing({
  progress,
  color,
  radius,
  strokeWidth,
  emoji,
}: ProjectRingProps) {
  const { tokens: userTokens } = useUserTheme();
  const normalized = clampProgress(progress);
  const size = radius * 2 + strokeWidth * 2;
  const center = size / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference * (1 - normalized);

  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size}>
        <Circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke={withAlpha(userTokens.textPrimary, 0.08)}
          strokeWidth={strokeWidth}
        />
        <Circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          rotation={-90}
          origin={`${center}, ${center}`}
        />
      </Svg>
      <View pointerEvents="none" style={styles.center}>
        <Text style={styles.emoji}>{emoji}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  emoji: {
    fontSize: 16,
    lineHeight: 18,
  },
});
