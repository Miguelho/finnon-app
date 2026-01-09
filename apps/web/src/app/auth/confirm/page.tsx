"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function AuthConfirmPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<"loading" | "error">("loading");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();

    const handleAuth = async () => {
      // Check for PKCE code in query params
      const code = searchParams.get("code");
      const error = searchParams.get("error");
      const errorDescription = searchParams.get("error_description");

      if (error) {
        setStatus("error");
        setErrorMessage(errorDescription || error);
        return;
      }

      if (code) {
        // Exchange PKCE code for session
        const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
        if (exchangeError) {
          setStatus("error");
          setErrorMessage(exchangeError.message);
          return;
        }
        router.replace("/");
        return;
      }

      // Fallback: check for hash tokens (legacy flow)
      await new Promise((resolve) => setTimeout(resolve, 500));
      const { data: { session } } = await supabase.auth.getSession();

      if (session) {
        router.replace("/");
      } else {
        setStatus("error");
        setErrorMessage("No se pudo establecer la sesión");
      }
    };

    handleAuth();
  }, [router, searchParams]);

  if (status === "error") {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <p className="text-red-500">{errorMessage}</p>
          <button
            onClick={() => router.push("/login?error=no_session")}
            className="mt-4 underline"
          >
            Volver a iniciar sesión
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center">
        <p>Confirmando sesión...</p>
      </div>
    </div>
  );
}
