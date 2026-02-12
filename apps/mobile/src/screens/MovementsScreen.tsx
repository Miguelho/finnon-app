import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  LayoutAnimation,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  UIManager,
  View,
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { PERIODS, withAlpha, type Period } from "@poleursus/shared";
import { movementsDesignTokens } from "../types/movements";
import { useMovements } from "../hooks/useMovements";
import { useMovementsStore } from "../stores/useMovementsStore";
import { MovementsSummary } from "../components/movements/MovementsSummary";
import { RecurrentSection } from "../components/movements/RecurrentSection";
import { SearchBar } from "../components/movements/SearchBar";
import { FilterRow } from "../components/movements/FilterRow";
import { MovementGroup } from "../components/movements/MovementGroup";
import { PeriodSelector } from "../components/movements/PeriodSelector";
import { useUserTheme } from "../contexts/UserThemeContext";
import { useCopy, t } from "../lib/i18n";

const movementColors = movementsDesignTokens.colors;

export default function MovementsScreen() {
  const router = useRouter();
  const { tokens: userTokens, primaryActionColor, primaryActionTextColor } =
    useUserTheme();
  const { dictionary } = useCopy();
  const params = useLocalSearchParams<{
    period?: string | string[];
    category?: string | string[];
  }>();
  const periodParam = Array.isArray(params.period) ? params.period[0] : params.period;
  const categoryParam = Array.isArray(params.category)
    ? params.category[0]
    : params.category;
  const {
    loading,
    error,
    groupedByStatus,
    filteredMovements,
    unregisteredRecurrents,
    counts,
    merchantOptions,
    categoryOptions,
    currencySymbol,
    currencyCode,
    profilesById,
    refresh,
    locale,
  } = useMovements();

  const {
    selectedPeriod,
    filters,
    isSearchMode,
    isRecurrentSectionCollapsed,
    setPeriod,
    toggleTypeFilter,
    setCategoryFilter,
    setMerchantFilter,
    setSearchQuery,
    clearFilters,
    registerRecurrent,
    registerAllRecurrents,
    setRecurrentSectionCollapsed,
    toggleRecurrentCollapse,
  } = useMovementsStore();

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isPendingCollapsed, setIsPendingCollapsed] = useState(true);
  const [isDoneCollapsed, setIsDoneCollapsed] = useState(true);

  const periodVisibility = useRef(new Animated.Value(1)).current;
  const [periodNavHeight, setPeriodNavHeight] = useState(0);

  useEffect(() => {
    if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
      UIManager.setLayoutAnimationEnabledExperimental(true);
    }
  }, []);

  useEffect(() => {
    Animated.timing(periodVisibility, {
      toValue: isSearchMode ? 0 : 1,
      duration: 220,
      useNativeDriver: false,
    }).start();
  }, [isSearchMode, periodVisibility]);

  useEffect(() => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
  }, [
    unregisteredRecurrents.length,
    isRecurrentSectionCollapsed,
    isPendingCollapsed,
    isDoneCollapsed,
  ]);

  useEffect(() => {
    if (!periodParam) return;
    const isValidPeriod = PERIODS.some((period) => period.key === periodParam);
    if (isValidPeriod) {
      setPeriod(periodParam as Period);
    }
  }, [periodParam, setPeriod]);

  useEffect(() => {
    if (!categoryParam) return;
    const categoryIds = categoryParam
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean);
    if (categoryIds.length > 0) {
      setCategoryFilter(categoryIds);
    }
    setRecurrentSectionCollapsed(false);
    setIsPendingCollapsed(false);
    setIsDoneCollapsed(false);
  }, [
    categoryParam,
    setCategoryFilter,
    setRecurrentSectionCollapsed,
    setIsPendingCollapsed,
    setIsDoneCollapsed,
  ]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refresh();
    setIsRefreshing(false);
  };

  const showPendingGroup = groupedByStatus.pending.length > 0;

  const recurrentTotal = useMemo(
    () =>
      unregisteredRecurrents.reduce((acc, item) => {
        return item.type === "income" ? acc + item.amountMinor : acc - item.amountMinor;
      }, 0n),
    [unregisteredRecurrents]
  );

  const handleRegisterRecurrent = async (id: string) => {
    try {
      await registerRecurrent(id);
    } catch (e: any) {
      Alert.alert(
        t(dictionary, "common.errorTitle"),
        e?.message || t(dictionary, "transactions.recurring.confirmError")
      );
    }
  };

  const handleRegisterAll = async () => {
    try {
      await registerAllRecurrents();
    } catch (e: any) {
      Alert.alert(
        t(dictionary, "common.errorTitle"),
        e?.message || t(dictionary, "transactions.recurring.confirmError")
      );
    }
  };

  const activeTags = useMemo(() => {
    const tags: { id: string; label: string; type: "type" | "category" | "merchant" }[] =
      [];
    filters.types.forEach((type) => {
      const label =
        type === "income"
          ? t(dictionary, "common.incomeLabel")
          : t(dictionary, "common.expenseLabel");
      tags.push({ id: type, label, type: "type" });
    });

    filters.categoryIds.forEach((id) => {
      const category = categoryOptions.find((item) => item.id === id);
      if (category) tags.push({ id, label: category.name, type: "category" });
    });

    filters.merchantNames.forEach((name) => {
      tags.push({ id: name, label: name, type: "merchant" });
    });

    return tags;
  }, [dictionary, filters.categoryIds, filters.merchantNames, filters.types, categoryOptions]);

  if (loading) {
    return (
      <View style={[styles.loading, { backgroundColor: userTokens.background }]}>
        <ActivityIndicator size="large" color={primaryActionColor} />
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.errorContainer, { backgroundColor: userTokens.background }]}>
        <Text style={[styles.errorTitle, { color: userTokens.textPrimary }]}>
          {t(dictionary, "common.errorTitle")}
        </Text>
        <Text style={[styles.errorText, { color: userTokens.textSecondary }]}>{error}</Text>
        <Pressable
          style={[styles.retryButton, { backgroundColor: primaryActionColor }]}
          onPress={refresh}
        >
          <Text style={[styles.retryText, { color: primaryActionTextColor }]}>
            {t(dictionary, "common.retry")}
          </Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={[styles.screen, { backgroundColor: userTokens.background }]}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />
        }
      >
        <Animated.View
          style={[
            styles.periodNavWrapper,
            periodNavHeight
              ? {
                  height: periodVisibility.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, periodNavHeight],
                  }),
                  opacity: periodVisibility,
                }
              : { opacity: periodVisibility },
          ]}
          onLayout={(event) => {
            if (periodNavHeight === 0) {
              setPeriodNavHeight(event.nativeEvent.layout.height);
            }
          }}
          pointerEvents={isSearchMode ? "none" : "auto"}
        >
          <View
            style={[
              styles.periodNav,
              { backgroundColor: userTokens.surface, borderColor: userTokens.border },
            ]}
          >
            <PeriodSelector selected={selectedPeriod} onSelect={setPeriod} />
          </View>
        </Animated.View>

        <MovementsSummary
          movements={filteredMovements}
          currencyCode={currencyCode}
          currencySymbol={currencySymbol}
        />

        <Pressable
          style={styles.recurrentLink}
          onPress={() => router.push("/(auth)/recurrentes")}
        >
          <Text style={[styles.recurrentLinkText, { color: primaryActionColor }]}>
            {t(dictionary, "transactions.ui.recurringLink")}
          </Text>
        </Pressable>

        {unregisteredRecurrents.length > 0 ? (
          <RecurrentSection
            recurrents={unregisteredRecurrents}
            totalAmount={recurrentTotal}
            currencyCode={currencyCode}
            currencySymbol={currencySymbol}
            onRegister={handleRegisterRecurrent}
            onRegisterAll={handleRegisterAll}
            isCollapsed={isRecurrentSectionCollapsed}
            onToggleCollapse={toggleRecurrentCollapse}
            locale={locale}
          />
        ) : null}

        <SearchBar
          value={filters.searchQuery}
          onChange={setSearchQuery}
          onClear={() => setSearchQuery("")}
        />

        {isSearchMode && (
          <View
            style={[
              styles.searchModeBar,
              { backgroundColor: withAlpha(primaryActionColor, 0.14) },
            ]}
          >
            <Text style={[styles.searchModeText, { color: primaryActionColor }]}>
              🔍 {t(dictionary, "transactions.ui.searchResultsInPeriod")}
            </Text>
            <Pressable onPress={() => setSearchQuery("")}>
              <MaterialCommunityIcons
                name="close"
                size={16}
                color={primaryActionColor}
              />
            </Pressable>
          </View>
        )}

        <FilterRow
          counts={counts}
          activeTypes={filters.types}
          onToggleType={toggleTypeFilter}
          categories={categoryOptions}
          selectedCategoryIds={filters.categoryIds}
          onCategorySelect={(id) =>
            setCategoryFilter(Array.from(new Set([...filters.categoryIds, id])))
          }
          onCategoryDeselect={(id) =>
            setCategoryFilter(filters.categoryIds.filter((value) => value !== id))
          }
          merchants={merchantOptions}
          selectedMerchants={filters.merchantNames}
          onMerchantSelect={(id) =>
            setMerchantFilter(Array.from(new Set([...filters.merchantNames, id])))
          }
          onMerchantDeselect={(id) =>
            setMerchantFilter(filters.merchantNames.filter((value) => value !== id))
          }
        />

        {activeTags.length > 0 && (
          <View style={styles.activeTags}>
            {activeTags.map((tag) => (
              <Pressable
                key={`${tag.type}:${tag.id}`}
                style={[
                  styles.activeTag,
                  { backgroundColor: withAlpha(primaryActionColor, 0.14) },
                ]}
                onPress={() => {
                  if (tag.type === "type") {
                    toggleTypeFilter(tag.id as "income" | "expense");
                  } else if (tag.type === "category") {
                    setCategoryFilter(
                      filters.categoryIds.filter((value) => value !== tag.id)
                    );
                  } else {
                    setMerchantFilter(
                      filters.merchantNames.filter((value) => value !== tag.id)
                    );
                  }
                }}
              >
                <Text style={[styles.activeTagText, { color: primaryActionColor }]}>
                  {tag.label}
                </Text>
                <MaterialCommunityIcons
                  name="close"
                  size={12}
                  color={primaryActionColor}
                />
              </Pressable>
            ))}
            <Pressable style={styles.clearAll} onPress={clearFilters}>
              <Text style={[styles.clearAllText, { color: userTokens.textSecondary }]}>
                {t(dictionary, "transactions.ui.clearAllFilters")}
              </Text>
            </Pressable>
          </View>
        )}

        {showPendingGroup && (
          <MovementGroup
            label={t(dictionary, "transactions.ui.pendingSection")}
            variant="pending"
            movements={groupedByStatus.pending}
            totalAmount={groupedByStatus.pending.reduce(
              (acc, movement) =>
                movement.type === "income"
                  ? acc + movement.amountMinor
                  : acc - movement.amountMinor,
              0n
            )}
            dotColor={movementColors.pendingAmber}
            currencyCode={currencyCode}
            currencySymbol={currencySymbol}
            profilesById={profilesById}
            locale={locale}
            isCollapsed={isPendingCollapsed}
            onToggleCollapse={() => setIsPendingCollapsed((prev) => !prev)}
            onPressMovement={(id) => router.push(`/(auth)/transactions/${id}`)}
          />
        )}

        <MovementGroup
          label={t(dictionary, "transactions.ui.doneSection")}
          variant="done"
          movements={groupedByStatus.confirmed}
          totalAmount={groupedByStatus.confirmed.reduce(
            (acc, movement) =>
              movement.type === "income"
                ? acc + movement.amountMinor
                : acc - movement.amountMinor,
            0n
          )}
          dotColor={movementColors.incomeGreen}
          currencyCode={currencyCode}
          currencySymbol={currencySymbol}
          profilesById={profilesById}
          locale={locale}
          onPressMovement={(id) => router.push(`/(auth)/transactions/${id}`)}
          isCollapsed={isDoneCollapsed}
          onToggleCollapse={() => setIsDoneCollapsed((prev) => !prev)}
        />
      </ScrollView>

    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  content: {
    padding: 16,
    paddingBottom: 120,
    gap: 16,
  },
  loading: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  errorTitle: {
    fontSize: movementsDesignTokens.typography.sizes.xl,
    fontFamily: "DMSans-Bold",
  },
  errorText: {
    marginTop: 8,
    fontSize: movementsDesignTokens.typography.sizes.sm,
    textAlign: "center",
    fontFamily: "DMSans",
  },
  retryButton: {
    marginTop: 12,
    borderRadius: movementsDesignTokens.radius.md,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  retryText: {
    fontFamily: "DMSans-SemiBold",
  },
  periodNavWrapper: {
    overflow: "hidden",
  },
  periodNav: {
    borderRadius: movementsDesignTokens.radius.md,
    borderWidth: 1,
    paddingVertical: 10,
    paddingHorizontal: 8,
  },
  recurrentLink: {
    alignSelf: "flex-end",
    paddingHorizontal: 2,
    paddingVertical: 2,
  },
  recurrentLinkText: {
    fontSize: movementsDesignTokens.typography.sizes.sm,
    fontFamily: "DMSans-Medium",
  },
  searchModeBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderRadius: movementsDesignTokens.radius.md,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  searchModeText: {
    fontSize: movementsDesignTokens.typography.sizes.sm,
    fontFamily: "DMSans-Medium",
  },
  activeTags: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    alignItems: "center",
  },
  activeTag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: movementsDesignTokens.radius.full,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  activeTagText: {
    fontSize: movementsDesignTokens.typography.sizes.xs,
    fontFamily: "DMSans-Medium",
  },
  clearAll: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  clearAllText: {
    fontSize: movementsDesignTokens.typography.sizes.xs,
    fontFamily: "DMSans-Medium",
  },
});
