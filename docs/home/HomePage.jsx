import React, { useState } from "react";
import BalanceHeader from "./BalanceHeader";
import Timeline from "./Timeline";
import Calendar from "./Calendar";
import ObjectiveCard from "./ObjectiveCard";
import ProgrammedCard from "./ProgrammedCard";
import EmptyStateCard from "./EmptyStateCard";

/**
 * HomePage — Pantalla de Inicio de Finnon
 *
 * Responde a: "¿Qué necesito saber y hacer esta semana?"
 *
 * Layout: 2 columnas en desktop (main + sidebar 340px), 1 columna apilada en móvil.
 * Orden móvil: Balance → Timeline → Calendario → Objetivo → Programados
 *
 * Props esperadas del backend/store:
 * - account: cuenta activa con su balance mensual
 * - lastMovement: último movimiento registrado
 * - nextMovement: próximo movimiento con fecha futura
 * - weekData: datos del calendario semanal (días con movimientos)
 * - monthData: datos del calendario mensual
 * - objective: estado del objetivo (null si no tiene)
 * - programmed: array de movimientos programados (max 3 en UI)
 * - hasMovements: boolean para saber si mostrar empty state
 * - hasObjective: boolean para saber si mostrar empty state
 */
export default function HomePage({
  account,
  lastMovement,
  nextMovement,
  weekData,
  monthData,
  selectedDay,
  onSelectDay,
  objective,
  programmed,
  hasMovements,
  hasObjective,
  onAddMovement,
  onCreateObjective,
  onNavigateMovements,
  onNavigateObjective,
  onNavigateProgrammed,
}) {
  const [calendarView, setCalendarView] = useState("week"); // "week" | "month"

  return (
    <div className="mx-auto max-w-[1080px] px-4 pb-20 pt-8 sm:px-10">
      {/* Balance del mes */}
      <BalanceHeader
        amount={account?.monthlyBalance ?? 0}
        month={account?.currentMonth ?? ""}
      />

      {/* Grid principal */}
      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[1fr_340px]">
        {/* Columna izquierda */}
        <div className="flex flex-col gap-6">
          {hasMovements ? (
            <>
              <Timeline
                last={lastMovement}
                next={nextMovement}
              />
              <Calendar
                view={calendarView}
                onViewChange={setCalendarView}
                weekData={weekData}
                monthData={monthData}
                selectedDay={selectedDay}
                onSelectDay={onSelectDay}
              />
            </>
          ) : (
            <EmptyStateCard
              icon="📝"
              title="Empieza a registrar tus movimientos"
              description="Añade tu primer ingreso o gasto para ver tu calendario financiero y el estado de tu semana."
              buttonLabel="Añadir movimiento"
              onAction={onAddMovement}
            />
          )}
        </div>

        {/* Columna derecha */}
        <div className="flex flex-col gap-6">
          {hasObjective ? (
            <ObjectiveCard
              objective={objective}
              onNavigate={onNavigateObjective}
            />
          ) : (
            <EmptyStateCard
              icon="🎯"
              title="Define tu primer objetivo"
              description="Establece cuánto quieres ahorrar este mes y te ayudaremos a seguir tu progreso."
              buttonLabel="Crear objetivo"
              onAction={onCreateObjective}
            />
          )}

          {hasMovements && programmed?.length > 0 && (
            <ProgrammedCard
              items={programmed.slice(0, 3)}
              onViewAll={onNavigateProgrammed}
            />
          )}
        </div>
      </div>
    </div>
  );
}
