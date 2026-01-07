import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { getDictionary, t } from "@poleursus/shared";
import { TopNav } from "@/components/navigation/top-nav";
import { PageContainer } from "@/components/layout/page-container";
import { Card, CardContent } from "@/components/ui/card";
import { ActiveAccountSelector } from "@/components/settings/active-account-selector";

export default async function SwitchAccountPage() {
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
  const activeAccountId =
    cookieStore.get("finnon:activeAccountId")?.value ??
    accountsWithCounts[0]?.id ??
    "";
  const locale = cookieStore.get("NEXT_LOCALE")?.value || "es";
  const dictionary = getDictionary(locale);
  const title = t(
    dictionary,
    "settings.menu.sections.account.items.switchAccount.title"
  );
  const description = t(
    dictionary,
    "settings.menu.sections.account.items.switchAccount.description"
  );

  return (
    <div className="min-h-screen bg-background">
      <TopNav />
      <PageContainer className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
          <p className="text-muted-foreground">{description}</p>
        </div>

        <Card>
          <CardContent className="p-6">
            <ActiveAccountSelector
              accounts={accountsWithCounts}
              initialActiveAccountId={activeAccountId}
            />
          </CardContent>
        </Card>
      </PageContainer>
    </div>
  );
}
