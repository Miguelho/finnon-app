import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useRouter, Redirect } from "expo-router";
import { Plus, PencilSimple, X } from "phosphor-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "../../../../src/contexts/AuthContext";
import { useNetworkNotice } from "../../../../src/contexts/NetworkNoticeContext";
import { useCopy, t } from "../../../../src/lib/i18n";
import { supabase } from "../../../../src/lib/supabase";
import { CategoryIcon } from "../../../../src/components/CategoryIcon";
import {
  resolveCategoryIconKey,
  themeTokens,
  type CategoryType,
} from "@poleursus/shared";

type CategoryRow = {
  id: string;
  account_id: string;
  name: string;
  icon_id: string;
  type: CategoryType;
  created_at: string;
};

type AccountMembershipRecord = {
  account_members?: Array<{ user_id: string; role: "viewer" | "contributor" | "admin" }>;
};

const tokens = themeTokens.light;
const colors = tokens.colors;
const ui = {
  pageBg: colors.bg.primary,
  surface: "#FFFFFF",
  border: "#E8E6E1",
  borderLight: "#F0EEE9",
  surfaceHover: "#F7F7F5",
  expenseBg: "#FFF5F3",
  expenseText: "#C4442A",
  incomeBg: "#F0F7F1",
  incomeText: "#2D7A3A",
  dangerHover: "#FDEAE4",
};

export default function AccountCategoriesSettingsScreen() {
  const { selectedAccountId, isInitialized, user } = useAuth();
  const { dictionary, locale } = useCopy();
  const { reportNetworkIssue } = useNetworkNotice();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [accountRole, setAccountRole] = useState<"viewer" | "contributor" | "admin">(
    "viewer"
  );
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  const canEdit = accountRole !== "viewer";

  const loadAccountRole = async (accountId: string, userId: string) => {
    const { data, error: roleError } = await supabase
      .from("accounts")
      .select("account_members!inner(user_id, role)")
      .eq("id", accountId)
      .eq("account_members.user_id", userId)
      .maybeSingle();

    if (roleError) {
      throw roleError;
    }

    if (!data) {
      throw new Error(t(dictionary, "errors.accountNotFoundOrDenied"));
    }

    const membership = data as AccountMembershipRecord;
    const role =
      membership.account_members?.find((member) => member.user_id === userId)?.role ??
      "viewer";

    setAccountRole(role);
  };

  const loadCategories = async (accountId: string) => {
    const { data, error: categoryError } = await supabase
      .from("categories")
      .select("id, account_id, name, icon_id, type, created_at")
      .eq("account_id", accountId)
      .order("name", { ascending: true });

    if (categoryError) {
      throw categoryError;
    }

    setCategories((data ?? []) as CategoryRow[]);
  };

  const reload = async () => {
    if (!selectedAccountId || !user?.id) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      await Promise.all([
        loadAccountRole(selectedAccountId, user.id),
        loadCategories(selectedAccountId),
      ]);
    } catch (err: any) {
      console.error("[AccountCategoriesSettings] Load error:", err);
      setError(err?.message ?? t(dictionary, "categories.loadError"));
      reportNetworkIssue({
        message: t(dictionary, "categories.loadError"),
        onRetry: () => {
          void reload();
        },
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!selectedAccountId || !user?.id) {
      setIsLoading(false);
      return;
    }

    void reload();
  }, [selectedAccountId, user?.id]);

  const sortedCategories = useMemo(
    () =>
      [...categories].sort((a, b) =>
        a.name.localeCompare(b.name, locale, { sensitivity: "base" })
      ),
    [categories, locale]
  );

  const expenseCategories = sortedCategories.filter(
    (category) => category.type === "expense"
  );
  const incomeCategories = sortedCategories.filter(
    (category) => category.type === "income"
  );

  const confirmDelete = (category: CategoryRow) => {
    if (!canEdit || pendingDeleteId) return;

    Alert.alert(
      t(dictionary, "categories.deleteConfirmTitle"),
      t(dictionary, "categories.deleteConfirmDescription", { name: category.name }),
      [
        { text: t(dictionary, "common.cancel"), style: "cancel" },
        {
          text: t(dictionary, "common.delete"),
          style: "destructive",
          onPress: () => {
            void deleteCategory(category);
          },
        },
      ]
    );
  };

  const deleteCategory = async (category: CategoryRow) => {
    if (!canEdit) return;

    setPendingDeleteId(category.id);
    try {
      const { error: deleteError } = await supabase
        .from("categories")
        .delete()
        .eq("id", category.id);

      if (deleteError) {
        if (deleteError.code === "23503") {
          Alert.alert(
            t(dictionary, "common.errorTitle"),
            t(dictionary, "categories.error.inUse")
          );
          return;
        }
        throw deleteError;
      }

      setCategories((current) =>
        current.filter((currentCategory) => currentCategory.id !== category.id)
      );
      Alert.alert(
        t(dictionary, "common.successTitle"),
        t(dictionary, "accountSettings.categories.deleteSuccess")
      );
    } catch (err: any) {
      console.error("[AccountCategoriesSettings] Delete error:", err);
      Alert.alert(
        t(dictionary, "common.errorTitle"),
        err?.message ?? t(dictionary, "categories.deleteError")
      );
    } finally {
      setPendingDeleteId(null);
    }
  };

  const openCreate = (type: CategoryType) => {
    if (!canEdit) return;
    router.push(`/(auth)/(tabs)/account/categories/create?type=${type}`);
  };

  const openEdit = (categoryId: string) => {
    if (!canEdit) return;
    router.push(`/(auth)/(tabs)/account/categories/${categoryId}/edit`);
  };

  if (!isInitialized) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={colors.text.muted} />
      </View>
    );
  }

  if (!selectedAccountId) {
    return <Redirect href="/(auth)/select-account" />;
  }

  if (isLoading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={colors.text.muted} />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorTitle}>{t(dictionary, "common.errorTitle")}</Text>
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }

  const renderSection = (type: CategoryType, sectionCategories: CategoryRow[]) => {
    const isExpense = type === "expense";
    const toneColor = isExpense ? ui.expenseText : ui.incomeText;
    const toneBg = isExpense ? ui.expenseBg : ui.incomeBg;
    const emptyCopy = canEdit
      ? isExpense
        ? t(dictionary, "categories.emptyExpense")
        : t(dictionary, "categories.emptyIncome")
      : isExpense
      ? t(dictionary, "categories.emptyExpenseReadOnly")
      : t(dictionary, "categories.emptyIncomeReadOnly");

    return (
      <View style={[styles.section, isExpense && styles.sectionSpacing]}>
        <View style={styles.sectionHeader}>
          <View style={[styles.sectionDot, { backgroundColor: toneColor }]} />
          <Text style={[styles.sectionLabel, { color: toneColor }]}>
            {isExpense
              ? t(dictionary, "accountSettings.categories.expenseSection")
              : t(dictionary, "accountSettings.categories.incomeSection")}
          </Text>
          <Text style={styles.sectionCount}>
            ·{" "}
            {t(dictionary, "accountSettings.categories.categoryCount", {
              count: sectionCategories.length,
            })}
          </Text>
        </View>

        <View style={styles.sectionCard}>
          {sectionCategories.length === 0 ? (
            <Text style={styles.emptyText}>{emptyCopy}</Text>
          ) : (
            sectionCategories.map((category, index) => {
              const isDeleting = pendingDeleteId === category.id;
              const showDivider = canEdit || index < sectionCategories.length - 1;

              return (
                <View
                  key={category.id}
                  style={[styles.categoryRow, !showDivider && styles.categoryRowNoDivider]}
                >
                  <View style={styles.categoryMain}>
                    <View style={[styles.iconBadge, { backgroundColor: toneBg }]}>
                      <CategoryIcon
                        iconKey={resolveCategoryIconKey(category.icon_id)}
                        size={16}
                        tone={isExpense ? "negative" : "positive"}
                        accessibilityLabel={category.name}
                      />
                    </View>
                    <Text style={styles.categoryName} numberOfLines={1}>
                      {category.name}
                    </Text>
                  </View>

                  {canEdit ? (
                    <View style={styles.categoryActions}>
                      <Pressable
                        onPress={() => openEdit(category.id)}
                        style={({ pressed }) => [
                          styles.iconActionButton,
                          pressed && styles.iconActionButtonPressed,
                        ]}
                        accessibilityRole="button"
                        accessibilityLabel={t(dictionary, "common.edit")}
                      >
                        <PencilSimple size={14} color={colors.text.secondary} />
                      </Pressable>
                      <Pressable
                        onPress={() => confirmDelete(category)}
                        disabled={isDeleting}
                        style={({ pressed }) => [
                          styles.iconActionButtonDanger,
                          pressed && styles.iconActionButtonDangerPressed,
                          isDeleting && styles.iconActionButtonDisabled,
                        ]}
                        accessibilityRole="button"
                        accessibilityLabel={t(dictionary, "common.delete")}
                      >
                        <X
                          size={14}
                          color={isDeleting ? colors.text.muted : colors.state.negative}
                        />
                      </Pressable>
                    </View>
                  ) : null}
                </View>
              );
            })
          )}

          {canEdit ? (
            <Pressable
              onPress={() => openCreate(type)}
              style={({ pressed }) => [styles.addRow, pressed && styles.addRowPressed]}
              accessibilityRole="button"
              accessibilityLabel={
                isExpense
                  ? t(dictionary, "accountSettings.categories.addExpense")
                  : t(dictionary, "accountSettings.categories.addIncome")
              }
            >
              <Plus size={14} color={colors.text.secondary} />
              <Text style={styles.addRowText}>
                {isExpense
                  ? t(dictionary, "accountSettings.categories.addExpense")
                  : t(dictionary, "accountSettings.categories.addIncome")}
              </Text>
            </Pressable>
          ) : null}
        </View>
      </View>
    );
  };

  return (
    <ScrollView
      style={styles.scrollContainer}
      contentContainerStyle={[
        styles.scrollContent,
        { paddingBottom: insets.bottom + tokens.spacing.xxl },
      ]}
    >
      <View style={styles.pageHeader}>
        <Text style={styles.pageSubtitle}>
          {t(dictionary, "accountSettings.categories.subtitle")}
        </Text>
      </View>

      {!canEdit ? (
        <Text style={styles.readOnlyNotice}>{t(dictionary, "categories.readOnlyNotice")}</Text>
      ) : null}

      {renderSection("expense", expenseCategories)}
      {renderSection("income", incomeCategories)}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: ui.pageBg,
  },
  scrollContainer: {
    flex: 1,
    backgroundColor: ui.pageBg,
  },
  scrollContent: {
    paddingTop: tokens.spacing.lg,
    paddingHorizontal: tokens.spacing.lg,
    gap: tokens.spacing.lg,
  },
  errorContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: tokens.spacing.xl,
    backgroundColor: ui.pageBg,
  },
  errorTitle: {
    fontSize: tokens.typography.size.lg,
    fontWeight: tokens.typography.weight.bold,
    color: colors.text.primary,
    marginBottom: tokens.spacing.xs,
  },
  errorText: {
    fontSize: tokens.typography.size.sm,
    color: colors.state.negative,
    textAlign: "center",
  },
  pageHeader: {
    marginBottom: tokens.spacing.sm,
  },
  pageSubtitle: {
    fontSize: tokens.typography.size.sm,
    color: colors.text.muted,
  },
  readOnlyNotice: {
    fontSize: tokens.typography.size.xs,
    color: colors.text.secondary,
  },
  section: {
    gap: tokens.spacing.sm,
  },
  sectionSpacing: {
    marginBottom: 8,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: tokens.spacing.xs,
  },
  sectionDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: tokens.typography.weight.semibold,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  sectionCount: {
    fontSize: tokens.typography.size.xs,
    color: colors.text.secondary,
  },
  sectionCard: {
    backgroundColor: ui.surface,
    borderWidth: 1,
    borderColor: ui.border,
    borderRadius: tokens.radii.lg,
    overflow: "hidden",
  },
  categoryRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: tokens.spacing.sm,
    paddingHorizontal: tokens.spacing.lg,
    paddingVertical: tokens.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: ui.borderLight,
  },
  categoryRowNoDivider: {
    borderBottomWidth: 0,
  },
  categoryMain: {
    flexDirection: "row",
    alignItems: "center",
    gap: tokens.spacing.sm,
    flex: 1,
    minWidth: 0,
  },
  iconBadge: {
    width: 36,
    height: 36,
    borderRadius: tokens.radii.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  categoryName: {
    flex: 1,
    fontSize: tokens.typography.size.sm,
    fontWeight: tokens.typography.weight.medium,
    color: colors.text.primary,
  },
  categoryActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: tokens.spacing.xs,
  },
  iconActionButton: {
    width: 30,
    height: 30,
    borderRadius: tokens.radii.sm,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: ui.surface,
  },
  iconActionButtonPressed: {
    backgroundColor: ui.surfaceHover,
  },
  iconActionButtonDanger: {
    width: 30,
    height: 30,
    borderRadius: tokens.radii.sm,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: ui.expenseBg,
  },
  iconActionButtonDangerPressed: {
    backgroundColor: ui.dangerHover,
  },
  iconActionButtonDisabled: {
    opacity: 0.6,
  },
  addRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: tokens.spacing.xs,
    paddingHorizontal: tokens.spacing.lg,
    paddingVertical: 14,
    backgroundColor: ui.surface,
  },
  addRowPressed: {
    backgroundColor: ui.surfaceHover,
  },
  addRowText: {
    fontSize: 13,
    fontWeight: tokens.typography.weight.medium,
    color: colors.text.secondary,
  },
  emptyText: {
    fontSize: tokens.typography.size.sm,
    color: colors.text.secondary,
    paddingHorizontal: tokens.spacing.lg,
    paddingVertical: tokens.spacing.lg,
  },
});
