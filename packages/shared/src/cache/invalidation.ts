import { cacheTags } from "./keys";

export type MutationAction = "insert" | "update" | "delete" | "upsert";

export type MutationEntity =
  | "transactions"
  | "obligations"
  | "recurring_items"
  | "categories"
  | "financial_goals"
  | "projects"
  | "project_contributions";

const tableToTags: Record<MutationEntity, string[]> = {
  transactions: [
    cacheTags.transactions,
    cacheTags.merchants,
    cacheTags.topCategories,
    cacheTags.homeCalendar,
    cacheTags.goalSummary,
    cacheTags.projectsMonthCloseInputs,
  ],
  obligations: [
    cacheTags.obligations,
    cacheTags.homeCalendar,
    cacheTags.homeNextProgrammed,
  ],
  recurring_items: [
    cacheTags.recurrents,
    cacheTags.transactionsPendingProjection,
    cacheTags.merchants,
    cacheTags.topCategories,
  ],
  categories: [
    cacheTags.categories,
    cacheTags.topCategories,
    cacheTags.transactions,
  ],
  financial_goals: [
    cacheTags.goalMonth,
    cacheTags.goalHistory,
    cacheTags.goalGamification,
    cacheTags.homeObjective,
  ],
  projects: [
    cacheTags.projects,
    cacheTags.homeProjectWidget,
    cacheTags.goalComposition,
  ],
  project_contributions: [
    cacheTags.projectContributions,
    cacheTags.projects,
    cacheTags.homeProjectWidget,
  ],
};

export function getInvalidationTagsForMutation(
  entity: MutationEntity,
  _action: MutationAction
): string[] {
  return tableToTags[entity] ?? [];
}

export function getInvalidationTagsForTable(table: string): string[] {
  const normalized = table as MutationEntity;
  if (!(normalized in tableToTags)) return [];
  return tableToTags[normalized];
}
