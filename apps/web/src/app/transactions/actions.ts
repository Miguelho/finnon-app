"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import {
  type TransactionType,
  parseMoneyToMinor,
  convertCurrency,
} from "@poleursus/shared";

type ActionResult<T = any> = {
  success: boolean;
  data?: T;
  error?: { key: string; params?: Record<string, string | number> };
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
  fx_rate?: number; // Optional for v1 multi-currency
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
    const amountMinor = parseMoneyToMinor(input.amount, input.currency);
    if (typeof amountMinor === "object" && "error" in amountMinor) {
      return { success: false, error: amountMinor.error };
    }

    // Calculate amount_base_minor
    let amountBaseMinor: bigint;
    let fxRate = input.fx_rate ?? 1;

    if (input.currency === account.base_currency) {
      // Same currency - no conversion needed
      amountBaseMinor = amountMinor;
      fxRate = 1;
    } else {
      // Different currency - convert
      if (!input.fx_rate || input.fx_rate <= 0) {
        return {
          success: false,
          error: { key: "errors.fxRateRequired" },
        };
      }
      amountBaseMinor = convertCurrency(
        amountMinor,
        input.currency,
        account.base_currency,
        input.fx_rate
      );
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
    fx_rate?: number;
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
    const amountMinor = parseMoneyToMinor(input.amount, input.currency);
    if (typeof amountMinor === "object" && "error" in amountMinor) {
      return { success: false, error: amountMinor.error };
    }

    // Calculate amount_base_minor
    let amountBaseMinor: bigint;
    let fxRate = input.fx_rate ?? 1;

    if (input.currency === account.base_currency) {
      amountBaseMinor = amountMinor;
      fxRate = 1;
    } else {
      if (!input.fx_rate || input.fx_rate <= 0) {
        return {
          success: false,
          error: { key: "errors.fxRateRequired" },
        };
      }
      amountBaseMinor = convertCurrency(
        amountMinor,
        input.currency,
        account.base_currency,
        input.fx_rate
      );
    }

    // Update transaction
    const { data, error } = await supabase
      .from("transactions")
      .update({
        type: input.type,
        amount_minor: amountMinor.toString(),
        currency: input.currency,
        amount_base_minor: amountBaseMinor.toString(),
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
