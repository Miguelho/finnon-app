"use client";

import { useEffect, useState, useRef } from "react";
import { themeTokens, type DayMarkerData } from "@poleursus/shared";
import { DayMarker } from "./day-marker";

type GhostMarkerProps = {
  isAnimating: boolean;
  markerData: DayMarkerData | null;
  sourceRect: DOMRect | null;
  targetRect: DOMRect | null;
  onAnimationEnd?: () => void;
};

const colors = themeTokens.light.colors;
const ANIMATION_DURATION = 200; // ms

/**
 * GhostMarker component that animates from source to target position.
 * Used for the week-to-month transition effect.
 */
export function GhostMarker({
  isAnimating,
  markerData,
  sourceRect,
  targetRect,
  onAnimationEnd,
}: GhostMarkerProps) {
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null);
  const [scale, setScale] = useState(1);
  const [opacity, setOpacity] = useState(0);
  const rafRef = useRef<number | null>(null);
  const startTimeRef = useRef<number | null>(null);

  // Check for reduced motion preference
  const prefersReducedMotion =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  useEffect(() => {
    if (!isAnimating || !sourceRect || !targetRect || !markerData) {
      setOpacity(0);
      return;
    }

    if (prefersReducedMotion) {
      // Skip animation for reduced motion
      onAnimationEnd?.();
      return;
    }

    // Initialize at source position
    setPosition({ x: sourceRect.left, y: sourceRect.top });
    setScale(1);
    setOpacity(1);
    startTimeRef.current = null;

    const animate = (timestamp: number) => {
      if (!startTimeRef.current) {
        startTimeRef.current = timestamp;
      }

      const elapsed = timestamp - startTimeRef.current;
      const progress = Math.min(elapsed / ANIMATION_DURATION, 1);

      // Easing function (ease-out)
      const easeOut = 1 - Math.pow(1 - progress, 3);

      // Interpolate position
      const currentX = sourceRect.left + (targetRect.left - sourceRect.left) * easeOut;
      const currentY = sourceRect.top + (targetRect.top - sourceRect.top) * easeOut;

      // Interpolate scale (1 -> 0.95 -> 1)
      const scaleProgress = progress < 0.5 ? progress * 2 : 2 - progress * 2;
      const currentScale = 1 - scaleProgress * 0.05;

      setPosition({ x: currentX, y: currentY });
      setScale(currentScale);

      if (progress < 1) {
        rafRef.current = requestAnimationFrame(animate);
      } else {
        // Animation complete
        setOpacity(0);
        onAnimationEnd?.();
      }
    };

    rafRef.current = requestAnimationFrame(animate);

    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, [isAnimating, sourceRect, targetRect, markerData, prefersReducedMotion, onAnimationEnd]);

  if (!position || opacity === 0 || !markerData) {
    return null;
  }

  return (
    <div
      className="pointer-events-none fixed z-50"
      style={{
        left: position.x,
        top: position.y,
        transform: `scale(${scale})`,
        opacity,
        transition: prefersReducedMotion ? "none" : undefined,
      }}
    >
      <DayMarker
        {...markerData}
        variant="week"
        isSelected
      />
    </div>
  );
}
