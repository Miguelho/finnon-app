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
import { supabase } from "../../../src/lib/supabase";
import { useAuth } from "../../../src/contexts/AuthContext";
import { Button } from "../../../src/components/Button";
import { Card } from "../../../src/components/Card";
import { getIconById } from "@poleursus/shared";

type Category = {
  id: string;
  account_id: string;
  name: string;
  icon_id: string;
  type: "income" | "expense";
  created_at: string;
};

export default function CategoriesScreen() {
  const router = useRouter();
  const { user, selectedAccountId } = useAuth();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadCategories();
  }, [selectedAccountId]);

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
        .order("created_at", { ascending: false });

      if (fetchError) throw fetchError;

      setCategories(data || []);
    } catch (e: any) {
      console.error("Error loading categories:", e);
      setError(e?.message || "Failed to load categories");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (category: Category) => {
    Alert.alert(
      "Delete Category",
      `Are you sure you want to delete "${category.name}"?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              const { error } = await supabase
                .from("categories")
                .delete()
                .eq("id", category.id);

              if (error) throw error;

              setCategories(categories.filter((c) => c.id !== category.id));
            } catch (e: any) {
              Alert.alert("Error", e?.message || "Failed to delete category");
            }
          },
        },
      ]
    );
  };

  const incomeCategories = categories.filter((cat) => cat.type === "income");
  const expenseCategories = categories.filter((cat) => cat.type === "expense");

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
        <Card title="Error" description={error}>
          <Button title="Retry" onPress={loadCategories} />
        </Card>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Categories</Text>
          <Text style={styles.subtitle}>
            Manage your income and expense categories
          </Text>
        </View>
      </View>

      {/* Actions */}
      <View style={styles.actions}>
        <Button
          title="Create Category"
          onPress={() => router.push("/(auth)/categories/create")}
        />
        <Button
          title="Back"
          onPress={() => router.back()}
          variant="secondary"
        />
      </View>

      {/* Expense Categories */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>
          Expense Categories ({expenseCategories.length})
        </Text>
        {expenseCategories.length === 0 ? (
          <Text style={styles.emptyText}>
            No expense categories yet. Create one to get started.
          </Text>
        ) : (
          <View style={styles.list}>
            {expenseCategories.map((category) => {
              const icon = getIconById(category.icon_id);
              return (
                <View key={category.id} style={styles.categoryItem}>
                  <View style={styles.categoryInfo}>
                    <Text style={styles.emoji}>{icon?.emoji || "📦"}</Text>
                    <Text style={styles.categoryName}>{category.name}</Text>
                  </View>
                  <View style={styles.categoryActions}>
                    <TouchableOpacity
                      onPress={() =>
                        router.push(`/(auth)/categories/${category.id}`)
                      }
                      style={styles.actionButton}
                    >
                      <Text style={styles.actionButtonText}>Edit</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => handleDelete(category)}
                      style={[styles.actionButton, styles.deleteButton]}
                    >
                      <Text style={styles.deleteButtonText}>Delete</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </View>

      {/* Income Categories */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>
          Income Categories ({incomeCategories.length})
        </Text>
        {incomeCategories.length === 0 ? (
          <Text style={styles.emptyText}>
            No income categories yet. Create one to get started.
          </Text>
        ) : (
          <View style={styles.list}>
            {incomeCategories.map((category) => {
              const icon = getIconById(category.icon_id);
              return (
                <View key={category.id} style={styles.categoryItem}>
                  <View style={styles.categoryInfo}>
                    <Text style={styles.emoji}>{icon?.emoji || "📦"}</Text>
                    <Text style={styles.categoryName}>{category.name}</Text>
                  </View>
                  <View style={styles.categoryActions}>
                    <TouchableOpacity
                      onPress={() =>
                        router.push(`/(auth)/categories/${category.id}`)
                      }
                      style={styles.actionButton}
                    >
                      <Text style={styles.actionButtonText}>Edit</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => handleDelete(category)}
                      style={[styles.actionButton, styles.deleteButton]}
                    >
                      <Text style={styles.deleteButtonText}>Delete</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  content: {
    padding: 16,
    gap: 16,
  },
  header: {
    marginBottom: 8,
  },
  title: {
    fontSize: 28,
    fontWeight: "800",
  },
  subtitle: {
    fontSize: 14,
    color: "#666",
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
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 12,
  },
  emptyText: {
    fontSize: 14,
    color: "#666",
    fontStyle: "italic",
  },
  list: {
    gap: 8,
  },
  categoryItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 12,
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    backgroundColor: "#fff",
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
    fontSize: 16,
    fontWeight: "600",
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
    borderColor: "#007AFF",
  },
  actionButtonText: {
    color: "#007AFF",
    fontSize: 14,
    fontWeight: "600",
  },
  deleteButton: {
    borderColor: "#FF3B30",
  },
  deleteButtonText: {
    color: "#FF3B30",
    fontSize: 14,
    fontWeight: "600",
  },
});
