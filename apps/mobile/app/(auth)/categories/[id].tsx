import { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Picker } from "@react-native-picker/picker";
import { supabase } from "../../../src/lib/supabase";
import { useAuth } from "../../../src/contexts/AuthContext";
import { Button } from "../../../src/components/Button";
import { Input } from "../../../src/components/Input";
import { Card } from "../../../src/components/Card";
import { IconPicker } from "../../../src/components/IconPicker";
import type { CategoryType } from "@poleursus/shared";

type Category = {
  id: string;
  account_id: string;
  name: string;
  icon_id: string;
  type: "income" | "expense";
  created_at: string;
};

export default function EditCategoryScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const { selectedAccountId } = useAuth();
  const [category, setCategory] = useState<Category | null>(null);
  const [name, setName] = useState("");
  const [iconId, setIconId] = useState("general");
  const [type, setType] = useState<CategoryType>("expense");
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    loadCategory();
  }, [id]);

  const loadCategory = async () => {
    if (!id) return;

    setIsLoading(true);

    try {
      const { data, error } = await supabase
        .from("categories")
        .select("*")
        .eq("id", id)
        .single();

      if (error) throw error;

      if (data) {
        setCategory(data);
        setName(data.name);
        setIconId(data.icon_id);
        setType(data.type);
      }
    } catch (e: any) {
      console.error("Error loading category:", e);
      Alert.alert("Error", e?.message || "Failed to load category", [
        {
          text: "OK",
          onPress: () => router.back(),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdate = async () => {
    if (!name.trim()) {
      Alert.alert("Error", "Please enter a category name");
      return;
    }

    if (!category) return;

    setIsSubmitting(true);

    try {
      const { error } = await supabase
        .from("categories")
        .update({
          name: name.trim(),
          icon_id: iconId,
          type,
        })
        .eq("id", category.id);

      if (error) throw error;

      Alert.alert("Success", "Category updated successfully", [
        {
          text: "OK",
          onPress: () => router.back(),
        },
      ]);
    } catch (e: any) {
      console.error("Error updating category:", e);
      Alert.alert("Error", e?.message || "Failed to update category");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (!category) {
    return (
      <View style={styles.container}>
        <Card title="Error" description="Category not found">
          <Button title="Go Back" onPress={() => router.back()} />
        </Card>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Card title="Edit Category" description="Update the category details">
        <View style={styles.form}>
          <Input
            label="Name"
            value={name}
            onChangeText={setName}
            placeholder="e.g., Groceries"
          />

          <View style={styles.field}>
            <Text style={styles.label}>Type</Text>
            <View style={styles.pickerContainer}>
              <Picker
                selectedValue={type}
                onValueChange={(value) => setType(value as CategoryType)}
                style={styles.picker}
              >
                <Picker.Item label="Expense" value="expense" />
                <Picker.Item label="Income" value="income" />
              </Picker>
            </View>
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Icon</Text>
            <IconPicker
              value={iconId}
              onChange={setIconId}
              filterType={type}
            />
          </View>

          <View style={styles.actions}>
            <View style={{ flex: 1 }}>
              <Button
                title="Cancel"
                onPress={() => router.back()}
                variant="secondary"
                disabled={isSubmitting}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Button
                title={isSubmitting ? "Saving..." : "Save Changes"}
                onPress={handleUpdate}
                disabled={isSubmitting}
              />
            </View>
          </View>
        </View>
      </Card>
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
  },
  form: {
    gap: 16,
  },
  field: {
    gap: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: "#333",
  },
  pickerContainer: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    overflow: "hidden",
  },
  picker: {
    height: 50,
  },
  actions: {
    flexDirection: "row",
    gap: 12,
    marginTop: 8,
  },
});
