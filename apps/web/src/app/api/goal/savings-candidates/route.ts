import { NextRequest, NextResponse } from "next/server";
import { createAuthenticatedClient } from "@/lib/supabase/server";
import { getSupabaseAnonKey, getSupabaseUrl } from "@/lib/supabase/env";

const TIME_ZONE = "Europe/Madrid";

const getDateKeyInTimeZone = (timeZone: string, date = new Date()) => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const lookup = parts.reduce<Record<string, string>>((acc, part) => {
    if (part.type !== "literal") acc[part.type] = part.value;
    return acc;
  }, {});

  const year = lookup.year ?? "1970";
  const month = lookup.month ?? "01";
  const day = lookup.day ?? "01";
  return `${year}-${month}-${day}`;
};

const isMonthKey = (value: string | null) =>
  typeof value === "string" && /^\d{4}-\d{2}$/.test(value);

const getMonthRange = (monthKey: string) => {
  const [yearStr, monthStr] = monthKey.split("-");
  const year = Number(yearStr);
  const monthIndex = Number(monthStr) - 1;
  const monthStart = `${monthKey}-01`;
  const monthEnd = new Date(Date.UTC(year, monthIndex + 1, 1))
    .toISOString()
    .slice(0, 10);
  return { monthStart, monthEnd };
};

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const accountId = searchParams.get("accountId");
    const monthParam = searchParams.get("month");

    if (!accountId) {
      return NextResponse.json(
        { errorKey: "errors.invalidRequest" },
        { status: 400 }
      );
    }

    const todayKey = getDateKeyInTimeZone(TIME_ZONE);
    const defaultMonthKey = todayKey.slice(0, 7);
    const monthKey = isMonthKey(monthParam) ? monthParam! : defaultMonthKey;
    const { monthStart, monthEnd } = getMonthRange(monthKey);

    const authHeader = request.headers.get("authorization");
    let supabase;
    let user;

    if (authHeader?.startsWith("Bearer ")) {
      const token = authHeader.substring(7);
      const { createClient } = await import("@supabase/supabase-js");
      supabase = createClient(
        getSupabaseUrl(),
        getSupabaseAnonKey(),
        {
          global: {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          },
          auth: { persistSession: false, autoRefreshToken: false },
        }
      );
      const {
        data: { user: authUser },
        error,
      } = await supabase.auth.getUser();
      if (error || !authUser) {
        return NextResponse.json(
          { errorKey: "errors.unauthorized" },
          { status: 401 }
        );
      }
      user = authUser;
    } else {
      const authenticated = await createAuthenticatedClient();
      supabase = authenticated.client;
      user = authenticated.user;
    }

    const { data: member, error: memberError } = await supabase
      .from("account_members")
      .select("user_id")
      .eq("account_id", accountId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (memberError) {
      return NextResponse.json(
        { errorKey: "errors.membersLoadFailed" },
        { status: 500 }
      );
    }

    if (!member) {
      return NextResponse.json(
        { errorKey: "errors.accessDenied" },
        { status: 403 }
      );
    }

    const { data: goalRow, error: goalError } = await supabase
      .from("financial_goals")
      .select("target_amount_base_minor")
      .eq("account_id", accountId)
      .eq("month", monthKey)
      .eq("type", "save")
      .maybeSingle();

    if (goalError) {
      return NextResponse.json(
        { errorKey: "errors.internalServer" },
        { status: 500 }
      );
    }

    const targetMinor =
      goalRow?.target_amount_base_minor ?? "0";

    // V2: Usar RPC actualizado con fecha estimada y delayDays
    const { data: candidates, error: rpcError } = await supabase.rpc(
      "get_savings_candidates_v2",
      {
        p_account_id: accountId,
        p_month_start: monthStart,
        p_month_end: monthEnd,
        p_today: todayKey,
        p_target_minor: targetMinor,
      }
    );

    if (rpcError) {
      console.error("[API/goal/savings-candidates] RPC error:", rpcError);
      return NextResponse.json(
        { errorKey: "errors.internalServer" },
        { status: 500 }
      );
    }

    const appliedFilters = {
      month: monthKey,
      type: "expense",
      order: "impact",
      origin: searchParams.get("origin") ?? undefined,
    };

    if (!candidates || typeof candidates !== "object") {
      return NextResponse.json({
        summary: null,
        sections: [],
        appliedFilters,
      });
    }

    return NextResponse.json({
      ...(candidates as Record<string, unknown>),
      appliedFilters,
    });
  } catch (error) {
    console.error("[API/goal/savings-candidates] Error:", error);

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
