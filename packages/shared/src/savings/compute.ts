import {
  computeProjectMonthlyAllocation,
  getMonthlyProjectCommitmentTotal,
} from "../projects/compute";
import type { Project, ProjectContribution } from "../projects/types";

type TxLike = {
  type: "income" | "expense";
  amount_minor?: bigint | number | string | null;
  amount_base_minor?: bigint | number | string | null;
};

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

const toPeriodKey = (value: string | Date | null | undefined) => {
  if (!value) return null;
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}`;
  }
  if (typeof value !== "string") return null;
  if (/^\d{4}-\d{2}$/.test(value)) return value;
  if (/^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 7);
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, "0")}`;
};

const sortProjectsByPriority = (projects: Project[]) =>
  [...projects].sort((a, b) => {
    if (a.priority !== b.priority) return a.priority - b.priority;
    return a.id.localeCompare(b.id);
  });

export const isHuchaProject = (project: Project) => project.is_hucha === true;

export const splitProjectsByHucha = (projects: Project[]) => {
  const huchaProject = projects.find((project) => isHuchaProject(project)) ?? null;
  const activeProjects = projects.filter((project) => project.status === "active");
  const activeProjectsNoHucha = sortProjectsByPriority(
    activeProjects.filter((project) => !isHuchaProject(project))
  );

  return {
    huchaProject,
    activeProjects,
    activeProjectsNoHucha,
  };
};

export const getMonthlyCommitmentWithoutHucha = (projects: Project[]) => {
  const { activeProjectsNoHucha } = splitProjectsByHucha(projects);
  return getMonthlyProjectCommitmentTotal(activeProjectsNoHucha, { activeOnly: true });
};

export const computeSavingsMonthFromTransactions = (transactions: TxLike[]) => {
  let incomeMinor = 0n;
  let expenseMinor = 0n;

  transactions.forEach((tx) => {
    const amount = toMinor(tx.amount_base_minor ?? tx.amount_minor ?? 0);
    if (tx.type === "income") {
      incomeMinor += amount;
    } else {
      expenseMinor += amount;
    }
  });

  return {
    incomeMinor,
    expenseMinor,
    savingsMinor: incomeMinor - expenseMinor,
  };
};

export type SavingsDistribution = {
  savingsMinor: bigint;
  objectiveMinor: bigint;
  projectCoveredMinor: bigint;
  huchaMinor: bigint;
  gapToObjectiveMinor: bigint;
  status: "no_savings" | "needs_projects" | "hucha_surplus";
  allocations: Array<{
    project: Project;
    commitmentMinor: bigint;
    allocatedMinor: bigint;
    shortfallMinor: bigint;
  }>;
};

export const computeSavingsDistribution = (params: {
  projects: Project[];
  savingsMinor: bigint | number | string;
}): SavingsDistribution => {
  const savingsMinor = toMinor(params.savingsMinor);
  const { activeProjectsNoHucha } = splitProjectsByHucha(params.projects);
  const allocatableMinor = savingsMinor > 0n ? savingsMinor : 0n;

  const allocation = computeProjectMonthlyAllocation({
    projects: activeProjectsNoHucha.map((project) => ({
      projectId: project.id,
      priority: project.priority,
      commitmentMinor: project.monthly_commitment_base_minor,
    })),
    actualSavedMinor: allocatableMinor,
  });

  const projectById = new Map(activeProjectsNoHucha.map((project) => [project.id, project]));
  const allocations = allocation.allocations
    .map((row) => {
      const project = projectById.get(row.projectId);
      if (!project) return null;
      return {
        project,
        commitmentMinor: row.commitmentMinor,
        allocatedMinor: row.allocatedMinor,
        shortfallMinor: row.shortfallMinor,
      };
    })
    .filter((row): row is NonNullable<typeof row> => row !== null);

  const objectiveMinor = allocation.totalCommittedMinor;
  const projectCoveredMinor = allocatableMinor < objectiveMinor ? allocatableMinor : objectiveMinor;
  const huchaMinor = savingsMinor > objectiveMinor ? savingsMinor - objectiveMinor : 0n;
  const gapToObjectiveMinor = objectiveMinor > allocatableMinor ? objectiveMinor - allocatableMinor : 0n;

  let status: SavingsDistribution["status"] = "needs_projects";
  if (savingsMinor <= 0n) {
    status = "no_savings";
  } else if (huchaMinor > 0n || objectiveMinor === 0n) {
    status = "hucha_surplus";
  }

  return {
    savingsMinor,
    objectiveMinor,
    projectCoveredMinor,
    huchaMinor,
    gapToObjectiveMinor,
    status,
    allocations,
  };
};

export const getHuchaAccumulatedMinor = (params: {
  huchaProjectId: string | null | undefined;
  contributions: ProjectContribution[];
  confirmedOnly?: boolean;
}) => {
  const { huchaProjectId, contributions, confirmedOnly = true } = params;
  if (!huchaProjectId) return 0n;

  return contributions.reduce((total, contribution) => {
    if (contribution.project_id !== huchaProjectId) return total;
    if (confirmedOnly && !contribution.confirmed) return total;
    return total + toMinor(contribution.actual_amount_base_minor);
  }, 0n);
};

export const getHuchaMonthlySeries = (params: {
  huchaProjectId: string | null | undefined;
  contributions: ProjectContribution[];
  confirmedOnly?: boolean;
}) => {
  const { huchaProjectId, contributions, confirmedOnly = true } = params;
  const byPeriod = new Map<string, bigint>();

  if (!huchaProjectId) return [] as Array<{ period: string; amountMinor: bigint }>;

  contributions.forEach((contribution) => {
    if (contribution.project_id !== huchaProjectId) return;
    if (confirmedOnly && !contribution.confirmed) return;
    const periodKey = toPeriodKey(contribution.period);
    if (!periodKey) return;
    byPeriod.set(
      periodKey,
      (byPeriod.get(periodKey) ?? 0n) + toMinor(contribution.actual_amount_base_minor)
    );
  });

  return Array.from(byPeriod.entries())
    .map(([period, amountMinor]) => ({ period, amountMinor }))
    .sort((a, b) => (a.period < b.period ? -1 : a.period > b.period ? 1 : 0));
};

export const getHuchaStats = (params: {
  huchaProjectId: string | null | undefined;
  contributions: ProjectContribution[];
  currentPeriod?: string;
}) => {
  const currentPeriod = params.currentPeriod ?? toPeriodKey(new Date()) ?? "";
  const series = getHuchaMonthlySeries({
    huchaProjectId: params.huchaProjectId,
    contributions: params.contributions,
    confirmedOnly: true,
  });

  const accumulatedMinor = series.reduce((total, row) => total + row.amountMinor, 0n);
  const currentMonthContributionMinor =
    series.find((row) => row.period === currentPeriod)?.amountMinor ?? 0n;
  const averageMinor =
    series.length > 0
      ? accumulatedMinor / BigInt(series.length)
      : 0n;
  const bestMonth =
    series.length > 0
      ? series.reduce((best, row) =>
          row.amountMinor > best.amountMinor ? row : best
        )
      : null;
  const monthsWithContribution = series.filter((row) => row.amountMinor > 0n).length;

  return {
    accumulatedMinor,
    currentMonthContributionMinor,
    averageMinor,
    monthsWithContribution,
    bestMonth,
    series,
  };
};

export const computeSavingsHistoryStats = (params: {
  projects: Project[];
  contributions: ProjectContribution[];
}) => {
  const nonHuchaProjectIds = new Set(
    params.projects.filter((project) => !isHuchaProject(project)).map((project) => project.id)
  );

  const monthly = new Map<
    string,
    {
      committedMinor: bigint;
      actualMinor: bigint;
    }
  >();

  params.contributions.forEach((contribution) => {
    if (!contribution.confirmed) return;
    if (!nonHuchaProjectIds.has(contribution.project_id)) return;
    const period = toPeriodKey(contribution.period);
    if (!period) return;

    const current = monthly.get(period) ?? { committedMinor: 0n, actualMinor: 0n };
    monthly.set(period, {
      committedMinor: current.committedMinor + toMinor(contribution.committed_amount_base_minor),
      actualMinor: current.actualMinor + toMinor(contribution.actual_amount_base_minor),
    });
  });

  const periods = Array.from(monthly.entries())
    .map(([period, totals]) => ({
      period,
      committedMinor: totals.committedMinor,
      actualMinor: totals.actualMinor,
      achieved: totals.actualMinor >= totals.committedMinor,
    }))
    .sort((a, b) => (a.period < b.period ? -1 : a.period > b.period ? 1 : 0));

  let streak = 0;
  for (let idx = periods.length - 1; idx >= 0; idx -= 1) {
    const row = periods[idx];
    if (!row?.achieved) break;
    streak += 1;
  }

  const achievedCount = periods.filter((row) => row.achieved).length;

  return {
    periods,
    totalMonths: periods.length,
    achievedMonths: achievedCount,
    currentStreak: streak,
  };
};

