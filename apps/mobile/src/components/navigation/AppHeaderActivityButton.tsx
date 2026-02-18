import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Mail } from "lucide-react-native";
import { useRouter } from "expo-router";
import { themeTokens } from "@poleursus/shared";
import { useAuth } from "../../contexts/AuthContext";
import { useUserTheme } from "../../contexts/UserThemeContext";
import { useCopy, t } from "../../lib/i18n";
import { supabase } from "../../lib/supabase";

type ActivityNotification = {
  id: string;
  userInitial: string;
  userName: string;
  count: number;
  timeAgo: string;
};

const tokens = themeTokens.light;

function formatTimeAgo(
  date: Date,
  dictionary: ReturnType<typeof import("@poleursus/shared").getDictionary>
): string {
  const diffMs = Date.now() - date.getTime();
  const diffMinutes = Math.round(diffMs / (1000 * 60));

  if (diffMinutes < 1) {
    return t(dictionary, "accountActivity.timeAgo.justNow");
  }
  if (diffMinutes < 60) {
    return (t(dictionary, "accountActivity.timeAgo.minutesAgo") as string).replace(
      "{count}",
      String(diffMinutes)
    );
  }
  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) {
    const key =
      diffHours === 1
        ? "accountActivity.timeAgo.hoursAgo"
        : "accountActivity.timeAgo.hoursAgoPl";
    return (t(dictionary, key) as string).replace("{count}", String(diffHours));
  }
  const diffDays = Math.round(diffHours / 24);
  const key =
    diffDays === 1
      ? "accountActivity.timeAgo.daysAgo"
      : "accountActivity.timeAgo.daysAgoPl";
  return (t(dictionary, key) as string).replace("{count}", String(diffDays));
}

export function AppHeaderActivityButton() {
  const { user, selectedAccountId } = useAuth();
  const { tokens: userTokens } = useUserTheme();
  const { dictionary } = useCopy();
  const router = useRouter();
  const [notifications, setNotifications] = useState<ActivityNotification[]>(
    []
  );
  const [modalVisible, setModalVisible] = useState(false);
  const [loading, setLoading] = useState(false);

  const loadActivity = useCallback(async () => {
    if (!user || !selectedAccountId) {
      setNotifications([]);
      return;
    }

    setLoading(true);

    try {
      const since = new Date();
      since.setDate(since.getDate() - 7);

      const { data: rows, error } = await supabase
        .from("transactions")
        .select("id, created_by, created_at")
        .eq("account_id", selectedAccountId)
        .gte("created_at", since.toISOString())
        .neq("created_by", user.id)
        .order("created_at", { ascending: false })
        .limit(50);

      if (error || !rows) {
        setNotifications([]);
        return;
      }

      const byUser = new Map<string, { count: number; latest: Date }>();
      for (const row of rows) {
        if (!row.created_by) continue;
        const createdAt = new Date(row.created_at);
        const existing = byUser.get(row.created_by);
        if (existing) {
          existing.count += 1;
          if (createdAt > existing.latest) existing.latest = createdAt;
        } else {
          byUser.set(row.created_by, { count: 1, latest: createdAt });
        }
      }

      const userIds = Array.from(byUser.keys());
      if (userIds.length === 0) {
        setNotifications([]);
        return;
      }

      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, display_name, email")
        .in("user_id", userIds);

      const profileMap = new Map(
        (profiles ?? []).map((p) => [p.user_id, p])
      );

      const items: ActivityNotification[] = userIds
        .map((userId) => {
          const activity = byUser.get(userId);
          if (!activity) return null;
          const profile = profileMap.get(userId);
          const userName =
            profile?.display_name ?? profile?.email ?? "Usuario";
          const userInitial = (userName.trim().charAt(0) || "?").toUpperCase();
          return {
            id: userId,
            userInitial,
            userName,
            count: activity.count,
            timeAgo: formatTimeAgo(activity.latest, dictionary),
          };
        })
        .filter(Boolean) as ActivityNotification[];

      items.sort(
        (a, b) =>
          (byUser.get(b.id)?.latest.getTime() ?? 0) -
          (byUser.get(a.id)?.latest.getTime() ?? 0)
      );

      setNotifications(items.slice(0, 5));
    } finally {
      setLoading(false);
    }
  }, [user, selectedAccountId, dictionary]);

  const openModal = useCallback(() => {
    setModalVisible(true);
    void loadActivity();
  }, [loadActivity]);

  if (!user) return null;

  const title = t(dictionary, "accountActivity.title") as string;
  const emptyText = t(dictionary, "accountActivity.emptyTitle") as string;
  const addedText = t(dictionary, "accountActivity.added") as string;
  const viewText = t(dictionary, "accountActivity.viewCta") as string;

  return (
    <>
      <Pressable
        onPress={openModal}
        accessibilityRole="button"
        accessibilityLabel={title}
        hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
        style={styles.button}
      >
        <Mail
          size={21}
          color={userTokens.textPrimary}
        />
      </Pressable>

      <Modal
        visible={modalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setModalVisible(false)}
      >
        <Pressable
          style={styles.overlay}
          onPress={() => setModalVisible(false)}
        >
          <View
            style={[
              styles.dropdown,
              {
                backgroundColor: userTokens.surface,
                borderColor: userTokens.border,
              },
            ]}
          >
            <Pressable onPress={() => {}}>
              {/* Header */}
              <View
                style={[
                  styles.dropdownHeader,
                  { borderBottomColor: userTokens.border },
                ]}
              >
                <Text
                  style={[
                    styles.dropdownTitle,
                    { color: userTokens.textPrimary },
                  ]}
                >
                  {title}
                </Text>
              </View>

              {/* Items */}
              {loading ? (
                <View style={styles.emptyContainer}>
                  <ActivityIndicator size="small" color={userTokens.textSecondary} />
                </View>
              ) : notifications.length > 0 ? (
                notifications.map((notif) => (
                  <View
                    key={notif.id}
                    style={[
                      styles.notifRow,
                      { borderBottomColor: userTokens.border },
                    ]}
                  >
                    <View style={styles.avatar}>
                      <Text style={styles.avatarText}>
                        {notif.userInitial}
                      </Text>
                    </View>
                    <View style={styles.notifContent}>
                      <Text
                        style={[
                          styles.notifText,
                          { color: userTokens.textPrimary },
                        ]}
                        numberOfLines={2}
                      >
                        {notif.userName} {addedText}{" "}
                        <Text style={styles.notifBold}>
                          {(
                            t(
                              dictionary,
                              "accountActivity.movements"
                            ) as string
                          ).replace("{count}", String(notif.count))}
                        </Text>
                      </Text>
                      <Text
                        style={[
                          styles.notifTime,
                          { color: userTokens.textTertiary },
                        ]}
                      >
                        {notif.timeAgo}
                      </Text>
                    </View>
                    <Pressable
                      onPress={() => {
                        setModalVisible(false);
                        router.push("/(auth)/(tabs)/transactions");
                      }}
                      hitSlop={{ top: 6, right: 6, bottom: 6, left: 6 }}
                      style={styles.viewButton}
                    >
                      <Text style={styles.viewButtonText}>
                        {viewText} →
                      </Text>
                    </Pressable>
                  </View>
                ))
              ) : (
                <View style={styles.emptyContainer}>
                  <Text
                    style={[
                      styles.emptyText,
                      { color: userTokens.textTertiary },
                    ]}
                  >
                    {emptyText}
                  </Text>
                </View>
              )}
            </Pressable>
          </View>
        </Pressable>
      </Modal>
    </>
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
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.3)",
    justifyContent: "flex-start",
    alignItems: "flex-end",
    paddingTop: 90,
    paddingRight: 12,
  },
  dropdown: {
    width: 310,
    borderRadius: 12,
    borderWidth: 1,
    overflow: "hidden",
  },
  dropdownHeader: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 10,
    borderBottomWidth: 1,
  },
  dropdownTitle: {
    fontSize: 13,
    fontWeight: tokens.typography.weight.semibold,
  },
  notifRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#F3E8FF",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    fontSize: 13,
    fontWeight: tokens.typography.weight.bold,
    color: "#9333EA",
  },
  notifContent: {
    flex: 1,
    minWidth: 0,
  },
  notifText: {
    fontSize: 13,
    fontWeight: tokens.typography.weight.medium,
  },
  notifBold: {
    fontWeight: tokens.typography.weight.bold,
  },
  notifTime: {
    fontSize: 11,
    marginTop: 2,
  },
  viewButton: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  viewButtonText: {
    fontSize: 12,
    fontWeight: tokens.typography.weight.medium,
    color: "#2563EB",
  },
  emptyContainer: {
    paddingHorizontal: 16,
    paddingVertical: 24,
    alignItems: "center",
  },
  emptyText: {
    fontSize: 14,
  },
});
