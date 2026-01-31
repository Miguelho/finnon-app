import { useEffect } from "react";
import { StyleSheet } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
  useReducedMotion,
  runOnJS,
} from "react-native-reanimated";
import { themeTokens, type DayMarkerData } from "@poleursus/shared";
import { DayMarker } from "./DayMarker";

type Position = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type GhostMarkerProps = {
  isAnimating: boolean;
  markerData: DayMarkerData | null;
  sourcePosition: Position | null;
  targetPosition: Position | null;
  onAnimationEnd?: () => void;
};

const tokens = themeTokens.light;
const ANIMATION_DURATION = 200; // ms

/**
 * GhostMarker component that animates from source to target position.
 * Used for the week-to-month transition effect.
 */
export function GhostMarker({
  isAnimating,
  markerData,
  sourcePosition,
  targetPosition,
  onAnimationEnd,
}: GhostMarkerProps) {
  const reducedMotion = useReducedMotion();

  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const scale = useSharedValue(1);
  const opacity = useSharedValue(0);

  useEffect(() => {
    if (!isAnimating || !sourcePosition || !targetPosition || !markerData) {
      opacity.value = 0;
      return;
    }

    if (reducedMotion) {
      // Skip animation for reduced motion
      onAnimationEnd?.();
      return;
    }

    // Initialize at source position
    translateX.value = sourcePosition.x;
    translateY.value = sourcePosition.y;
    scale.value = 1;
    opacity.value = 1;

    const easing = Easing.out(Easing.cubic);
    const duration = ANIMATION_DURATION;

    // Animate to target
    translateX.value = withTiming(targetPosition.x, { duration, easing });
    translateY.value = withTiming(targetPosition.y, { duration, easing });

    // Scale animation (1 -> 0.95 -> 1)
    scale.value = withTiming(0.95, { duration: duration / 2, easing }, () => {
      scale.value = withTiming(1, { duration: duration / 2, easing }, () => {
        // Animation complete
        opacity.value = 0;
        if (onAnimationEnd) {
          runOnJS(onAnimationEnd)();
        }
      });
    });
  }, [
    isAnimating,
    sourcePosition,
    targetPosition,
    markerData,
    reducedMotion,
    onAnimationEnd,
    translateX,
    translateY,
    scale,
    opacity,
  ]);

  const animatedStyle = useAnimatedStyle(() => ({
    position: "absolute",
    left: translateX.value,
    top: translateY.value,
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
    zIndex: 100,
  }));

  if (!markerData || !sourcePosition) {
    return null;
  }

  return (
    <Animated.View style={[styles.container, animatedStyle]} pointerEvents="none">
      <DayMarker
        {...markerData}
        variant="week"
        isSelected
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    zIndex: 100,
  },
});
