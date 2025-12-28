"use client";

import { accountSchema, categorySchema, transactionSchema } from "@poleursus/shared";
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

export default function Home() {
  const [supabaseStatus, setSupabaseStatus] = useState<"checking" | "connected" | "error">("checking");
  const [errorMessage, setErrorMessage] = useState<string>("");

  useEffect(() => {
    async function checkSupabase() {
      try {
        const { error } = await supabase.auth.getSession();
        if (error) throw error;
        setSupabaseStatus("connected");
      } catch (error) {
        setSupabaseStatus("error");
        setErrorMessage(error instanceof Error ? error.message : "Unknown error");
      }
    }
    checkSupabase();
  }, []);

  // Verify that shared schemas are accessible
  const hasSchemas =
    accountSchema && categorySchema && transactionSchema ? "✓" : "✗";

  return (
    <main style={{ padding: "2rem", fontFamily: "system-ui" }}>
      <h1>Finnon Web</h1>
      <p>Next.js app ready</p>
      <p>Shared schemas: {hasSchemas}</p>
      <p>
        Supabase connection:{" "}
        {supabaseStatus === "checking" && "⏳ Checking..."}
        {supabaseStatus === "connected" && "✓ Connected"}
        {supabaseStatus === "error" && `✗ Error: ${errorMessage}`}
      </p>
    </main>
  );
}
