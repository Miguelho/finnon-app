import { TopNav } from "@/components/navigation/top-nav";
import InvitationsClient from "./invitations-client";

export default function InvitationsPage() {
  return (
    <>
      <TopNav containerClassName="max-w-6xl" />
      <InvitationsClient />
    </>
  );
}
