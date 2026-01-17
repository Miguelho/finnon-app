import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PageContainer } from "@/components/layout/page-container";
import { TopNav } from "@/components/navigation/top-nav";
import { InvitationsClient } from "@/components/invitations/invitations-client";
import { themeTokens } from "@poleursus/shared";

export default async function InvitationsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const colors = themeTokens.light.colors;

  return (
    <div
      className="min-h-screen"
      style={{ backgroundColor: colors.bg.primary, color: colors.text.primary }}
    >
      <TopNav />
      <PageContainer className="space-y-6">
        <InvitationsClient />
      </PageContainer>
    </div>
  );
}
