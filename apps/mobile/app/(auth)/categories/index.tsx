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
import { useRouter } from "expo-router";
import { useIsFocused } from "@react-navigation/native";
import { supabase } from "../../../src/lib/supabase";
import { useAuth } from "../../../src/contexts/AuthContext";
import { Button } from "../../../src/components/Button";
import { Card } from "../../../src/components/Card";
import { getIconById, themeTokens } from "@poleursus/shared";
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

export default function CategoriesScreen() {
  const router = useRouter();
  const { selectedAccountId } = useAuth();
  const { dictionary } = useCopy();
  const isFocused = useIsFocused();
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
      <View style={styles.loading}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.container}>
        <Card title={t(dictionary, "common.errorTitle")} description={error}>
          <Button title={t(dictionary, "common.retry")} onPress={loadCategories} />
        </Card>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>{t(dictionary, "categories.title")}</Text>
          <Text style={styles.subtitle}>
            {t(dictionary, "categories.subtitle")}
          </Text>
        </View>
      </View>

      {/* Actions */}
      <View style={styles.actions}>
        <Button
          title={t(dictionary, "categories.createTitle")}
          onPress={() => router.push("/(auth)/categories/create")}
        />
        <Button
          title={t(dictionary, "common.back")}
          onPress={() => router.back()}
          variant="secondary"
        />
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
            {expenseCategories.map((category) => {
              const icon = getIconById(category.icon_id);
              return (
                <View key={category.id} style={styles.categoryItem}>
                  <TouchableOpacity
                    style={styles.categoryInfo}
                    onPress={() => router.push(`/(auth)/categories/${category.id}`)}
                  >
                    <Text style={styles.emoji}>{icon?.emoji || "📦"}</Text>
                    <Text style={styles.categoryName}>{category.name}</Text>
                  </TouchableOpacity>
                  <View style={styles.categoryActions}>
                    <TouchableOpacity
                      onPress={() =>
                        router.push(`/(auth)/categories/${category.id}/edit`)
                      }
                      style={styles.actionButton}
                    >
                      <Text style={styles.actionButtonText}>
                        {t(dictionary, "common.edit")}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => handleDelete(category)}
                      style={[styles.actionButton, styles.deleteButton]}
                    >
                      <Text style={styles.deleteButtonText}>
                        {t(dictionary, "common.delete")}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })}
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
            {incomeCategories.map((category) => {
              const icon = getIconById(category.icon_id);
              return (
                <View key={category.id} style={styles.categoryItem}>
                  <TouchableOpacity
                    style={styles.categoryInfo}
                    onPress={() => router.push(`/(auth)/categories/${category.id}`)}
                  >
                    <Text style={styles.emoji}>{icon?.emoji || "📦"}</Text>
                    <Text style={styles.categoryName}>{category.name}</Text>
                  </TouchableOpacity>
                  <View style={styles.categoryActions}>
                    <TouchableOpacity
                      onPress={() =>
                        router.push(`/(auth)/categories/${category.id}/edit`)
                      }
                      style={styles.actionButton}
                    >
                      <Text style={styles.actionButtonText}>
                        {t(dictionary, "common.edit")}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => handleDelete(category)}
                      style={[styles.actionButton, styles.deleteButton]}
                    >
                      <Text style={styles.deleteButtonText}>
                        {t(dictionary, "common.delete")}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })}
          </View>
        )}
        </View>
      )}
    </ScrollView>
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
  content: {
    padding: 16,
    gap: 16,
  },
  header: {
    marginBottom: 8,
  },
  title: {
    fontSize: tokens.typography.size.display,
    fontWeight: tokens.typography.weight.bold,
    color: colors.text.primary,
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
  categoryItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 12,
    borderWidth: 1,
    borderColor: colors.state.neutral,
    borderRadius: 8,
    backgroundColor: colors.bg.surface,
  },
  categoryInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
  },
  emoji: {
    fontSize: 24,
  },
  categoryName: {
    fontSize: tokens.typography.size.md,
    fontWeight: tokens.typography.weight.semibold,
    color: colors.text.primary,
  },
  categoryActions: {
    flexDirection: "row",
    gap: 8,
  },
  actionButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.action.primary,
  },
  actionButtonText: {
    color: colors.action.primary,
    fontSize: tokens.typography.size.sm,
    fontWeight: tokens.typography.weight.semibold,
  },
  deleteButton: {
    borderColor: colors.state.negative,
  },
  deleteButtonText: {
    color: colors.state.negative,
    fontSize: tokens.typography.size.sm,
    fontWeight: tokens.typography.weight.semibold,
  },
});
