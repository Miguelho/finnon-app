"use client";

import Link from "next/link";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import {
  formatMoneyWithSymbol,
  formatMonthLabel,
  getReserveContainerBalanceMinor,
  getReserveContainerStats,
  getReserveTransferDirection,
  semanticColorTokens,
  toMonthKey,
  withAlpha,
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
  recentTransactions: TransactionRow[];
};

type TransactionRow = {
  id: string;
  type: "income" | "expense";
  amount_minor: string | number | null;
  amount_base_minor: string | number | null;
  date: string;
};

const HERO_SIZE = 160;
const HERO_RADIUS = HERO_SIZE * 0.41;
const HERO_TRACK_WIDTH = HERO_SIZE * 0.068;
const HUCHA_ACCENT = semanticColorTokens.savings.primary;
const HUCHA_GRADIENT_TOP = "#8EB2FFCC";
const HUCHA_GRADIENT_BOTTOM = `${HUCHA_ACCENT}EE`;
const HUCHA_WAVE = "rgba(91,141,255,0.5)";
const HUCHA_STROKE = "rgba(91,141,255,0.35)";
const HISTORY_CHART_WIDTH = 320;
const HISTORY_CHART_HEIGHT = 132;
const HISTORY_CHART_PADDING_X = 18;
const HISTORY_CHART_PADDING_TOP = 14;
const HISTORY_CHART_PADDING_BOTTOM = 18;

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

const toMonthPeriodKey = (value: string | Date | null | undefined): string | null => {
  if (!value) return null;
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    return toMonthKey(value);
  }
  if (/^\d{4}-\d{2}/.test(value)) return value.slice(0, 7);
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return toMonthKey(parsed);
};

const buildSavingsHistoryChart = (
  points: Array<{
    period: string;
    amountMinor: bigint;
    label: string;
    isCurrent: boolean;
  }>
) => {
  const minMinor = points.reduce(
    (current, point) => (point.amountMinor < current ? point.amountMinor : current),
    0n
  );
  const maxMinor = points.reduce(
    (current, point) => (point.amountMinor > current ? point.amountMinor : current),
    0n
  );
  const chartBottom = HISTORY_CHART_HEIGHT - HISTORY_CHART_PADDING_BOTTOM;
  const chartInnerWidth = HISTORY_CHART_WIDTH - HISTORY_CHART_PADDING_X * 2;
  const chartInnerHeight = chartBottom - HISTORY_CHART_PADDING_TOP;
  const divisor = maxMinor === minMinor ? 1 : Number(maxMinor - minMinor);

  const chartPoints = points.map((point, index) => {
    const x =
      points.length <= 1
        ? HISTORY_CHART_WIDTH / 2
        : HISTORY_CHART_PADDING_X + (index / (points.length - 1)) * chartInnerWidth;
    const y =
      maxMinor === minMinor
        ? chartBottom
        : HISTORY_CHART_PADDING_TOP +
          chartInnerHeight -
          (Number(point.amountMinor - minMinor) / divisor) * chartInnerHeight;

    return {
      ...point,
      x,
      y,
      xPercent: (x / HISTORY_CHART_WIDTH) * 100,
      yPercent: (y / HISTORY_CHART_HEIGHT) * 100,
    };
  });

  const linePath = chartPoints
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`)
    .join(" ");
  const firstPoint = chartPoints[0] ?? null;
  const lastPoint = chartPoints[chartPoints.length - 1] ?? null;
  const areaPath =
    firstPoint && lastPoint
      ? `${linePath} L ${lastPoint.x} ${chartBottom} L ${firstPoint.x} ${chartBottom} Z`
      : "";
  const zeroY =
    maxMinor === minMinor
      ? chartBottom
      : HISTORY_CHART_PADDING_TOP +
        chartInnerHeight -
        (Number(0n - minMinor) / divisor) * chartInnerHeight;

  return {
    points: chartPoints,
    linePath,
    areaPath,
    zeroY,
    currentPoint: chartPoints.find((point) => point.isCurrent) ?? null,
  };
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
  recentTransactions,
}: ReserveDetailClientProps) {
  const { resolvedMode, tokens } = useWebUserTheme();
  const historyAreaGradientId = useId();
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

  const currentMonthKey = useMemo(() => toMonthKey(new Date()), []);
  const previousMonthKey = useMemo(() => {
    const date = new Date(`${currentMonthKey}-01T00:00:00`);
    date.setMonth(date.getMonth() - 1);
    return toMonthKey(date);
  }, [currentMonthKey]);

  const savingsHistory = useMemo(() => {
    const monthFormatter = new Intl.DateTimeFormat(locale === "en" ? "en-US" : "es-ES", {
      month: "short",
    });
    const byPeriod = new Map<string, bigint>();

    const historyPoints = Array.from({ length: 4 }, (_, index) => {
      const date = new Date(`${currentMonthKey}-01T00:00:00`);
      date.setMonth(date.getMonth() + index - 3);
      const period = toMonthKey(date);
      byPeriod.set(period, 0n);
      return {
        period,
        label: monthFormatter.format(date).replace(".", "").slice(0, 3),
        isCurrent: period === currentMonthKey,
      };
    });

    recentTransactions.forEach((transaction) => {
      const period = toMonthPeriodKey(transaction.date);
      if (!period || !byPeriod.has(period)) return;
      const amountMinor = toMinor(transaction.amount_base_minor ?? transaction.amount_minor);
      byPeriod.set(
        period,
        (byPeriod.get(period) ?? 0n) + (transaction.type === "income" ? amountMinor : -amountMinor)
      );
    });

    const points = historyPoints.map(({ period, label, isCurrent }) => {
      const amountMinor = byPeriod.get(period) ?? 0n;
      return {
        period,
        amountMinor,
        label,
        isCurrent: period === currentMonthKey,
      };
    });
    const values = points.map((point) => point.amountMinor);
    const averageMinor =
      values.length > 0
        ? values.reduce((total, amountMinor) => total + amountMinor, 0n) / BigInt(values.length)
        : 0n;
    const maxMinor = values.reduce(
      (current, amountMinor) => (amountMinor > current ? amountMinor : current),
      0n
    );
    const chart = buildSavingsHistoryChart(points);

    return {
      currentMinor: byPeriod.get(currentMonthKey) ?? 0n,
      previousMinor: byPeriod.get(previousMonthKey) ?? 0n,
      averageMinor,
      maxMinor,
      points: chart.points,
      linePath: chart.linePath,
      areaPath: chart.areaPath,
      zeroY: chart.zeroY,
      currentPoint: chart.currentPoint,
    };
  }, [currentMonthKey, locale, previousMonthKey, recentTransactions]);

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
      gradient.addColorStop(0, HUCHA_GRADIENT_TOP);
      gradient.addColorStop(1, HUCHA_GRADIENT_BOTTOM);
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
        context.strokeStyle = HUCHA_WAVE;
        context.lineWidth = 1.8;
        context.stroke();
      }

      context.restore();

      context.beginPath();
      context.arc(cx, cy, HERO_RADIUS, 0, Math.PI * 2);
      context.strokeStyle = HUCHA_STROKE;
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
  const historyAccent = HUCHA_ACCENT;
  const historyDanger = tokens.dangerText;
  const historyCardBorder = withAlpha(historyAccent, resolvedMode === "dark" ? 0.34 : 0.2);
  const historyCardShadow = withAlpha(historyAccent, resolvedMode === "dark" ? 0.2 : 0.14);
  const historyCardGradient = `linear-gradient(180deg, ${withAlpha(
    tokens.surfaceAlt,
    resolvedMode === "dark" ? 0.96 : 0.92
  )}, ${withAlpha(tokens.surface, resolvedMode === "dark" ? 0.98 : 0.96)})`;
  const historyChipBackground = withAlpha(tokens.surface, resolvedMode === "dark" ? 0.72 : 0.82);
  const historyTileBackground = withAlpha(tokens.surface, resolvedMode === "dark" ? 0.62 : 0.76);
  const historyTileBorder = withAlpha(tokens.border, resolvedMode === "dark" ? 0.85 : 0.7);
  const historyChartBackground = withAlpha(tokens.surface, resolvedMode === "dark" ? 0.5 : 0.68);
  const historyBaseline = withAlpha(tokens.border, resolvedMode === "dark" ? 0.95 : 0.9);
  const historyMarkerGlow = withAlpha(historyAccent, resolvedMode === "dark" ? 0.28 : 0.18);
  const historyAreaFill = withAlpha(historyAccent, resolvedMode === "dark" ? 0.22 : 0.18);
  const historyLineStroke = withAlpha(historyAccent, resolvedMode === "dark" ? 0.96 : 0.88);

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
        {successMessage ? <p className="text-sm" style={{ color: HUCHA_ACCENT }}>{successMessage}</p> : null}

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
                  className="max-w-[120px] text-center text-2xl font-bold tracking-[-0.8px] tabular-nums text-foreground"
                >
                  {formatMoneyWithSymbol(reserveBalanceMinor, baseCurrency, currencySymbol)}
                </span>
              </div>
            </div>
            <span className="text-[9px] uppercase tracking-widest text-muted-foreground">
              {locale === "en" ? "Accumulated" : "Acumulado"}
            </span>
            <h1 className="text-2xl font-bold tracking-tight">
              {locale === "en" ? "Own Funds" : "Fondos Propios"}
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

        <section>
          <div
            className="overflow-hidden rounded-[28px] border"
            style={{
              borderColor: historyCardBorder,
              boxShadow: `0 18px 48px ${historyCardShadow}`,
              backgroundImage: historyCardGradient,
            }}
          >
            <div className="p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p
                    className="text-[11px] font-semibold uppercase tracking-[0.12em]"
                    style={{ color: historyAccent }}
                  >
                    {locale === "en" ? "Savings history" : "Historial de ahorro"}
                  </p>
                  <p
                    className="mt-2 text-[20px] font-semibold tracking-tight"
                    style={{ color: tokens.textPrimary }}
                  >
                    {locale === "en" ? "Last 4 months" : "Últimos 4 meses"}
                  </p>
                </div>
                <div
                  className="rounded-full border px-3 py-1 text-[11px] font-medium"
                  style={{
                    borderColor: historyTileBorder,
                    backgroundColor: historyChipBackground,
                    color: tokens.textSecondary,
                    boxShadow: `0 10px 24px ${withAlpha(historyAccent, resolvedMode === "dark" ? 0.16 : 0.1)}`,
                  }}
                >
                  {locale === "en" ? "Monthly savings" : "Ahorro mensual"}
                </div>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
                {[
                  {
                    label: locale === "en" ? "Current" : "Actual",
                    value: savingsHistory.currentMinor,
                  },
                  {
                    label: locale === "en" ? "Previous" : "Anterior",
                    value: savingsHistory.previousMinor,
                  },
                  {
                    label: locale === "en" ? "Average" : "Media",
                    value: savingsHistory.averageMinor,
                  },
                  {
                    label: locale === "en" ? "Peak" : "Máximo",
                    value: savingsHistory.maxMinor,
                  },
                ].map((stat) => (
                  <div
                    key={stat.label}
                    className="rounded-[18px] border p-3 backdrop-blur"
                    style={{
                      borderColor: historyTileBorder,
                      backgroundColor: historyTileBackground,
                      boxShadow: `0 10px 24px ${withAlpha(tokens.textPrimary, resolvedMode === "dark" ? 0.14 : 0.08)}`,
                    }}
                  >
                    <p
                      className="text-[10px] font-semibold uppercase tracking-[0.08em]"
                      style={{ color: tokens.textSecondary }}
                    >
                      {stat.label}
                    </p>
                    <p
                      className="mt-2 text-[18px] font-semibold tracking-tight"
                      style={{ color: tokens.textPrimary }}
                    >
                      {formatMoneyWithSymbol(stat.value, baseCurrency, currencySymbol)}
                    </p>
                  </div>
                ))}
              </div>

              <div
                className="mt-5 rounded-[24px] border px-3 pb-3 pt-4"
                style={{
                  borderColor: historyTileBorder,
                  backgroundColor: historyChartBackground,
                  boxShadow: `inset 0 1px 0 ${withAlpha(tokens.surface, resolvedMode === "dark" ? 0.38 : 0.6)}`,
                }}
              >
                <div className="relative">
                  {savingsHistory.currentPoint ? (
                    <div
                      className="pointer-events-none absolute z-10 rounded-full border px-2 py-1 text-[10px] font-medium"
                      style={{
                        left: `${savingsHistory.currentPoint.xPercent}%`,
                        top: `calc(${savingsHistory.currentPoint.yPercent}% - 8px)`,
                        transform: "translate(-50%, -100%)",
                        borderColor: historyTileBorder,
                        backgroundColor: withAlpha(tokens.surface, resolvedMode === "dark" ? 0.88 : 0.92),
                        color: tokens.textSecondary,
                        boxShadow: `0 8px 18px ${withAlpha(historyAccent, resolvedMode === "dark" ? 0.22 : 0.14)}`,
                      }}
                    >
                      {formatMoneyWithSymbol(
                        savingsHistory.currentPoint.amountMinor,
                        baseCurrency,
                        currencySymbol
                      )}
                    </div>
                  ) : null}

                  <svg
                    viewBox={`0 0 ${HISTORY_CHART_WIDTH} ${HISTORY_CHART_HEIGHT}`}
                    className="h-[150px] w-full overflow-visible"
                    preserveAspectRatio="none"
                    aria-hidden="true"
                  >
                    <defs>
                      <linearGradient id={historyAreaGradientId} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={historyAreaFill} />
                        <stop offset="100%" stopColor={withAlpha(historyAccent, 0)} />
                      </linearGradient>
                    </defs>

                    <line
                      x1={HISTORY_CHART_PADDING_X}
                      y1={savingsHistory.zeroY}
                      x2={HISTORY_CHART_WIDTH - HISTORY_CHART_PADDING_X}
                      y2={savingsHistory.zeroY}
                      stroke={historyBaseline}
                      strokeDasharray="5 5"
                    />

                    {savingsHistory.areaPath ? (
                      <path d={savingsHistory.areaPath} fill={`url(#${historyAreaGradientId})`} />
                    ) : null}

                    {savingsHistory.linePath ? (
                      <path
                        d={savingsHistory.linePath}
                        fill="none"
                        stroke={historyLineStroke}
                        strokeWidth="3.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    ) : null}
                  </svg>

                  <div className="pointer-events-none absolute inset-0">
                    {savingsHistory.points.map((point) => {
                      const pointColor = point.amountMinor < 0n ? historyDanger : historyAccent;
                      return (
                        <div
                          key={point.period}
                          className="absolute"
                          style={{
                            left: `${point.xPercent}%`,
                            top: `${point.yPercent}%`,
                            transform: "translate(-50%, -50%)",
                          }}
                        >
                          {point.isCurrent ? (
                            <div
                              className="absolute left-1/2 top-1/2 rounded-full"
                              style={{
                                width: 22,
                                height: 22,
                                transform: "translate(-50%, -50%)",
                                backgroundColor: historyMarkerGlow,
                              }}
                            />
                          ) : null}
                          <div
                            className="relative rounded-full border"
                            style={{
                              width: point.isCurrent ? 12 : 9,
                              height: point.isCurrent ? 12 : 9,
                              backgroundColor: pointColor,
                              borderColor: withAlpha(tokens.surface, resolvedMode === "dark" ? 0.92 : 0.98),
                              borderWidth: point.isCurrent ? 3 : 2,
                              boxShadow: `0 0 0 1px ${withAlpha(pointColor, 0.12)}`,
                            }}
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-4 gap-2">
                  {savingsHistory.points.map((point) => (
                    <div key={point.period} className="text-center">
                      <p
                        className="text-[10px] font-medium uppercase tracking-[0.08em]"
                        style={{ color: point.isCurrent ? tokens.textPrimary : tokens.textSecondary }}
                      >
                        {point.label}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

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
