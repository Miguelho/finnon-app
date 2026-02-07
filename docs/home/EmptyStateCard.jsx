import React from "react";

/**
 * EmptyStateCard — Estado vacío genérico con CTA
 *
 * Se usa cuando el usuario no tiene movimientos o no tiene objetivo.
 * Cada bloque tiene su propio empty state independiente.
 */
export default function EmptyStateCard({
  icon,
  title,
  description,
  buttonLabel,
  onAction,
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white">
      <div className="px-5 py-8 text-center">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 text-xl">
          {icon}
        </div>
        <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
        <p className="mt-1 text-[13px] leading-relaxed text-gray-400">
          {description}
        </p>
        <button
          onClick={onAction}
          className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-gray-900 px-5 py-2 text-[13px] font-semibold text-white transition-transform hover:-translate-y-px"
        >
          {buttonLabel}
        </button>
      </div>
    </div>
  );
}
