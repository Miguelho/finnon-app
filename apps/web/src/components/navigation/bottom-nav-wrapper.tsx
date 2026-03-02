import { cookies } from "next/headers";
import { getDictionary, t } from "@poleursus/shared";
import { BottomNav } from "./bottom-nav";
import { createClient } from "@/lib/supabase/server";

export async function BottomNavWrapper() {
  const cookieStore = await cookies();
  const locale = cookieStore.get("NEXT_LOCALE")?.value || "es";
  const dictionary = getDictionary(locale);

  const navItems = [
    { href: "/home", label: t(dictionary, "navigation.home"), iconKey: "home" as const },
    {
      href: "/account",
      label: t(dictionary, "navigation.account"),
      iconKey: "account" as const,
    },
    {
      href: "/projects",
      label: t(dictionary, "navigation.projects"),
      iconKey: "projects" as const,
    },
    {
      href: "/transactions",
      label: t(dictionary, "transactions.pageTitle"),
      iconKey: "transactions" as const,
    },
  ];

  const activeAccountId =
    cookieStore.get("finnon:activeAccountId")?.value ?? "";
  let addActionProps: {
    accountId: string;
    canEdit: boolean;
  } | null = null;

  if (activeAccountId) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      const { data: account } = await supabase
        .from("accounts")
        .select("id, base_currency, account_members!inner(user_id, role)")
        .eq("id", activeAccountId)
        .eq("account_members.user_id", user.id)
        .maybeSingle();

      if (account) {
        const role =
          account.account_members?.find((member) => member.user_id === user.id)
            ?.role ?? "viewer";
        addActionProps = {
          accountId: account.id,
          canEdit: role !== "viewer",
        };
      }
    }
  }

  return <BottomNav items={navItems} addAction={addActionProps ?? undefined} />;
}
