import { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Picker } from "@react-native-picker/picker";
import { supabase } from "../../../../../src/lib/supabase";
import { useAuth } from "../../../../../src/contexts/AuthContext";
import { Button } from "../../../../../src/components/Button";
import { Input } from "../../../../../src/components/Input";
import { Card } from "../../../../../src/components/Card";
import { IconPicker } from "../../../../../src/components/IconPicker";
import {
  normalizeCategoryName,
  suggestCategoryIcon,
  themeTokens,
  type CategoryType,
  type CategoryIconKey,
} from "@poleursus/shared";
import { useCopy, t } from "../../../../../src/lib/i18n";

const tokens = themeTokens.light;
const colors = tokens.colors;

export default function CreateCategoryScreen() {
  const router = useRouter();
  const { type: initialTypeParam } = useLocalSearchParams<{ type?: string }>();
  const { selectedAccountId } = useAuth();
  const [name, setName] = useState("");
  const [iconKey, setIconKey] = useState<CategoryIconKey>("Tag");
  const [type, setType] = useState<CategoryType>("expense");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [userSelectedIcon, setUserSelectedIcon] = useState(false);
  const { dictionary } = useCopy();
  const normalizedNameValue = normalizeCategoryName(name);
  const canSubmit = Boolean(normalizedNameValue) && !isSubmitting;

  useEffect(() => {
    const normalizedType =
      initialTypeParam === "income" || initialTypeParam === "expense"
        ? initialTypeParam
        : null;

    if (!normalizedType) return;

    setType(normalizedType);
    if (!userSelectedIcon) {
      setIconKey(normalizedType === "income" ? "Bank" : "Tag");
    }
  }, [initialTypeParam, userSelectedIcon]);

  const handleNameChange = (newName: string) => {
    setName(newName);
    // Auto-suggest icon only if user hasn't manually selected one
    if (!userSelectedIcon && newName.trim()) {
      const suggestion = suggestCategoryIcon(newName);
      setIconKey(suggestion.primary);
    }
  };

  const handleIconChange = (newIconKey: CategoryIconKey) => {
    setUserSelectedIcon(true);
    setIconKey(newIconKey);
  };

  const handleCreate = async () => {
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

    if (!selectedAccountId) {
      Alert.alert(
        t(dictionary, "common.errorTitle"),
        t(dictionary, "categories.noAccountSelected")
      );
      return;
    }

    setIsSubmitting(true);

    try {
      const { data: existing, error: existingError } = await supabase
        .from("categories")
        .select("id, name")
        .eq("account_id", selectedAccountId);

      if (existingError) throw existingError;

      const normalizedLower = normalizedName.toLowerCase();
      const isDuplicate = (existing ?? []).some(
        (category) =>
          normalizeCategoryName(category.name).toLowerCase() === normalizedLower
      );

      if (isDuplicate) {
        Alert.alert(
          t(dictionary, "common.errorTitle"),
          t(dictionary, "categories.error.duplicateName")
        );
        return;
      }

      const { data, error } = await supabase
        .from("categories")
        .insert([
          {
            account_id: selectedAccountId,
            name: normalizedName,
            icon_id: iconKey,
            type,
          },
        ])
        .select()
        .single();

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
        title={t(dictionary, "categories.newTitle")}
        description={t(dictionary, "categories.createDescription")}
      >
        <View style={styles.form}>
          <Input
            label={t(dictionary, "categories.nameLabel")}
            value={name}
            onChangeText={handleNameChange}
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
              onChange={handleIconChange}
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
                    : t(dictionary, "categories.saveLabel")
                }
                onPress={handleCreate}
                disabled={!canSubmit}
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
