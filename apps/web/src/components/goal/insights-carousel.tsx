"use client";

import { useEffect, useMemo, useState, type KeyboardEvent } from "react";
import { themeTokens, type InsightViewModel } from "@poleursus/shared";
import { CategoryIcon } from "@/components/category-icon";

const tokens = themeTokens.light;
const colors = tokens.colors;

const ICON_SLOT_HEIGHT = 64;
const SLIDE_HEIGHT = 160;
const CATEGORY_CHIP_SIZE = 30;
const CHEVRON_SIZE = 18;

const getStatusColor = (status: InsightViewModel["status"]) => {
  if (status === "positive") return colors.state.positive;
  if (status === "negative") return colors.state.negative;
  return colors.state.neutral;
};

const ChevronIcon = ({ direction }: { direction: "left" | "right" }) => {
  const path =
    direction === "left" ? "M11 6l-6 6 6 6" : "M7 6l6 6-6 6";
  return (
    <svg
      width={CHEVRON_SIZE}
      height={CHEVRON_SIZE}
      viewBox="0 0 18 18"
      fill="none"
      stroke={colors.text.secondary}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d={path} />
    </svg>
  );
};

const InsightDeltaIcon = ({ status }: { status: InsightViewModel["status"] }) => {
  const accent = getStatusColor(status);
  return (
    <svg
      width={32}
      height={32}
      viewBox="0 0 32 32"
      fill="none"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path
        d="M4 22 L12 14 L18 18 L26 10"
        stroke={colors.text.secondary}
      />
      <path d="M26 10 L26 16" stroke={accent} />
      <path d="M26 10 L20 10" stroke={accent} />
    </svg>
  );
};

const InsightCompareIcon = ({
  status,
}: {
  status: InsightViewModel["status"];
}) => {
  const accent = getStatusColor(status);
  const caretPath =
    status === "negative"
      ? "M22 10 L26 6 L30 10"
      : status === "positive"
        ? "M22 6 L26 10 L30 6"
        : "M22 8 L30 8";

  return (
    <svg
      width={32}
      height={32}
      viewBox="0 0 32 32"
      fill="none"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M8 24 V12" stroke={colors.text.secondary} />
      <path d="M14 24 V8" stroke={colors.text.secondary} />
      <path d={caretPath} stroke={accent} />
    </svg>
  );
};

const CategoryIconChip = ({
  iconName,
  fallbackLetter,
}: {
  iconName?: string | null;
  fallbackLetter?: string | null;
}) => (
  <div
    style={{
      width: CATEGORY_CHIP_SIZE,
      height: CATEGORY_CHIP_SIZE,
      borderRadius: tokens.radii.md,
      border: `1px solid ${colors.state.neutral}`,
      backgroundColor: colors.bg.secondary,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontSize: tokens.typography.size.xs,
      fontWeight: tokens.typography.weight.medium,
      color: colors.text.secondary,
    }}
  >
    {iconName ? (
      <CategoryIcon iconId={iconName} size={18} tone="muted" />
    ) : (
      (fallbackLetter ?? "?")
    )}
  </div>
);

export const InsightSlide = ({ insight }: { insight: InsightViewModel }) => {
  const renderIcon = () => {
    if (insight.iconKind === "category-icons") {
      const categories = insight.categories ?? [];
      return (
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            justifyContent: "center",
            gap: tokens.spacing.xs,
            width: CATEGORY_CHIP_SIZE * 2 + tokens.spacing.xs,
          }}
        >
          {categories.slice(0, 4).map((category) => (
            <CategoryIconChip
              key={category.categoryId}
              iconName={category.iconName}
              fallbackLetter={category.fallbackLetter}
            />
          ))}
        </div>
      );
    }

    if (insight.svgName === "compare") {
      return <InsightCompareIcon status={insight.status} />;
    }

    return <InsightDeltaIcon status={insight.status} />;
  };

  return (
    <div
      style={{
        height: SLIDE_HEIGHT,
        display: "flex",
        flexDirection: "column",
        gap: tokens.spacing.sm,
      }}
    >
      <div
        style={{
          height: ICON_SLOT_HEIGHT,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {renderIcon()}
      </div>
      <div
        style={{
          color: colors.text.secondary,
          fontSize: tokens.typography.size.sm,
          lineHeight: 1.4,
          textAlign: "center",
          display: "-webkit-box",
          WebkitLineClamp: 3,
          WebkitBoxOrient: "vertical",
          overflow: "hidden",
        }}
        aria-live="polite"
      >
        {insight.body}
      </div>
    </div>
  );
};

export function InsightsCarousel({ insights }: { insights: InsightViewModel[] }) {
  const [index, setIndex] = useState(0);
  const total = insights.length;

  useEffect(() => {
    if (index >= total && total > 0) {
      setIndex(0);
    }
  }, [index, total]);

  const canPrev = index > 0;
  const canNext = index < total - 1;

  const trackStyle = useMemo(() => {
    if (total === 0) return {};
    const translatePercent = (100 / total) * index;
    return {
      width: `${total * 100}%`,
      transform: `translateX(-${translatePercent}%)`,
    } as const;
  }, [index, total]);

  const slideWidth = total > 0 ? `${100 / total}%` : "100%";

  const handlePrev = () => {
    if (canPrev) setIndex((current) => Math.max(current - 1, 0));
  };

  const handleNext = () => {
    if (canNext) setIndex((current) => Math.min(current + 1, total - 1));
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      handlePrev();
    }
    if (event.key === "ArrowRight") {
      event.preventDefault();
      handleNext();
    }
  };

  if (total === 0) return null;

  return (
    <div
      onKeyDown={handleKeyDown}
      tabIndex={0}
      aria-roledescription="carousel"
      style={{
        display: "flex",
        flexDirection: "column",
        gap: tokens.spacing.sm,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: tokens.spacing.xs }}>
        <button
          type="button"
          onClick={handlePrev}
          disabled={!canPrev}
          aria-label="Insight anterior"
          style={{
            width: 36,
            height: 36,
            borderRadius: tokens.radii.pill,
            border: `1px solid ${colors.state.neutral}`,
            backgroundColor: colors.bg.surface,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            opacity: canPrev ? 0.6 : 0.25,
            cursor: canPrev ? "pointer" : "default",
          }}
        >
          <ChevronIcon direction="left" />
        </button>
        <div
          style={{
            overflow: "hidden",
            flex: 1,
          }}
        >
          <div
            style={{
              display: "flex",
              transition: "transform 240ms ease-out",
              ...trackStyle,
            }}
          >
            {insights.map((insight, insightIndex) => (
              <div
                key={`${insight.id}-${insightIndex}`}
                style={{
                  width: slideWidth,
                  flexShrink: 0,
                  paddingLeft: tokens.spacing.md,
                  paddingRight: tokens.spacing.md,
                }}
              >
                <InsightSlide insight={insight} />
              </div>
            ))}
          </div>
        </div>
        <button
          type="button"
          onClick={handleNext}
          disabled={!canNext}
          aria-label="Insight siguiente"
          style={{
            width: 36,
            height: 36,
            borderRadius: tokens.radii.pill,
            border: `1px solid ${colors.state.neutral}`,
            backgroundColor: colors.bg.surface,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            opacity: canNext ? 0.6 : 0.25,
            cursor: canNext ? "pointer" : "default",
          }}
        >
          <ChevronIcon direction="right" />
        </button>
      </div>
      {total > 1 && (
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            gap: tokens.spacing.xs,
          }}
        >
          {insights.map((_, dotIndex) => (
            <span
              key={`dot-${dotIndex}`}
              aria-hidden
              style={{
                width: 6,
                height: 6,
                borderRadius: tokens.radii.pill,
                backgroundColor:
                  dotIndex === index ? colors.text.primary : colors.state.neutral,
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
