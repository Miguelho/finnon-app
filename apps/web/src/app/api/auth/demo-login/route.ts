import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import {
  getSupabaseAnonKey,
  getSupabaseUrl,
} from "@/lib/supabase/env";
import { isDemoEmail, parseDemoEmails } from "@poleursus/shared";

const demoLoginSchema = z.object({
  email: z.string().trim().email(),
  otp: z.string().trim().length(8),
});

export async function POST(request: Request) {
  const demoEmails = parseDemoEmails(process.env.NEXT_PUBLIC_DEMO_EMAILS);
  const expectedOtp = process.env.DEMO_OTP_CODE;
  const demoPassword = process.env.DEMO_USER_PASSWORD;

  if (demoEmails.length === 0 || !expectedOtp || !demoPassword) {
    console.warn("[API/auth/demo-login] Demo login feature is not configured");
    return NextResponse.json(
      { error: "Demo login is not available" },
      { status: 404 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const parsed = demoLoginSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const { email, otp } = parsed.data;
  const normalizedEmail = email.trim().toLowerCase();

  if (!isDemoEmail(normalizedEmail, demoEmails)) {
    console.warn("[API/auth/demo-login] Email not in demo list:", normalizedEmail);
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  }

  if (otp !== expectedOtp) {
    console.warn("[API/auth/demo-login] Invalid OTP for demo account:", normalizedEmail);
    return NextResponse.json({ error: "Invalid code" }, { status: 401 });
  }

  console.warn("[API/auth/demo-login] Demo login attempt for:", normalizedEmail);

  const anonClient = createSupabaseClient(
    getSupabaseUrl(),
    getSupabaseAnonKey(),
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    }
  );

  const { data: signInData, error: signInError } =
    await anonClient.auth.signInWithPassword({
      email: normalizedEmail,
      password: demoPassword,
    });

  if (signInError || !signInData.session) {
    console.error("[API/auth/demo-login] signInWithPassword failed:", signInError);
    return NextResponse.json(
      { error: "Authentication failed" },
      { status: 500 }
    );
  }

  const isMobileClient =
    request.headers.get("x-client-type") === "mobile";

  if (isMobileClient) {
    return NextResponse.json({
      access_token: signInData.session.access_token,
      refresh_token: signInData.session.refresh_token,
      expires_in: signInData.session.expires_in,
      token_type: signInData.session.token_type,
      user: signInData.session.user,
    });
  }

  const cookieStore = await cookies();
  const serverClient = createServerClient(
    getSupabaseUrl(),
    getSupabaseAnonKey(),
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

  await serverClient.auth.setSession({
    access_token: signInData.session.access_token,
    refresh_token: signInData.session.refresh_token,
  });

  console.warn("[API/auth/demo-login] Demo login successful for:", normalizedEmail);

  return NextResponse.json({ ok: true });
}
