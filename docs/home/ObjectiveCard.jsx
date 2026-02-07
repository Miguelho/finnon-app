import React from "react";

/**
 * ObjectiveCard — Indicador rápido del objetivo mensual
 *
 * Muestra:
 * - Estado (on-track / at-risk / off-track) con icono y color
 * - Barra de progreso con marcador de "dónde deberías estar"
 * - Mensaje contextual con insight accionable
 * - Racha de meses (últimos 5)
 *
 * Props:
 * - objective.status: "on-track" | "at-risk" | "off-track"
 * - objective.statusLabel: string ("En riesgo", "Vas bien", etc.)
 * - objective.description: string ("Ahorrar €500 en febrero")
 * - objective.current: number (cantidad ahorrada)
 * - objective.target: number (objetivo)
 * - objective.progressPercent: number (0-100)
 * - objective.expectedPercent: number (0-100, dónde debería estar por fecha)
 * - objective.message: string (insight contextual)
 * - objective.streak: [{hit: boolean}] (últimos 5 meses)
 * - onNavigate: callback para "Ver detalle"
 */
export default function ObjectiveCard({ objective, onNavigate }) {
  if (!objective) return null;

  const statusConfig = {
    "on-track": {
      icon: "✓",
      bgClass: "bg-green-50",
    },
    "at-risk": {
      icon: "⚠",
      bgClass: "bg-amber-50",
    },
    "off-track": {
      icon: "✕",
      bgClass: "bg-red-50",
    },
  };

  const progressColorClass = {
    "on-track": "bg-green-600",
    "at-risk": "bg-amber-500",
    "off-track": "bg-red-600",
  };

  const config = statusConfig[objective.status] ?? statusConfig["at-risk"];

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-[15px] font-semibold text-gray-900">Objetivo</h3>
        <button
          onClick={onNavigate}
          className="text-[13px] font-medium text-blue-600 hover:underline"
        >
          Ver detalle →
        </button>
      </div>

      {/* Status */}
      <div className="mb-4 flex items-center gap-2">
        <div
          className={`flex h-8 w-8 items-center justify-center rounded-full text-base ${config.bgClass}`}
        >
          {config.icon}
        </div>
        <div>
          <p className="text-sm font-semibold text-gray-900">
            {objective.statusLabel}
          </p>
          <p className="text-xs text-gray-500">{objective.description}</p>
        </div>
      </div>

      {/* Progress bar */}
      <div className="mb-3">
        <div className="relative h-1.5 rounded-full bg-gray-100">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              progressColorClass[objective.status]
            }`}
            style={{ width: `${objective.progressPercent}%` }}
          />
          {/* Expected marker */}
          <div
            className="absolute -top-0.5 h-2.5 w-0.5 rounded-sm bg-gray-400"
            style={{ left: `${objective.expectedPercent}%` }}
          />
        </div>
        <div className="mt-1.5 flex justify-between">
          <span className="text-xs text-gray-400">
            <strong className="font-semibold text-gray-900">
              €{objective.current}
            </strong>{" "}
            ahorrado
          </span>
          <span className="text-xs text-gray-400">de €{objective.target}</span>
        </div>
      </div>

      {/* Contextual message */}
      <div className="rounded-lg bg-gray-50 px-3 py-2.5">
        <p
          className="text-[13px] leading-relaxed text-gray-500"
          dangerouslySetInnerHTML={{ __html: objective.message }}
        />
      </div>

      {/* Streak */}
      {objective.streak && (
        <div className="mt-3.5 flex items-center gap-1">
          {objective.streak.map((month, i) => (
            <span
              key={i}
              className={`h-2 w-2 rounded-full ${
                month.hit ? "bg-green-600" : "bg-gray-200"
              }`}
            />
          ))}
          <span className="ml-1 text-[11px] text-gray-400">
            {objective.streak.filter((m) => m.hit).length} de{" "}
            {objective.streak.length} meses
          </span>
        </div>
      )}
    </div>
  );
}
