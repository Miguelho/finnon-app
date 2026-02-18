import { useCallback, useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Mail } from "lucide-react-native";
import { useIsFocused } from "@react-navigation/native";
import { useRouter } from "expo-router";
import { isExpired, themeTokens } from "@poleursus/shared";
import { useAuth } from "../../contexts/AuthContext";
import { useCopy, t } from "../../lib/i18n";
import { supabase } from "../../lib/supabase";

const tokens = themeTokens.light;
const colors = tokens.colors;

export function AppHeaderInvitesButton() {
  const { user } = useAuth();
  const { dictionary } = useCopy();
  const isFocused = useIsFocused();
  const router = useRouter();
  const [pendingCount, setPendingCount] = useState(0);

  const loadPendingCount = useCallback(async () => {
    if (!user) {
      setPendingCount(0);
      return;
    }

    const normalizedEmail = user.email?.trim().toLowerCase();
    const filters: string[] = [];

    if (normalizedEmail) {
      filters.push(
        `invited_email.ilike.${normalizedEmail}`,
        `invitee_email.ilike.${normalizedEmail}`
      );
    }

    if (user.id) {
      filters.push(`invitee_user_id.eq.${user.id}`);
    }

    if (filters.length === 0) {
      setPendingCount(0);
      return;
    }

    const { data, error } = await supabase
      .from("invites")
      .select("id, expires_at, status")
      .or(filters.join(","))
      .eq("status", "pending");

    if (error) {
      setPendingCount(0);
      return;
    }

    const count = (data ?? []).filter((invite) => !isExpired(invite.expires_at))
      .length;
    setPendingCount(count);
  }, [user]);

  useEffect(() => {
    if (!isFocused) return;

    void loadPendingCount();
    const interval = setInterval(() => {
      void loadPendingCount();
    }, 30000);

    return () => clearInterval(interval);
  }, [isFocused, loadPendingCount]);

  if (!user) return null;

  return (
    <Pressable
      onPress={() => router.push("/(auth)/invitations")}
      accessibilityRole="button"
      accessibilityLabel={t(dictionary, "invitations.title")}
      hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
      style={styles.button}
    >
      <Mail
        size={21}
        color={colors.text.primary}
      />
      {pendingCount > 0 ? (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>
            {pendingCount > 99 ? "99+" : String(pendingCount)}
          </Text>
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    marginRight: tokens.spacing.sm,
    width: 30,
    height: 30,
    borderRadius: tokens.radii.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  badge: {
    position: "absolute",
    top: -3,
    right: -4,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: "#DC2626",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 2,
    borderWidth: 1,
    borderColor: colors.bg.primary,
  },
  badgeText: {
    fontSize: 9,
    fontWeight: tokens.typography.weight.bold,
    color: "#FFFFFF",
    lineHeight: 11,
  },
});
