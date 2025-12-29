import { Stack, Redirect, useSegments } from "expo-router";
import { useEffect, useState } from "react";
import { View, ActivityIndicator, StyleSheet } from "react-native";
import { AuthProvider, useAuth } from "../src/contexts/AuthContext";
import { supabase } from "../src/lib/supabase";

function RootLayoutNav() {
   return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: "none",
      }}
    >
      <Stack.Screen name="index" options={{ headerShown: true, title: "Finnon" }} />
      <Stack.Screen name="(auth)" options={{ headerShown: false }} />
    </Stack>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#fff",
  },
});

export default function RootLayout() {
  return (
    <AuthProvider>
      <RootLayoutNav />
    </AuthProvider>
  );
}
