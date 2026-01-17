import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { TopNav } from "@/components/navigation/top-nav";
import InvitationsClient from "./invitations-client";

export default async function InvitationsPage(): Promise<React.JSX.Element> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <>
      <TopNav containerClassName="max-w-6xl" />
      <InvitationsClient userId={user.id} />
    </>
  );
}
