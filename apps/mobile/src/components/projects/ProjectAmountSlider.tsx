import { useMemo, useRef } from "react";
import {
  PanResponder,
  StyleSheet,
  View,
  type LayoutChangeEvent,
} from "react-native";

type ProjectAmountSliderProps = {
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (value: number) => void;
  trackColor: string;
  fillColor: string;
  thumbColor: string;
  onTrackLayout?: (width: number) => void;
  trackWidth?: number;
};

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

export function ProjectAmountSlider({
  min,
  max,
  step,
  value,
  onChange,
  trackColor,
  fillColor,
  thumbColor,
  trackWidth = 0,
  onTrackLayout,
}: ProjectAmountSliderProps) {
  const trackRef = useRef<View | null>(null);
  const range = Math.max(max - min, step);
  const safeValue = clamp(value, min, max);
  const ratio = (safeValue - min) / range;
  const thumbLeft = trackWidth > 0 ? ratio * trackWidth : 0;

  const updateFromPosition = (positionX: number) => {
    if (trackWidth <= 0) return;
    const clampedX = clamp(positionX, 0, trackWidth);
    const raw = min + (clampedX / trackWidth) * range;
    const snapped = Math.round(raw / step) * step;
    const nextValue = clamp(snapped, min, max);
    onChange(nextValue);
  };

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: (event) => {
          updateFromPosition(event.nativeEvent.locationX);
        },
        onPanResponderMove: (event) => {
          updateFromPosition(event.nativeEvent.locationX);
        },
      }),
    [max, min, onChange, step, trackWidth]
  );

  const handleTrackLayout = (event: LayoutChangeEvent) => {
    const nextWidth = event.nativeEvent.layout.width;
    if (nextWidth > 0) {
      onTrackLayout?.(nextWidth);
    }
  };

  return (
    <View
      ref={trackRef}
      style={[styles.track, { backgroundColor: trackColor }]}
      onLayout={handleTrackLayout}
      {...panResponder.panHandlers}
    >
      <View
        style={[
          styles.fill,
          {
            backgroundColor: fillColor,
            width: trackWidth > 0 ? thumbLeft : 0,
          },
        ]}
      />
      <View
        style={[
          styles.thumb,
          {
            backgroundColor: thumbColor,
            left: trackWidth > 0 ? thumbLeft - 12 : -12,
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    height: 8,
    borderRadius: 999,
    justifyContent: "center",
  },
  fill: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    borderRadius: 999,
  },
  thumb: {
    position: "absolute",
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "#FFFFFF",
    shadowColor: "#000000",
    shadowOpacity: 0.18,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
});
