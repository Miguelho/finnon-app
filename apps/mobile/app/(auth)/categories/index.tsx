import { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from "react-native";
import { Stack, useRouter } from "expo-router";
import { useIsFocused } from "@react-navigation/native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { supabase } from "../../../src/lib/supabase";
import { useAuth } from "../../../src/contexts/AuthContext";
import { Button } from "../../../src/components/Button";
import { Card } from "../../../src/components/Card";
import { CategoryTile } from "../../../src/components/CategoryTile";
import { themeTokens } from "@poleursus/shared";
import { useCopy, t } from "../../../src/lib/i18n";

type Category = {
  id: string;
  account_id: string;
  name: string;
  icon_id: string;
  type: "income" | "expense";
  created_at: string;
};

const tokens = themeTokens.light;
const colors = tokens.colors;
const spacing = tokens.spacing;
const radii = tokens.radii;

export default function CategoriesScreen() {
  const router = useRouter();
  const { selectedAccountId } = useAuth();
  const { dictionary } = useCopy();
  const isFocused = useIsFocused();
  const insets = useSafeAreaInsets();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isFocused) {
      loadCategories();
    }
  }, [selectedAccountId, isFocused]);

  const loadCategories = async () => {
    if (!selectedAccountId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { data, error: fetchError } = await supabase
        .from("categories")
        .select("*")
        .eq("account_id", selectedAccountId)
        .order("name", { ascending: true });

      if (fetchError) throw fetchError;

      setCategories(data || []);
    } catch (e: any) {
      console.error("Error loading categories:", e);
      setError(e?.message || t(dictionary, "categories.loadError"));
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (category: Category) => {
    Alert.alert(
      t(dictionary, "categories.deleteConfirmTitle"),
      t(dictionary, "categories.deleteConfirmDescription", { name: category.name }),
      [
        { text: t(dictionary, "common.cancel"), style: "cancel" },
        {
          text: t(dictionary, "common.delete"),
          style: "destructive",
          onPress: async () => {
            try {
              const { error } = await supabase
                .from("categories")
                .delete()
                .eq("id", category.id);

              if (error) {
                if (error.code === "23503") {
                  Alert.alert(
                    t(dictionary, "common.errorTitle"),
                    t(dictionary, "categories.error.inUse")
                  );
                  return;
                }
                throw error;
              }

              setCategories(categories.filter((c) => c.id !== category.id));
            } catch (e: any) {
              Alert.alert(
                t(dictionary, "common.errorTitle"),
                e?.message || t(dictionary, "categories.deleteError")
              );
            }
          },
        },
      ]
    );
  };

  const incomeCategories = categories.filter((cat) => cat.type === "income");
  const expenseCategories = categories.filter((cat) => cat.type === "expense");
  const hasCategories = categories.length > 0;

  if (loading) {
    return (
      <>
        <Stack.Screen options={{ title: t(dictionary, "categories.title") }} />
        <View style={styles.loading}>
          <ActivityIndicator size="large" />
        </View>
      </>
    );
  }

  if (error) {
    return (
      <>
        <Stack.Screen options={{ title: t(dictionary, "categories.title") }} />
        <View style={styles.container}>
          <Card title={t(dictionary, "common.errorTitle")} description={error}>
            <Button title={t(dictionary, "common.retry")} onPress={loadCategories} />
          </Card>
        </View>
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: t(dictionary, "categories.title") }} />
      <View style={styles.container}>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[
            styles.content,
            { paddingBottom: spacing.xxxl + insets.bottom + 72 },
          ]}
        >
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.subtitle}>
              {t(dictionary, "categories.subtitle")}
            </Text>
          </View>

        {!hasCategories && (
          <Card>
            <Text style={styles.emptyText}>{t(dictionary, "categories.emptyAll")}</Text>
            <View style={styles.emptyCta}>
              <Button
                title={t(dictionary, "categories.createTitle")}
                onPress={() => router.push("/(auth)/categories/create")}
              />
            </View>
          </Card>
        )}

        {/* Expense Categories */}
        {hasCategories && (
          <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            {t(dictionary, "categories.listExpenseTitle", {
              count: expenseCategories.length,
            })}
          </Text>
          {expenseCategories.length === 0 ? (
            <Text style={styles.emptyText}>
              {t(dictionary, "categories.emptyExpense")}
            </Text>
          ) : (
            <View style={styles.list}>
              {expenseCategories.map((category) => (
                <CategoryTile
                  key={category.id}
                  category={category}
                  onPress={() => router.push(`/(auth)/categories/${category.id}`)}
                  onEdit={() => router.push(`/(auth)/categories/${category.id}/edit`)}
                  onDelete={() => handleDelete(category)}
                />
              ))}
            </View>
          )}
          </View>
        )}

        {/* Income Categories */}
        {hasCategories && (
          <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            {t(dictionary, "categories.listIncomeTitle", {
              count: incomeCategories.length,
            })}
          </Text>
          {incomeCategories.length === 0 ? (
            <Text style={styles.emptyText}>
              {t(dictionary, "categories.emptyIncome")}
            </Text>
          ) : (
            <View style={styles.list}>
              {incomeCategories.map((category) => (
                <CategoryTile
                  key={category.id}
                  category={category}
                  onPress={() => router.push(`/(auth)/categories/${category.id}`)}
                  onEdit={() => router.push(`/(auth)/categories/${category.id}/edit`)}
                  onDelete={() => handleDelete(category)}
                />
              ))}
            </View>
          )}
          </View>
        )}
        </ScrollView>

        <TouchableOpacity
          onPress={() => router.push("/(auth)/categories/create")}
          style={[styles.addFab, { bottom: spacing.lg + insets.bottom }]}
          accessibilityRole="button"
          accessibilityLabel={t(dictionary, "categories.createTitle")}
        >
          <MaterialCommunityIcons name="plus" size={24} color={colors.bg.primary} />
        </TouchableOpacity>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: colors.bg.primary,
  },
  container: {
    flex: 1,
    backgroundColor: colors.bg.primary,
  },
  scroll: {
    flex: 1,
  },
  content: {
    padding: 16,
    gap: 16,
  },
  header: {
    marginBottom: 8,
  },
  subtitle: {
    fontSize: tokens.typography.size.sm,
    color: colors.text.secondary,
    marginTop: 4,
  },
  actions: {
    flexDirection: "row",
    gap: 8,
  },
  addFab: {
    position: "absolute",
    right: spacing.lg,
    width: 56,
    height: 56,
    borderRadius: radii.pill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.action.primary,
    shadowColor: colors.shadow.soft,
    shadowOpacity: 0.25,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
  section: {
    marginTop: 8,
  },
  sectionTitle: {
    fontSize: tokens.typography.size.lg,
    fontWeight: tokens.typography.weight.bold,
    color: colors.text.primary,
    marginBottom: 12,
  },
  emptyText: {
    fontSize: tokens.typography.size.sm,
    color: colors.text.secondary,
    fontStyle: "italic",
  },
  list: {
    gap: 8,
  },
  emptyCta: {
    marginTop: 12,
  },
});
