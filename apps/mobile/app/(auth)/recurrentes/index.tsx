import { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { Stack, useRouter } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { supabase } from "../../../src/lib/supabase";
import { useAuth } from "../../../src/contexts/AuthContext";
import { Card } from "../../../src/components/Card";
import { Button } from "../../../src/components/Button";
import { RecurringTile } from "../../../src/components/RecurringTile";
import { themeTokens, type RecurringItem } from "@poleursus/shared";
import { useCopy, t } from "../../../src/lib/i18n";

type Category = {
  id: string;
  name: string;
  icon_id: string;
  type: "income" | "expense";
};

type RecurringItemWithCategory = RecurringItem & {
  category?: Category | null;
};

const tokens = themeTokens.light;
const colors = tokens.colors;
const spacing = tokens.spacing;
const typography = tokens.typography;
const radii = tokens.radii;

export default function RecurrentesScreen(): React.JSX.Element {
  const router = useRouter();
  const { selectedAccountId } = useAuth();
  const { dictionary } = useCopy();
  const [recurringItems, setRecurringItems] = useState<
    RecurringItemWithCategory[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!selectedAccountId) {
      setError(t(dictionary, "transactions.noAccountSelected"));
      setLoading(false);
      return;
    }

    try {
      const { data, error: fetchError } = await supabase
        .from("recurring_items")
        .select(
          `
          *,
          category:categories(id, name, icon_id, type)
        `
        )
        .eq("account_id", selectedAccountId)
        .order("merchant", { ascending: true });

      if (fetchError) throw fetchError;

      setRecurringItems(data || []);
      setError(null);
    } catch (e: any) {
      setError(e?.message || t(dictionary, "recurrentes.loadError"));
    } finally {
      setLoading(false);
    }
  }, [selectedAccountId, dictionary]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, [loadData]);

  const handleEdit = (id: string) => {
    router.push(`/(auth)/recurrentes/${id}`);
  };

  const handlePause = async (id: string, isPaused: boolean) => {
    try {
      const { data, error: updateError } = await supabase
        .from("recurring_items")
        .update({
          is_paused: isPaused,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id)
        .select()
        .single();

      if (updateError) throw updateError;

      setRecurringItems((prev) =>
        prev.map((item) =>
          item.id === id ? { ...item, is_paused: data.is_paused } : item
        )
      );

      Alert.alert(
        t(dictionary, "common.successTitle"),
        isPaused
          ? t(dictionary, "recurrentes.pauseSuccess")
          : t(dictionary, "recurrentes.resumeSuccess")
      );
    } catch (e: any) {
      Alert.alert(
        t(dictionary, "common.errorTitle"),
        isPaused
          ? t(dictionary, "recurrentes.pauseError")
          : t(dictionary, "recurrentes.resumeError")
      );
    }
  };

  const handleEnd = (id: string) => {
    Alert.alert(
      t(dictionary, "recurrentes.endConfirmTitle"),
      t(dictionary, "recurrentes.endConfirmDescription"),
      [
        { text: t(dictionary, "common.cancel"), style: "cancel" },
        {
          text: t(dictionary, "recurrentes.end"),
          style: "destructive",
          onPress: async () => {
            try {
              const today = new Date().toISOString().slice(0, 10);
              const { data, error: updateError } = await supabase
                .from("recurring_items")
                .update({
                  end_date: today,
                  updated_at: new Date().toISOString(),
                })
                .eq("id", id)
                .select()
                .single();

              if (updateError) throw updateError;

              setRecurringItems((prev) =>
                prev.map((item) =>
                  item.id === id ? { ...item, end_date: data.end_date } : item
                )
              );

              Alert.alert(
                t(dictionary, "common.successTitle"),
                t(dictionary, "recurrentes.endSuccess")
              );
            } catch (e: any) {
              Alert.alert(
                t(dictionary, "common.errorTitle"),
                t(dictionary, "recurrentes.endError")
              );
            }
          },
        },
      ]
    );
  };

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace("/(auth)/transactions");
    }
  };

  const screenTitle = t(dictionary, "recurrentes.title");
  const screenOptions = {
    title: screenTitle,
    headerLeft: () => (
      <TouchableOpacity
        onPress={handleBack}
        accessibilityRole="button"
        accessibilityLabel={t(dictionary, "common.back")}
        style={styles.headerBackButton}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <MaterialCommunityIcons
          name="arrow-left"
          size={22}
          color={colors.text.primary}
        />
      </TouchableOpacity>
    ),
  };

  if (loading) {
    return (
      <>
        <Stack.Screen options={screenOptions} />
        <View style={styles.loading}>
          <ActivityIndicator size="large" />
        </View>
      </>
    );
  }

  if (error) {
    return (
      <>
        <Stack.Screen options={screenOptions} />
        <View style={styles.container}>
          <Card title={t(dictionary, "common.errorTitle")} description={error}>
            <Button title={t(dictionary, "common.retry")} onPress={loadData} />
          </Card>
        </View>
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={screenOptions} />
      <View style={styles.screen}>
        <ScrollView
          style={styles.container}
          contentContainerStyle={styles.content}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        >
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.subtitle}>
              {t(dictionary, "recurrentes.pageDescription")}
            </Text>
          </View>

          {/* List */}
          <View style={styles.listContainer}>
            {recurringItems.length === 0 ? (
              <Text style={styles.emptyText}>
                {t(dictionary, "recurrentes.empty")}
              </Text>
            ) : (
              <View>
                {recurringItems.map((item, index) => {
                  const isLast = index === recurringItems.length - 1;
                  return (
                    <View
                      key={item.id}
                      style={[styles.listRow, isLast && styles.listRowLast]}
                    >
                      <RecurringTile
                        recurringItem={item}
                        onEdit={handleEdit}
                        onPause={handlePause}
                        onEnd={handleEnd}
                      />
                    </View>
                  );
                })}
              </View>
            )}
          </View>
        </ScrollView>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg.primary,
  },
  container: {
    flex: 1,
  },
  content: {
    paddingBottom: spacing.xl,
  },
  loading: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: colors.bg.primary,
  },
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  subtitle: {
    fontSize: typography.size.sm,
    color: colors.text.secondary,
    marginTop: spacing.xs,
  },
  listContainer: {
    backgroundColor: colors.bg.primary,
    borderRadius: radii.lg,
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: colors.state.neutral,
  },
  listRow: {
    borderBottomWidth: 1,
    borderBottomColor: colors.state.neutral,
  },
  listRowLast: {
    borderBottomWidth: 0,
  },
  emptyText: {
    fontSize: typography.size.md,
    color: colors.text.secondary,
    textAlign: "center",
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.lg,
  },
  headerBackButton: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
});
