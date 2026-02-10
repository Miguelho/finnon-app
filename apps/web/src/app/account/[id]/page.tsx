import { redirect } from "next/navigation";

type AccountDetailRedirectPageProps = {
  params: Promise<{ id: string }>;
};

export default async function AccountDetailRedirectPage({
  params,
}: AccountDetailRedirectPageProps) {
  await params;
  redirect("/account");
}
