import React from "react";
import { formatCurrency, formatShortDate } from "./utils";

/**
 * Timeline — Último movimiento ← Hoy → Próximo movimiento
 *
 * Grid de 3 columnas: último | divider con "Hoy" | próximo.
 * Si no hay último o próximo, muestra "—" como placeholder.
 */
export default function Timeline({ last, next }) {
  return (
    <div className="grid grid-cols-[1fr_auto_1fr] items-center rounded-xl border border-gray-200 bg-white px-4 py-5 sm:px-6">
      {/* Último */}
      <TimelineItem
        label="Último"
        movement={last}
        align="left"
      />

      {/* Divider */}
      <div className="flex flex-col items-center gap-1 px-3 sm:px-6">
        <div className="h-5 w-px bg-gray-200" />
        <div className="h-2 w-2 rounded-full bg-gray-900" />
        <span className="text-[10px] font-semibold uppercase tracking-widest text-gray-400">
          Hoy
        </span>
        <div className="h-2 w-2 rounded-full bg-gray-200" />
        <div className="h-5 w-px bg-gray-200" />
      </div>

      {/* Próximo */}
      <TimelineItem
        label="Próximo"
        movement={next}
        align="right"
      />
    </div>
  );
}

function TimelineItem({ label, movement, align }) {
  const alignClass = align === "right" ? "text-right" : "text-left";

  if (!movement) {
    return (
      <div className={`flex flex-col gap-0.5 ${alignClass}`}>
        <span className="text-[11px] font-medium uppercase tracking-wide text-gray-400">
          {label}
        </span>
        <span className="text-sm text-gray-400">—</span>
      </div>
    );
  }

  const { integer, decimals } = formatCurrency(movement.amount);
  const isIncome = movement.amount > 0;

  return (
    <div className={`flex flex-col gap-0.5 ${alignClass}`}>
      <span className="text-[11px] font-medium uppercase tracking-wide text-gray-400">
        {label}
      </span>
      <span className="text-sm font-medium text-gray-900">
        {movement.name}
      </span>
      <span
        className={`font-mono text-[15px] font-medium ${
          isIncome ? "text-green-600" : "text-red-600"
        }`}
      >
        {isIncome ? "+" : ""}
        {integer},{decimals}
      </span>
      <span className="text-xs text-gray-400">
        {formatShortDate(movement.date)}
      </span>
    </div>
  );
}
