import { View, Text, StyleSheet } from "react-native";
import { accountSchema, categorySchema, transactionSchema } from "@poleursus/shared";
import { useEffect, useState } from "react";
import { supabase } from "../src/lib/supabase";

export default function Index() {
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

  const supabaseStatusText =
    supabaseStatus === "checking" ? "⏳ Checking..." :
    supabaseStatus === "connected" ? "✓ Connected" :
    `✗ Error: ${errorMessage}`;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Finnon Mobile</Text>
      <Text style={styles.text}>Expo app ready</Text>
      <Text style={styles.text}>Shared schemas: {hasSchemas}</Text>
      <Text style={styles.text}>Supabase: {supabaseStatusText}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#fff",
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 16,
  },
  text: {
    fontSize: 16,
    marginVertical: 4,
  },
});
