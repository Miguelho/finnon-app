import { useEffect, useMemo, useState } from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from "react-native";
import { Path, Svg } from "react-native-svg";
import { themeTokens, type InsightViewModel, type CategoryIconKey } from "@poleursus/shared";
import { CategoryIcon } from "../CategoryIcon";

const tokens = themeTokens.light;
const colors = tokens.colors;

const ICON_SLOT_HEIGHT = 64;
const SLIDE_HEIGHT = 160;
const CATEGORY_CHIP_SIZE = 30;

const getStatusColor = (status: InsightViewModel["status"]) => {
  if (status === "positive") return colors.state.positive;
  if (status === "negative") return colors.state.negative;
  return colors.state.neutral;
};

const InsightDeltaIcon = ({ status }: { status: InsightViewModel["status"] }) => {
  const accent = getStatusColor(status);
  return (
    <Svg width={32} height={32} viewBox="0 0 32 32" fill="none">
      <Path
        d="M4 22 L12 14 L18 18 L26 10"
        stroke={colors.text.secondary}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M26 10 L26 16"
        stroke={accent}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M26 10 L20 10"
        stroke={accent}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
};

const InsightCompareIcon = ({ status }: { status: InsightViewModel["status"] }) => {
  const accent = getStatusColor(status);
  const caretPath =
    status === "negative"
      ? "M22 10 L26 6 L30 10"
      : status === "positive"
        ? "M22 6 L26 10 L30 6"
        : "M22 8 L30 8";

  return (
    <Svg width={32} height={32} viewBox="0 0 32 32" fill="none">
      <Path
        d="M8 24 V12"
        stroke={colors.text.secondary}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M14 24 V8"
        stroke={colors.text.secondary}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d={caretPath}
        stroke={accent}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
};

const CategoryIconChip = ({
  iconName,
  fallbackLetter,
}: {
  iconName?: string | null;
  fallbackLetter?: string | null;
}) => (
  <View style={styles.categoryChip}>
    {iconName ? (
      <CategoryIcon iconKey={iconName as CategoryIconKey} size={18} tone="muted" />
    ) : (
      <Text style={styles.categoryFallback}>{fallbackLetter ?? "?"}</Text>
    )}
  </View>
);

const InsightSlide = ({ insight }: { insight: InsightViewModel }) => {
  const icon = useMemo(() => {
    if (insight.iconKind === "category-icons") {
      const categories = insight.categories ?? [];
      return (
        <View style={styles.categoryGrid}>
          {categories.slice(0, 4).map((category) => (
            <CategoryIconChip
              key={category.categoryId}
              iconName={category.iconName}
              fallbackLetter={category.fallbackLetter}
            />
          ))}
        </View>
      );
    }

    if (insight.svgName === "compare") {
      return <InsightCompareIcon status={insight.status} />;
    }

    return <InsightDeltaIcon status={insight.status} />;
  }, [insight]);

  return (
    <View style={styles.slide}>
      <View style={styles.iconSlot}>{icon}</View>
      <Text style={styles.body} numberOfLines={3} ellipsizeMode="tail">
        {insight.body}
      </Text>
    </View>
  );
};

export function InsightsCarousel({ insights }: { insights: InsightViewModel[] }) {
  const [index, setIndex] = useState(0);
  const [layoutWidth, setLayoutWidth] = useState(0);
  const { width: windowWidth } = useWindowDimensions();

  const slideWidth = layoutWidth || Math.max(windowWidth - tokens.spacing.lg * 2, 1);
  const canScroll = insights.length > 1;

  useEffect(() => {
    if (index >= insights.length && insights.length > 0) {
      setIndex(0);
    }
  }, [index, insights.length]);

  const handleMomentumEnd = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (!slideWidth) return;
    const nextIndex = Math.round(event.nativeEvent.contentOffset.x / slideWidth);
    setIndex(nextIndex);
  };

  if (insights.length === 0) return null;

  return (
    <View
      style={styles.carousel}
      onLayout={(event) => setLayoutWidth(event.nativeEvent.layout.width)}
    >
      <ScrollView
        horizontal
        pagingEnabled
        scrollEnabled={canScroll}
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={handleMomentumEnd}
        snapToInterval={slideWidth}
        decelerationRate="fast"
      >
        {insights.map((insight, insightIndex) => (
          <View
            key={`${insight.id}-${insightIndex}`}
            style={[styles.slideContainer, { width: slideWidth }]}
          >
            <InsightSlide insight={insight} />
          </View>
        ))}
      </ScrollView>
      {insights.length > 1 && (
        <View style={styles.dots}>
          {insights.map((_, dotIndex) => (
            <View
              key={`dot-${dotIndex}`}
              style={[
                styles.dot,
                dotIndex === index ? styles.dotActive : undefined,
              ]}
            />
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  carousel: {
    gap: tokens.spacing.sm,
  },
  slideContainer: {
    paddingHorizontal: tokens.spacing.sm,
  },
  slide: {
    height: SLIDE_HEIGHT,
    gap: tokens.spacing.sm,
  },
  iconSlot: {
    height: ICON_SLOT_HEIGHT,
    alignItems: "center",
    justifyContent: "center",
  },
  body: {
    fontSize: tokens.typography.size.sm,
    color: colors.text.secondary,
    lineHeight: 20,
    textAlign: "center",
  },
  categoryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: tokens.spacing.xs,
    width: CATEGORY_CHIP_SIZE * 2 + tokens.spacing.xs,
  },
  categoryChip: {
    width: CATEGORY_CHIP_SIZE,
    height: CATEGORY_CHIP_SIZE,
    borderRadius: tokens.radii.md,
    borderWidth: 1,
    borderColor: colors.state.neutral,
    backgroundColor: colors.bg.secondary,
    alignItems: "center",
    justifyContent: "center",
  },
  categoryFallback: {
    fontSize: tokens.typography.size.xs,
    fontWeight: tokens.typography.weight.medium,
    color: colors.text.secondary,
  },
  dots: {
    flexDirection: "row",
    justifyContent: "center",
    gap: tokens.spacing.xs,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: tokens.radii.pill,
    backgroundColor: colors.state.neutral,
  },
  dotActive: {
    backgroundColor: colors.text.primary,
  },
});
