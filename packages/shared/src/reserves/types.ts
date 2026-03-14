export type ReserveContainerKind = "hucha";
export type ReserveContainerStatus = "active";

export type ReserveContainer = {
  id: string;
  account_id: string;
  slug: string;
  kind: ReserveContainerKind;
  name: string;
  emoji: string;
  color?: string | null;
  status: ReserveContainerStatus;
  created_by?: string;
  created_at?: string | Date;
  updated_at?: string | Date;
};

export type MonthlyProjectFundingPlan = {
  id: string;
  account_id: string;
  period: string | Date;
  project_id: string;
  planned_amount_base_minor: bigint | number | string;
  created_by?: string;
  updated_by?: string;
  created_at?: string | Date;
  updated_at?: string | Date;
};

export type MonthClose = {
  id: string;
  account_id: string;
  period: string | Date;
  actual_saved_base_minor: bigint | number | string;
  allocated_to_projects_base_minor: bigint | number | string;
  allocated_to_reserves_base_minor: bigint | number | string;
  closed_by: string;
  closed_at: string | Date;
  created_at?: string | Date;
};

export type MonthCloseAllocationDestinationType = "project" | "reserve_container";

export type MonthCloseAllocation = {
  id: string;
  month_close_id: string;
  account_id: string;
  destination_type: MonthCloseAllocationDestinationType;
  project_id?: string | null;
  reserve_container_id?: string | null;
  amount_base_minor: bigint | number | string;
  created_at?: string | Date;
};

export type ReserveTransfer = {
  id: string;
  account_id: string;
  source_reserve_container_id: string;
  destination_project_id: string;
  amount_base_minor: bigint | number | string;
  direction?: "reserve_to_project" | "project_to_reserve" | null;
  created_by?: string;
  created_at?: string | Date;
};

export type SavingsMonthProjectPlan = {
  project_id: string;
  planned_amount_base_minor: bigint | number | string;
};

export type SavingsMonthView = {
  period: string;
  generatedSavedMinor: bigint;
  plannedToProjectsMinor: bigint;
  availableToPlanMinor: bigint;
  needsRebalance: boolean;
  isClosed: boolean;
  closedAt: string | Date | null;
  allocatedToProjectsMinor: bigint;
  allocatedToReservesMinor: bigint;
};

export type ReserveContainerStats = {
  accumulatedMinor: bigint;
  currentMonthContributionMinor: bigint;
  averageMinor: bigint;
  monthsWithContribution: number;
  bestMonth: { period: string; amountMinor: bigint } | null;
  series: Array<{ period: string; amountMinor: bigint }>;
};
