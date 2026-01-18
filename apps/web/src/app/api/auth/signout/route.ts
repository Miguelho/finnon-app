import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

export async function POST() {
  const cookieStore = await cookies();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
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
    }
  );

  const { error } = await supabase.auth.signOut();

  if (error) {
    console.error("[API/auth/signout] Error signing out:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Clear the active account cookie as well
  cookieStore.set("finnon:activeAccountId", "", {
    path: "/",
    maxAge: 0,
  });

  return NextResponse.json({ ok: true });
}
