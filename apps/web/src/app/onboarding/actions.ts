"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export async function createAccountAction(formData: FormData) {
  const accountName = formData.get("accountName") as string;
  const currency = formData.get("currency") as string;

  if (!accountName || !currency) {
    return { error: { key: "errors.onboardingMissingFields" } };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: { key: "errors.noSession" } };
  }

  console.log("Creating account for user:", user.id);

  // Crear cuenta (trigger auto-agrega owner como admin)
  const { data: account, error: accountError } = await supabase
    .from("accounts")
    .insert({
      name: accountName,
      base_currency: currency,
      owner_user_id: user.id,
    })
    .select()
    .single();

  if (accountError) {
    console.error("Error creating account:", accountError);
    return { error: { key: "errors.internalServer" } };
  }

  console.log("Account created successfully:", account.id);

  // Redirigir al dashboard
  redirect("/");
}
