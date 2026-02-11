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
import { supabase } from "../../../../../../src/lib/supabase";
import { Button } from "../../../../../../src/components/Button";
import { Input } from "../../../../../../src/components/Input";
import { Card } from "../../../../../../src/components/Card";
import { IconPicker } from "../../../../../../src/components/IconPicker";
import {
  normalizeCategoryName,
  resolveCategoryIconKey,
  themeTokens,
  type CategoryType,
  type CategoryIconKey,
} from "@poleursus/shared";
import { useCopy, t } from "../../../../../../src/lib/i18n";

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

export default function EditCategoryScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const [category, setCategory] = useState<Category | null>(null);
  const [name, setName] = useState("");
  const [iconKey, setIconKey] = useState<CategoryIconKey>("Tag");
  const [type, setType] = useState<CategoryType>("expense");
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { dictionary } = useCopy();

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
        setIconKey(resolveCategoryIconKey(data.icon_id));
        setType(data.type);
      }
    } catch (e: any) {
      console.error("Error loading category:", e);
      Alert.alert(
        t(dictionary, "common.errorTitle"),
        e?.message || t(dictionary, "categories.loadError"),
        [
          {
            text: t(dictionary, "common.ok"),
            onPress: () => router.back(),
          },
        ]
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdate = async () => {
    const normalizedName = normalizeCategoryName(name);
    if (!normalizedName) {
      Alert.alert(
        t(dictionary, "common.errorTitle"),
        t(dictionary, "categories.nameRequired")
      );
      return;
    }

    if (normalizedName.length < 2 || normalizedName.length > 40) {
      Alert.alert(
        t(dictionary, "common.errorTitle"),
        t(dictionary, "categories.error.nameLength")
      );
      return;
    }

    if (!category) return;

    setIsSubmitting(true);

    try {
      const { data: existing, error: existingError } = await supabase
        .from("categories")
        .select("id, name")
        .eq("account_id", category.account_id);

      if (existingError) throw existingError;

      const normalizedLower = normalizedName.toLowerCase();
      const isDuplicate = (existing ?? []).some(
        (existingCategory) =>
          existingCategory.id !== category.id &&
          normalizeCategoryName(existingCategory.name).toLowerCase() ===
            normalizedLower
      );

      if (isDuplicate) {
        Alert.alert(
          t(dictionary, "common.errorTitle"),
          t(dictionary, "categories.error.duplicateName")
        );
        return;
      }

      const { error } = await supabase
        .from("categories")
        .update({
          name: normalizedName,
          icon_id: iconKey,
          type,
        })
        .eq("id", category.id);

      if (error) {
        if (error.code === "23505") {
          Alert.alert(
            t(dictionary, "common.errorTitle"),
            t(dictionary, "categories.error.duplicateName")
          );
          return;
        }
        throw error;
      }

      Alert.alert(
        t(dictionary, "common.successTitle"),
        t(dictionary, "categories.updateSuccess"),
        [
          {
            text: t(dictionary, "common.ok"),
            onPress: () => router.back(),
          },
        ]
      );
    } catch (e: any) {
      console.error("Error updating category:", e);
      Alert.alert(
        t(dictionary, "common.errorTitle"),
        e?.message || t(dictionary, "categories.updateError")
      );
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
        <Card
          title={t(dictionary, "categories.notFoundTitle")}
          description={t(dictionary, "categories.notFoundDescription")}
        >
          <Button title={t(dictionary, "transactions.goBack")} onPress={() => router.back()} />
        </Card>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Card description={t(dictionary, "categories.editDescription")}>
        <View style={styles.form}>
          <Input
            label={t(dictionary, "categories.nameLabel")}
            value={name}
            onChangeText={setName}
            placeholder={t(dictionary, "categories.namePlaceholder")}
            maxLength={40}
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
              value={iconKey}
              onChange={setIconKey}
              filterType={type}
              categoryName={name}
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
                    ? t(dictionary, "common.saving")
                    : t(dictionary, "transactions.saveChanges")
                }
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
    backgroundColor: colors.bg.primary,
  },
  container: {
    flex: 1,
    backgroundColor: colors.bg.primary,
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
    fontSize: tokens.typography.size.sm,
    fontWeight: tokens.typography.weight.semibold,
    color: colors.text.primary,
  },
  pickerContainer: {
    borderWidth: 1,
    borderColor: colors.state.neutral,
    borderRadius: tokens.radii.md,
    overflow: "hidden",
    backgroundColor: colors.bg.surface,
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
