"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Legacy landing page for magic link emails.
 * Magic links have been removed — redirect stale clicks to login.
 */
export default function AuthConfirmPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/login?error=expired");
  }, [router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <p>Redirigiendo...</p>
    </div>
  );
}
