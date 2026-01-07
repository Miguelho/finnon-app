import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { FinnonMark } from "@/components/brand/finnon-mark";
import { PageContainer } from "@/components/layout/page-container";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AccountSelection } from "@/components/account-selection";
import { getDictionary, t, themeTokens } from "@poleursus/shared";

export default async function SelectAccountPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: accounts } = await supabase
    .from("accounts")
    .select("id, name, base_currency, account_members!inner(user_id)")
    .eq("account_members.user_id", user.id);

  const cookieStore = await cookies();
  const locale = cookieStore.get("NEXT_LOCALE")?.value || "es";
  const dictionary = getDictionary(locale);
  const colors = themeTokens.light.colors;
  const activeAccountId =
    cookieStore.get("finnon:activeAccountId")?.value ?? "";

  if (!accounts || accounts.length === 0) {
    return (
      <div
        className="min-h-screen"
        style={{ backgroundColor: colors.bg.primary, color: colors.text.primary }}
      >
        <header className="mx-auto flex w-full max-w-4xl items-center gap-3 px-6 py-6">
          <FinnonMark mode="iconWordmark" size="md" />
        </header>
        <PageContainer className="space-y-6">
          <div className="space-y-2">
            <h1 className="text-3xl font-bold tracking-tight">
              {t(dictionary, "accountSelection.title")}
            </h1>
            <p className="text-muted-foreground">
              {t(dictionary, "accountSelection.description")}
            </p>
          </div>
          <Card>
            <CardHeader>
              <CardTitle>{t(dictionary, "accountSelection.emptyTitle")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-muted-foreground">
                {t(dictionary, "accountSelection.emptyDescription")}
              </p>
              <Button asChild>
                <Link href="/onboarding">
                  {t(dictionary, "accountSelection.createCta")}
                </Link>
              </Button>
            </CardContent>
          </Card>
        </PageContainer>
      </div>
    );
  }

  const accountIds = accounts.map((account) => account.id);
  const { data: members } = accountIds.length
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

  return (
    <div
      className="min-h-screen"
      style={{ backgroundColor: colors.bg.primary, color: colors.text.primary }}
    >
      <header className="mx-auto flex w-full max-w-4xl items-center gap-3 px-6 py-6">
        <FinnonMark mode="iconWordmark" size="md" />
      </header>
      <PageContainer className="space-y-6">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">
            {t(dictionary, "accountSelection.title")}
          </h1>
          <p className="text-muted-foreground">
            {t(dictionary, "accountSelection.description")}
          </p>
        </div>
        <Card>
          <CardContent className="p-6">
            <AccountSelection
              accounts={accountsWithCounts}
              initialActiveAccountId={
                activeAccountId || accountsWithCounts[0]?.id || ""
              }
            />
          </CardContent>
        </Card>
      </PageContainer>
    </div>
  );
}
