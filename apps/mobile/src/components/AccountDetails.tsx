import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { supabase } from "../lib/supabase";
import { useAuth } from "../contexts/AuthContext";
import { Card } from "./Card";
import { CategoryIcon } from "./CategoryIcon";
import { useNetworkNotice } from "../contexts/NetworkNoticeContext";
import { useCopy, t } from "../lib/i18n";
import { ConfirmationModal, signOutAndReset, themeTokens } from "@poleursus/shared";

type Account = {
  id: string;
  name: string;
  base_currency: string;
};

type MemberProfile = {
  user_id: string;
  role: "viewer" | "contributor" | "admin";
  name: string | null;
  email: string | null;
};

type Category = {
  id: string;
  account_id: string;
  name: string;
  icon_id: string;
  type: "income" | "expense";
  created_at: string;
};

type AccountDetailsProps = {
  accountId: string;
  showSignOut?: boolean;
};

export function AccountDetails({ accountId, showSignOut = false }: AccountDetailsProps) {
  const { user, clearSelectedAccount, setSelectedAccountId } = useAuth();
  const { dictionary } = useCopy();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { reportNetworkIssue } = useNetworkNotice();

  const [account, setAccount] = useState<Account | null>(null);
  const [members, setMembers] = useState<MemberProfile[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [categoriesError, setCategoriesError] = useState<string | null>(null);
  const [categoriesLoading, setCategoriesLoading] = useState(false);
  const [isSignOutOpen, setIsSignOutOpen] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);

  const closeSignOutModal = () => {
    if (!isSigningOut) setIsSignOutOpen(false);
  };

  useEffect(() => {
    if (!accountId) return;
    setSelectedAccountId(accountId);
  }, [accountId, setSelectedAccountId]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!accountId) return;

      setLoading(true);
      setError(null);
      setCategoriesError(null);

      try {
        const { data: accountData, error: accountError } = await supabase
          .from("accounts")
          .select("id, name, base_currency")
          .eq("id", accountId)
          .single();

        if (accountError) {
          if (accountError.code === "PGRST116") {
            if (showSignOut) {
              await clearSelectedAccount();
              router.replace("/(auth)/select-account");
              return;
            }
            if (!cancelled) {
              setError(t(dictionary, "errors.accountNotFoundOrDenied"));
            }
            return;
          }

          throw accountError;
        }

        if (!cancelled) {
          setAccount(accountData as Account);
        }

        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          throw new Error(t(dictionary, "account.noSessionError"));
        }

        const apiUrl = process.env.EXPO_PUBLIC_API_URL || "http://localhost:3000";
        const response = await fetch(`${apiUrl}/api/profiles`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ accountId }),
        });

        if (!response.ok) {
          const errorBody = await response.json().catch(() => ({}));
          throw new Error(errorBody.error || t(dictionary, "account.participantsLoadError"));
        }

        const payload = await response.json();
        if (!cancelled) {
          setMembers((payload?.members ?? []) as MemberProfile[]);
        }

        setCategoriesLoading(true);
        try {
          const { data: categoryData, error: categoryError } = await supabase
            .from("categories")
            .select("id, account_id, name, icon_id, type, created_at")
            .eq("account_id", accountId)
            .order("name", { ascending: true });

          if (categoryError) {
            throw categoryError;
          }

          if (!cancelled) {
            setCategories((categoryData ?? []) as Category[]);
          }
        } catch (categoryErr: any) {
          console.error("[AccountDetail] Categories load error:", categoryErr);
          if (!cancelled) {
            setCategoriesError(
              categoryErr?.message ?? t(dictionary, "categories.loadError")
            );
            setCategories([]);
          }
        } finally {
          if (!cancelled) {
            setCategoriesLoading(false);
          }
        }
      } catch (err: any) {
        console.error("[AccountDetail] Error:", err);
        if (!cancelled) {
          setError(err?.message ?? t(dictionary, "account.loadError"));
        }
        reportNetworkIssue({ onRetry: load });
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [
    accountId,
    clearSelectedAccount,
    dictionary,
    reportNetworkIssue,
    router,
    showSignOut,
  ]);

  const handleSignOut = async () => {
    setIsSigningOut(true);

    try {
      await signOutAndReset({
        signOut: () => supabase.auth.signOut(),
        clearLocalSessionArtifacts: clearSelectedAccount,
        onReset: async () => {
          setIsSignOutOpen(false);
        },
        onNavigate: () => {
          router.replace("/(auth)/login");
        },
      });
    } catch (err) {
      console.error("[AccountDetail] Sign out failed:", err);
      reportNetworkIssue({
        message: t(dictionary, "settings.signOut.error"),
        onRetry: handleSignOut,
      });
    } finally {
      setIsSigningOut(false);
    }
  };

  if (!accountId) {
    return (
      <View style={[styles.loading, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={colors.text.muted} />
      </View>
    );
  }

  if (loading) {
    return (
      <View style={[styles.loading, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={colors.text.muted} />
      </View>
    );
  }

  if (error) {
    return (
      <View
        style={[
          styles.container,
          { paddingTop: tokens.spacing.lg + insets.top, paddingBottom: insets.bottom },
        ]}
      >
        <Card title={t(dictionary, "account.errorTitle")} description={error}>
          <Text style={styles.errorText}>{t(dictionary, "account.errorDescription")}</Text>
        </Card>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.scrollContainer}
      contentContainerStyle={[
        styles.scroll,
        {
          paddingTop: tokens.spacing.lg + insets.top,
          paddingBottom: tokens.spacing.lg + insets.bottom,
        },
      ]}
    >
      <Card
        title={t(dictionary, "account.title")}
        description={t(dictionary, "account.description")}
      >
        <View style={styles.section}>
          <Text style={styles.value}>{account?.name ?? "-"}</Text>
          <Text style={styles.meta}>
            {t(dictionary, "account.baseCurrencyLabel", {
              currency: account?.base_currency ?? "-",
            })}
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            {t(dictionary, "account.participantsLabel", { count: members.length })}
          </Text>
          {members.length === 0 ? (
            <Text style={styles.empty}>{t(dictionary, "account.participantsEmpty")}</Text>
          ) : (
            <View style={styles.memberList}>
              {members.map((member) => {
                const isCurrentUser = member.user_id === user?.id;
                const fallback = t(dictionary, "account.memberFallback", {
                  id: member.user_id.slice(0, 6),
                });
                const displayName =
                  member.name ||
                  member.email ||
                  (isCurrentUser ? t(dictionary, "account.youLabel") : fallback);
                return (
                  <View
                    key={`${member.user_id}-${member.role}`}
                    style={styles.memberRow}
                  >
                    <View style={styles.memberInfo}>
                      <Text style={styles.memberName}>
                        {isCurrentUser ? t(dictionary, "account.youLabel") : displayName}
                      </Text>
                      {member.email && !isCurrentUser && (
                        <Text style={styles.memberMeta}>{member.email}</Text>
                      )}
                    </View>
                    <View style={styles.memberRoleBadge}>
                      <Text style={styles.memberRoleText}>{member.role}</Text>
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </View>

        <View style={styles.sectionDivider} />

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            {t(dictionary, "account.categoriesLabel", {
              count: categories.length,
            })}
          </Text>
          <Text style={styles.sectionSubtitle}>
            {t(dictionary, "account.categoriesSubtitle")}
          </Text>

          {categoriesLoading ? (
            <Text style={styles.empty}>{t(dictionary, "common.loading")}</Text>
          ) : categoriesError ? (
            <Text style={styles.empty}>{categoriesError}</Text>
          ) : categories.length === 0 ? (
            <Text style={styles.empty}>{t(dictionary, "categories.emptyAll")}</Text>
          ) : (
            <View style={styles.categoryList}>
              {categories.map((category) => (
                <TouchableOpacity
                  key={category.id}
                  style={styles.categoryRow}
                  onPress={() =>
                    router.push(
                      `/(auth)/(tabs)/account/categories/${category.id}/edit`
                    )
                  }
                >
                  <View style={styles.categoryInfo}>
                    <View style={styles.categoryIconBadge}>
                      <CategoryIcon
                        iconKey={category.icon_id}
                        size={16}
                        tone="muted"
                        accessibilityLabel={category.name}
                      />
                    </View>
                    <Text style={styles.categoryName} numberOfLines={1}>
                      {category.name}
                    </Text>
                  </View>
                  <View style={styles.categoryTypeBadge}>
                    <Text style={styles.categoryTypeText}>
                      {category.type === "income"
                        ? t(dictionary, "categories.incomeLabel")
                        : t(dictionary, "categories.expenseLabel")}
                    </Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          )}

          <TouchableOpacity
            onPress={() =>
              router.push("/(auth)/(tabs)/account/categories/create")
            }
            style={styles.addCategoryLink}
          >
            <Text style={styles.addCategoryText}>
              + {t(dictionary, "account.categoriesAddLabel")}
            </Text>
          </TouchableOpacity>
        </View>

        {showSignOut && (
          <View style={styles.signOutSection}>
            <View style={styles.sectionDivider} />
            <TouchableOpacity
              onPress={() => setIsSignOutOpen(true)}
              disabled={isSigningOut}
              style={styles.signOutRow}
            >
              <View>
                <Text style={styles.signOutTitle}>
                  {t(dictionary, "settings.signOut.label")}
                </Text>
                <Text style={styles.signOutDescription}>
                  {t(dictionary, "settings.signOut.description")}
                </Text>
              </View>
              <Text style={styles.signOutChevron}>›</Text>
            </TouchableOpacity>
          </View>
        )}
      </Card>

      {showSignOut ? (
        <ConfirmationModal
          open={isSignOutOpen}
          title={t(dictionary, "settings.signOut.confirmTitle")}
          description={t(dictionary, "settings.signOut.confirmDescription")}
          confirmLabel={t(dictionary, "settings.signOut.confirmAction")}
          cancelLabel={t(dictionary, "settings.signOut.confirmCancel")}
          onConfirm={handleSignOut}
          onCancel={closeSignOutModal}
          confirmLoading={isSigningOut}
          confirmDisabled={isSigningOut}
          cancelDisabled={isSigningOut}
          dismissOnBackdrop={!isSigningOut}
          tone="destructive"
        />
      ) : null}
    </ScrollView>
  );
}

const tokens = themeTokens.light;
const colors = tokens.colors;

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: colors.bg.secondary,
  },
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: colors.bg.secondary,
    padding: tokens.spacing.lg,
  },
  scrollContainer: {
    flex: 1,
    backgroundColor: colors.bg.secondary,
  },
  scroll: {
    flexGrow: 1,
    backgroundColor: colors.bg.secondary,
    paddingHorizontal: tokens.spacing.lg,
    paddingBottom: tokens.spacing.lg,
  },
  section: {
    marginBottom: tokens.spacing.lg,
  },
  sectionTitle: {
    fontSize: tokens.typography.size.sm,
    fontWeight: tokens.typography.weight.semibold,
    color: colors.text.primary,
    marginBottom: tokens.spacing.xs,
  },
  sectionSubtitle: {
    fontSize: tokens.typography.size.sm,
    color: colors.text.secondary,
    marginBottom: tokens.spacing.sm,
  },
  value: {
    fontSize: tokens.typography.size.xl,
    fontWeight: tokens.typography.weight.semibold,
    color: colors.text.primary,
    marginBottom: tokens.spacing.xs,
  },
  meta: {
    fontSize: tokens.typography.size.sm,
    color: colors.text.secondary,
  },
  memberList: {
    gap: tokens.spacing.sm,
  },
  memberRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: tokens.spacing.md,
    borderWidth: 1,
    borderColor: colors.state.neutral,
    borderRadius: tokens.radii.md,
    backgroundColor: colors.bg.surface,
  },
  memberInfo: {
    flex: 1,
  },
  memberName: {
    fontSize: tokens.typography.size.md,
    fontWeight: tokens.typography.weight.medium,
    color: colors.text.primary,
  },
  memberMeta: {
    fontSize: tokens.typography.size.xs,
    color: colors.text.secondary,
    marginTop: tokens.spacing.xs,
  },
  memberRoleBadge: {
    backgroundColor: colors.action.secondary,
    paddingHorizontal: tokens.spacing.sm,
    paddingVertical: tokens.spacing.xs,
    borderRadius: tokens.radii.pill,
  },
  memberRoleText: {
    fontSize: tokens.typography.size.xs,
    fontWeight: tokens.typography.weight.semibold,
    color: colors.text.primary,
    textTransform: "capitalize",
  },
  empty: {
    fontSize: tokens.typography.size.sm,
    color: colors.text.secondary,
  },
  sectionDivider: {
    height: 1,
    backgroundColor: colors.state.neutral,
    marginBottom: tokens.spacing.md,
  },
  categoryList: {
    gap: tokens.spacing.sm,
    marginBottom: tokens.spacing.sm,
  },
  categoryRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: tokens.spacing.md,
    borderWidth: 1,
    borderColor: colors.state.neutral,
    borderRadius: tokens.radii.md,
    backgroundColor: colors.bg.surface,
  },
  categoryInfo: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    gap: tokens.spacing.sm,
  },
  categoryIconBadge: {
    width: 32,
    height: 32,
    borderRadius: tokens.radii.sm,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.bg.secondary,
  },
  categoryName: {
    flex: 1,
    fontSize: tokens.typography.size.md,
    fontWeight: tokens.typography.weight.medium,
    color: colors.text.primary,
  },
  categoryTypeBadge: {
    backgroundColor: colors.action.secondary,
    paddingHorizontal: tokens.spacing.sm,
    paddingVertical: tokens.spacing.xs,
    borderRadius: tokens.radii.pill,
  },
  categoryTypeText: {
    fontSize: tokens.typography.size.xs,
    fontWeight: tokens.typography.weight.semibold,
    color: colors.text.primary,
    textTransform: "capitalize",
  },
  addCategoryLink: {
    paddingVertical: tokens.spacing.xs,
  },
  addCategoryText: {
    fontSize: tokens.typography.size.sm,
    fontWeight: tokens.typography.weight.semibold,
    color: colors.action.primary,
  },
  errorText: {
    color: colors.state.negative,
    fontSize: tokens.typography.size.sm,
    textAlign: "center",
  },
  signOutSection: {
    marginTop: tokens.spacing.md,
  },
  signOutRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: tokens.spacing.sm,
  },
  signOutTitle: {
    fontSize: tokens.typography.size.md,
    fontWeight: tokens.typography.weight.semibold,
    color: colors.state.negative,
  },
  signOutDescription: {
    fontSize: tokens.typography.size.sm,
    color: colors.text.secondary,
    marginTop: tokens.spacing.xs,
  },
  signOutChevron: {
    fontSize: tokens.typography.size.xl,
    color: colors.text.muted,
    marginLeft: tokens.spacing.md,
  },
});
