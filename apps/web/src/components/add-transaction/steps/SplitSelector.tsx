"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import type {
  ContributionSplitDetail,
  ContributionSplitType,
} from "@poleursus/shared";
import {
  DEFAULT_USER_AVATAR_COLOR,
  getAvatarInitials,
  USER_AVATAR_COLORS,
  USER_AVATAR_COLOR_ORDER,
} from "@poleursus/shared";

type FormParticipant = {
  userId: string;
  name: string;
  role: "viewer" | "contributor" | "admin";
};

interface SplitSelectorProps {
  value: ContributionSplitType;
  paidByBoth: boolean;
  participants: FormParticipant[];
  splitDetails: ContributionSplitDetail[] | null;
  totalAmountMinor: number;
  personalLabel: string;
  onChange: (
    splitType: ContributionSplitType,
    splitDetails?: ContributionSplitDetail[] | null
  ) => void;
}

const hashSeed = (seed: string) => {
  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash << 5) - hash + seed.charCodeAt(index);
    hash |= 0;
  }
  return Math.abs(hash);
};

const getParticipantPalette = (userId: string) => {
  const colorId =
    USER_AVATAR_COLOR_ORDER[hashSeed(userId) % USER_AVATAR_COLOR_ORDER.length] ??
    DEFAULT_USER_AVATAR_COLOR;
  return USER_AVATAR_COLORS[colorId];
};

const clampPercent = (value: number) => Math.min(100, Math.max(0, Math.round(value)));

const ICON_EASE = "cubic-bezier(0.34, 1.56, 0.64, 1)";

const EqualIcon = ({ active }: { active: boolean }) => {
  const firstBarRef = React.useRef<HTMLSpanElement | null>(null);
  const secondBarRef = React.useRef<HTMLSpanElement | null>(null);
  const hasMountedRef = React.useRef(false);
  const wasActiveRef = React.useRef(active);

  React.useEffect(() => {
    const first = firstBarRef.current;
    const second = secondBarRef.current;
    if (!first || !second) return;

    if (!hasMountedRef.current) {
      hasMountedRef.current = true;
      wasActiveRef.current = active;
      return;
    }

    if (active && !wasActiveRef.current) {
      [first, second].forEach((bar) => {
        bar.style.transform = "scaleX(0.3)";
        bar.style.opacity = "0";
      });

      first.animate(
        [
          { transform: "scaleX(0.3)", opacity: 0 },
          { transform: "scaleX(1)", opacity: 1 },
        ],
        { duration: 500, easing: ICON_EASE, fill: "forwards" }
      );
      second.animate(
        [
          { transform: "scaleX(0.3)", opacity: 0 },
          { transform: "scaleX(1)", opacity: 1 },
        ],
        { duration: 500, delay: 60, easing: ICON_EASE, fill: "forwards" }
      );
    } else if (!active) {
      [first, second].forEach((bar) => {
        bar.style.transform = "scaleX(1)";
        bar.style.opacity = "1";
      });
    }

    wasActiveRef.current = active;
  }, [active]);

  return (
    <div className="flex h-9 w-9 flex-col items-center justify-center gap-[5px]" aria-hidden="true">
      <span
        ref={firstBarRef}
        className="h-[3px] w-5 rounded-full bg-current"
        style={{ transform: "scaleX(1)" }}
      />
      <span
        ref={secondBarRef}
        className="h-[3px] w-5 rounded-full bg-current"
        style={{ transform: "scaleX(1)" }}
      />
    </div>
  );
};

const PersonalIcon = ({ active }: { active: boolean }) => {
  const iconRef = React.useRef<HTMLSpanElement | null>(null);
  const hasMountedRef = React.useRef(false);
  const wasActiveRef = React.useRef(active);

  React.useEffect(() => {
    const icon = iconRef.current;
    if (!icon) return;

    if (!hasMountedRef.current) {
      hasMountedRef.current = true;
      wasActiveRef.current = active;
      return;
    }

    if (active && !wasActiveRef.current) {
      icon.animate(
        [
          { transform: "scale(0.5)", opacity: 0 },
          { transform: "scale(1)", opacity: 1 },
        ],
        { duration: 400, easing: ICON_EASE, fill: "forwards" }
      );
    } else if (!active) {
      icon.style.transform = "scale(1)";
      icon.style.opacity = "1";
    }

    wasActiveRef.current = active;
  }, [active]);

  return (
    <div className="flex h-9 w-9 items-center justify-center" aria-hidden="true">
      <span ref={iconRef} className="text-[22px] font-bold leading-none text-current">
        1
      </span>
    </div>
  );
};

const CustomIcon = ({ active }: { active: boolean }) => {
  const barRefs = React.useRef<Array<HTMLSpanElement | null>>([]);
  const hasMountedRef = React.useRef(false);
  const wasActiveRef = React.useRef(active);
  const heights = [10, 16, 12];

  React.useEffect(() => {
    const bars = barRefs.current.filter((bar): bar is HTMLSpanElement => !!bar);
    if (bars.length === 0) return;

    if (!hasMountedRef.current) {
      hasMountedRef.current = true;
      wasActiveRef.current = active;
      return;
    }

    if (active && !wasActiveRef.current) {
      bars.forEach((bar) => {
        bar.style.transform = "scaleY(0)";
        bar.style.opacity = "0";
      });
      bars.forEach((bar, index) => {
        bar.animate(
          [
            { transform: "scaleY(0)", opacity: 0 },
            { transform: "scaleY(1)", opacity: 1 },
          ],
          {
            duration: 450,
            delay: index * 60,
            easing: ICON_EASE,
            fill: "forwards",
          }
        );
      });
    } else if (!active) {
      bars.forEach((bar) => {
        bar.style.transform = "scaleY(1)";
        bar.style.opacity = "1";
      });
    }

    wasActiveRef.current = active;
  }, [active]);

  return (
    <div className="flex h-9 w-9 items-end justify-center gap-[3px]" aria-hidden="true">
      {heights.map((height, index) => (
        <span
          key={`${height}-${index}`}
          ref={(element) => {
            barRefs.current[index] = element;
          }}
          className="w-[4px] rounded-[2px] bg-current"
          style={{
            height,
            transformOrigin: "bottom",
            transform: "scaleY(1)",
          }}
        />
      ))}
    </div>
  );
};

export function SplitSelector({
  value,
  paidByBoth,
  participants,
  splitDetails,
  totalAmountMinor,
  personalLabel,
  onChange,
}: SplitSelectorProps) {
  const t = useTranslations("addTransaction");
  const options = React.useMemo(() => participants.slice(0, 2), [participants]);
  const equalDisabled = !paidByBoth;
  const personalDisabled = paidByBoth;
  const [firstPercent, setFirstPercent] = React.useState(50);

  const buildCustomSplit = React.useCallback(
    (firstPct: number) => {
      const first = options[0];
      const second = options[1];
      if (!first || !second) return null;

      const safeAmount = Math.max(0, totalAmountMinor);
      const safePct = clampPercent(firstPct);
      const firstShare = Math.round((safePct / 100) * safeAmount);
      const secondShare = safeAmount - firstShare;

      return [
        { userId: first.userId, shareMinor: firstShare },
        { userId: second.userId, shareMinor: secondShare },
      ];
    },
    [options, totalAmountMinor]
  );

  React.useEffect(() => {
    if (value === "equal" && equalDisabled) {
      onChange("personal", null);
      return;
    }
    if (value === "personal" && personalDisabled) {
      onChange("equal", null);
    }
  }, [equalDisabled, onChange, personalDisabled, value]);

  React.useEffect(() => {
    const first = options[0];
    if (!first) return;

    const firstDetail = (splitDetails ?? []).find((detail) => detail.userId === first.userId);
    if (totalAmountMinor <= 0 || !firstDetail) {
      setFirstPercent(50);
      return;
    }

    const pct = clampPercent((firstDetail.shareMinor / totalAmountMinor) * 100);
    setFirstPercent(pct);
  }, [options, splitDetails, totalAmountMinor]);

  const handleSelectOption = (nextValue: ContributionSplitType) => {
    if (nextValue === "equal" && equalDisabled) return;
    if (nextValue === "personal" && personalDisabled) return;

    if (nextValue === "custom") {
      onChange("custom", buildCustomSplit(firstPercent));
      return;
    }

    onChange(nextValue, null);
  };

  const handlePercentChange = (nextValue: number, fromSecond: boolean) => {
    const nextFirst = clampPercent(fromSecond ? 100 - nextValue : nextValue);
    setFirstPercent(nextFirst);
    if (value === "custom") {
      onChange("custom", buildCustomSplit(nextFirst));
    }
  };

  const secondPercent = 100 - firstPercent;
  const totalPercent = firstPercent + secondPercent;
  const showHint = equalDisabled || personalDisabled;

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-2">
        <button
          type="button"
          onClick={() => handleSelectOption("equal")}
          disabled={equalDisabled}
          className={cn(
            "rounded-xl border p-2.5 text-center transition-all",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
            value === "equal"
              ? "border-primary bg-primary/12 text-primary"
              : "border-border bg-muted/40 text-muted-foreground",
            equalDisabled && "cursor-not-allowed opacity-40"
          )}
          style={{ transition: "all 200ms cubic-bezier(0.34, 1.2, 0.64, 1)" }}
        >
          <EqualIcon active={value === "equal"} />
          <span className="mt-2 block text-[11px] font-semibold leading-4">
            {t("splitEqualOption")}
          </span>
        </button>

        <button
          type="button"
          onClick={() => handleSelectOption("personal")}
          disabled={personalDisabled}
          className={cn(
            "rounded-xl border p-2.5 text-center transition-all",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
            value === "personal"
              ? "border-primary bg-primary/12 text-primary"
              : "border-border bg-muted/40 text-muted-foreground",
            personalDisabled && "cursor-not-allowed opacity-40"
          )}
          style={{ transition: "all 200ms cubic-bezier(0.34, 1.2, 0.64, 1)" }}
        >
          <PersonalIcon active={value === "personal"} />
          <span className="mt-2 block text-[11px] font-semibold leading-4">
            {personalLabel}
          </span>
        </button>

        <button
          type="button"
          onClick={() => handleSelectOption("custom")}
          className={cn(
            "rounded-xl border p-2.5 text-center transition-all",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
            value === "custom"
              ? "border-primary bg-primary/12 text-primary"
              : "border-border bg-muted/40 text-muted-foreground"
          )}
          style={{ transition: "all 200ms cubic-bezier(0.34, 1.2, 0.64, 1)" }}
        >
          <CustomIcon active={value === "custom"} />
          <span className="mt-2 block text-[11px] font-semibold leading-4">
            {t("splitCustomOption")}
          </span>
        </button>
      </div>

      {showHint ? (
        <p className="text-xs text-muted-foreground">
          {equalDisabled ? t("splitEqualRequiresBoth") : t("splitPersonalDisabledForBoth")}
        </p>
      ) : null}

      <div
        className={cn(
          "overflow-hidden rounded-lg border border-border bg-background transition-[max-height,opacity,margin] duration-300 ease-in-out",
          value === "custom" ? "mt-2 max-h-80 opacity-100" : "max-h-0 opacity-0"
        )}
      >
        <div className="space-y-3 p-3">
          <p className="text-xs font-medium text-muted-foreground">{t("splitCustomHelper")}</p>
          {options.map((participant, index) => {
            const palette = getParticipantPalette(participant.userId);
            const initials = getAvatarInitials(undefined, participant.name);
            const pct = index === 0 ? firstPercent : secondPercent;

            return (
              <div key={participant.userId} className="space-y-1.5">
                <div className="flex items-center justify-between gap-3">
                  <span className="inline-flex items-center gap-2 text-sm text-foreground">
                    <span
                      className="inline-flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold uppercase"
                      style={{ backgroundColor: palette.bg, color: palette.fg }}
                    >
                      {initials}
                    </span>
                    {participant.name}
                  </span>
                  <span className="w-11 text-right text-sm font-semibold tabular-nums text-foreground">
                    {pct}%
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={1}
                  value={pct}
                  onChange={(event) =>
                    handlePercentChange(Number(event.target.value), index === 1)
                  }
                  style={{ accentColor: palette.fg }}
                  className="w-full"
                />
              </div>
            );
          })}
          <p
            className={cn(
              "text-xs font-semibold",
              totalPercent === 100 ? "text-emerald-600" : "text-destructive"
            )}
          >
            {t("splitTotalLabel", { total: totalPercent })}
          </p>
        </div>
      </div>
    </div>
  );
}
