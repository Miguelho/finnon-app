import type { SavingsCandidateTx } from "./saving-mode";
import type { MonthStatus } from "./types";

export type SimulatorInput = {
  candidates: SavingsCandidateTx[];
  disabledIds: string[];
  gapToGoalMinor?: bigint | null;
};

export type SimulatorResult = {
  totalDelayDays: number;
  totalSavedMinor: bigint;
  disabledCount: number;
  remainingMinor?: bigint;
  reachesGoal?: boolean;
};

export type SimulatorCardVariant = "danger" | "warning" | "neutral";

/**
 * Computes the aggregate impact of disabling selected transactions.
 * All calculations are client-side only - no backend calls needed.
 */
export const computeSimulatorImpact = (
  input: SimulatorInput
): SimulatorResult => {
  const disabledSet = new Set(input.disabledIds);

  let totalDelayDays = 0;
  let totalSavedMinor = 0n;
  let disabledCount = 0;

  for (const tx of input.candidates) {
    if (disabledSet.has(tx.id)) {
      totalDelayDays += tx.delayDays ?? 0;
      totalSavedMinor += tx.amountBaseMinor;
      disabledCount++;
    }
  }

  if (input.gapToGoalMinor !== undefined && input.gapToGoalMinor !== null) {
    const remainingRaw = input.gapToGoalMinor - totalSavedMinor;
    const remainingMinor = remainingRaw > 0n ? remainingRaw : 0n;
    const reachesGoal = remainingRaw <= 0n;
    return {
      totalDelayDays,
      totalSavedMinor,
      disabledCount,
      remainingMinor,
      reachesGoal,
    };
  }

  return {
    totalDelayDays,
    totalSavedMinor,
    disabledCount,
  };
};

/**
 * Returns the subtitle text for the simulator card based on month status.
 */
export const getSimulatorSubtitle = (
  monthStatus: MonthStatus,
  copy: {
    retrasado: string;
    enRiesgo: string;
    adelantado: string;
  }
): string => {
  switch (monthStatus) {
    case "retrasado":
      return copy.retrasado;
    case "en_riesgo":
      return copy.enRiesgo;
    case "adelantado":
      return copy.adelantado;
    default:
      return copy.adelantado;
  }
};

/**
 * Determines if the simulator should be expanded by default based on month status.
 * - retrasado: expanded (user needs help)
 * - en_riesgo: collapsed (visible but not intrusive)
 * - adelantado: collapsed (discrete, user is doing well)
 */
export const shouldExpandByDefault = (monthStatus: MonthStatus): boolean => {
  return monthStatus === "retrasado";
};

/**
 * Returns the visual variant for the simulator card based on month status.
 */
export const getSimulatorCardVariant = (
  monthStatus: MonthStatus
): SimulatorCardVariant => {
  switch (monthStatus) {
    case "retrasado":
      return "danger";
    case "en_riesgo":
      return "warning";
    case "adelantado":
    default:
      return "neutral";
  }
};

/**
 * Filters candidates to only include those with positive delay impact.
 * These are the ones that matter for the simulator.
 */
export const filterSimulatorCandidates = (
  candidates: SavingsCandidateTx[]
): SavingsCandidateTx[] => {
  return candidates;
};

/**
 * Extracts all transaction candidates from savings sections.
 * Flattens HIGH_IMPACT and UNUSUAL sections into a single array.
 */
export const extractCandidatesFromSections = (
  sections: Array<{
    kind: string;
    items: SavingsCandidateTx[] | unknown[];
  }>
): SavingsCandidateTx[] => {
  const candidates: SavingsCandidateTx[] = [];

  for (const section of sections) {
    if (section.kind === "HIGH_IMPACT" || section.kind === "UNUSUAL") {
      const items = section.items as SavingsCandidateTx[];
      candidates.push(...items);
    }
  }

  return candidates;
};
