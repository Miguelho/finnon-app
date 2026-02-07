import React from "react";
import { formatCurrency } from "./utils";

/**
 * BalanceHeader — Balance del mes centrado
 *
 * Muestra el balance neto del mes de la cuenta activa.
 * El importe usa fuente monoespaciada, los decimales en gris más pequeño.
 */
export default function BalanceHeader({ amount, month }) {
  const { integer, decimals } = formatCurrency(amount);

  return (
    <div className="mb-8 text-center">
      <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
        Balance del mes
      </p>
      <p className="font-mono text-[42px] font-medium leading-tight text-gray-900 sm:text-[42px]">
        {integer}
        <span className="text-2xl text-gray-400">,{decimals}</span>
      </p>
      <p className="mt-1 text-sm text-gray-400">{month}</p>
    </div>
  );
}
