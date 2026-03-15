"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  formatMoneyWithSymbol,
  formatMonthLabel,
  getReserveContainerBalanceMinor,
  getReserveContainerStats,
  getReserveTransferDirection,
  toMonthKey,
  type MonthClose,
  type MonthCloseAllocation,
  type Project,
  type ReserveContainer,
  type ReserveTransfer,
} from "@poleursus/shared";
import { ArrowLeft } from "lucide-react";
import { PageContainer } from "@/components/layout/page-container";
import { useWebUserTheme } from "@/components/theme/web-user-theme-provider";

type ReserveDetailClientProps = {
  accountId: string;
  locale: "es" | "en";
  canEdit: boolean;
  baseCurrency: string;
  currencySymbol: string;
  reserveContainer: ReserveContainer;
  projects: Project[];
  monthCloses: MonthClose[];
  monthCloseAllocations: MonthCloseAllocation[];
  reserveTransfers: ReserveTransfer[];
};

const HERO_SIZE = 160;
const HERO_RADIUS = HERO_SIZE * 0.41;
const HERO_TRACK_WIDTH = HERO_SIZE * 0.068;
const HUCHA_ACCENT = "#4ECDC4";

const toMinor = (value: bigint | number | string | null | undefined): bigint => {
  if (value === null || value === undefined) return 0n;
  if (typeof value === "bigint") return value;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return 0n;
    return BigInt(Math.round(value));
  }
  try {
    return BigInt(value);
  } catch {
    return 0n;
  }
};

export function ReserveDetailClient({
  locale,
  baseCurrency,
  currencySymbol,
  reserveContainer,
  projects,
  monthCloses,
  monthCloseAllocations,
  reserveTransfers,
}: ReserveDetailClientProps) {
  const { resolvedMode } = useWebUserTheme();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [errorMessage] = useState<string | null>(null);
  const [successMessage] = useState<string | null>(null);
  const [isSubmitting] = useState(false);

  const monthClosesById = useMemo(
    () => new Map(monthCloses.map((monthClose) => [monthClose.id, monthClose])),
    [monthCloses]
  );

  const reserveBalanceMinor = useMemo(
    () =>
      getReserveContainerBalanceMinor({
        reserveContainerId: reserveContainer.id,
        closeAllocations: monthCloseAllocations,
        reserveTransfers,
      }),
    [monthCloseAllocations, reserveContainer.id, reserveTransfers]
  );

  const reserveStats = useMemo(
    () =>
      getReserveContainerStats({
        reserveContainerId: reserveContainer.id,
        closeAllocations: monthCloseAllocations,
        reserveTransfers,
        monthClosesById,
        currentPeriod: toMonthKey(new Date()),
      }),
    [monthCloseAllocations, monthClosesById, reserveContainer.id, reserveTransfers]
  );

  const activityRows = useMemo(() => {
    const projectById = new Map(projects.map((project) => [project.id, project]));

    const incoming = monthCloseAllocations
      .filter((allocation) => allocation.reserve_container_id === reserveContainer.id)
      .map((allocation) => {
        const monthClose = monthClosesById.get(allocation.month_close_id);
        const period =
          monthClose && typeof monthClose.period === "string"
            ? String(monthClose.period).slice(0, 7)
            : null;
        return {
          id: `allocation:${allocation.id}`,
          label:
            locale === "en"
              ? `Month close ${period ? formatMonthLabel(period, locale) : ""}`.trim()
              : `Cierre ${period ? formatMonthLabel(period, locale) : ""}`.trim(),
          secondary:
            locale === "en" ? "Incoming from month close" : "Entrada desde cierre mensual",
          amountMinor: toMinor(allocation.amount_base_minor),
          createdAt: monthClose?.closed_at ?? allocation.created_at ?? null,
        };
      });

    const transferRows = reserveTransfers
      .filter((transfer) => transfer.source_reserve_container_id === reserveContainer.id)
      .map((transfer) => {
        const project = projectById.get(transfer.destination_project_id);
        const direction = getReserveTransferDirection(transfer);
        return {
          id: `transfer:${transfer.id}`,
          label: project
            ? `${project.emoji || "\u{1F3AF}"} ${project.name}`
            : locale === "en"
              ? direction === "project_to_reserve"
                ? "Project return"
                : "Project transfer"
              : direction === "project_to_reserve"
                ? "Devolucion desde proyecto"
                : "Transferencia a proyecto",
          secondary:
            locale === "en"
              ? direction === "project_to_reserve"
                ? "Incoming return from project"
                : "Outgoing transfer to project"
              : direction === "project_to_reserve"
                ? "Entrada devuelta desde proyecto"
                : "Salida hacia proyecto",
          amountMinor:
            direction === "project_to_reserve"
              ? toMinor(transfer.amount_base_minor)
              : -toMinor(transfer.amount_base_minor),
          createdAt: transfer.created_at ?? null,
        };
      });

    return [...incoming, ...transferRows].sort((a, b) => {
      const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return bTime - aTime;
    });
  }, [locale, monthCloseAllocations, monthClosesById, projects, reserveContainer.id, reserveTransfers]);

  const levelTarget = useMemo(() => {
    const maxReference = reserveStats.bestMonth?.amountMinor ?? reserveBalanceMinor;
    if (maxReference <= 0n) return 0.5;
    return Math.min(0.92, Number(reserveBalanceMinor) / Number(maxReference));
  }, [reserveBalanceMinor, reserveStats.bestMonth?.amountMinor]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const context = canvas.getContext("2d");
    if (!context) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = HERO_SIZE * dpr;
    canvas.height = HERO_SIZE * dpr;
    canvas.style.width = `${HERO_SIZE}px`;
    canvas.style.height = `${HERO_SIZE}px`;

    let rafId = 0;
    let waveOffset = 0;
    let levelCurrent = 0;
    const cx = HERO_SIZE / 2;
    const cy = HERO_SIZE / 2;
    const trackColor =
      resolvedMode === "dark" ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.06)";

    const drawFrame = () => {
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      context.clearRect(0, 0, HERO_SIZE, HERO_SIZE);

      context.beginPath();
      context.arc(cx, cy, HERO_RADIUS, 0, Math.PI * 2);
      context.strokeStyle = trackColor;
      context.lineWidth = HERO_TRACK_WIDTH;
      context.stroke();

      context.save();
      context.beginPath();
      context.arc(cx, cy, HERO_RADIUS - 1, 0, Math.PI * 2);
      context.clip();

      const fillTop = cy + HERO_RADIUS - levelCurrent * HERO_RADIUS * 2;
      const gradient = context.createLinearGradient(cx, cy - HERO_RADIUS, cx, cy + HERO_RADIUS);
      gradient.addColorStop(0, "#4ECDC4CC");
      gradient.addColorStop(1, "#26A69AEE");
      context.fillStyle = gradient;
      context.fillRect(
        cx - HERO_RADIUS,
        fillTop,
        HERO_RADIUS * 2 + 2,
        cy + HERO_RADIUS + 2 - fillTop
      );

      if (levelCurrent > 0.03 && levelCurrent < 0.97) {
        context.beginPath();
        for (let index = 0; index < 25; index += 1) {
          const ratio = index / 24;
          const x = cx - HERO_RADIUS + ratio * HERO_RADIUS * 2;
          const y = fillTop + Math.sin(ratio * Math.PI * 4 + waveOffset) * 2.5;
          if (index === 0) context.moveTo(x, y);
          else context.lineTo(x, y);
        }
        context.strokeStyle = "rgba(78,205,196,0.5)";
        context.lineWidth = 1.8;
        context.stroke();
      }

      context.restore();

      context.beginPath();
      context.arc(cx, cy, HERO_RADIUS, 0, Math.PI * 2);
      context.strokeStyle = "rgba(78,205,196,0.35)";
      context.lineWidth = 1.8;
      context.stroke();
    };

    const loop = () => {
      waveOffset += 0.028;
      levelCurrent += (levelTarget - levelCurrent) * 0.04;
      drawFrame();
      rafId = window.requestAnimationFrame(loop);
    };

    drawFrame();
    rafId = window.requestAnimationFrame(loop);

    return () => {
      window.cancelAnimationFrame(rafId);
    };
  }, [levelTarget, resolvedMode]);

  const bestMonthLabel = reserveStats.bestMonth
    ? formatMonthLabel(reserveStats.bestMonth.period, locale)
    : null;

  return (
    <PageContainer className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <Link
          href="/projects"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          {locale === "en" ? "Back to projects" : "Volver a proyectos"}
        </Link>
      </div>

      <div className="space-y-6" aria-busy={isSubmitting}>
        {errorMessage ? <p className="text-sm text-destructive">{errorMessage}</p> : null}
        {successMessage ? <p className="text-sm text-[#4ECDC4]">{successMessage}</p> : null}

        <div className="mx-auto w-full max-w-md">
          <div className="flex flex-col items-center gap-3 py-4 text-center">
            <div className="relative isolate" style={{ width: HERO_SIZE, height: HERO_SIZE }}>
              <canvas
                ref={canvasRef}
                style={{
                  position: "absolute",
                  inset: 0,
                  zIndex: 0,
                  display: "block",
                  width: "100%",
                  height: "100%",
                }}
              />
              <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center px-6">
                <span
                  className="max-w-[120px] text-center text-2xl font-bold tracking-[-0.8px] tabular-nums"
                  style={{ color: HUCHA_ACCENT }}
                >
                  {formatMoneyWithSymbol(reserveBalanceMinor, baseCurrency, currencySymbol)}
                </span>
              </div>
            </div>
            <span className="text-[9px] uppercase tracking-widest text-muted-foreground">
              {locale === "en" ? "Accumulated" : "Acumulado"}
            </span>
            <h1 className="text-2xl font-bold tracking-tight">
              {locale === "en" ? "Hucha" : "Hucha"}
            </h1>
            <p className="text-sm text-muted-foreground">
              {locale === "en"
                ? "Automatic destination for unassigned savings."
                : "Destino automático del ahorro que no asignas."}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          <div className="rounded-[14px] border bg-card p-4">
            <p className="mb-1 text-[11px] text-muted-foreground">
              {locale === "en" ? "This month" : "Este mes"}
            </p>
            <p className="text-xl font-bold tracking-tight tabular-nums" style={{ color: HUCHA_ACCENT }}>
              {formatMoneyWithSymbol(
                reserveStats.currentMonthContributionMinor,
                baseCurrency,
                currencySymbol
              )}
            </p>
          </div>

          <div className="rounded-[14px] border bg-card p-4">
            <p className="mb-1 text-[11px] text-muted-foreground">
              {locale === "en" ? "Monthly average" : "Media mensual"}
            </p>
            <p className="text-xl font-bold tracking-tight tabular-nums" style={{ color: HUCHA_ACCENT }}>
              {formatMoneyWithSymbol(reserveStats.averageMinor, baseCurrency, currencySymbol)}
            </p>
          </div>

          <div className="rounded-[14px] border bg-card p-4">
            <p className="mb-1 text-[11px] text-muted-foreground">
              {locale === "en" ? "Best month" : "Mejor mes"}
            </p>
            <p
              className="text-xl font-bold tracking-tight tabular-nums"
              style={{ color: reserveStats.bestMonth ? HUCHA_ACCENT : undefined }}
            >
              {reserveStats.bestMonth
                ? formatMoneyWithSymbol(
                    reserveStats.bestMonth.amountMinor,
                    baseCurrency,
                    currencySymbol
                  )
                : "—"}
            </p>
            {bestMonthLabel ? (
              <p className="mt-0.5 text-[11px] text-muted-foreground">{bestMonthLabel}</p>
            ) : null}
          </div>

          <div className="rounded-[14px] border bg-card p-4">
            <p className="mb-1 text-[11px] text-muted-foreground">
              {locale === "en" ? "Funded months" : "Meses con aportación"}
            </p>
            <p className="text-xl font-bold tracking-tight tabular-nums text-foreground">
              {reserveStats.monthsWithContribution}
            </p>
          </div>
        </div>

        <section className="space-y-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            {locale === "en" ? "Contribution history" : "Historial de aportes"}
          </p>

          {activityRows.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {locale === "en" ? "There is no history yet." : "Todavía no hay historial."}
            </p>
          ) : (
            <div className="flex flex-col gap-[2px]">
              {activityRows.map((row, index) => {
                const isFirst = index === 0;
                const isLast = index === activityRows.length - 1;
                const isOnly = activityRows.length === 1;

                return (
                  <div
                    key={row.id}
                    className="flex items-center justify-between bg-card px-4 py-3.5"
                    style={{
                      borderRadius: isOnly
                        ? 14
                        : isFirst
                          ? "14px 14px 10px 10px"
                          : isLast
                            ? "10px 10px 14px 14px"
                            : 10,
                    }}
                  >
                    <div className="min-w-0">
                      <p className="truncate text-[13px] text-muted-foreground">{row.label}</p>
                    </div>
                    <p
                      className="ml-4 shrink-0 text-[14px] font-semibold tabular-nums"
                      style={{ color: row.amountMinor >= 0n ? HUCHA_ACCENT : undefined }}
                    >
                      {row.amountMinor >= 0n ? "+" : "-"}
                      {formatMoneyWithSymbol(
                        row.amountMinor >= 0n ? row.amountMinor : -row.amountMinor,
                        baseCurrency,
                        currencySymbol
                      )}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </PageContainer>
  );
}
