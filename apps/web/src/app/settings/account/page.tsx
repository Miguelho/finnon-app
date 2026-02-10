import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";

export default async function ActiveAccountPageRedirect() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const cookieStore = await cookies();
  const activeAccountId = cookieStore.get("finnon:activeAccountId")?.value ?? "";

  if (!activeAccountId) {
    redirect("/select-account");
  }

  const { data: account } = await supabase
    .from("accounts")
    .select("id, account_members!inner(user_id)")
    .eq("id", activeAccountId)
    .eq("account_members.user_id", user.id)
    .maybeSingle();

  if (!account) {
    redirect("/select-account");
  }

  redirect(`/account/${activeAccountId}/settings/general`);
}
