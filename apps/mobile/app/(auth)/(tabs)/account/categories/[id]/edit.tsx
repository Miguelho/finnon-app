import { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
  Modal,
  Pressable,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Picker } from "@react-native-picker/picker";
import { supabase } from "../../../../../../src/lib/supabase";
import { useUserTheme } from "../../../../../../src/contexts/UserThemeContext";
import { Button } from "../../../../../../src/components/Button";
import { Input } from "../../../../../../src/components/Input";
import { Card } from "../../../../../../src/components/Card";
import { IconPicker } from "../../../../../../src/components/IconPicker";
import { CategoryColorPicker } from "../../../../../../src/components/CategoryColorPicker";
import {
  normalizeHexColor,
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
  color?: string | null;
  type: "income" | "expense";
  created_at: string;
};

const tokens = themeTokens.light;

export default function EditCategoryScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const { tokens: userThemeTokens } = useUserTheme();
  const [category, setCategory] = useState<Category | null>(null);
  const [name, setName] = useState("");
  const [iconKey, setIconKey] = useState<CategoryIconKey>("Tag");
  const [type, setType] = useState<CategoryType>("expense");
  const [color, setColor] = useState<string>("#D4943A");
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const { dictionary } = useCopy();
  const isBusy = isSubmitting || isDeleting;

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
        setColor(normalizeHexColor(data.color) ?? "#D4943A");
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
          color: normalizeHexColor(color),
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

  const handleDelete = async () => {
    if (!category) return;

    setIsDeleting(true);
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

      setIsDeleteDialogOpen(false);
      Alert.alert(
        t(dictionary, "common.successTitle"),
        t(dictionary, "accountSettings.categories.deleteSuccess"),
        [
          {
            text: t(dictionary, "common.ok"),
            onPress: () => router.back(),
          },
        ]
      );
    } catch (e: any) {
      console.error("Error deleting category:", e);
      Alert.alert(
        t(dictionary, "common.errorTitle"),
        e?.message || t(dictionary, "categories.deleteError")
      );
    } finally {
      setIsDeleting(false);
    }
  };

  if (isLoading) {
    return (
      <View style={[styles.loading, { backgroundColor: userThemeTokens.background }]}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (!category) {
    return (
      <View style={[styles.container, { backgroundColor: userThemeTokens.background }]}>
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
    <ScrollView
      style={[styles.container, { backgroundColor: userThemeTokens.background }]}
      contentContainerStyle={styles.content}
    >
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
            <Text style={[styles.label, { color: userThemeTokens.textPrimary }]}>
              {t(dictionary, "categories.typeLabel")}
            </Text>
            <View
              style={[
                styles.pickerContainer,
                {
                  borderColor: userThemeTokens.border,
                  backgroundColor: userThemeTokens.surface,
                },
              ]}
            >
              <Picker
                selectedValue={type}
                onValueChange={(value) => setType(value as CategoryType)}
                style={[styles.picker, { color: userThemeTokens.textPrimary }]}
              >
                <Picker.Item label={t(dictionary, "categories.expenseLabel")} value="expense" />
                <Picker.Item label={t(dictionary, "categories.incomeLabel")} value="income" />
              </Picker>
            </View>
          </View>

          <View style={styles.field}>
            <Text style={[styles.label, { color: userThemeTokens.textPrimary }]}>
              {t(dictionary, "categories.iconLabel")}
            </Text>
            <IconPicker
              value={iconKey}
              onChange={setIconKey}
              filterType={type}
              categoryName={name}
            />
          </View>

          <View style={styles.field}>
            <Text style={[styles.label, { color: userThemeTokens.textPrimary }]}>
              {t(dictionary, "categories.colorLabel")}
            </Text>
            <CategoryColorPicker value={color} onChange={setColor} />
          </View>

          <View style={styles.actions}>
            <View style={{ flex: 1 }}>
              <Button
                title={t(dictionary, "common.cancel")}
                onPress={() => router.back()}
                variant="secondary"
                disabled={isBusy}
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
                disabled={isBusy}
              />
            </View>
          </View>

          <Pressable
            onPress={() => setIsDeleteDialogOpen(true)}
            disabled={isBusy}
            style={({ pressed }) => [
              styles.deleteButton,
              {
                borderColor: userThemeTokens.dangerBorder,
                backgroundColor: pressed
                  ? userThemeTokens.dangerBackground
                  : userThemeTokens.surface,
                opacity: isBusy ? 0.6 : 1,
              },
            ]}
            accessibilityRole="button"
            accessibilityLabel={t(dictionary, "common.delete")}
          >
            <Text style={[styles.deleteButtonText, { color: userThemeTokens.dangerText }]}>
              {t(dictionary, "common.delete")}
            </Text>
          </Pressable>
        </View>
      </Card>

      <Modal
        transparent
        visible={isDeleteDialogOpen}
        animationType="fade"
        onRequestClose={() => {
          if (!isDeleting) setIsDeleteDialogOpen(false);
        }}
      >
        <View style={styles.modalOverlay}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => {
              if (!isDeleting) setIsDeleteDialogOpen(false);
            }}
            disabled={isDeleting}
          />

          <View
            style={[
              styles.modalCard,
              {
                backgroundColor: userThemeTokens.surface,
                borderColor: userThemeTokens.border,
              },
            ]}
          >
            <Text style={[styles.modalTitle, { color: userThemeTokens.textPrimary }]}>
              {t(dictionary, "categories.deleteConfirmTitle")}
            </Text>
            <Text style={[styles.modalDescription, { color: userThemeTokens.textSecondary }]}>
              {t(dictionary, "categories.deleteConfirmDescription", {
                name: category?.name ?? "",
              })}
            </Text>

            <View style={styles.modalActions}>
              <Pressable
                onPress={() => {
                  if (!isDeleting) setIsDeleteDialogOpen(false);
                }}
                disabled={isDeleting}
                style={styles.modalCancelButton}
              >
                <Text
                  style={[
                    styles.modalCancelText,
                    { color: isDeleting ? userThemeTokens.textTertiary : userThemeTokens.textSecondary },
                  ]}
                >
                  {t(dictionary, "common.cancel")}
                </Text>
              </Pressable>

              <Pressable
                onPress={() => {
                  void handleDelete();
                }}
                disabled={isDeleting}
                style={[
                  styles.modalConfirmButton,
                  {
                    borderColor: userThemeTokens.dangerText,
                    opacity: isDeleting ? 0.55 : 1,
                  },
                ]}
              >
                {isDeleting ? (
                  <ActivityIndicator size="small" color={userThemeTokens.dangerText} />
                ) : (
                  <Text style={[styles.modalConfirmText, { color: userThemeTokens.dangerText }]}>
                    {t(dictionary, "common.delete")}
                  </Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
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
  },
  pickerContainer: {
    borderWidth: 1,
    borderRadius: tokens.radii.md,
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
  deleteButton: {
    borderWidth: 1,
    borderRadius: tokens.radii.md,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
  },
  deleteButtonText: {
    fontSize: tokens.typography.size.sm,
    fontWeight: tokens.typography.weight.semibold,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: "center",
    padding: tokens.spacing.lg,
    backgroundColor: "rgba(0, 0, 0, 0.32)",
  },
  modalCard: {
    borderWidth: 1,
    borderRadius: tokens.radii.lg,
    padding: tokens.spacing.lg,
  },
  modalTitle: {
    fontSize: tokens.typography.size.lg,
    fontWeight: tokens.typography.weight.semibold,
    marginBottom: tokens.spacing.xs,
  },
  modalDescription: {
    fontSize: tokens.typography.size.sm,
    marginBottom: tokens.spacing.lg,
  },
  modalActions: {
    marginTop: tokens.spacing.xs,
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: tokens.spacing.sm,
  },
  modalCancelButton: {
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: tokens.spacing.sm,
  },
  modalCancelText: {
    fontSize: tokens.typography.size.sm,
    fontWeight: tokens.typography.weight.medium,
  },
  modalConfirmButton: {
    borderWidth: 1,
    borderRadius: tokens.radii.md,
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: tokens.spacing.sm,
    alignItems: "center",
    justifyContent: "center",
    minWidth: 134,
  },
  modalConfirmText: {
    fontSize: tokens.typography.size.sm,
    fontWeight: tokens.typography.weight.semibold,
  },
});
