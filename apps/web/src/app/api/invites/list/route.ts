import { NextRequest, NextResponse } from "next/server";
import {
  createServiceRoleClient,
  getAuthenticatedUser,
  normalizeEmail,
} from "@/lib/invites";

export async function GET(request: NextRequest) {
  try {
    const { user } = await getAuthenticatedUser(request);

    if (!user) {
      return NextResponse.json(
        { errorKey: "errors.noSession" },
        { status: 401 }
      );
    }

    const filters = [];
    const email = normalizeEmail(user.email);

    if (email) {
      filters.push(`invited_email.ilike.${email}`, `invitee_email.ilike.${email}`);
    }

    if (user.id) {
      filters.push(`invitee_user_id.eq.${user.id}`);
    }

    if (filters.length === 0) {
      return NextResponse.json({ invites: [], profiles: {} });
    }

    const serviceClient = createServiceRoleClient();
    const { data, error } = await serviceClient
      .from("invites")
      .select(
        "id, account_id, role, status, expires_at, created_at, created_by, invited_email, invitee_email, accounts(name)"
      )
      .or(filters.join(","))
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error loading invites:", error);
      return NextResponse.json(
        { errorKey: "invitations.loadError" },
        { status: 500 }
      );
    }

    const inviteRows = (data || []) as {
      created_by: string;
    }[];
    const creatorIds = Array.from(
      new Set(inviteRows.map((invite) => invite.created_by).filter(Boolean))
    );

    let profiles: Record<string, { user_id: string; email: string | null; display_name: string | null }> =
      {};

    if (creatorIds.length > 0) {
      const { data: profileRows } = await serviceClient
        .from("profiles")
        .select("user_id, email, display_name")
        .in("user_id", creatorIds);

      profiles = (profileRows || []).reduce<typeof profiles>((acc, profile) => {
        acc[profile.user_id] = profile;
        return acc;
      }, {});
    }

    return NextResponse.json({ invites: data ?? [], profiles });
  } catch (error) {
    console.error("Invite list error:", error);
    return NextResponse.json(
      { errorKey: "errors.internalServer" },
      { status: 500 }
    );
  }
}
