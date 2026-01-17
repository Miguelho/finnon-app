import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { TopNav } from "@/components/navigation/top-nav";
import { PageContainer } from "@/components/layout/page-container";
import { getDictionary, t } from "@poleursus/shared";
import InvitationsClient from "./invitations-client";

export default async function InvitationsPage(): Promise<React.JSX.Element> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const cookieStore = await cookies();
  const locale = cookieStore.get("NEXT_LOCALE")?.value || "es";
  const dictionary = getDictionary(locale);

  return (
    <div className="min-h-screen bg-background">
      <TopNav containerClassName="max-w-6xl" />
      <PageContainer className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            {t(dictionary, "invites.title")}
          </h1>
          <p className="text-muted-foreground">
            {t(dictionary, "invites.subtitle")}
          </p>
        </div>
        <InvitationsClient userId={user.id} />
      </PageContainer>
    </div>
  );
}
