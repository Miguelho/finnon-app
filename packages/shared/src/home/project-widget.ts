import type { Project } from "../projects/types";
import { isFinancialProject } from "../projects/compute";

export type HomeProjectWidgetState =
  | { state: "empty" }
  | { state: "active"; project: Project }
  | { state: "completed"; project: Project }
  | { state: "all_done"; project: Project | null };

const toMillis = (value: string | Date | null | undefined) => {
  if (!value) return 0;
  const date = value instanceof Date ? value : new Date(value);
  const millis = date.getTime();
  return Number.isFinite(millis) ? millis : 0;
};

const sortByPriority = (projects: Project[]) =>
  [...projects].sort((a, b) => {
    if (a.priority !== b.priority) return a.priority - b.priority;
    return toMillis(a.created_at) - toMillis(b.created_at);
  });

const sortByUpdatedDesc = (projects: Project[]) =>
  [...projects].sort((a, b) => toMillis(b.updated_at) - toMillis(a.updated_at));

export function getProjectWidgetState(
  projects: Project[],
  now: Date = new Date()
): HomeProjectWidgetState {
  const activeProjects = sortByPriority(
    projects.filter((project) => project.status === "active" && isFinancialProject(project))
  );
  const completedProjects = sortByUpdatedDesc(
    projects.filter((project) => project.status === "completed" && isFinancialProject(project))
  );

  if (activeProjects.length === 0 && completedProjects.length === 0) {
    return { state: "empty" };
  }

  if (activeProjects.length === 0 && completedProjects.length > 0) {
    return { state: "all_done", project: completedProjects[0] ?? null };
  }

  const recentlyCompleted = completedProjects.find((project) => {
    const updatedMillis = toMillis(project.updated_at);
    if (!updatedMillis) return false;
    const daysSinceCompletion =
      (now.getTime() - updatedMillis) / (1000 * 60 * 60 * 24);
    return daysSinceCompletion >= 0 && daysSinceCompletion <= 7;
  });

  if (recentlyCompleted) {
    return { state: "completed", project: recentlyCompleted };
  }

  return { state: "active", project: activeProjects[0] as Project };
}
