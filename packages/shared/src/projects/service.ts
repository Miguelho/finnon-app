import type { Project, ProjectContribution, ProjectStatus } from "./types";

export type ProjectSupabaseLikeClient = {
  from: (table: string) => any;
};

export async function getAccountProjects(params: {
  client: ProjectSupabaseLikeClient;
  accountId: string;
  statuses?: ProjectStatus[];
}): Promise<Project[]> {
  const { client, accountId, statuses } = params;

  let query = client
    .from("projects")
    .select("*")
    .eq("account_id", accountId)
    .order("priority", { ascending: true })
    .order("created_at", { ascending: true });

  if (statuses && statuses.length > 0) {
    query = query.in("status", statuses);
  }

  const { data, error } = await query;
  if (error) throw error;

  return (data as Project[] | null) ?? [];
}

export async function getProjectById(params: {
  client: ProjectSupabaseLikeClient;
  projectId: string;
}): Promise<Project | null> {
  const { client, projectId } = params;

  const { data, error } = await client
    .from("projects")
    .select("*")
    .eq("id", projectId)
    .maybeSingle();

  if (error) throw error;
  return (data as Project | null) ?? null;
}

export async function createProject(params: {
  client: ProjectSupabaseLikeClient;
  accountId: string;
  createdBy: string;
  name: string;
  emoji: string;
  targetAmountBaseMinor: bigint | number | string;
  priority: number;
  status?: ProjectStatus;
}): Promise<Project> {
  const {
    client,
    accountId,
    createdBy,
    name,
    emoji,
    targetAmountBaseMinor,
    priority,
    status = "active",
  } = params;

  const payload = {
    account_id: accountId,
    created_by: createdBy,
    name,
    emoji,
    target_amount_base_minor: String(targetAmountBaseMinor),
    priority,
    status,
  };

  const { data, error } = await client
    .from("projects")
    .insert(payload)
    .select("*")
    .single();

  if (error) throw error;
  return data as Project;
}

export async function updateProjectCommitment(params: {
  client: ProjectSupabaseLikeClient;
  projectId: string;
  monthlyCommitmentBaseMinor: bigint | number | string | null;
  now?: Date;
}): Promise<Project> {
  const { client, projectId, monthlyCommitmentBaseMinor, now } = params;

  const payload = {
    monthly_commitment_base_minor:
      monthlyCommitmentBaseMinor === null
        ? null
        : String(monthlyCommitmentBaseMinor),
    updated_at: (now ?? new Date()).toISOString(),
  };

  const { data, error } = await client
    .from("projects")
    .update(payload)
    .eq("id", projectId)
    .select("*")
    .single();

  if (error) throw error;
  return data as Project;
}

export async function getProjectContributions(params: {
  client: ProjectSupabaseLikeClient;
  projectId: string;
}): Promise<ProjectContribution[]> {
  const { client, projectId } = params;

  const { data, error } = await client
    .from("project_contributions")
    .select("*")
    .eq("project_id", projectId)
    .order("period", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data as ProjectContribution[] | null) ?? [];
}
