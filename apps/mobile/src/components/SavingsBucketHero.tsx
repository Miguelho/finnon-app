import { useMemo } from "react";
import { StyleSheet, View, type ViewStyle } from "react-native";
import Svg, { ClipPath, Defs, Ellipse, LinearGradient, Path, Rect, Stop } from "react-native-svg";

type SavingsBucketHeroProps = {
  valueMinor: bigint;
  maxMinor: bigint;
  size?: number;
  style?: ViewStyle;
};

export function SavingsBucketHero({
  valueMinor,
  maxMinor,
  size = 92,
  style,
}: SavingsBucketHeroProps) {
  const clipId = useMemo(() => `bucket-${Math.random().toString(36).slice(2)}`, []);
  const level =
    maxMinor > 0n ? Math.min(0.84, Math.max(0.12, Number(valueMinor) / Number(maxMinor))) : 0.56;
  const fillHeight = 54 * level;
  const fillY = 70 - fillHeight;

  return (
    <View style={[styles.wrap, { width: size, height: size }, style]}>
      <Svg width={size} height={size} viewBox="0 0 92 92">
        <Defs>
          <LinearGradient id={`${clipId}-fill`} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0%" stopColor="#84F2EA" stopOpacity="0.95" />
            <Stop offset="100%" stopColor="#31BDB3" stopOpacity="0.95" />
          </LinearGradient>
          <LinearGradient id={`${clipId}-glass`} x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0%" stopColor="rgba(255,255,255,0.9)" />
            <Stop offset="100%" stopColor="rgba(120,214,223,0.32)" />
          </LinearGradient>
          <ClipPath id={`${clipId}-bucket`}>
            <Path d="M24 22 L68 22 L61 74 Q60 78 56 78 L36 78 Q32 78 31 74 Z" />
          </ClipPath>
        </Defs>

        <Ellipse cx="46" cy="24" rx="23" ry="7.5" fill="#9CF1EB" opacity="0.32" />
        <Ellipse cx="46" cy="24" rx="20" ry="5.5" fill="#B5F7F2" opacity="0.72" />

        <Rect
          x="22"
          y={fillY}
          width="48"
          height={fillHeight + 10}
          fill={`url(#${clipId}-fill)`}
          clipPath={`url(#${clipId}-bucket)`}
        />
        <Ellipse
          cx="46"
          cy={fillY}
          rx="19"
          ry="5"
          fill="#8EF1E7"
          opacity="0.88"
          clipPath={`url(#${clipId}-bucket)`}
        />

        <Path
          d="M24 22 L68 22 L61 74 Q60 78 56 78 L36 78 Q32 78 31 74 Z"
          fill={`url(#${clipId}-glass)`}
          stroke="rgba(59,194,187,0.7)"
          strokeWidth="1.4"
        />
        <Ellipse
          cx="46"
          cy="24"
          rx="23"
          ry="7.5"
          fill="none"
          stroke="rgba(83,210,202,0.85)"
          strokeWidth="1.4"
        />
        <Path
          d="M31 29 L35 72"
          stroke="rgba(255,255,255,0.48)"
          strokeWidth="1.2"
          strokeLinecap="round"
        />
        <Path
          d="M61 29 L57 72"
          stroke="rgba(255,255,255,0.28)"
          strokeWidth="1"
          strokeLinecap="round"
        />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: "center",
    justifyContent: "center",
  },
});
