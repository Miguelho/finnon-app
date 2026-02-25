import type { ReactNode } from "react";

type ProjectProgressRingProps = {
  progress: number;
  size?: number;
  strokeWidth?: number;
  trackColor?: string;
  progressColor?: string;
  center?: ReactNode;
};

const clampProgress = (value: number) => {
  if (!Number.isFinite(value)) return 0;
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
};

export function ProjectProgressRing({
  progress,
  size = 84,
  strokeWidth = 8,
  trackColor = "hsl(var(--muted))",
  progressColor = "hsl(var(--primary))",
  center,
}: ProjectProgressRingProps) {
  const normalized = clampProgress(progress);
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference - normalized * circumference;

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={trackColor}
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={progressColor}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          style={{ transition: "stroke-dashoffset 260ms ease" }}
        />
      </svg>
      {center ? (
        <div className="absolute inset-0 flex items-center justify-center">{center}</div>
      ) : null}
    </div>
  );
}
