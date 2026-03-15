"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

type HuchaLiquidCanvasProps = {
  valueMinor: bigint;
  maxMinor: bigint;
  size?: number;
  className?: string;
};

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
      gradient.addColorStop(0, "#4ECDC4CC");
      gradient.addColorStop(1, "#26A69AEE");
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
        context.strokeStyle = "rgba(78,205,196,0.5)";
        context.lineWidth = 1.8;
        context.stroke();
      }

      context.restore();

      context.beginPath();
      context.arc(cx, cy, radius, 0, Math.PI * 2);
      context.strokeStyle = "rgba(78,205,196,0.35)";
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
