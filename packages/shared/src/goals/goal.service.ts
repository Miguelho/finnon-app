import type { FinancialGoal, GoalType, MonthKey } from "./types";

export type SupabaseLikeClient = {
  from: (table: string) => any;
};

export async function getMonthlyGoal(
  client: SupabaseLikeClient,
  accountId: string,
  month: MonthKey,
  type: GoalType = "save"
): Promise<FinancialGoal | null> {
  const { data, error } = await client
    .from("financial_goals")
    .select("*")
    .eq("account_id", accountId)
    .eq("month", month)
    .eq("type", type)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return (data as FinancialGoal | null) ?? null;
}

export async function upsertMonthlyGoal(params: {
  client: SupabaseLikeClient;
  accountId: string;
  month: MonthKey;
  targetAmountBaseMinor: bigint | number | string;
  createdBy: string;
  type?: GoalType;
  now?: Date;
}): Promise<FinancialGoal> {
  const {
    client,
    accountId,
    month,
    targetAmountBaseMinor,
    createdBy,
    type = "save",
    now,
  } = params;

  const payload = {
    account_id: accountId,
    month,
    type,
    target_amount_base_minor: String(targetAmountBaseMinor),
    created_by: createdBy,
    updated_at: (now ?? new Date()).toISOString(),
  };

  const { data, error } = await client
    .from("financial_goals")
    .upsert([payload], { onConflict: "account_id,month,type" })
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data as FinancialGoal;
}
