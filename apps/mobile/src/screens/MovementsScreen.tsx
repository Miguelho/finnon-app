import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  LayoutAnimation,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  UIManager,
  View,
} from "react-native";
import { Picker } from "@react-native-picker/picker";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { movementsDesignTokens } from "../types/movements";
import { useMovements } from "../hooks/useMovements";
import { useMovementsStore } from "../stores/useMovementsStore";
import { SummaryCards } from "../components/movements/SummaryCards";
import { RecurrentSection } from "../components/movements/RecurrentSection";
import { SearchBar } from "../components/movements/SearchBar";
import { FilterRow } from "../components/movements/FilterRow";
import { MovementGroup } from "../components/movements/MovementGroup";

const colors = movementsDesignTokens.colors;

export default function MovementsScreen() {
  const router = useRouter();
  const {
    loading,
    error,
    monthLabel,
    groupedByStatus,
    summary,
    unregisteredRecurrents,
    counts,
    merchantOptions,
    categoryOptions,
    currencySymbol,
    currencyCode,
    profilesById,
    isCurrentOrFutureMonth,
    refresh,
    locale,
  } = useMovements();

  const {
    selectedMonth,
    filters,
    isSearchMode,
    isRecurrentSectionCollapsed,
    setMonth,
    toggleTypeFilter,
    setCategoryFilter,
    setMerchantFilter,
    setSearchQuery,
    clearFilters,
    registerRecurrent,
    registerAllRecurrents,
    toggleRecurrentCollapse,
  } = useMovementsStore();

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isMonthPickerOpen, setIsMonthPickerOpen] = useState(false);
  const [pickerYear, setPickerYear] = useState(selectedMonth.year);
  const [pickerMonthIndex, setPickerMonthIndex] = useState(
    selectedMonth.month - 1
  );
  const [isPendingCollapsed, setIsPendingCollapsed] = useState(true);
  const [isDoneCollapsed, setIsDoneCollapsed] = useState(true);

  const monthVisibility = useRef(new Animated.Value(1)).current;
  const [monthNavHeight, setMonthNavHeight] = useState(0);

  useEffect(() => {
    if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
      UIManager.setLayoutAnimationEnabledExperimental(true);
    }
  }, []);

  useEffect(() => {
    Animated.timing(monthVisibility, {
      toValue: isSearchMode ? 0 : 1,
      duration: 220,
      useNativeDriver: false,
    }).start();
  }, [isSearchMode, monthVisibility]);

  useEffect(() => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
  }, [
    unregisteredRecurrents.length,
    isRecurrentSectionCollapsed,
    isPendingCollapsed,
    isDoneCollapsed,
  ]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refresh();
    setIsRefreshing(false);
  };

  const handlePrevMonth = () => {
    const date = new Date(selectedMonth.year, selectedMonth.month - 2, 1);
    setMonth(date.getMonth() + 1, date.getFullYear());
  };

  const handleNextMonth = () => {
    const date = new Date(selectedMonth.year, selectedMonth.month, 1);
    setMonth(date.getMonth() + 1, date.getFullYear());
  };

  const openMonthPicker = () => {
    setPickerYear(selectedMonth.year);
    setPickerMonthIndex(selectedMonth.month - 1);
    setIsMonthPickerOpen(true);
  };

  const applyMonthPicker = () => {
    setMonth(pickerMonthIndex + 1, pickerYear);
    setIsMonthPickerOpen(false);
  };

  const formattedMonthLabel = useMemo(() => {
    if (!monthLabel) return "";
    return monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1);
  }, [monthLabel]);

  const showPendingGroup =
    isCurrentOrFutureMonth && groupedByStatus.pending.length > 0;

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
            styles.monthNavWrapper,
            monthNavHeight
              ? {
                  height: monthVisibility.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, monthNavHeight],
                  }),
                  opacity: monthVisibility,
                }
              : { opacity: monthVisibility },
          ]}
          onLayout={(event) => {
            if (monthNavHeight === 0) {
              setMonthNavHeight(event.nativeEvent.layout.height);
            }
          }}
          pointerEvents={isSearchMode ? "none" : "auto"}
        >
          <View style={styles.monthNav}>
            <Pressable style={styles.monthNavButton} onPress={handlePrevMonth}>
              <MaterialCommunityIcons name="chevron-left" size={22} color={colors.textPrimary} />
            </Pressable>
            <Text style={styles.monthLabel}>{formattedMonthLabel}</Text>
            <Pressable style={styles.monthNavButton} onPress={handleNextMonth}>
              <MaterialCommunityIcons name="chevron-right" size={22} color={colors.textPrimary} />
            </Pressable>
            <Pressable style={styles.calendarButton} onPress={openMonthPicker}>
              <MaterialCommunityIcons name="calendar-month" size={18} color={colors.textPrimary} />
            </Pressable>
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

        {isCurrentOrFutureMonth && unregisteredRecurrents.length > 0 ? (
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
              🔍 Mostrando resultados de todos los meses
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

      <Modal
        transparent
        visible={isMonthPickerOpen}
        animationType="slide"
        onRequestClose={() => setIsMonthPickerOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Selecciona un mes</Text>
            <View style={styles.pickerRow}>
              <Picker
                selectedValue={pickerMonthIndex}
                onValueChange={(value) => setPickerMonthIndex(value as number)}
                style={styles.picker}
              >
                {Array.from({ length: 12 }).map((_, index) => (
                  <Picker.Item
                    key={index}
                    label={new Date(2000, index, 1).toLocaleDateString(locale ?? "es", {
                      month: "long",
                    })}
                    value={index}
                  />
                ))}
              </Picker>
              <Picker
                selectedValue={pickerYear}
                onValueChange={(value) => setPickerYear(value as number)}
                style={styles.picker}
              >
                {Array.from({ length: 11 }).map((_, index) => {
                  const year = new Date().getFullYear() - 5 + index;
                  return <Picker.Item key={year} label={`${year}`} value={year} />;
                })}
              </Picker>
            </View>
            <View style={styles.modalActions}>
              <Pressable
                style={[styles.modalButton, styles.modalCancel]}
                onPress={() => setIsMonthPickerOpen(false)}
              >
                <Text style={styles.modalCancelText}>Cancelar</Text>
              </Pressable>
              <Pressable style={styles.modalButton} onPress={applyMonthPicker}>
                <Text style={styles.modalApplyText}>Aplicar</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
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
  monthNavWrapper: {
    overflow: "hidden",
  },
  monthNav: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: colors.surface,
    borderRadius: movementsDesignTokens.radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
  },
  monthNavButton: {
    width: 32,
    height: 32,
    borderRadius: movementsDesignTokens.radius.full,
    backgroundColor: colors.chipBg,
    alignItems: "center",
    justifyContent: "center",
  },
  monthLabel: {
    flex: 1,
    textAlign: "center",
    fontSize: movementsDesignTokens.typography.sizes.md,
    color: colors.textPrimary,
    fontFamily: "DMSans-SemiBold",
  },
  calendarButton: {
    width: 32,
    height: 32,
    borderRadius: movementsDesignTokens.radius.full,
    backgroundColor: colors.chipBg,
    alignItems: "center",
    justifyContent: "center",
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
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.35)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: colors.surface,
    padding: 16,
    borderTopLeftRadius: movementsDesignTokens.radius.lg,
    borderTopRightRadius: movementsDesignTokens.radius.lg,
  },
  modalTitle: {
    fontSize: movementsDesignTokens.typography.sizes.lg,
    fontFamily: "DMSans-SemiBold",
    color: colors.textPrimary,
  },
  pickerRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 12,
  },
  picker: {
    flex: 1,
  },
  modalActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 8,
    marginTop: 12,
  },
  modalButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: movementsDesignTokens.radius.md,
    backgroundColor: colors.accentBlue,
  },
  modalCancel: {
    backgroundColor: colors.chipBg,
  },
  modalCancelText: {
    color: colors.textSecondary,
    fontFamily: "DMSans-Medium",
  },
  modalApplyText: {
    color: colors.surface,
    fontFamily: "DMSans-SemiBold",
  },
});
