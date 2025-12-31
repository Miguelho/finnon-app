import { NextRequest, NextResponse } from "next/server";
import { createAuthenticatedClient } from "@/lib/supabase/server";
import { supabaseServer } from "@/lib/supabaseServer";

type AccountMember = {
  user_id: string;
  role: "viewer" | "contributor" | "admin";
};

type AuthUserRow = {
  id: string;
  email: string | null;
  raw_user_meta_data: Record<string, unknown> | null;
};

function getDisplayName(user: AuthUserRow) {
  const meta = user.raw_user_meta_data ?? {};
  const fullName = typeof meta.full_name === "string" ? meta.full_name : "";
  const displayName =
    typeof meta.display_name === "string" ? meta.display_name : "";
  const name = typeof meta.name === "string" ? meta.name : "";
  const firstName = typeof meta.first_name === "string" ? meta.first_name : "";
  const lastName = typeof meta.last_name === "string" ? meta.last_name : "";
  const combined = [firstName, lastName].filter(Boolean).join(" ").trim();

  return fullName || displayName || name || combined || user.email || null;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const accountId = typeof body?.accountId === "string" ? body.accountId : null;

    if (!accountId) {
      return NextResponse.json(
        { errorKey: "errors.invalidRequest" },
        { status: 400 }
      );
    }

    // Auth: support Authorization header (mobile) or cookies (web)
    const authHeader = request.headers.get("authorization");
    let supabase;
    let user;

    if (authHeader?.startsWith("Bearer ")) {
      const token = authHeader.substring(7);
      const { createClient } = await import("@supabase/supabase-js");
      supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
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

    // Verify membership and fetch members for the account
    const { data: members, error: membersError } = await supabase
      .from("account_members")
      .select("user_id, role")
      .eq("account_id", accountId);

    if (membersError) {
      return NextResponse.json(
        { errorKey: "errors.membersLoadFailed" },
        { status: 500 }
      );
    }

    if (!members || members.length === 0) {
      return NextResponse.json(
        { errorKey: "errors.accountNotFoundOrDenied" },
        { status: 404 }
      );
    }

    const isMember = members.some((member) => member.user_id === user.id);
    if (!isMember) {
      return NextResponse.json(
        { errorKey: "errors.accessDenied" },
        { status: 403 }
      );
    }

    const userIds = Array.from(new Set(members.map((member) => member.user_id)));

    const { data: users, error: usersError } = await supabaseServer
      .from("auth.users")
      .select("id, email, raw_user_meta_data")
      .in("id", userIds);

    if (usersError) {
      console.error("Error loading profiles:", usersError);
      return NextResponse.json(
        { errorKey: "errors.profilesLoadFailed" },
        { status: 500 }
      );
    }

    const profilesById = (users ?? []).reduce<Record<string, AuthUserRow>>(
      (acc, profile) => {
        acc[profile.id] = profile as AuthUserRow;
        return acc;
      },
      {}
    );

    const responseMembers = (members as AccountMember[]).map((member) => {
      const profile = profilesById[member.user_id];
      return {
        user_id: member.user_id,
        role: member.role,
        name: profile ? getDisplayName(profile) : null,
        email: profile?.email ?? null,
      };
    });

    return NextResponse.json({ members: responseMembers });
  } catch (error) {
    console.error("Profiles endpoint error:", error);

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
