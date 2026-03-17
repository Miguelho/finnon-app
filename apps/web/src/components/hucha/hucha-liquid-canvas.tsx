"use client";

import { useEffect, useRef } from "react";
import { semanticColorTokens } from "@poleursus/shared";
import { cn } from "@/lib/utils";

type HuchaLiquidCanvasProps = {
  valueMinor: bigint;
  maxMinor: bigint;
  size?: number;
  className?: string;
};

const SAVINGS_CIRCLE_COLOR = semanticColorTokens.savings.primary;
const SAVINGS_CIRCLE_GRADIENT_TOP = "#8EB2FFCC";
const SAVINGS_CIRCLE_GRADIENT_BOTTOM = `${SAVINGS_CIRCLE_COLOR}EE`;
const SAVINGS_CIRCLE_WAVE = "rgba(91,141,255,0.5)";
const SAVINGS_CIRCLE_STROKE = "rgba(91,141,255,0.35)";

const clampRatio = (value: number) => {
  if (!Number.isFinite(value) || value <= 0) return 0;
  if (value >= 1) return 1;
  return value;
};

export function HuchaLiquidCanvas({
  valueMinor,
  maxMinor,
  size = 88,
  className,
}: HuchaLiquidCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const levelTargetRef = useRef(
    maxMinor > 0n ? Math.min(0.92, Number(valueMinor) / Number(maxMinor)) : 0.5
  );
  const levelCurrentRef = useRef(levelTargetRef.current);
  const waveOffsetRef = useRef(0);

  useEffect(() => {
    levelTargetRef.current =
      maxMinor > 0n ? Math.min(0.92, Number(valueMinor) / Number(maxMinor)) : 0.5;
  }, [maxMinor, valueMinor]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const context = canvas.getContext("2d");
    if (!context) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    canvas.style.width = `${size}px`;
    canvas.style.height = `${size}px`;
    context.setTransform(dpr, 0, 0, dpr, 0, 0);

    const cx = size / 2;
    const cy = size / 2;
    const radius = size * 0.41;
    const trackWidth = size * 0.068;

    let rafId = 0;

    const draw = () => {
      levelCurrentRef.current +=
        (levelTargetRef.current - levelCurrentRef.current) * 0.04;
      waveOffsetRef.current += 0.028;

      context.clearRect(0, 0, size, size);

      context.beginPath();
      context.arc(cx, cy, radius, 0, Math.PI * 2);
      context.strokeStyle = "rgba(255,255,255,0.07)";
      context.lineWidth = trackWidth;
      context.stroke();

      context.save();
      context.beginPath();
      context.arc(cx, cy, radius - 1, 0, Math.PI * 2);
      context.clip();

      const fillTop =
        cy + radius - clampRatio(levelCurrentRef.current) * radius * 2;

      const gradient = context.createLinearGradient(0, cy - radius, 0, cy + radius);
      gradient.addColorStop(0, SAVINGS_CIRCLE_GRADIENT_TOP);
      gradient.addColorStop(1, SAVINGS_CIRCLE_GRADIENT_BOTTOM);
      context.fillStyle = gradient;
      context.fillRect(cx - radius, fillTop, radius * 2, cy + radius - fillTop);

      if (levelCurrentRef.current > 0.03 && levelCurrentRef.current < 0.97) {
        context.beginPath();
        for (let index = 0; index < 25; index += 1) {
          const x = cx - radius + (index / 24) * radius * 2;
          const y =
            fillTop +
            Math.sin((index / 24) * Math.PI * 4 + waveOffsetRef.current) * 2.5;
          if (index === 0) {
            context.moveTo(x, y);
          } else {
            context.lineTo(x, y);
          }
        }
        context.strokeStyle = SAVINGS_CIRCLE_WAVE;
        context.lineWidth = 1.8;
        context.stroke();
      }

      context.restore();

      context.beginPath();
      context.arc(cx, cy, radius, 0, Math.PI * 2);
      context.strokeStyle = SAVINGS_CIRCLE_STROKE;
      context.lineWidth = 1.8;
      context.stroke();

      rafId = window.requestAnimationFrame(draw);
    };

    rafId = window.requestAnimationFrame(draw);
    return () => cancelAnimationFrame(rafId);
  }, [size]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className={cn("absolute inset-0", className)}
    />
  );
}
