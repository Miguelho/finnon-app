import { cookies } from "next/headers";
import { getDictionary, t } from "@poleursus/shared";
import { BottomNav } from "./bottom-nav";

export async function BottomNavWrapper() {
  const cookieStore = await cookies();
  const locale = cookieStore.get("NEXT_LOCALE")?.value || "es";
  const dictionary = getDictionary(locale);

  const navItems = [
    { href: "/", label: t(dictionary, "navigation.home"), iconKey: "home" as const },
    {
      href: "/transactions",
      label: t(dictionary, "transactions.pageTitle"),
      iconKey: "transactions" as const,
    },
    { href: "/goal", label: t(dictionary, "goal.pageTitle"), iconKey: "goal" as const },
    {
      href: "/account",
      label: t(dictionary, "navigation.account"),
      iconKey: "account" as const,
    },
  ];

  return <BottomNav items={navItems} />;
}
