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
import { PERIODS, type Period } from "@poleursus/shared";
import { movementsDesignTokens } from "../types/movements";
import { useMovements } from "../hooks/useMovements";
import { useMovementsStore } from "../stores/useMovementsStore";
import { SummaryCards } from "../components/movements/SummaryCards";
import { RecurrentSection } from "../components/movements/RecurrentSection";
import { SearchBar } from "../components/movements/SearchBar";
import { FilterRow } from "../components/movements/FilterRow";
import { MovementGroup } from "../components/movements/MovementGroup";
import { PeriodSelector } from "../components/movements/PeriodSelector";

const colors = movementsDesignTokens.colors;

export default function MovementsScreen() {
  const router = useRouter();
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
    summary,
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
      Alert.alert("Error", e?.message || "No se pudo registrar el recurrente");
    }
  };

  const handleRegisterAll = async () => {
    try {
      await registerAllRecurrents();
    } catch (e: any) {
      Alert.alert("Error", e?.message || "No se pudieron registrar los recurrentes");
    }
  };

  const activeTags = useMemo(() => {
    const tags: { id: string; label: string; type: "type" | "category" | "merchant" }[] =
      [];
    filters.types.forEach((type) => {
      const label = type === "income" ? "Ingresos" : "Gastos";
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
  }, [filters.categoryIds, filters.merchantNames, filters.types, categoryOptions]);

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={colors.accentBlue} />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorTitle}>Ups</Text>
        <Text style={styles.errorText}>{error}</Text>
        <Pressable style={styles.retryButton} onPress={refresh}>
          <Text style={styles.retryText}>Reintentar</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
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
          <View style={styles.periodNav}>
            <PeriodSelector selected={selectedPeriod} onSelect={setPeriod} />
            <Pressable
              style={styles.recurrentLink}
              onPress={() => router.push("/(auth)/recurrentes")}
            >
              <Text style={styles.recurrentLinkText}>Recurrentes →</Text>
            </Pressable>
          </View>
        </Animated.View>

        <SummaryCards
          summary={summary}
          currencyCode={currencyCode}
          currencySymbol={currencySymbol}
        />

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
          <View style={styles.searchModeBar}>
            <Text style={styles.searchModeText}>
              🔍 Mostrando resultados del periodo seleccionado
            </Text>
            <Pressable onPress={() => setSearchQuery("")}>
              <MaterialCommunityIcons name="close" size={16} color={colors.accentBlue} />
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
                style={styles.activeTag}
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
                <Text style={styles.activeTagText}>{tag.label}</Text>
                <MaterialCommunityIcons name="close" size={12} color={colors.accentBlue} />
              </Pressable>
            ))}
            <Pressable style={styles.clearAll} onPress={clearFilters}>
              <Text style={styles.clearAllText}>Limpiar todo</Text>
            </Pressable>
          </View>
        )}

        {showPendingGroup && (
          <MovementGroup
            label="Pendientes"
            variant="pending"
            movements={groupedByStatus.pending}
            totalAmount={groupedByStatus.pending.reduce(
              (acc, movement) =>
                movement.type === "income"
                  ? acc + movement.amountMinor
                  : acc - movement.amountMinor,
              0n
            )}
            dotColor={colors.pendingAmber}
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
          label="Realizados"
          variant="done"
          movements={groupedByStatus.confirmed}
          totalAmount={groupedByStatus.confirmed.reduce(
            (acc, movement) =>
              movement.type === "income"
                ? acc + movement.amountMinor
                : acc - movement.amountMinor,
            0n
          )}
          dotColor={colors.incomeGreen}
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
    backgroundColor: colors.bg,
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
    backgroundColor: colors.bg,
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
    backgroundColor: colors.bg,
  },
  errorTitle: {
    fontSize: movementsDesignTokens.typography.sizes.xl,
    fontFamily: "DMSans-Bold",
    color: colors.textPrimary,
  },
  errorText: {
    marginTop: 8,
    fontSize: movementsDesignTokens.typography.sizes.sm,
    color: colors.textSecondary,
    textAlign: "center",
    fontFamily: "DMSans",
  },
  retryButton: {
    marginTop: 12,
    backgroundColor: colors.accentBlue,
    borderRadius: movementsDesignTokens.radius.md,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  retryText: {
    color: colors.surface,
    fontFamily: "DMSans-SemiBold",
  },
  periodNavWrapper: {
    overflow: "hidden",
  },
  periodNav: {
    backgroundColor: colors.surface,
    borderRadius: movementsDesignTokens.radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 12,
    paddingHorizontal: 8,
  },
  recurrentLink: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  recurrentLinkText: {
    fontSize: movementsDesignTokens.typography.sizes.sm,
    color: colors.accentBlue,
    fontFamily: "DMSans-Medium",
  },
  searchModeBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.accentBlueBg,
    borderRadius: movementsDesignTokens.radius.md,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  searchModeText: {
    fontSize: movementsDesignTokens.typography.sizes.sm,
    color: colors.accentBlue,
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
    backgroundColor: colors.accentBlueBg,
    borderRadius: movementsDesignTokens.radius.full,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  activeTagText: {
    fontSize: movementsDesignTokens.typography.sizes.xs,
    color: colors.accentBlue,
    fontFamily: "DMSans-Medium",
  },
  clearAll: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  clearAllText: {
    fontSize: movementsDesignTokens.typography.sizes.xs,
    color: colors.textSecondary,
    fontFamily: "DMSans-Medium",
  },
});
