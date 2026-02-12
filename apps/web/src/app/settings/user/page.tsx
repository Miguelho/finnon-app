import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { TopNav } from "@/components/navigation/top-nav";
import { PageContainer } from "@/components/layout/page-container";
import { UserProfileScreen } from "@/components/settings/user-profile-screen";

export default async function UserProfilePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <div className="min-h-screen bg-background">
      <TopNav />
      <PageContainer className="max-w-[680px] py-7">
        <UserProfileScreen userId={user.id} userEmail={user.email ?? ""} />
      </PageContainer>
    </div>
  );
}
