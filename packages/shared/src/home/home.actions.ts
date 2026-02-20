import type { ObligationStatus } from "../domain/types";

export type SupabaseLikeClient = {
  from: (table: string) => any;
};

export type ObligationStatusUpdate = {
  status: "paid" | "pending";
  paidAt: string | null;
  transactionId?: string | null;
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

type ObligationRecord = {
  id: string;
  account_id: string;
  name: string;
  amount_minor: string | number | bigint;
  amount_base_minor?: string | number | bigint | null;
  currency: string;
  due_date: string | Date;
  paid_at?: string | Date | null;
  created_by: string;
};

const resolveDateValue = (value: string | Date | null | undefined) => {
  if (!value) return null;
  if (typeof value === "string") return value;
  return value.toISOString().slice(0, 10);
};

export async function upsertObligationTransaction(
  client: SupabaseLikeClient,
  obligation: ObligationRecord
): Promise<string | null> {
  const amountMinor = String(obligation.amount_minor ?? 0);
  const amountBaseMinor = String(
    obligation.amount_base_minor ?? obligation.amount_minor ?? 0
  );
  const transactionDate =
    resolveDateValue(obligation.paid_at) ??
    resolveDateValue(obligation.due_date) ??
    formatPaidAt();

  const payload = {
    account_id: obligation.account_id,
    type: "expense",
    amount_minor: amountMinor,
    currency: obligation.currency,
    amount_base_minor: amountBaseMinor,
    fx_rate: "1",
    fx_date: transactionDate,
    category_id: null,
    date: transactionDate,
    merchant: obligation.name,
    notes: null,
    created_by: obligation.created_by,
    paid_by: obligation.created_by,
    split_type: "personal",
    split_details: null,
    obligation_id: obligation.id,
  };

  const { data, error } = await client
    .from("transactions")
    .upsert([payload], {
      onConflict: "obligation_id",
      ignoreDuplicates: true,
    })
    .select("id")
    .single();

  if (error) {
    throw error;
  }

  if (data && typeof data === "object" && "id" in data) {
    return data.id as string;
  }

  return null;
}

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

  if (update.status === "paid") {
    const { data: obligation, error: loadError } = await client
      .from("obligations")
      .select(
        "id, account_id, name, amount_minor, amount_base_minor, currency, due_date, paid_at, created_by"
      )
      .eq("id", obligationId)
      .single();

    if (loadError) {
      throw loadError;
    }

    if (obligation) {
      const transactionId = await upsertObligationTransaction(
        client,
        obligation as ObligationRecord
      );
      return { ...update, transactionId };
    }
  }

  return update;
}
