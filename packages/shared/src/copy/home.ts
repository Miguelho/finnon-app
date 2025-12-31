export const homeCopy = {
  emptyObligationsTitle: "Aún no hay obligaciones este mes.",
  emptyObligationsCta: "Crear primera obligación",
  emptyActivityTitle: "Aún no has registrado movimientos.",
  emptyActivityCta: "Añadir gasto",
  upcomingEmpty: "Nada programado en los próximos 7 días.",
  recentEmpty: "Aún no hay actividad.",
  guestBadge: "Solo lectura",
  guestBlurb: "Ves esta cuenta como invitado.",
  guestCta: "Crear cuenta para editar",
  addCta: "Añadir",
  upcomingCta: "Ver todo",
  recentCta: "Ver transacciones",
  paidLabel: "Pagado",
  registeredLabel: "Registrado",
  committedLabel: "Comprometido",
  pendingLabel: "Pendiente",
} as const;

export function formatParticipantCount(count: number): string {
  const safeCount = Number.isFinite(count) ? count : 0;
  return `${safeCount} ${safeCount === 1 ? "participante" : "participantes"}`;
}
