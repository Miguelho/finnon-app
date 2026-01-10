/**
 * SVG path generator functions for each arrow style.
 * All paths use a viewBox of "0 0 100 16" for consistent scaling.
 * Direction: "right" points right (income), "left" points left (expense)
 */

import type { ArrowDirection, ArrowStyle } from "./types";

// Constants for path generation
const VIEW_WIDTH = 100;
const VIEW_HEIGHT = 16;
const MID_Y = VIEW_HEIGHT / 2;

/**
 * Chevron style: thin line with ">" stroke tip
 * - Body: horizontal line (stroke)
 * - Tip: chevron stroke with round caps
 */
export const getChevronPaths = (direction: ArrowDirection) => {
  const isRight = direction === "right";

  // Body line path (horizontal stroke)
  const bodyPath = isRight
    ? `M 0 ${MID_Y} L 85 ${MID_Y}` // right: line from left to near-right
    : `M 100 ${MID_Y} L 15 ${MID_Y}`; // left: line from right to near-left

  // Chevron tip path (stroke-based, not fill)
  const tipPath = isRight
    ? `M 80 4 L 96 ${MID_Y} L 80 12` // right: pointing right
    : `M 20 4 L 4 ${MID_Y} L 20 12`; // left: pointing left

  return { bodyPath, tipPath };
};

/**
 * Taper style: body tapers toward the tip (filled path)
 * - Body + tip as single filled polygon shape
 * - Creates visual "flow" effect
 */
export const getTaperPaths = (direction: ArrowDirection) => {
  const isRight = direction === "right";

  // Single tapered polygon path
  // Right: starts thick on left, tapers to point on right
  // Left: starts thick on right, tapers to point on left
  const bodyPath = isRight
    ? `M 0 2 L 0 14 L 90 ${MID_Y} Z` // right taper
    : `M 100 2 L 100 14 L 10 ${MID_Y} Z`; // left taper

  // Tip accent (small triangle at tip for color accent)
  const tipPath = isRight
    ? `M 80 6 L 80 10 L 96 ${MID_Y} Z` // right tip accent
    : `M 20 6 L 20 10 L 4 ${MID_Y} Z`; // left tip accent

  return { bodyPath, tipPath };
};

/**
 * Capsule + Notch style: rounded pill body with directional notch
 * - Body: rounded rectangle (capsule/pill)
 * - Tip: small notch/cut suggesting direction
 */
export const getCapsuleNotchPaths = (direction: ArrowDirection) => {
  const isRight = direction === "right";
  const r = 4; // corner radius

  // Capsule body (rounded rect using path)
  const bodyPath = isRight
    ? `M ${r} 2 L 85 2 Q 89 2 89 6 L 89 10 Q 89 14 85 14 L ${r} 14 Q 0 14 0 10 L 0 6 Q 0 2 ${r} 2 Z`
    : `M 15 2 L ${100 - r} 2 Q 100 2 100 6 L 100 10 Q 100 14 ${100 - r} 14 L 15 14 Q 11 14 11 10 L 11 6 Q 11 2 15 2 Z`;

  // Notch/arrow indicator at tip
  const tipPath = isRight
    ? `M 89 6 L 96 ${MID_Y} L 89 10 Z` // right notch
    : `M 11 6 L 4 ${MID_Y} L 11 10 Z`; // left notch

  return { bodyPath, tipPath };
};

/**
 * Get paths for a given style and direction
 */
export const getArrowPaths = (
  style: ArrowStyle,
  direction: ArrowDirection
): { bodyPath: string; tipPath: string } => {
  switch (style) {
    case "taper":
      return getTaperPaths(direction);
    case "capsuleNotch":
      return getCapsuleNotchPaths(direction);
    case "chevron":
    default:
      return getChevronPaths(direction);
  }
};

/** ViewBox dimensions for all arrow SVGs */
export const ARROW_VIEWBOX = `0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`;

/** Default arrow height */
export const DEFAULT_ARROW_HEIGHT = 8;
