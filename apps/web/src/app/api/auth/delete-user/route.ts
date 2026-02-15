import { createServerClient } from "@supabase/ssr";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import {
  getSupabaseAdminKey,
  getSupabaseAnonKey,
  getSupabaseUrl,
} from "@/lib/supabase/env";

const deleteUserSchema = z.object({
  email: z.string().trim().email(),
  confirmation: z.string().trim().min(1).max(64),
});

const normalize = (value: string) => value.trim().toLowerCase();
const allowedConfirmationValues = new Set(["confirmar", "confirm"]);

type OwnedAccount = {
  id: string;
};

type AccountMember = {
  user_id: string;
  role: "viewer" | "contributor" | "admin";
  created_at: string;
};

type ProfileAvatarRow = {
  avatar_path: string | null;
};

export async function POST(request: Request) {
  const cookieStore = await cookies();
  const authHeader = request.headers.get("authorization");
  const bearerToken = authHeader?.startsWith("Bearer ")
    ? authHeader.substring(7)
    : null;
  const usesBearerAuth = Boolean(bearerToken);

  const supabase = usesBearerAuth
    ? createSupabaseClient(getSupabaseUrl(), getSupabaseAnonKey(), {
        global: {
          headers: {
            Authorization: `Bearer ${bearerToken}`,
          },
        },
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      })
    : createServerClient(getSupabaseUrl(), getSupabaseAnonKey(), {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          },
        },
      });

  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { errorKey: "errors.invalidRequest" },
        { status: 400 }
      );
    }

    const parsed = deleteUserSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { errorKey: "errors.invalidRequest" },
        { status: 400 }
      );
    }

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        { errorKey: "errors.noSession" },
        { status: 401 }
      );
    }

    if (!user.email) {
      return NextResponse.json(
        { errorKey: "settings.userProfile.errors.deleteUserNoEmail" },
        { status: 400 }
      );
    }

    if (normalize(parsed.data.email) !== normalize(user.email)) {
      return NextResponse.json(
        { errorKey: "settings.userProfile.errors.deleteUserEmailMismatch" },
        { status: 400 }
      );
    }

    const normalizedConfirmation = normalize(parsed.data.confirmation);
    if (!allowedConfirmationValues.has(normalizedConfirmation)) {
      return NextResponse.json(
        { errorKey: "settings.userProfile.errors.deleteUserKeywordMismatch" },
        { status: 400 }
      );
    }

    const serviceClient = createSupabaseClient(
      getSupabaseUrl(),
      getSupabaseAdminKey(),
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      }
    );

    const { data: profileRow } = await serviceClient
      .from("profiles")
      .select("avatar_path")
      .eq("user_id", user.id)
      .maybeSingle<ProfileAvatarRow>();

    const { data: ownedAccounts, error: ownedAccountsError } = await serviceClient
      .from("accounts")
      .select("id")
      .eq("owner_user_id", user.id);

    if (ownedAccountsError) {
      console.error("[API/auth/delete-user] Error loading owned accounts:", ownedAccountsError);
      return NextResponse.json(
        { errorKey: "settings.userProfile.errors.deleteUser" },
        { status: 500 }
      );
    }

    for (const account of (ownedAccounts ?? []) as OwnedAccount[]) {
      const { data: members, error: membersError } = await serviceClient
        .from("account_members")
        .select("user_id, role, created_at")
        .eq("account_id", account.id)
        .neq("user_id", user.id)
        .order("created_at", { ascending: true });

      if (membersError) {
        console.error("[API/auth/delete-user] Error loading account members:", membersError);
        return NextResponse.json(
          { errorKey: "settings.userProfile.errors.deleteUser" },
          { status: 500 }
        );
      }

      const candidates = (members ?? []) as AccountMember[];
      const nextOwner =
        candidates.find((member) => member.role === "admin") ??
        candidates.find((member) => member.role === "contributor") ??
        candidates[0];

      if (!nextOwner) {
        continue;
      }

      if (nextOwner.role !== "admin") {
        const { error: promoteError } = await serviceClient
          .from("account_members")
          .update({ role: "admin" })
          .eq("account_id", account.id)
          .eq("user_id", nextOwner.user_id);

        if (promoteError) {
          console.error("[API/auth/delete-user] Error promoting next owner:", promoteError);
          return NextResponse.json(
            { errorKey: "settings.userProfile.errors.deleteUser" },
            { status: 500 }
          );
        }
      }

      const { error: transferOwnerError } = await serviceClient
        .from("accounts")
        .update({ owner_user_id: nextOwner.user_id })
        .eq("id", account.id)
        .eq("owner_user_id", user.id);

      if (transferOwnerError) {
        console.error("[API/auth/delete-user] Error transferring account ownership:", transferOwnerError);
        return NextResponse.json(
          { errorKey: "settings.userProfile.errors.deleteUser" },
          { status: 500 }
        );
      }
    }

    const { error: removeMemberError } = await serviceClient
      .from("account_members")
      .delete()
      .eq("user_id", user.id);

    if (removeMemberError) {
      console.error("[API/auth/delete-user] Error removing memberships:", removeMemberError);
      return NextResponse.json(
        { errorKey: "settings.userProfile.errors.deleteUser" },
        { status: 500 }
      );
    }

    if (profileRow?.avatar_path) {
      const { error: avatarError } = await serviceClient.storage
        .from("avatars")
        .remove([profileRow.avatar_path]);

      if (avatarError) {
        console.warn("[API/auth/delete-user] Could not delete avatar file:", avatarError);
      }
    }

    const { error: deleteUserError } = await serviceClient.auth.admin.deleteUser(user.id);
    if (deleteUserError) {
      console.error("[API/auth/delete-user] Error deleting auth user:", deleteUserError);
      if (deleteUserError.code === "bad_jwt") {
        return NextResponse.json(
          { errorKey: "settings.userProfile.errors.deleteUserAdminKeyInvalid" },
          { status: 500 }
        );
      }
      return NextResponse.json(
        { errorKey: "settings.userProfile.errors.deleteUser" },
        { status: 500 }
      );
    }

    if (!usesBearerAuth) {
      const { error: signOutError } = await supabase.auth.signOut();
      if (signOutError) {
        console.warn("[API/auth/delete-user] Sign out after delete failed:", signOutError);
      }

      cookieStore.set("finnon:activeAccountId", "", {
        path: "/",
        maxAge: 0,
      });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[API/auth/delete-user] Unexpected error:", error);
    return NextResponse.json(
      { errorKey: "settings.userProfile.errors.deleteUser" },
      { status: 500 }
    );
  }
}
