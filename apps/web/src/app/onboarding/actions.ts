"use server";

import { createAuthenticatedClient, createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export async function createAccountAction(formData: FormData) {
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

  // Crear cuenta (trigger auto-agrega owner como admin)
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

  // Redirigir a selección de cuenta
  redirect("/select-account");
}
