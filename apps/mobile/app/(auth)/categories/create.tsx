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
import { useCopy, t } from "../../../src/lib/i18n";

export default function CreateCategoryScreen() {
  const router = useRouter();
  const { selectedAccountId } = useAuth();
  const [name, setName] = useState("");
  const [iconId, setIconId] = useState("general");
  const [type, setType] = useState<CategoryType>("expense");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { dictionary } = useCopy();

  const handleCreate = async () => {
    if (!name.trim()) {
      Alert.alert(
        t(dictionary, "common.errorTitle"),
        t(dictionary, "categories.nameRequired")
      );
      return;
    }

    if (!selectedAccountId) {
      Alert.alert(
        t(dictionary, "common.errorTitle"),
        t(dictionary, "categories.noAccountSelected")
      );
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

      Alert.alert(
        t(dictionary, "common.successTitle"),
        t(dictionary, "categories.createSuccess"),
        [
        {
          text: t(dictionary, "common.ok"),
          onPress: () => router.back(),
        },
      ]);
    } catch (e: any) {
      console.error("Error creating category:", e);
      Alert.alert(
        t(dictionary, "common.errorTitle"),
        e?.message || t(dictionary, "categories.createError")
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Card
        title={t(dictionary, "categories.createTitle")}
        description={t(dictionary, "categories.createDescription")}
      >
        <View style={styles.form}>
          <Input
            label={t(dictionary, "categories.nameLabel")}
            value={name}
            onChangeText={setName}
            placeholder={t(dictionary, "categories.namePlaceholder")}
          />

          <View style={styles.field}>
            <Text style={styles.label}>{t(dictionary, "categories.typeLabel")}</Text>
            <View style={styles.pickerContainer}>
              <Picker
                selectedValue={type}
                onValueChange={(value) => setType(value as CategoryType)}
                style={styles.picker}
              >
                <Picker.Item label={t(dictionary, "categories.expenseLabel")} value="expense" />
                <Picker.Item label={t(dictionary, "categories.incomeLabel")} value="income" />
              </Picker>
            </View>
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>{t(dictionary, "categories.iconLabel")}</Text>
            <IconPicker
              value={iconId}
              onChange={setIconId}
              filterType={type}
            />
          </View>

          <View style={styles.actions}>
            <View style={{ flex: 1 }}>
              <Button
                title={t(dictionary, "common.cancel")}
                onPress={() => router.back()}
                variant="secondary"
                disabled={isSubmitting}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Button
                title={
                  isSubmitting
                    ? t(dictionary, "common.creating")
                    : t(dictionary, "common.create")
                }
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
