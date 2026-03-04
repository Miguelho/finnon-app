"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import {
  DEFAULT_USER_AVATAR_COLOR,
  getAvatarInitials,
  USER_AVATAR_COLORS,
  USER_AVATAR_COLOR_ORDER,
} from "@poleursus/shared";
import { cn } from "@/lib/utils";

type FormParticipant = {
  userId: string;
  name: string;
  role: "viewer" | "contributor" | "admin";
};

interface PaidBySelectorProps {
  participants: FormParticipant[];
  currentUserId: string | null;
  value: string | null;
  bothSelected: boolean;
  onChange: (value: string | null, bothSelected: boolean) => void;
}

const hashSeed = (seed: string) => {
  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash << 5) - hash + seed.charCodeAt(index);
    hash |= 0;
  }
  return Math.abs(hash);
};

const hexToRgba = (hex: string, alpha: number) => {
  const normalized = hex.replace("#", "");
  const safeAlpha = Math.max(0, Math.min(1, alpha));
  const chunk =
    normalized.length === 3
      ? normalized
          .split("")
          .map((char) => `${char}${char}`)
          .join("")
      : normalized;
  const red = Number.parseInt(chunk.slice(0, 2), 16);
  const green = Number.parseInt(chunk.slice(2, 4), 16);
  const blue = Number.parseInt(chunk.slice(4, 6), 16);
  if ([red, green, blue].some((value) => Number.isNaN(value))) {
    return `rgba(0, 0, 0, ${safeAlpha})`;
  }
  return `rgba(${red}, ${green}, ${blue}, ${safeAlpha})`;
};

const getParticipantPalette = (userId: string) => {
  const colorId =
    USER_AVATAR_COLOR_ORDER[hashSeed(userId) % USER_AVATAR_COLOR_ORDER.length] ??
    DEFAULT_USER_AVATAR_COLOR;
  return USER_AVATAR_COLORS[colorId];
};

export function PaidBySelector({
  participants,
  currentUserId,
  value,
  bothSelected,
  onChange,
}: PaidBySelectorProps) {
  const t = useTranslations("addTransaction");
  const options = React.useMemo(() => participants.slice(0, 2), [participants]);
  const fallbackId =
    currentUserId && options.some((member) => member.userId === currentUserId)
      ? currentUserId
      : (options[0]?.userId ?? null);
  const selectedId = value ?? fallbackId;

  return (
    <div className="space-y-2">
      <div className="rounded-xl border border-border bg-muted/40 p-1">
        <button
          type="button"
          onClick={() => onChange(null, true)}
          aria-pressed={bothSelected}
          className={cn(
            "flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border px-2 py-2 text-sm font-medium",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          )}
          style={{
            borderColor: bothSelected ? "hsl(var(--primary))" : "transparent",
            backgroundColor: bothSelected ? "hsl(var(--primary) / 0.14)" : "transparent",
            color: bothSelected ? "hsl(var(--primary))" : "hsl(var(--muted-foreground))",
            transition: "background-color 200ms ease, border-color 200ms ease, color 200ms ease",
          }}
        >
          <span className="inline-flex">
            {options.map((participant, index) => {
              const palette = getParticipantPalette(participant.userId);
              const initials = getAvatarInitials(undefined, participant.name);
              return (
                <span
                  key={participant.userId}
                  className={cn(
                    "inline-flex h-5 w-5 items-center justify-center rounded-full border text-[9px] font-bold uppercase",
                    index > 0 && "-ml-1.5"
                  )}
                  style={{
                    backgroundColor: palette.bg,
                    color: palette.fg,
                    borderColor: "hsl(var(--background))",
                  }}
                  aria-hidden="true"
                >
                  {initials}
                </span>
              );
            })}
          </span>
          {t("bothPaidOption")}
        </button>
      </div>

      <div className="grid grid-cols-2 gap-1">
        {options.map((participant) => {
          const palette = getParticipantPalette(participant.userId);
          const isActive = bothSelected || selectedId === participant.userId;
          const initials = getAvatarInitials(undefined, participant.name);

          return (
            <button
              key={participant.userId}
              type="button"
              onClick={() => onChange(participant.userId, false)}
              aria-pressed={isActive}
              className={cn(
                "flex min-h-8 items-center justify-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              )}
              style={{
                borderColor: isActive ? hexToRgba(palette.fg, 0.45) : "hsl(var(--border))",
                backgroundColor: isActive ? hexToRgba(palette.bg, 0.58) : "hsl(var(--background))",
                color: isActive ? palette.fg : "hsl(var(--muted-foreground))",
                transition: "background-color 200ms ease, border-color 200ms ease, color 200ms ease",
              }}
            >
              <span
                className="inline-flex h-5 w-5 items-center justify-center rounded-full text-[9px] font-bold uppercase"
                style={{ backgroundColor: palette.bg, color: palette.fg }}
                aria-hidden="true"
              >
                {initials}
              </span>
              <span className="truncate">{participant.name}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
