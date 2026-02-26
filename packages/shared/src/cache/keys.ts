import type { CategoryType } from "../schemas/category";

const join = (...parts: Array<string | number | null | undefined>) =>
  parts
    .filter((part): part is string | number => part !== null && part !== undefined)
    .map((part) => String(part))
    .join(":");

export const cacheKeys = {
  transactionsRange: (accountId: string, start: string, end: string) =>
    join("transactions", accountId, start, end),
  obligationsRange: (accountId: string, start: string, end: string) =>
    join("obligations", accountId, start, end),
  recurrentsRange: (accountId: string, start: string, end: string) =>
    join("recurrents", accountId, start, end),
  categories: (accountId: string) => join("categories", accountId),
  topCategories: (accountId: string, txType: CategoryType) =>
    join("top_categories", accountId, txType),
  merchantSuggestions: (accountId: string, txType: "income" | "expense") =>
    join("merchant_suggestions", accountId, txType),
  goalMonth: (accountId: string, month: string) => join("goal", accountId, month),
  goalHistory: (accountId: string) => join("goal_history", accountId),
  goalGamification: (accountId: string) => join("goal_gamification", accountId),
  projects: (accountId: string) => join("projects", accountId),
  projectContributions: (accountId: string, scope: string) =>
    join("project_contributions", accountId, scope),
  accountSummary: (accountId: string) => join("account_summary", accountId),
};

export const cacheTags = {
  transactions: "transactions",
  obligations: "obligations",
  recurrents: "recurrents",
  categories: "categories",
  merchants: "merchants",
  topCategories: "top_categories",
  homeCalendar: "home_calendar",
  homeNextProgrammed: "home_next_programmed",
  goalSummary: "goal_summary",
  goalMonth: "goal_month",
  goalHistory: "goal_history",
  goalGamification: "goal_gamification",
  homeObjective: "home_objective",
  projects: "projects",
  homeProjectWidget: "home_project_widget",
  goalComposition: "goal_composition",
  projectContributions: "project_contributions",
  projectsMonthCloseInputs: "projects_month_close_inputs",
  accountSummary: "account_summary",
  transactionsPendingProjection: "transactions_pending_projection",
};
