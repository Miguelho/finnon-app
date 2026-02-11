import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PageContainer } from "@/components/layout/page-container";
import { TopNav } from "@/components/navigation/top-nav";
import { InvitationsClient } from "@/components/invitations/invitations-client";

export default async function InvitationsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <TopNav />
      <PageContainer className="space-y-6">
        <InvitationsClient />
      </PageContainer>
    </div>
  );
}
