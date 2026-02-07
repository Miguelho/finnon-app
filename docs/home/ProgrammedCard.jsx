import React from "react";

/**
 * ProgrammedCard — Próximos 3 movimientos programados
 *
 * Muestra max 3 con "Ver todos →" inline con el título.
 * El enlace "Ver todos" navega a Movimientos con filtro de programados.
 *
 * Props:
 * - items: [{ id, name, date, amount, category }] (ya cortado a 3 en el padre)
 * - onViewAll: callback → navega a /movimientos?filter=programmed
 */
export default function ProgrammedCard({ items, onViewAll }) {
  if (!items || items.length === 0) return null;

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5">
      {/* Header con link inline */}
      <div className="flex items-center justify-between">
        <h3 className="text-[15px] font-semibold text-gray-900">
          Programados
        </h3>
        <button
          onClick={onViewAll}
          className="text-[13px] font-medium text-blue-600 hover:underline"
        >
          Ver todos →
        </button>
      </div>

      {/* List */}
      <div className="mt-3">
        {items.map((item) => {
          const isIncome = item.amount > 0;
          return (
            <div
              key={item.id}
              className="flex items-center justify-between border-t border-gray-50 py-2.5 first:border-t-0"
            >
              <div className="flex items-center gap-3">
                <div
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] text-base ${
                    isIncome ? "bg-green-50" : "bg-red-50"
                  }`}
                >
                  {isIncome ? "↑" : "↓"}
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    {item.name}
                  </p>
                  <p className="text-xs text-gray-400">{item.dateLabel}</p>
                </div>
              </div>
              <span
                className={`shrink-0 font-mono text-sm font-medium ${
                  isIncome ? "text-green-600" : "text-red-600"
                }`}
              >
                {isIncome ? "+" : "-"}€{Math.abs(item.amount).toFixed(2)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
