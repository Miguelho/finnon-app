import { buildProjectColorMap, getProjectColor } from "../projects/palette";
import { computeProjectProgress } from "../projects/compute";
import type { Project } from "../projects/types";

type MinorLike = bigint | number | string | null | undefined;

export type HomeProjectContributionRow = {
  project_id: string | null;
  amount_base_minor: MinorLike;
};

export type HomeProjectPreview = {
  id: string;
  name: string;
  emoji: string;
  color: string;
  goalAmount: bigint;
  totalContributed: bigint;
  estimatedCompletion: Date | null;
  progressRatio: number;
  priority: number;
};

const toMinor = (value: MinorLike): bigint => {
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

const byPriority = (left: Project, right: Project) => {
  if (left.priority !== right.priority) {
    return left.priority - right.priority;
  }

  const leftCreated = left.created_at ? new Date(left.created_at).getTime() : Number.POSITIVE_INFINITY;
  const rightCreated = right.created_at ? new Date(right.created_at).getTime() : Number.POSITIVE_INFINITY;

  if (leftCreated !== rightCreated) {
    return leftCreated - rightCreated;
  }

  return left.name.localeCompare(right.name);
};

export const getProjectContributionTotals = (
  rows: HomeProjectContributionRow[]
): Map<string, bigint> => {
  const totals = new Map<string, bigint>();

  rows.forEach((row) => {
    if (!row.project_id) return;
    totals.set(row.project_id, (totals.get(row.project_id) ?? 0n) + toMinor(row.amount_base_minor));
  });

  return totals;
};

export const buildHomeProjectPreviews = (params: {
  projects: Project[];
  contributionRows: HomeProjectContributionRow[];
  limit?: number;
  now?: Date;
}): HomeProjectPreview[] => {
  const { projects, contributionRows, limit = 3, now } = params;
  const contributionTotals = getProjectContributionTotals(contributionRows);
  const sortedProjects = [...projects].sort(byPriority).slice(0, Math.max(0, limit));
  const projectColorMap = buildProjectColorMap(projects);

  return sortedProjects.map((project) => {
    const totalContributed = contributionTotals.get(project.id) ?? 0n;
    const progress = computeProjectProgress({
      project,
      fundedMinor: totalContributed,
      now,
    });

    return {
      id: project.id,
      name: project.name,
      emoji: project.emoji || "🎯",
      color: getProjectColor(project, projectColorMap),
      goalAmount: progress.targetMinor > 0n ? progress.targetMinor : 0n,
      totalContributed,
      estimatedCompletion: progress.estimatedCompletionDate,
      progressRatio: progress.progressRatio,
      priority: project.priority,
    };
  });
};
