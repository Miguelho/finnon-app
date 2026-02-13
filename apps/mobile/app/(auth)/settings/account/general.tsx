import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Picker } from "@react-native-picker/picker";
import { Redirect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "../../../../src/contexts/AuthContext";
import { useNetworkNotice } from "../../../../src/contexts/NetworkNoticeContext";
import { useUserTheme } from "../../../../src/contexts/UserThemeContext";
import { useCopy, t } from "../../../../src/lib/i18n";
import { supabase } from "../../../../src/lib/supabase";
import { CURRENCIES, themeTokens } from "@poleursus/shared";

type AccountRole = "viewer" | "contributor" | "admin";
type AccountRecord = {
  id: string;
  name: string;
  base_currency: string;
  account_members?: Array<{ user_id: string; role: AccountRole }>;
};

const tokens = themeTokens.light;
const colors = themeTokens.light.colors;

export default function AccountGeneralSettingsScreen() {
  const { selectedAccountId, isInitialized, user } = useAuth();
  const { dictionary } = useCopy();
  const insets = useSafeAreaInsets();
  const { reportNetworkIssue } = useNetworkNotice();
  const {
    tokens: userThemeTokens,
    primaryActionColor,
    primaryActionTextColor,
  } = useUserTheme();

  const [account, setAccount] = useState<AccountRecord | null>(null);
  const [name, setName] = useState("");
  const [currency, setCurrency] = useState("EUR");
  const [role, setRole] = useState<AccountRole>("viewer");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadAccount() {
      if (!selectedAccountId || !user?.id) {
        if (!cancelled) {
          setIsLoading(false);
        }
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const { data, error: accountError } = await supabase
          .from("accounts")
          .select("id, name, base_currency, account_members!inner(user_id, role)")
          .eq("id", selectedAccountId)
          .eq("account_members.user_id", user.id)
          .maybeSingle();

        if (accountError) {
          throw accountError;
        }

        if (!data) {
          throw new Error(t(dictionary, "errors.accountNotFoundOrDenied"));
        }

        const accountData = data as AccountRecord;
        const currentRole =
          accountData.account_members?.find((member) => member.user_id === user.id)?.role ??
          "viewer";

        if (!cancelled) {
          setAccount(accountData);
          setName(accountData.name);
          setCurrency(accountData.base_currency);
          setRole(currentRole);
        }
      } catch (err: any) {
        console.error("[AccountGeneralSettings] Load error:", err);
        if (!cancelled) {
          setError(err?.message ?? t(dictionary, "account.loadError"));
        }
        reportNetworkIssue({
          message: t(dictionary, "account.loadError"),
          onRetry: loadAccount,
        });
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void loadAccount();

    return () => {
      cancelled = true;
    };
  }, [dictionary, reportNetworkIssue, selectedAccountId, user?.id]);

  const canEdit = role !== "viewer";

  const hasChanges = useMemo(() => {
    if (!account) return false;
    return name.trim() !== account.name.trim() || currency !== account.base_currency;
  }, [account, currency, name]);

  const accountIcon = useMemo(() => {
    const source = name.trim() || account?.name?.trim() || "";
    return source.charAt(0).toUpperCase() || "🏦";
  }, [account?.name, name]);

  const saveChanges = async () => {
    if (!selectedAccountId || !account || !canEdit || isSaving || !hasChanges) {
      return;
    }

    const normalizedName = name.trim();
    if (!normalizedName) {
      Alert.alert(
        t(dictionary, "common.errorTitle"),
        t(dictionary, "categories.nameRequired")
      );
      return;
    }

    setIsSaving(true);
    try {
      const { error: updateError } = await supabase
        .from("accounts")
        .update({ name: normalizedName, base_currency: currency })
        .eq("id", selectedAccountId);

      if (updateError) {
        throw updateError;
      }

      setAccount((previous) =>
        previous
          ? { ...previous, name: normalizedName, base_currency: currency }
          : previous
      );
      setName(normalizedName);

      Alert.alert(
        t(dictionary, "common.successTitle"),
        t(dictionary, "accountSettings.general.saveSuccess")
      );
    } catch (err) {
      console.error("[AccountGeneralSettings] Save error:", err);
      Alert.alert(
        t(dictionary, "common.errorTitle"),
        t(dictionary, "accountSettings.general.saveError")
      );
      reportNetworkIssue({
        message: t(dictionary, "accountSettings.general.saveError"),
        onRetry: saveChanges,
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (!isInitialized) {
    return (
      <View style={[styles.loading, { backgroundColor: userThemeTokens.background }]}>
        <ActivityIndicator size="large" color={colors.text.muted} />
      </View>
    );
  }

  if (!selectedAccountId) {
    return <Redirect href="/(auth)/select-account" />;
  }

  if (isLoading) {
    return (
      <View style={[styles.loading, { backgroundColor: userThemeTokens.background }]}>
        <ActivityIndicator size="large" color={colors.text.muted} />
      </View>
    );
  }

  if (error || !account) {
    return (
      <View style={[styles.errorContainer, { backgroundColor: userThemeTokens.background }]}>
        <Text style={styles.errorTitle}>{t(dictionary, "common.errorTitle")}</Text>
        <Text style={styles.errorText}>
          {error ?? t(dictionary, "account.loadError")}
        </Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={[styles.scrollContainer, { backgroundColor: userThemeTokens.background }]}
      contentContainerStyle={[
        styles.scrollContent,
        { paddingBottom: insets.bottom + tokens.spacing.xxl },
      ]}
    >
      <View style={styles.pageHeader}>
        <Text style={[styles.pageSubtitle, { color: userThemeTokens.textSecondary }]}>
          {t(dictionary, "accountSettings.general.subtitle")}
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: userThemeTokens.textPrimary }]}>
          {t(dictionary, "account.title")}
        </Text>
        <View
          style={[
            styles.formCard,
            {
              backgroundColor: userThemeTokens.surface,
              borderColor: userThemeTokens.border,
              overflow: Platform.OS === "android" ? "visible" : "hidden",
            },
          ]}
        >
          <View style={[styles.formRow, { borderBottomColor: userThemeTokens.border }]}>
            <Text style={[styles.formLabel, { color: userThemeTokens.textSecondary }]}>
              {t(dictionary, "common.iconLabel")}
            </Text>
            <View style={styles.formControl}>
              <View
                style={[
                  styles.iconPreview,
                  {
                    borderColor: userThemeTokens.border,
                    backgroundColor: userThemeTokens.surfaceAlt,
                  },
                ]}
              >
                <Text style={[styles.iconText, { color: userThemeTokens.textPrimary }]}>
                  {accountIcon}
                </Text>
              </View>
            </View>
          </View>

          <View style={[styles.formRow, { borderBottomColor: userThemeTokens.border }]}>
            <Text style={[styles.formLabel, { color: userThemeTokens.textSecondary }]}>
              {t(dictionary, "common.nameLabel")}
            </Text>
            <View style={styles.formControl}>
              <TextInput
                value={name}
                onChangeText={setName}
                editable={canEdit && !isSaving}
                style={[
                  styles.textInput,
                  {
                    borderColor: userThemeTokens.border,
                    backgroundColor: userThemeTokens.surfaceAlt,
                    color: userThemeTokens.textPrimary,
                  },
                  (!canEdit || isSaving) && styles.inputDisabled,
                ]}
                placeholder={t(dictionary, "common.nameLabel")}
                placeholderTextColor={userThemeTokens.textSecondary}
                maxLength={80}
              />
            </View>
          </View>

          <View
            style={[
              styles.formRow,
              styles.formRowLast,
              Platform.OS === "android" && styles.formRowPicker,
            ]}
          >
            <Text style={[styles.formLabel, { color: userThemeTokens.textSecondary }]}>
              {t(dictionary, "common.currencyLabel")}
            </Text>
            <View style={styles.formControl}>
              <View
                style={[
                  styles.pickerWrapper,
                  {
                    borderColor: userThemeTokens.border,
                    backgroundColor: userThemeTokens.surfaceAlt,
                    overflow: Platform.OS === "ios" ? "hidden" : "visible",
                  },
                  (!canEdit || isSaving) && styles.inputDisabled,
                ]}
              >
                <Picker
                  selectedValue={currency}
                  onValueChange={(value) => setCurrency(String(value))}
                  enabled={canEdit && !isSaving}
                  style={[styles.picker, { color: userThemeTokens.textPrimary }]}
                  dropdownIconColor={userThemeTokens.textSecondary}
                >
                  {CURRENCIES.map((option) => (
                    <Picker.Item
                      key={option.code}
                      label={`${option.code} - ${option.name}`}
                      value={option.code}
                    />
                  ))}
                </Picker>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.saveRow}>
          <Pressable
            onPress={() => {
              void saveChanges();
            }}
            disabled={!canEdit || isSaving || !hasChanges}
            style={[
              styles.saveButton,
              { backgroundColor: primaryActionColor },
              { borderColor: userThemeTokens.border },
              (!canEdit || isSaving || !hasChanges) && styles.saveButtonDisabled,
            ]}
          >
            <Text
              style={[styles.saveButtonText, { color: primaryActionTextColor }]}
            >
              {isSaving ? t(dictionary, "common.saving") : t(dictionary, "common.saveChanges")}
            </Text>
          </Pressable>

          {!canEdit ? (
            <Text style={[styles.readOnlyHint, { color: userThemeTokens.textSecondary }]}>
              {t(dictionary, "categories.readOnlyNotice")}
            </Text>
          ) : null}
        </View>
      </View>

      <View style={[styles.dangerSection, { borderTopColor: userThemeTokens.border }]}>
        <Text style={styles.dangerTitle}>{t(dictionary, "accountSettings.general.dangerTitle")}</Text>
        <View
          style={[
            styles.dangerCard,
            {
              borderColor: userThemeTokens.border,
              backgroundColor: userThemeTokens.surface,
            },
          ]}
        >
          <View style={styles.dangerInfo}>
            <Text style={[styles.dangerActionTitle, { color: userThemeTokens.textPrimary }]}>
              {t(dictionary, "accountSettings.general.deleteTitle")}
            </Text>
            <Text style={[styles.dangerDescription, { color: userThemeTokens.textSecondary }]}>
              {t(dictionary, "accountSettings.general.deleteDescription")}
            </Text>
          </View>
          <Pressable
            disabled
            style={[styles.dangerButton, { borderColor: userThemeTokens.border }]}
          >
            <Text style={styles.dangerButtonText}>{t(dictionary, "common.delete")}</Text>
          </Pressable>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollContainer: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: tokens.spacing.lg,
    paddingHorizontal: tokens.spacing.lg,
  },
  loading: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  errorContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: tokens.spacing.xl,
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
    marginBottom: tokens.spacing.xl,
  },
  pageSubtitle: {
    fontSize: tokens.typography.size.sm,
  },
  section: {
    marginBottom: tokens.spacing.xxl,
  },
  sectionTitle: {
    fontSize: tokens.typography.size.sm,
    fontWeight: tokens.typography.weight.semibold,
    marginBottom: tokens.spacing.md,
  },
  formCard: {
    borderWidth: 1,
    borderRadius: tokens.radii.lg,
    overflow: "hidden",
  },
  formRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: tokens.spacing.md,
    paddingHorizontal: tokens.spacing.lg,
    paddingVertical: tokens.spacing.md,
    borderBottomWidth: 1,
  },
  formRowLast: {
    borderBottomWidth: 0,
  },
  formRowPicker: {
    zIndex: 20,
    elevation: 20,
  },
  formLabel: {
    width: 118,
    fontSize: 13,
    fontWeight: tokens.typography.weight.medium,
  },
  formControl: {
    flex: 1,
  },
  iconPreview: {
    width: 48,
    height: 48,
    borderRadius: tokens.radii.sm,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  iconText: {
    fontSize: 22,
  },
  textInput: {
    borderWidth: 1,
    borderRadius: tokens.radii.sm,
    fontSize: tokens.typography.size.sm,
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: 10,
  },
  pickerWrapper: {
    borderWidth: 1,
    borderRadius: tokens.radii.sm,
    minHeight: 52,
    justifyContent: "center",
  },
  picker: {
    height: 52,
  },
  inputDisabled: {
    opacity: 0.65,
  },
  saveRow: {
    marginTop: tokens.spacing.lg,
    gap: tokens.spacing.sm,
  },
  saveButton: {
    borderWidth: 1,
    borderRadius: tokens.radii.sm,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    paddingHorizontal: tokens.spacing.lg,
    alignSelf: "flex-start",
    minWidth: 148,
  },
  saveButtonDisabled: {
    opacity: 0.45,
  },
  saveButtonText: {
    fontSize: tokens.typography.size.sm,
    fontWeight: tokens.typography.weight.semibold,
  },
  readOnlyHint: {
    fontSize: tokens.typography.size.xs,
  },
  dangerSection: {
    borderTopWidth: 1,
    paddingTop: tokens.spacing.xl,
  },
  dangerTitle: {
    fontSize: tokens.typography.size.xs,
    fontWeight: tokens.typography.weight.semibold,
    color: colors.state.negative,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: tokens.spacing.md,
  },
  dangerCard: {
    borderWidth: 1,
    borderRadius: tokens.radii.lg,
    padding: tokens.spacing.lg,
    gap: tokens.spacing.md,
  },
  dangerInfo: {
    gap: tokens.spacing.xs,
  },
  dangerActionTitle: {
    fontSize: tokens.typography.size.sm,
    fontWeight: tokens.typography.weight.semibold,
  },
  dangerDescription: {
    fontSize: tokens.typography.size.xs,
  },
  dangerButton: {
    borderWidth: 1,
    borderRadius: tokens.radii.sm,
    paddingHorizontal: tokens.spacing.lg,
    paddingVertical: 8,
    alignSelf: "flex-start",
  },
  dangerButtonText: {
    color: colors.state.negative,
    fontSize: tokens.typography.size.sm,
    fontWeight: tokens.typography.weight.semibold,
  },
});
