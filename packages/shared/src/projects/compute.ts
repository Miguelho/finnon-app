import type {
  GoalComposition,
  Project,
  ProjectAllocationInput,
  ProjectAllocationResult,
  ProjectAllocationRow,
  ProjectContribution,
  ProjectProgress,
} from "./types";

const MONTH_KEY_PATTERN = /^\d{4}-\d{2}$/;

const clampNumber = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

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

const ceilDiv = (numerator: bigint, denominator: bigint) => {
  if (denominator <= 0n) return 0n;
  return (numerator + denominator - 1n) / denominator;
};

const addMonths = (date: Date, months: number) => {
  const next = new Date(date.getTime());
  next.setMonth(next.getMonth() + months);
  return next;
};

const toMonthKey = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
};

const addMonthsToKey = (monthKey: string, delta: number): string => {
  if (!MONTH_KEY_PATTERN.test(monthKey)) {
    return toMonthKey(new Date());
  }

  const [yearStr, monthStr] = monthKey.split("-");
  const year = Number(yearStr);
  const monthIndex = Number(monthStr) - 1;
  if (!Number.isFinite(year) || !Number.isFinite(monthIndex)) {
    return toMonthKey(new Date());
  }

  const date = new Date(year, monthIndex + delta, 1);
  return toMonthKey(date);
};

const normalizeMonthKey = (value: string): string | null => {
  if (MONTH_KEY_PATTERN.test(value)) return value;

  const monthPrefix = value.slice(0, 7);
  if (MONTH_KEY_PATTERN.test(monthPrefix)) return monthPrefix;

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return toMonthKey(parsed);
};

const toMonthKeyFromInput = (
  value: string | Date | null | undefined
): string | null => {
  if (!value) return null;
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    return toMonthKey(value);
  }
  return normalizeMonthKey(value);
};

export const computePendingMonthCloseKeys = (params: {
  commitmentProjects: Array<{
    projectId: string;
    createdAt?: string | Date | null;
  }>;
  confirmedContributions: Array<{
    projectId: string;
    period: string | Date;
  }>;
  currentMonthKey?: string;
}) => {
  const { commitmentProjects, confirmedContributions, currentMonthKey } = params;

  if (commitmentProjects.length === 0) return [];

  const resolvedCurrentMonthKey =
    typeof currentMonthKey === "string" && MONTH_KEY_PATTERN.test(currentMonthKey)
      ? currentMonthKey
      : toMonthKey(new Date());
  const latestClosableMonthKey = addMonthsToKey(resolvedCurrentMonthKey, -1);

  const uniqueProjectIds = Array.from(
    new Set(
      commitmentProjects
        .map((project) => project.projectId)
        .filter((projectId) => projectId.length > 0)
    )
  );
  if (uniqueProjectIds.length === 0) return [];

  const defaultProjectMonth = latestClosableMonthKey;
  const projectStarts = new Map<string, string>();
  commitmentProjects.forEach((project) => {
    if (!project.projectId) return;

    const createdMonth =
      toMonthKeyFromInput(project.createdAt ?? null) ?? defaultProjectMonth;
    const currentStart = projectStarts.get(project.projectId);
    if (!currentStart || createdMonth < currentStart) {
      projectStarts.set(project.projectId, createdMonth);
    }
  });

  const earliestRequiredMonthKey = Array.from(projectStarts.values())
    .filter((monthKey) => monthKey <= latestClosableMonthKey)
    .sort()[0];
  if (!earliestRequiredMonthKey) return [];

  const confirmedByMonth = new Map<string, Set<string>>();
  confirmedContributions.forEach((row) => {
    if (!row.projectId) return;

    const periodMonthKey = toMonthKeyFromInput(row.period);
    if (
      !periodMonthKey ||
      periodMonthKey < earliestRequiredMonthKey ||
      periodMonthKey > latestClosableMonthKey
    ) {
      return;
    }

    const monthConfirmed = confirmedByMonth.get(periodMonthKey) ?? new Set<string>();
    monthConfirmed.add(row.projectId);
    confirmedByMonth.set(periodMonthKey, monthConfirmed);
  });

  const pendingMonthKeys: string[] = [];
  for (
    let monthKey = earliestRequiredMonthKey;
    monthKey <= latestClosableMonthKey;
    monthKey = addMonthsToKey(monthKey, 1)
  ) {
    const requiredProjectIds = uniqueProjectIds.filter((projectId) => {
      const startMonth = projectStarts.get(projectId);
      return typeof startMonth === "string" && startMonth <= monthKey;
    });
    if (requiredProjectIds.length === 0) continue;

    const confirmedProjectIds = confirmedByMonth.get(monthKey);
    const isPending = requiredProjectIds.some(
      (projectId) => !confirmedProjectIds?.has(projectId)
    );
    if (isPending) pendingMonthKeys.push(monthKey);
  }

  return pendingMonthKeys.sort().reverse();
};

export const getProjectSavedMinor = (
  contributions: ProjectContribution[],
  options?: { confirmedOnly?: boolean }
) => {
  const confirmedOnly = options?.confirmedOnly ?? true;

  return contributions.reduce((total, contribution) => {
    const isConfirmed = contribution.confirmed ?? false;
    if (confirmedOnly && !isConfirmed) return total;
    return total + toMinor(contribution.actual_amount_base_minor);
  }, 0n);
};

export const computeProjectProgress = (params: {
  project: Project;
  contributions?: ProjectContribution[];
  now?: Date;
}): ProjectProgress => {
  const { project, contributions = [], now = new Date() } = params;

  const targetMinor = toMinor(project.target_amount_base_minor);
  const commitmentMinor = toMinor(project.monthly_commitment_base_minor ?? 0);
  const rawSaved = getProjectSavedMinor(contributions, { confirmedOnly: true });
  const savedMinor = rawSaved > 0n ? rawSaved : 0n;
  const remainingMinor = targetMinor > savedMinor ? targetMinor - savedMinor : 0n;
  const progressRatio =
    targetMinor > 0n
      ? clampNumber(Number(savedMinor) / Number(targetMinor), 0, 1)
      : 0;
  const hasPlan = commitmentMinor > 0n;

  let monthsLeft: number | null = null;
  let estimatedCompletionDate: Date | null = null;

  if (remainingMinor === 0n) {
    monthsLeft = 0;
    estimatedCompletionDate = new Date(now.getTime());
  } else if (hasPlan) {
    const months = ceilDiv(remainingMinor, commitmentMinor);
    const monthsNumber = Number(months);
    if (Number.isFinite(monthsNumber) && monthsNumber >= 0) {
      monthsLeft = monthsNumber;
      estimatedCompletionDate = addMonths(now, monthsNumber);
    }
  }

  return {
    targetMinor,
    savedMinor,
    remainingMinor,
    progressRatio,
    commitmentMinor,
    monthsLeft,
    estimatedCompletionDate,
    hasPlan,
    isCompleted: remainingMinor === 0n,
  };
};

export const getMonthlyProjectCommitmentTotal = (
  projects: Project[],
  options?: { activeOnly?: boolean }
) => {
  const activeOnly = options?.activeOnly ?? true;

  return projects.reduce((total, project) => {
    if (activeOnly && project.status !== "active") return total;
    if (project.is_hucha) return total;
    return total + toMinor(project.monthly_commitment_base_minor ?? 0);
  }, 0n);
};

const allocateProportionally = (totalMinor: bigint, weights: bigint[]) => {
  if (totalMinor <= 0n || weights.length === 0) {
    return weights.map(() => 0n);
  }

  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0n);
  if (totalWeight <= 0n) {
    return weights.map(() => 0n);
  }

  const baseShares = weights.map((weight) => (totalMinor * weight) / totalWeight);
  const remainders = weights.map((weight, index) => ({
    index,
    remainder: (totalMinor * weight) % totalWeight,
  }));

  let allocated = baseShares.reduce((sum, share) => sum + share, 0n);
  let remaining = totalMinor - allocated;

  if (remaining > 0n) {
    remainders.sort((a, b) => {
      if (a.remainder > b.remainder) return -1;
      if (a.remainder < b.remainder) return 1;
      return a.index - b.index;
    });

    let cursor = 0;
    while (remaining > 0n && remainders.length > 0) {
      const current = remainders[cursor];
      if (!current) break;
      baseShares[current.index] = (baseShares[current.index] ?? 0n) + 1n;
      allocated += 1n;
      remaining -= 1n;
      cursor = (cursor + 1) % remainders.length;
    }
  }

  return baseShares;
};

const sortByPriority = (items: ProjectAllocationInput[]) => {
  return [...items].sort((a, b) => {
    if (a.priority !== b.priority) return a.priority - b.priority;
    return a.projectId.localeCompare(b.projectId);
  });
};

export const computeProjectMonthlyAllocation = (params: {
  projects: ProjectAllocationInput[];
  actualSavedMinor: bigint | number | string;
}): ProjectAllocationResult => {
  const actualSavedMinor = toMinor(params.actualSavedMinor);
  const normalized = sortByPriority(params.projects)
    .map((project) => ({
      projectId: project.projectId,
      priority: project.priority,
      commitmentMinor: toMinor(project.commitmentMinor),
    }))
    .filter((project) => project.commitmentMinor > 0n);

  const totalCommittedMinor = normalized.reduce(
    (sum, project) => sum + project.commitmentMinor,
    0n
  );

  if (normalized.length === 0 || totalCommittedMinor === 0n) {
    return {
      totalCommittedMinor: 0n,
      actualSavedMinor,
      surplusMinor: actualSavedMinor > 0n ? actualSavedMinor : 0n,
      deficitMinor: 0n,
      allocations: [],
    };
  }

  const allocationMap = new Map<string, bigint>();

  if (actualSavedMinor >= totalCommittedMinor) {
    normalized.forEach((project) => {
      allocationMap.set(project.projectId, project.commitmentMinor);
    });
  } else {
    let remaining = actualSavedMinor > 0n ? actualSavedMinor : 0n;
    let index = 0;

    while (index < normalized.length && remaining > 0n) {
      const currentPriority = normalized[index]?.priority;
      if (currentPriority === undefined) break;

      const group: typeof normalized = [];
      while (
        index < normalized.length &&
        normalized[index]?.priority === currentPriority
      ) {
        const item = normalized[index];
        if (item) group.push(item);
        index += 1;
      }

      const groupCommitment = group.reduce(
        (sum, project) => sum + project.commitmentMinor,
        0n
      );

      if (remaining >= groupCommitment) {
        group.forEach((project) => {
          allocationMap.set(project.projectId, project.commitmentMinor);
        });
        remaining -= groupCommitment;
        continue;
      }

      const groupAllocations = allocateProportionally(
        remaining,
        group.map((project) => project.commitmentMinor)
      );

      group.forEach((project, idx) => {
        allocationMap.set(project.projectId, groupAllocations[idx] ?? 0n);
      });

      remaining = 0n;
    }

    for (; index < normalized.length; index += 1) {
      const item = normalized[index];
      if (!item) continue;
      allocationMap.set(item.projectId, 0n);
    }
  }

  const allocations: ProjectAllocationRow[] = normalized.map((project) => {
    const allocatedMinor = allocationMap.get(project.projectId) ?? 0n;
    const shortfallMinor =
      project.commitmentMinor > allocatedMinor
        ? project.commitmentMinor - allocatedMinor
        : 0n;

    return {
      projectId: project.projectId,
      priority: project.priority,
      commitmentMinor: project.commitmentMinor,
      allocatedMinor,
      shortfallMinor,
    };
  });

  const surplusMinor =
    actualSavedMinor > totalCommittedMinor
      ? actualSavedMinor - totalCommittedMinor
      : 0n;
  const deficitMinor =
    totalCommittedMinor > actualSavedMinor
      ? totalCommittedMinor - actualSavedMinor
      : 0n;

  return {
    totalCommittedMinor,
    actualSavedMinor,
    surplusMinor,
    deficitMinor,
    allocations,
  };
};

export const distributeProjectSurplusProportionally = (params: {
  projects: ProjectAllocationInput[];
  surplusMinor: bigint | number | string;
}) => {
  const surplusMinor = toMinor(params.surplusMinor);
  const normalized = params.projects
    .map((project) => ({
      projectId: project.projectId,
      commitmentMinor: toMinor(project.commitmentMinor),
    }))
    .filter((project) => project.commitmentMinor > 0n);

  if (surplusMinor <= 0n || normalized.length === 0) {
    return normalized.map((project) => ({
      projectId: project.projectId,
      allocatedSurplusMinor: 0n,
    }));
  }

  const allocations = allocateProportionally(
    surplusMinor,
    normalized.map((project) => project.commitmentMinor)
  );

  return normalized.map((project, index) => ({
    projectId: project.projectId,
    allocatedSurplusMinor: allocations[index] ?? 0n,
  }));
};

export const computeGoalComposition = (params: {
  totalGoalMinor?: bigint | number | string | null;
  projectsCommitmentMinor?: bigint | number | string | null;
}): GoalComposition => {
  const fromProjectsMinor = toMinor(params.projectsCommitmentMinor ?? 0);
  const totalInputMinor = toMinor(params.totalGoalMinor ?? 0);

  const totalMinor =
    totalInputMinor >= fromProjectsMinor
      ? totalInputMinor
      : fromProjectsMinor;
  const manualMinor =
    totalMinor > fromProjectsMinor ? totalMinor - fromProjectsMinor : 0n;

  return {
    fromProjectsMinor,
    manualMinor,
    totalMinor,
  };
};
