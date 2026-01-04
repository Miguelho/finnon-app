import type { ObligationStatus } from "../domain/types";

type SupabaseUpdateResponse = { error?: unknown | null };

type SupabaseUpdateQuery = {
  eq: (column: string, value: string) => Promise<SupabaseUpdateResponse>;
};

type SupabaseTableQuery = {
  update: (values: Record<string, unknown>) => SupabaseUpdateQuery;
};

export type SupabaseLikeClient = {
  from: (table: string) => SupabaseTableQuery;
};

export type ObligationStatusUpdate = {
  status: "paid" | "pending";
  paidAt: string | null;
};

const formatPaidAt = (now?: Date) =>
  (now ?? new Date()).toISOString().slice(0, 10);

export const getNextObligationStatus = (
  currentStatus?: ObligationStatus | null,
  now?: Date
): ObligationStatusUpdate => {
  const nextStatus = currentStatus === "paid" ? "pending" : "paid";
  return {
    status: nextStatus,
    paidAt: nextStatus === "paid" ? formatPaidAt(now) : null,
  };
};

export async function markObligationPaid(
  client: SupabaseLikeClient,
  obligationId: string,
  currentStatus?: ObligationStatus | null,
  now?: Date
): Promise<ObligationStatusUpdate> {
  const update = getNextObligationStatus(currentStatus, now);
  const { error } = await client
    .from("obligations")
    .update({ status: update.status, paid_at: update.paidAt })
    .eq("id", obligationId);

  if (error) {
    throw error;
  }

  return update;
}
