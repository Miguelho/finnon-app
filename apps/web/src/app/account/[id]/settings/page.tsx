import { redirect } from "next/navigation";

type AccountSettingsRedirectPageProps = {
  params: Promise<{ id: string }>;
};

export default async function AccountSettingsRedirectPage({
  params,
}: AccountSettingsRedirectPageProps): Promise<never> {
  const { id } = await params;
  redirect(`/account/${id}/settings/general`);
}
