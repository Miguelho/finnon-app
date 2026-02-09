"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createAuthenticatedClient, createClient } from "@/lib/supabase/server";
import { persistOnboarding } from "@poleursus/shared";
import type { OnboardingPayload } from "@poleursus/shared";

type ActionError = {
  key: string;
  params?: Record<string, string | number>;
};

const ACTIVE_ACCOUNT_COOKIE = "finnon:activeAccountId";

export async function createAccountAction(
  formData: FormData
): Promise<{ accountId: string; currency: string } | { error: ActionError }> {
  const accountName = formData.get("accountName") as string;
  const currency = formData.get("currency") as string;

  if (!accountName || !currency) {
    return { error: { key: "errors.onboardingMissingFields" } };
  }

  const supabase = await createClient();
  let userId = "";
  let authClient: Awaited<ReturnType<typeof createAuthenticatedClient>>["client"] | null = null;

  try {
    const { client, user } = await createAuthenticatedClient();
    userId = user.id;
    authClient = client;
  } catch (error) {
    console.error("Invalid session while creating account:", error);
    await supabase.auth.signOut();
    redirect("/login");
  }

  console.log("Creating account for user:", userId);

  const { data: account, error: accountError } = await authClient!
    .from("accounts")
    .insert({
      name: accountName,
      base_currency: currency,
      owner_user_id: userId,
    })
    .select()
    .single();

  if (accountError) {
    console.error("Error creating account:", accountError);
    const errorCode = accountError.code ?? null;
    const errorStatus = accountError.status ?? null;
    const isAuthError =
      errorCode === "401" ||
      errorCode === "403" ||
      errorCode === "42501" ||
      errorCode === "23503" ||
      errorStatus === 401 ||
      errorStatus === 403;

    if (isAuthError) {
      await supabase.auth.signOut();
      redirect("/login");
    }

    return { error: { key: "errors.internalServer" } };
  }

  console.log("Account created successfully:", account.id);

  const cookieStore = await cookies();
  cookieStore.set(ACTIVE_ACCOUNT_COOKIE, account.id, {
    path: "/",
    sameSite: "lax",
    httpOnly: true,
  });

  return { accountId: account.id, currency };
}

export async function persistOnboardingAction(
  payload: OnboardingPayload,
  locale: "es" | "en"
) {
  const supabase = await createClient();

  try {
    const { client, user } = await createAuthenticatedClient();
    return await persistOnboarding(client, payload, user.id, locale);
  } catch (error) {
    console.error("Invalid session while persisting onboarding:", error);
    await supabase.auth.signOut();
    return { success: false, error: "Not authenticated" };
  }
}
