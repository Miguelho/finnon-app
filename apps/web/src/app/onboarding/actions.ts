"use server";

import { cookies } from "next/headers";
import { createAuthenticatedClient, createClient } from "@/lib/supabase/server";
import { persistOnboarding } from "@poleursus/shared";
import type { OnboardingPayload } from "@poleursus/shared";

const ACTIVE_ACCOUNT_COOKIE = "finnon:activeAccountId";

type CompleteOnboardingInput = {
  accountId?: string | null;
  accountName: string;
  currency: string;
  selectedCategories: OnboardingPayload["selectedCategories"];
  recurrents: OnboardingPayload["recurrents"];
  firstProject: OnboardingPayload["firstProject"];
};

export async function completeOnboardingAction(
  input: CompleteOnboardingInput,
  locale: "es" | "en"
): Promise<
  | { success: true; accountId: string }
  | { success: false; error: string; accountId?: string }
> {
  const accountName = input.accountName.trim();
  const currency = input.currency;
  if (!accountName || !currency) {
    return { success: false, error: "Missing account fields" };
  }

  const supabase = await createClient();

  try {
    const { client, user } = await createAuthenticatedClient();
    let resolvedAccountId = input.accountId ?? null;

    if (!resolvedAccountId) {
      const { data: account, error: accountError } = await client
        .from("accounts")
        .insert({
          name: accountName,
          base_currency: currency,
          owner_user_id: user.id,
        })
        .select("id")
        .single();

      if (accountError || !account) {
        console.error("Error creating account during onboarding:", accountError);
        return { success: false, error: "Failed to create account" };
      }

      if (!account.id) {
        return { success: false, error: "Failed to create account" };
      }
      resolvedAccountId = account.id;
    }

    if (!resolvedAccountId) {
      return { success: false, error: "Missing account id" };
    }

    const payload: OnboardingPayload = {
      accountId: resolvedAccountId,
      selectedCategories: input.selectedCategories,
      recurrents: input.recurrents,
      firstProject: input.firstProject,
    };

    const result = await persistOnboarding(client, payload, user.id, locale);
    if (!result.success) {
      return {
        success: false,
        error: result.error ?? "Failed to persist onboarding",
        accountId: resolvedAccountId,
      };
    }

    const cookieStore = await cookies();
    cookieStore.set(ACTIVE_ACCOUNT_COOKIE, resolvedAccountId, {
      path: "/",
      sameSite: "lax",
      httpOnly: true,
    });

    return { success: true, accountId: resolvedAccountId };
  } catch (error) {
    console.error("Invalid session while completing onboarding:", error);
    await supabase.auth.signOut();
    return { success: false, error: "Not authenticated" };
  }
}
