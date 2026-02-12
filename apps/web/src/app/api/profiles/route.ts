import { NextRequest, NextResponse } from "next/server";
import { createAuthenticatedClient } from "@/lib/supabase/server";
import { getSupabaseAnonKey, getSupabaseUrl } from "@/lib/supabase/env";

type AccountMember = {
  user_id: string;
  role: "viewer" | "contributor" | "admin";
};

type ProfileRow = {
  user_id: string;
  email: string | null;
  display_name: string | null;
  avatar_path: string | null;
  avatar_fallback_text: string | null;
  avatar_fallback_bg_token: string | null;
};

export async function POST(request: NextRequest) {
  try {
    let body: unknown = null;
    const rawBody = await request.text();
    if (rawBody.trim().length > 0) {
      try {
        body = JSON.parse(rawBody);
      } catch {
        return NextResponse.json(
          { errorKey: "errors.invalidRequest" },
          { status: 400 }
        );
      }
    }
    const parsedBody =
      typeof body === "object" && body !== null
        ? (body as { accountId?: unknown })
        : null;
    const accountId =
      typeof parsedBody?.accountId === "string" ? parsedBody.accountId : null;

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

    const { data: profiles, error: profilesError } = await supabase
      .from("profiles")
      .select(
        "user_id, email, display_name, avatar_path, avatar_fallback_text, avatar_fallback_bg_token"
      )
      .in("user_id", userIds);

    if (profilesError) {
      console.error("Error loading profiles:", profilesError);
      return NextResponse.json(
        { errorKey: "errors.profilesLoadFailed" },
        { status: 500 }
      );
    }

    const profilesById = (profiles ?? []).reduce<Record<string, ProfileRow>>(
      (acc, profile) => {
        acc[profile.user_id] = profile;
        return acc;
      },
      {}
    );

    const responseMembers = (members as AccountMember[]).map((member) => {
      const profile = profilesById[member.user_id];
      return {
        user_id: member.user_id,
        role: member.role,
        name: profile?.display_name ?? profile?.email ?? null,
        email: profile?.email ?? null,
        avatar_path: profile?.avatar_path ?? null,
        avatar_fallback_text: profile?.avatar_fallback_text ?? null,
        avatar_fallback_bg_token: profile?.avatar_fallback_bg_token ?? null,
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
