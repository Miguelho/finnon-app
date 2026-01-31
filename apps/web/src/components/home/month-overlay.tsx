"use client";

import { useEffect, useRef, forwardRef, useImperativeHandle } from "react";
import {
  themeTokens,
  type CalendarEvent,
  type DateRange,
  type DayMarkerData,
} from "@poleursus/shared";
import { MonthMap } from "./month-map";
import { DayMarker } from "./day-marker";

type MonthOverlayProps = {
  isOpen: boolean;
  month: Date;
  locale: string;
  events: CalendarEvent[];
  highlightRange: DateRange;
  markerData: Map<string, DayMarkerData>;
  selectedDate: Date | null;
  onSelectDate: (date: Date) => void;
  onClose: () => void;
};

export type MonthOverlayHandle = {
  getDayRect: (dayKey: string) => DOMRect | null;
};

const colors = themeTokens.light.colors;

// Duration constants
const OPEN_DURATION = 200;
const CLOSE_DURATION = 160;

/**
 * MonthOverlay component that reveals the month calendar with clip-path animation.
 * Positioned absolutely within CalendarCard.
 */
export const MonthOverlay = forwardRef<MonthOverlayHandle, MonthOverlayProps>(
  function MonthOverlay(
    {
      isOpen,
      month,
      locale,
      events,
      highlightRange,
      markerData,
      selectedDate,
      onSelectDate,
      onClose,
    },
    ref
  ) {
    const containerRef = useRef<HTMLDivElement>(null);
    const dayRefs = useRef<Map<string, HTMLElement>>(new Map());

    // Expose method to measure day positions (for ghost morph)
    useImperativeHandle(ref, () => ({
      getDayRect: (dayKey: string) => {
        const el = dayRefs.current.get(dayKey);
        return el?.getBoundingClientRect() ?? null;
      },
    }));

    // Handle Esc key to close
    useEffect(() => {
      if (!isOpen) return;

      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === "Escape") {
          e.preventDefault();
          onClose();
        }
      };

      document.addEventListener("keydown", handleKeyDown);
      return () => document.removeEventListener("keydown", handleKeyDown);
    }, [isOpen, onClose]);

    // Check for reduced motion preference
    const prefersReducedMotion =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    return (
      <div
        ref={containerRef}
        className="absolute left-0 right-0 top-0 z-20 overflow-hidden rounded-lg"
        style={{
          backgroundColor: colors.bg.primary,
          boxShadow: `0 4px 12px ${colors.shadow.soft}`,
          clipPath: isOpen
            ? "inset(0 0 0 0 round 10px)"
            : "inset(0 0 100% 0 round 10px)",
          opacity: isOpen ? 1 : 0,
          transform: `translateY(${isOpen ? -2 : 0}px)`,
          transition: prefersReducedMotion
            ? "none"
            : `clip-path ${isOpen ? OPEN_DURATION : CLOSE_DURATION}ms ease-out,
               opacity ${isOpen ? OPEN_DURATION : CLOSE_DURATION}ms ease-out,
               transform ${isOpen ? OPEN_DURATION : CLOSE_DURATION}ms ease-out`,
          pointerEvents: isOpen ? "auto" : "none",
        }}
        data-state={isOpen ? "open" : "closed"}
        role="region"
        aria-hidden={!isOpen}
      >
        <div className="p-3">
          <MonthMap
            month={month}
            locale={locale}
            events={events}
            highlightRange={highlightRange}
            selectedDate={selectedDate}
            onSelectDate={onSelectDate}
            markerData={markerData}
            renderDayContent={({ dayKey, isSelected, isToday, markerData: dayData }) => {
              // Store ref for ghost morph measurement
              return (
                <div
                  ref={(el) => {
                    if (el) {
                      dayRefs.current.set(dayKey, el);
                    } else {
                      dayRefs.current.delete(dayKey);
                    }
                  }}
                >
                  {dayData ? (
                    <DayMarker
                      {...dayData}
                      variant="month"
                      isSelected={isSelected}
                      isToday={isToday}
                    />
                  ) : null}
                </div>
              );
            }}
          />
        </div>
      </div>
    );
  }
);
