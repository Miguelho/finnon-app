import { cacheTags } from "./keys";

export type MutationAction = "insert" | "update" | "delete" | "upsert";

export type MutationEntity =
  | "transactions"
  | "obligations"
  | "recurring_items"
  | "categories"
  | "projects"
  | "project_contributions";

const tableToTags: Record<MutationEntity, string[]> = {
  transactions: [
    cacheTags.transactions,
    cacheTags.merchants,
    cacheTags.topCategories,
    cacheTags.homeCalendar,
    cacheTags.savingsSummary,
    cacheTags.projectsMonthCloseInputs,
  ],
  obligations: [
    cacheTags.obligations,
    cacheTags.homeCalendar,
    cacheTags.homeNextProgrammed,
    cacheTags.savingsSummary,
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
  projects: [
    cacheTags.savingsSummary,
    cacheTags.projects,
    cacheTags.hucha,
  ],
  project_contributions: [
    cacheTags.savingsSummary,
    cacheTags.savingsHistory,
    cacheTags.savingsGamification,
    cacheTags.hucha,
    cacheTags.projectContributions,
    cacheTags.projects,
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
