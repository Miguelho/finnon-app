import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getDictionary } from "@poleursus/shared";
import { createClient } from "@/lib/supabase/server";

export type AccountSettingsRole = "viewer" | "contributor" | "admin";

export type AccountSettingsContext = {
  userId: string;
  locale: string;
  dictionary: ReturnType<typeof getDictionary>;
  account: {
    id: string;
    name: string;
    baseCurrency: string;
    icon: string;
  };
  role: AccountSettingsRole;
};

export async function getAccountSettingsContext(
  accountId: string
): Promise<AccountSettingsContext> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: account } = await supabase
    .from("accounts")
    .select("id, name, base_currency, account_members!inner(user_id, role)")
    .eq("id", accountId)
    .eq("account_members.user_id", user.id)
    .maybeSingle();

  if (!account) {
    redirect("/account");
  }

  const cookieStore = await cookies();
  const locale = cookieStore.get("NEXT_LOCALE")?.value || "es";
  const dictionary = getDictionary(locale);
  const role =
    (account.account_members?.[0]?.role as AccountSettingsRole | undefined) ??
    "viewer";

  return {
    userId: user.id,
    locale,
    dictionary,
    account: {
      id: account.id,
      name: account.name,
      baseCurrency: account.base_currency,
      icon: account.name.trim().charAt(0).toUpperCase() || "🏦",
    },
    role,
  };
}
