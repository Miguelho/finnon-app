"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import {
  type TransactionType,
  type RecurringFrequency,
  parseMoneyToMinor,
  computeAmountBaseMinor,
  parseFxRate,
  CURRENCY_MINOR_UNITS,
  upsertObligationTransaction,
} from "@poleursus/shared";

type ActionResult<T = any> = {
  success: boolean;
  data?: T;
  error?: { key: string; params?: Record<string, string | number> };
};

const resolveFxRate = ({
  currency,
  baseCurrency,
  date,
  fxRateInput,
}: {
  currency: string;
  baseCurrency: string;
  date: string;
  fxRateInput?: string | null;
}):
  | { fxRate: string; fxDate: string }
  | { error: { key: string; params?: Record<string, string | number> } } => {
  if (currency === baseCurrency) {
    return { fxRate: "1", fxDate: date };
  }

  const raw = fxRateInput?.trim() ?? "";
  if (!raw) {
    return { error: { key: "errors.fxRateRequired" } };
  }

  const parsed = parseFxRate(raw);
  if (typeof parsed === "object" && "error" in parsed) {
    return { error: { key: "errors.invalidRequest" } };
  }

  if (parsed <= 0n) {
    return { error: { key: "errors.invalidRequest" } };
  }

  return { fxRate: raw.replace(",", "."), fxDate: date };
};

export async function createTransaction(input: {
  account_id: string;
  type: TransactionType;
  amount: string; // User input as string (e.g., "12.30")
  currency: string;
  category_id: string | null;
  date: string; // ISO date string
  merchant: string | null;
  notes: string | null;
  fx_rate?: string | null; // Optional for v1 multi-currency
}): Promise<ActionResult> {
  try {
    const supabase = await createClient();

    // Get current user
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, error: { key: "errors.unauthorized" } };
    }

    // Verify user is a member of the account
    const { data: membership } = await supabase
      .from("account_members")
      .select("role")
      .eq("account_id", input.account_id)
      .eq("user_id", user.id)
      .single();

    if (!membership) {
      return { success: false, error: { key: "errors.notMember" } };
    }

    // Get account to know base_currency
    const { data: account } = await supabase
      .from("accounts")
      .select("base_currency")
      .eq("id", input.account_id)
      .single();

    if (!account) {
      return { success: false, error: { key: "errors.accountNotFound" } };
    }

    // Parse amount to minor units
    const amountMinor = parseMoneyToMinor(
      input.amount,
      input.currency,
      CURRENCY_MINOR_UNITS
    );
    if (typeof amountMinor === "object" && "error" in amountMinor) {
      return { success: false, error: amountMinor.error };
    }

    // Calculate amount_base_minor
    let amountBaseMinor: bigint;
    const resolvedFx = resolveFxRate({
      currency: input.currency,
      baseCurrency: account.base_currency,
      date: input.date,
      fxRateInput: input.fx_rate,
    });

    if ("error" in resolvedFx) {
      return { success: false, error: resolvedFx.error };
    }

    const { fxRate, fxDate } = resolvedFx;

    if (input.currency === account.base_currency) {
      // Same currency - no conversion needed
      amountBaseMinor = amountMinor;
    } else {
      const computed = computeAmountBaseMinor({
        amountMinor,
        currency: input.currency,
        baseCurrency: account.base_currency,
        fxRate,
        currencyMeta: CURRENCY_MINOR_UNITS,
      });
      if (typeof computed === "object" && "error" in computed) {
        return { success: false, error: { key: "errors.invalidRequest" } };
      }
      amountBaseMinor = computed;
    }

    // Insert transaction
    const { data, error } = await supabase
      .from("transactions")
      .insert([
        {
          account_id: input.account_id,
          type: input.type,
          amount_minor: amountMinor.toString(), // Supabase expects string for bigint
          currency: input.currency,
          amount_base_minor: amountBaseMinor.toString(),
          fx_rate: fxRate,
          fx_date: fxDate,
          category_id: input.category_id,
          date: input.date,
          merchant: input.merchant,
          notes: input.notes,
          created_by: user.id,
        },
      ])
      .select()
      .single();

    if (error) {
      console.error("Error creating transaction:", error);
      return { success: false, error: { key: "errors.internalServer" } };
    }

    revalidatePath("/transactions");
    return { success: true, data };
  } catch (error: any) {
    console.error("Error in createTransaction:", error);
    return {
      success: false,
      error: { key: "errors.internalServer" },
    };
  }
}

export async function createRecurringItem(input: {
  account_id: string;
  type: TransactionType;
  amount: string;
  currency: string;
  category_id: string | null;
  start_date: string;
  frequency: RecurringFrequency;
  interval: number;
  end_date: string | null;
  merchant: string | null;
  notes: string | null;
}): Promise<ActionResult> {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, error: { key: "errors.unauthorized" } };
    }

    const { data: membership } = await supabase
      .from("account_members")
      .select("role")
      .eq("account_id", input.account_id)
      .eq("user_id", user.id)
      .single();

    if (!membership) {
      return { success: false, error: { key: "errors.notMember" } };
    }

    const { data: account } = await supabase
      .from("accounts")
      .select("base_currency")
      .eq("id", input.account_id)
      .single();

    if (!account) {
      return { success: false, error: { key: "errors.accountNotFound" } };
    }

    if (input.currency !== account.base_currency) {
      return { success: false, error: { key: "errors.invalidRequest" } };
    }

    const amountMinor = parseMoneyToMinor(
      input.amount,
      input.currency,
      CURRENCY_MINOR_UNITS
    );
    if (typeof amountMinor === "object" && "error" in amountMinor) {
      return { success: false, error: amountMinor.error };
    }

    if (!Number.isFinite(input.interval) || input.interval < 1) {
      return { success: false, error: { key: "errors.invalidRequest" } };
    }

    const { data, error } = await supabase
      .from("recurring_items")
      .insert([
        {
          account_id: input.account_id,
          type: input.type,
          amount_minor: amountMinor.toString(),
          currency: input.currency,
          category_id: input.category_id,
          merchant: input.merchant,
          notes: input.notes,
          start_date: input.start_date,
          frequency: input.frequency,
          interval: input.interval,
          end_date: input.end_date,
          is_paused: false,
          created_by: user.id,
        },
      ])
      .select()
      .single();

    if (error) {
      console.error("Error creating recurring item:", error);
      return { success: false, error: { key: "errors.internalServer" } };
    }

    revalidatePath("/transactions");
    return { success: true, data };
  } catch (error: any) {
    console.error("Error in createRecurringItem:", error);
    return { success: false, error: { key: "errors.internalServer" } };
  }
}

export async function createObligation(input: {
  account_id: string;
  name: string;
  amount: string;
  currency: string;
  due_date: string;
  status?: "pending" | "paid";
  paid_at?: string | null;
}): Promise<ActionResult> {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, error: { key: "errors.unauthorized" } };
    }

    const { data: membership } = await supabase
      .from("account_members")
      .select("role")
      .eq("account_id", input.account_id)
      .eq("user_id", user.id)
      .single();

    if (!membership) {
      return { success: false, error: { key: "errors.notMember" } };
    }

    const { data: account } = await supabase
      .from("accounts")
      .select("base_currency")
      .eq("id", input.account_id)
      .single();

    if (!account) {
      return { success: false, error: { key: "errors.accountNotFound" } };
    }

    const amountMinor = parseMoneyToMinor(
      input.amount,
      input.currency,
      CURRENCY_MINOR_UNITS
    );
    if (typeof amountMinor === "object" && "error" in amountMinor) {
      return { success: false, error: amountMinor.error };
    }

    const resolvedFx = resolveFxRate({
      currency: input.currency,
      baseCurrency: account.base_currency,
      date: input.due_date,
      fxRateInput: null,
    });

    if ("error" in resolvedFx) {
      return { success: false, error: resolvedFx.error };
    }

    const amountBaseMinor =
      input.currency === account.base_currency
        ? amountMinor
        : computeAmountBaseMinor({
            amountMinor,
            currency: input.currency,
            baseCurrency: account.base_currency,
            fxRate: resolvedFx.fxRate,
            currencyMeta: CURRENCY_MINOR_UNITS,
          });

    if (typeof amountBaseMinor === "object" && "error" in amountBaseMinor) {
      return { success: false, error: { key: "errors.invalidRequest" } };
    }

    const status = input.status ?? "pending";
    const paidAt = status === "paid" ? input.paid_at ?? input.due_date : null;

    const { data, error } = await supabase
      .from("obligations")
      .insert([
        {
          account_id: input.account_id,
          name: input.name,
          amount_minor: amountMinor.toString(),
          amount_base_minor: amountBaseMinor.toString(),
          currency: input.currency,
          due_date: input.due_date,
          status,
          paid_at: paidAt,
          created_by: user.id,
        },
      ])
      .select()
      .single();

    if (error) {
      console.error("Error creating obligation:", error);
      return { success: false, error: { key: "errors.internalServer" } };
    }

    if (status === "paid" && data) {
      await upsertObligationTransaction(supabase, data as any);
    }

    revalidatePath("/transactions");
    revalidatePath("/");
    return { success: true, data };
  } catch (error: any) {
    console.error("Error in createObligation:", error);
    return {
      success: false,
      error: { key: "errors.internalServer" },
    };
  }
}

export async function confirmRecurringTransaction(input: {
  recurring_item_id: string;
  occurrence_date: string;
}): Promise<ActionResult> {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, error: { key: "errors.unauthorized" } };
    }

    const { data: recurringItem } = await supabase
      .from("recurring_items")
      .select(
        "id, account_id, type, amount_minor, currency, category_id, merchant, notes, is_paused"
      )
      .eq("id", input.recurring_item_id)
      .single();

    if (!recurringItem || recurringItem.is_paused) {
      return { success: false, error: { key: "errors.invalidRequest" } };
    }

    const { data: membership } = await supabase
      .from("account_members")
      .select("role")
      .eq("account_id", recurringItem.account_id)
      .eq("user_id", user.id)
      .single();

    if (!membership) {
      return { success: false, error: { key: "errors.notMember" } };
    }

    const { data: account } = await supabase
      .from("accounts")
      .select("base_currency")
      .eq("id", recurringItem.account_id)
      .single();

    if (!account || account.base_currency !== recurringItem.currency) {
      return { success: false, error: { key: "errors.invalidRequest" } };
    }

    const amountMinor = String(recurringItem.amount_minor);
    const insertPayload = {
      account_id: recurringItem.account_id,
      type: recurringItem.type,
      amount_minor: amountMinor,
      currency: recurringItem.currency,
      amount_base_minor: amountMinor,
      fx_rate: "1",
      fx_date: input.occurrence_date,
      category_id: recurringItem.category_id,
      date: input.occurrence_date,
      merchant: recurringItem.merchant,
      notes: recurringItem.notes,
      created_by: user.id,
      recurring_item_id: recurringItem.id,
      recurring_occurrence_date: input.occurrence_date,
    };

    const { data: inserted, error: insertError } = await supabase
      .from("transactions")
      .upsert([insertPayload], {
        onConflict: "account_id,recurring_item_id,recurring_occurrence_date",
        ignoreDuplicates: true,
      })
      .select()
      .single();

    if (insertError) {
      console.error("Error confirming recurring transaction:", insertError);
      return { success: false, error: { key: "errors.internalServer" } };
    }

    if (!inserted) {
      const { data: existing } = await supabase
        .from("transactions")
        .select(
          "id, account_id, type, amount_minor, currency, amount_base_minor, category_id, date, merchant, notes, created_by, created_at"
        )
        .eq("account_id", recurringItem.account_id)
        .eq("recurring_item_id", recurringItem.id)
        .eq("recurring_occurrence_date", input.occurrence_date)
        .single();

      revalidatePath("/transactions");
      return { success: true, data: existing ?? null };
    }

    revalidatePath("/transactions");
    return { success: true, data: inserted };
  } catch (error: any) {
    console.error("Error in confirmRecurringTransaction:", error);
    return { success: false, error: { key: "errors.internalServer" } };
  }
}

export async function updateTransaction(
  transactionId: string,
  input: {
    type: TransactionType;
    amount: string;
    currency: string;
    category_id: string | null;
    date: string;
    merchant: string | null;
    notes: string | null;
    fx_rate?: string | null;
  }
): Promise<ActionResult> {
  try {
    const supabase = await createClient();

    // Get current user
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, error: { key: "errors.unauthorized" } };
    }

    // Get the transaction to verify ownership
    const { data: transaction } = await supabase
      .from("transactions")
      .select("account_id")
      .eq("id", transactionId)
      .single();

    if (!transaction) {
      return { success: false, error: { key: "errors.transactionNotFound" } };
    }

    // Verify user is a member of the account
    const { data: membership } = await supabase
      .from("account_members")
      .select("role")
      .eq("account_id", transaction.account_id)
      .eq("user_id", user.id)
      .single();

    if (!membership) {
      return { success: false, error: { key: "errors.notMember" } };
    }

    // Get account to know base_currency
    const { data: account } = await supabase
      .from("accounts")
      .select("base_currency")
      .eq("id", transaction.account_id)
      .single();

    if (!account) {
      return { success: false, error: { key: "errors.accountNotFound" } };
    }

    // Parse amount to minor units
    const amountMinor = parseMoneyToMinor(
      input.amount,
      input.currency,
      CURRENCY_MINOR_UNITS
    );
    if (typeof amountMinor === "object" && "error" in amountMinor) {
      return { success: false, error: amountMinor.error };
    }

    // Calculate amount_base_minor
    let amountBaseMinor: bigint;
    const resolvedFx = resolveFxRate({
      currency: input.currency,
      baseCurrency: account.base_currency,
      date: input.date,
      fxRateInput: input.fx_rate,
    });

    if ("error" in resolvedFx) {
      return { success: false, error: resolvedFx.error };
    }

    const { fxRate, fxDate } = resolvedFx;

    if (input.currency === account.base_currency) {
      amountBaseMinor = amountMinor;
    } else {
      const computed = computeAmountBaseMinor({
        amountMinor,
        currency: input.currency,
        baseCurrency: account.base_currency,
        fxRate,
        currencyMeta: CURRENCY_MINOR_UNITS,
      });
      if (typeof computed === "object" && "error" in computed) {
        return { success: false, error: { key: "errors.invalidRequest" } };
      }
      amountBaseMinor = computed;
    }

    // Update transaction
    const { data, error } = await supabase
      .from("transactions")
      .update({
        type: input.type,
        amount_minor: amountMinor.toString(),
        currency: input.currency,
        amount_base_minor: amountBaseMinor.toString(),
        fx_rate: fxRate,
        fx_date: fxDate,
        category_id: input.category_id,
        date: input.date,
        merchant: input.merchant,
        notes: input.notes,
      })
      .eq("id", transactionId)
      .select()
      .single();

    if (error) {
      console.error("Error updating transaction:", error);
      return { success: false, error: { key: "errors.internalServer" } };
    }

    revalidatePath("/transactions");
    return { success: true, data };
  } catch (error: any) {
    console.error("Error in updateTransaction:", error);
    return {
      success: false,
      error: { key: "errors.internalServer" },
    };
  }
}

export async function deleteTransaction(
  transactionId: string
): Promise<ActionResult> {
  try {
    const supabase = await createClient();

    // Get current user
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, error: { key: "errors.unauthorized" } };
    }

    // Get the transaction to verify ownership
    const { data: transaction } = await supabase
      .from("transactions")
      .select("account_id")
      .eq("id", transactionId)
      .single();

    if (!transaction) {
      return { success: false, error: { key: "errors.transactionNotFound" } };
    }

    // Verify user is a member of the account
    const { data: membership } = await supabase
      .from("account_members")
      .select("role")
      .eq("account_id", transaction.account_id)
      .eq("user_id", user.id)
      .single();

    if (!membership) {
      return { success: false, error: { key: "errors.notMember" } };
    }

    // Delete transaction
    const { error } = await supabase
      .from("transactions")
      .delete()
      .eq("id", transactionId);

    if (error) {
      console.error("Error deleting transaction:", error);
      return { success: false, error: { key: "errors.internalServer" } };
    }

    revalidatePath("/transactions");
    return { success: true };
  } catch (error: any) {
    console.error("Error in deleteTransaction:", error);
    return {
      success: false,
      error: { key: "errors.internalServer" },
    };
  }
}
