export type ProjectStatus = "active" | "completed" | "paused" | "cancelled";

export type Project = {
  id: string;
  account_id: string;
  name: string;
  emoji: string;
  color?: string | null;
  is_hucha?: boolean;
  target_amount_base_minor?: bigint | number | string | null;
  monthly_commitment_base_minor?: bigint | number | string | null;
  priority: number;
  status: ProjectStatus;
  created_by?: string;
  created_at?: string | Date;
  updated_at?: string | Date;
};

export type ProjectContributionSource = "automatic" | "manual";

export type ProjectContribution = {
  id: string;
  project_id: string;
  account_id?: string;
  user_id?: string;
  period: string | Date;
  committed_amount_base_minor?: bigint | number | string | null;
  actual_amount_base_minor: bigint | number | string;
  source?: ProjectContributionSource;
  confirmed?: boolean;
  confirmed_at?: string | Date | null;
  created_at?: string | Date;
  updated_at?: string | Date;
};

export type ProjectProgress = {
  targetMinor: bigint;
  monthlySavedMinor: bigint;
  extraSavedMinor: bigint;
  savedMinor: bigint;
  remainingMinor: bigint;
  progressRatio: number;
  commitmentMinor: bigint;
  monthsLeft: number | null;
  estimatedCompletionDate: Date | null;
  hasPlan: boolean;
  isCompleted: boolean;
};

export type ProjectAllocationInput = {
  projectId: string;
  priority: number;
  commitmentMinor: bigint | number | string | null | undefined;
};

export type ProjectAllocationRow = {
  projectId: string;
  priority: number;
  commitmentMinor: bigint;
  allocatedMinor: bigint;
  shortfallMinor: bigint;
};

export type ProjectAllocationResult = {
  totalCommittedMinor: bigint;
  actualSavedMinor: bigint;
  surplusMinor: bigint;
  deficitMinor: bigint;
  allocations: ProjectAllocationRow[];
};

export type GoalComposition = {
  fromProjectsMinor: bigint;
  manualMinor: bigint;
  totalMinor: bigint;
};
