import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { getDictionary, t } from "@poleursus/shared";
import { TopNav } from "@/components/navigation/top-nav";
import { PageContainer } from "@/components/layout/page-container";
import { ActiveAccountDetails } from "@/components/settings/active-account-details";
import { ActiveAccountSelector } from "@/components/settings/active-account-selector";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type Role = "admin" | "contributor" | "viewer";

export default async function AccountPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: accounts } = await supabase
    .from("accounts")
    .select("id, name, base_currency, account_members!inner(role, user_id)")
    .eq("account_members.user_id", user.id);

  if (!accounts || accounts.length === 0) {
    redirect("/select-account");
  }

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

  const cookieStore = await cookies();
  const activeAccountId = cookieStore.get("finnon:activeAccountId")?.value ?? "";
  if (!activeAccountId) {
    redirect("/select-account");
  }

  const locale = cookieStore.get("NEXT_LOCALE")?.value || "es";
  const dictionary = getDictionary(locale);
  const activeAccount =
    accounts.find((account) => account.id === activeAccountId) ?? accounts[0];

  if (!activeAccount) {
    redirect("/select-account");
  }

  const activeRole =
    activeAccount.account_members?.find((member) => member.user_id === user.id)
      ?.role ?? "viewer";
  const roleCopyKey = {
    admin: "invites.roleAdmin",
    contributor: "invites.roleContributor",
    viewer: "invites.roleViewer",
  } as const;

  const roleLabel = t(dictionary, "invites.roleLabel");
  const roleValue = t(dictionary, roleCopyKey[activeRole as Role]);
  const title = t(dictionary, "navigation.account");
  const description = t(dictionary, "account.description");
  const switchTitle = t(
    dictionary,
    "settings.menu.sections.account.items.switchAccount.title"
  );
  const switchDescription = t(
    dictionary,
    "settings.menu.sections.account.items.switchAccount.description"
  );

  return (
    <div className="min-h-screen bg-background">
      <TopNav />
      <PageContainer className="space-y-6">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
          <p className="text-muted-foreground">{description}</p>
          <p className="text-sm text-muted-foreground">
            {roleLabel}:{" "}
            <span className="font-medium text-foreground">{roleValue}</span>
          </p>
        </div>

        <ActiveAccountDetails
          account={activeAccount}
          currentUserId={user.id}
        />

        <Card>
          <CardHeader>
            <CardTitle>{switchTitle}</CardTitle>
            <CardDescription>{switchDescription}</CardDescription>
          </CardHeader>
          <CardContent className="p-6">
            <ActiveAccountSelector
              accounts={accountsWithCounts}
              initialActiveAccountId={activeAccount.id}
            />
          </CardContent>
        </Card>
      </PageContainer>
    </div>
  );
}
