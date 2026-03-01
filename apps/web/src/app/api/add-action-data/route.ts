import { NextResponse } from "next/server";
import { createAuthenticatedClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const isMissingCategoryColorError = (error: any) =>
  error?.code === "42703" &&
  typeof error?.message === "string" &&
  error.message.includes("categories") &&
  error.message.includes("color");

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

    const { client: supabase, user } = await createAuthenticatedClient();

    const loadCategories = async () => {
      let categoriesResult = await supabase
        .from("categories")
        .select("id, name, icon_id, type, color")
        .eq("account_id", accountId)
        .order("name", { ascending: true });

      if (isMissingCategoryColorError(categoriesResult.error)) {
        console.warn(
          "[add-action-data][web] categories.color missing, retrying without color."
        );
        const legacyResult = await supabase
          .from("categories")
          .select("id, name, icon_id, type")
          .eq("account_id", accountId)
          .order("name", { ascending: true });

        return {
          data: (legacyResult.data ?? []).map((item) => ({ ...item, color: null })),
          error: legacyResult.error,
        };
      }

      return categoriesResult;
    };

    const [
      categoriesResult,
      topExpenseResult,
      topIncomeResult,
      merchantExpenseResult,
      merchantIncomeResult,
      membersResult,
    ] = await Promise.all([
      loadCategories(),
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
      supabase
        .from("account_members")
        .select("user_id, role")
        .eq("account_id", accountId),
    ]);

    if (categoriesResult.error) throw categoriesResult.error;
    if (topExpenseResult.error) throw topExpenseResult.error;
    if (topIncomeResult.error) throw topIncomeResult.error;
    if (merchantExpenseResult.error) throw merchantExpenseResult.error;
    if (merchantIncomeResult.error) throw merchantIncomeResult.error;
    if (membersResult.error) throw membersResult.error;

    const memberUserIds = (membersResult.data ?? []).map((member) => member.user_id);
    const { data: memberProfiles, error: memberProfilesError } =
      memberUserIds.length > 0
        ? await supabase
            .from("profiles")
            .select("user_id, email, display_name")
            .in("user_id", memberUserIds)
        : { data: [], error: null };

    if (memberProfilesError) throw memberProfilesError;

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

    const profileByUserId = new Map(
      (memberProfiles ?? []).map((profile) => [profile.user_id, profile])
    );
    const participants = (membersResult.data ?? []).map((member) => {
      const profile = profileByUserId.get(member.user_id);
      return {
        userId: member.user_id,
        role: member.role,
        name:
          profile?.display_name?.trim() ||
          profile?.email?.trim() ||
          member.user_id.slice(0, 6),
      };
    });

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
      participants,
      currentUserId: user.id,
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
