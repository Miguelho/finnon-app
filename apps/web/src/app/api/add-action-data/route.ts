import { NextResponse } from "next/server";
import { createAuthenticatedClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const accountId = searchParams.get("accountId");

    if (!accountId) {
      return NextResponse.json(
        { errorKey: "errors.invalidRequest" },
        { status: 400 }
      );
    }

    const { client: supabase } = await createAuthenticatedClient();

    const [
      categoriesResult,
      topExpenseResult,
      topIncomeResult,
      merchantExpenseResult,
      merchantIncomeResult,
    ] = await Promise.all([
      supabase
        .from("categories")
        .select("id, name, icon_id, type")
        .eq("account_id", accountId)
        .order("name", { ascending: true }),
      supabase.rpc("get_top_categories", {
        p_account_id: accountId,
        p_tx_type: "expense",
        p_limit: 3,
      }),
      supabase.rpc("get_top_categories", {
        p_account_id: accountId,
        p_tx_type: "income",
        p_limit: 3,
      }),
      supabase.rpc("get_merchant_suggestions", {
        p_account_id: accountId,
        p_tx_type: "expense",
        p_limit: 20,
      }),
      supabase.rpc("get_merchant_suggestions", {
        p_account_id: accountId,
        p_tx_type: "income",
        p_limit: 20,
      }),
    ]);

    if (categoriesResult.error) throw categoriesResult.error;
    if (topExpenseResult.error) throw topExpenseResult.error;
    if (topIncomeResult.error) throw topIncomeResult.error;
    if (merchantExpenseResult.error) throw merchantExpenseResult.error;
    if (merchantIncomeResult.error) throw merchantIncomeResult.error;

    const normalizeRpcList = <T,>(value: unknown): T[] => {
      if (!value) return [];
      if (Array.isArray(value)) return value as T[];
      if (typeof value === "string") {
        try {
          const parsed = JSON.parse(value);
          return Array.isArray(parsed) ? (parsed as T[]) : [];
        } catch {
          return [];
        }
      }
      return [];
    };

    return NextResponse.json({
      categories: categoriesResult.data ?? [],
      topCategories: {
        expense: normalizeRpcList(topExpenseResult.data),
        income: normalizeRpcList(topIncomeResult.data),
      },
      merchantSuggestions: {
        expense: normalizeRpcList(merchantExpenseResult.data),
        income: normalizeRpcList(merchantIncomeResult.data),
      },
    });
  } catch (error) {
    console.error("Add action data endpoint error:", error);

    if (error instanceof Error && error.message === "No hay sesión activa válida") {
      return NextResponse.json(
        { errorKey: "errors.authRequired" },
        { status: 401 }
      );
    }

    return NextResponse.json(
      { errorKey: "errors.internalServer" },
      { status: 500 }
    );
  }
}
