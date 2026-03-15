"use client";

import { useId } from "react";
import { cn } from "@/lib/utils";

type SavingsBucketHeroProps = {
  valueMinor: bigint;
  maxMinor: bigint;
  size?: number;
  className?: string;
};

export function SavingsBucketHero({
  valueMinor,
  maxMinor,
  size = 92,
  className,
}: SavingsBucketHeroProps) {
  const clipId = useId();
  const level =
    maxMinor > 0n ? Math.min(0.84, Math.max(0.12, Number(valueMinor) / Number(maxMinor))) : 0.56;
  const fillHeight = 54 * level;
  const fillY = 70 - fillHeight;

  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 92 92"
      className={cn("overflow-visible", className)}
      style={{ width: size, height: size }}
    >
      <defs>
        <linearGradient id={`${clipId}-fill`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#84F2EA" stopOpacity="0.95" />
          <stop offset="100%" stopColor="#31BDB3" stopOpacity="0.95" />
        </linearGradient>
        <linearGradient id={`${clipId}-glass`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="rgba(255,255,255,0.9)" />
          <stop offset="100%" stopColor="rgba(120,214,223,0.32)" />
        </linearGradient>
        <clipPath id={`${clipId}-bucket`}>
          <path d="M24 22 L68 22 L61 74 Q60 78 56 78 L36 78 Q32 78 31 74 Z" />
        </clipPath>
      </defs>

      <ellipse cx="46" cy="24" rx="23" ry="7.5" fill="#9CF1EB" opacity="0.32" />
      <ellipse cx="46" cy="24" rx="20" ry="5.5" fill="#B5F7F2" opacity="0.72" />

      <g clipPath={`url(#${clipId}-bucket)`}>
        <rect x="22" y={fillY} width="48" height={fillHeight + 10} fill={`url(#${clipId}-fill)`} />
        <ellipse cx="46" cy={fillY} rx="19" ry="5" fill="#8EF1E7" opacity="0.88" />
      </g>

      <path
        d="M24 22 L68 22 L61 74 Q60 78 56 78 L36 78 Q32 78 31 74 Z"
        fill="url(#${clipId}-glass)"
        stroke="rgba(59,194,187,0.7)"
        strokeWidth="1.4"
      />
      <ellipse
        cx="46"
        cy="24"
        rx="23"
        ry="7.5"
        fill="none"
        stroke="rgba(83,210,202,0.85)"
        strokeWidth="1.4"
      />
      <path
        d="M31 29 L35 72"
        stroke="rgba(255,255,255,0.48)"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
      <path
        d="M61 29 L57 72"
        stroke="rgba(255,255,255,0.28)"
        strokeWidth="1"
        strokeLinecap="round"
      />
    </svg>
  );
}
