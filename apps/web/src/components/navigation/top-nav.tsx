import Link from "next/link";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { FinnonMark } from "@/components/brand/finnon-mark";
import { TopNavLinks } from "@/components/navigation/top-nav-links";
import { NotificationDropdown } from "@/components/navigation/notification-dropdown";
import { SettingsDrawer } from "@/components/settings/settings-drawer";
import { AddActionTrigger } from "@/components/navigation/add-action-trigger";
import { cn } from "@/lib/utils";
import { APP_SHELL_CONTAINER_CLASS } from "@/components/layout/shell";
import {
  buildSettingsMenuVM,
  getDictionary,
  navigationItems,
  t,
  type AvatarColorToken,
  type UserAvatarColorId,
} from "@poleursus/shared";

export async function TopNav() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: accounts } = await supabase
    .from("accounts")
    .select("id, name, base_currency, account_members!inner(user_id, role)")
    .eq("account_members.user_id", user.id)
    .order("name", { ascending: true });

  if (!accounts || accounts.length === 0) return null;

  const accountIds = accounts.map((account) => account.id);
  const { data: members } =
    accountIds.length > 0
      ? await supabase
          .from("account_members")
          .select("account_id")
          .in("account_id", accountIds)
      : { data: [] as { account_id: string }[] };

  const memberCounts = (members ?? []).reduce<Record<string, number>>(
    (acc, member) => {
      acc[member.account_id] = (acc[member.account_id] ?? 0) + 1;
      return acc;
    },
    {}
  );

  const accountsWithCounts = accounts.map((account) => ({
    id: account.id,
    name: account.name,
    base_currency: account.base_currency,
    memberCount: memberCounts[account.id] ?? 0,
  }));

  const { data: profile } = await supabase
    .from("profiles")
    .select(
      "user_id, email, display_name, avatar_path, avatar_fallback_text, avatar_fallback_bg_token, avatar_color"
    )
    .eq("user_id", user.id)
    .maybeSingle();

  const cookieStore = await cookies();
  const locale = cookieStore.get("NEXT_LOCALE")?.value === "en" ? "en" : "es";
  const dictionary = getDictionary(locale) as any;
  const homeAriaLabel = locale === "es" ? "Ir a inicio" : "Go to home";
  const activeAccountId =
    cookieStore.get("finnon:activeAccountId")?.value ??
    accountsWithCounts[0]?.id ??
    "";
  const activeAccount =
    accounts.find((account) => account.id === activeAccountId) ?? accounts[0];
  const activeRole =
    activeAccount?.account_members?.find((member) => member.user_id === user.id)
      ?.role ?? "viewer";
  const canEdit = activeRole !== "viewer";

  const settingsLabelKey =
    navigationItems.find((item) => item.key === "settings")?.labelKey ??
    ("navigation.settings" as const);
  const settingsLabel = t(dictionary as any, settingsLabelKey as any) as string;
  const openSettingsLabel = locale === "es" ? "Abrir ajustes" : "Open settings";
  const actionsLabel = locale === "es" ? "Acciones" : "Actions";
  const settingsMenu = buildSettingsMenuVM(dictionary as any, "web", {
    accountId: activeAccountId,
  });
  const shellBackgroundColor = "hsl(var(--background))";
  const shellBorderColor = "hsl(var(--border))";
  const shellTextColor = "hsl(var(--foreground))";
  const navItems: Array<{
    href: string;
    label: string;
    iconKey: "home" | "transactions" | "projects" | "account";
  }> = [
    { href: "/home", label: t(dictionary, "navigation.home"), iconKey: "home" },
    { href: "/account", label: t(dictionary, "navigation.account"), iconKey: "account" },
    {
      href: "/projects",
      label: t(dictionary, "navigation.projects"),
      iconKey: "projects",
    },
    {
      href: "/transactions",
      label: t(dictionary, "transactions.pageTitle"),
      iconKey: "transactions",
    },
  ];
  const containerClasses = cn(
    APP_SHELL_CONTAINER_CLASS,
    "flex items-center justify-between gap-4 py-3"
  );

  const profileEmail = profile?.email ?? user.email ?? "";
  const profileName = profile?.display_name ?? user.user_metadata?.name ?? null;
  const profileData = {
    userId: profile?.user_id ?? user.id,
    email: profileEmail,
    displayName: profileName,
    avatarPath: profile?.avatar_path ?? null,
    fallbackText: profile?.avatar_fallback_text ?? null,
    fallbackBgToken:
      (profile?.avatar_fallback_bg_token as AvatarColorToken | null) ?? null,
    avatarColor: (profile?.avatar_color as UserAvatarColorId | null) ?? null,
  };

  return (
    <>
      <div
        className="sticky top-0 z-10 w-full border-b"
        style={{
          backgroundColor: shellBackgroundColor,
          borderColor: shellBorderColor,
        }}
      >
        <div className={containerClasses}>
          {/* Logo */}
          <div className="flex shrink-0 items-center">
            <Link
              href="/home"
              aria-label={homeAriaLabel}
              className="flex items-center gap-2 rounded-md px-2 py-1"
              style={{ color: shellTextColor }}
            >
              <FinnonMark mode="iconWordmark" size="lg" />
            </Link>
          </div>

          {/* Navigation */}
          <div className="flex items-center gap-3">
            <TopNavLinks items={navItems} />
            <NotificationDropdown
              userId={user.id}
              accountId={activeAccountId}
              locale={locale}
            />
            <SettingsDrawer
              settingsLabel={settingsLabel}
              openLabel={openSettingsLabel}
              actionsLabel={actionsLabel}
              profile={profileData}
              menu={settingsMenu}
            />
          </div>
        </div>
      </div>
      {activeAccount ? (
        <AddActionTrigger
          canEdit={canEdit}
          accountId={activeAccount.id}
          variant="footer-center"
        />
      ) : null}
    </>
  );
}
