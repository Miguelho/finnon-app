import { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { Picker } from "@react-native-picker/picker";
import { supabase } from "../../../src/lib/supabase";
import { useAuth } from "../../../src/contexts/AuthContext";
import { Button } from "../../../src/components/Button";
import { Input } from "../../../src/components/Input";
import { Card } from "../../../src/components/Card";
import { IconPicker } from "../../../src/components/IconPicker";
import type { CategoryType } from "@poleursus/shared";

export default function CreateCategoryScreen() {
  const router = useRouter();
  const { selectedAccountId } = useAuth();
  const [name, setName] = useState("");
  const [iconId, setIconId] = useState("general");
  const [type, setType] = useState<CategoryType>("expense");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleCreate = async () => {
    if (!name.trim()) {
      Alert.alert("Error", "Please enter a category name");
      return;
    }

    if (!selectedAccountId) {
      Alert.alert("Error", "No active account selected");
      return;
    }

    setIsSubmitting(true);

    try {
      const { data, error } = await supabase
        .from("categories")
        .insert([
          {
            account_id: selectedAccountId,
            name: name.trim(),
            icon_id: iconId,
            type,
          },
        ])
        .select()
        .single();

      if (error) throw error;

      Alert.alert("Success", "Category created successfully", [
        {
          text: "OK",
          onPress: () => router.back(),
        },
      ]);
    } catch (e: any) {
      console.error("Error creating category:", e);
      Alert.alert("Error", e?.message || "Failed to create category");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Card title="Create Category" description="Add a new category to organize your transactions">
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
                title={isSubmitting ? "Creating..." : "Create"}
                onPress={handleCreate}
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
