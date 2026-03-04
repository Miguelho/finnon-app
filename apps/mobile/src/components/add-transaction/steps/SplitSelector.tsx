import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import type {
  ContributionSplitDetail,
  ContributionSplitType,
} from "@poleursus/shared";
import {
  DEFAULT_USER_AVATAR_COLOR,
  getAvatarInitials,
  USER_AVATAR_COLORS,
  USER_AVATAR_COLOR_ORDER,
} from "@poleursus/shared";
import { ProjectAmountSlider } from "../../projects/ProjectAmountSlider";

type FormParticipant = {
  userId: string;
  name: string;
  role: "viewer" | "contributor" | "admin";
};

interface SplitSelectorProps {
  value: ContributionSplitType;
  paidByBoth: boolean;
  participants: FormParticipant[];
  splitDetails: ContributionSplitDetail[] | null;
  totalAmountMinor: number;
  equalLabel: string;
  personalLabel: string;
  customLabel: string;
  equalHintText: string;
  personalHintText: string;
  customHelperText: string;
  formatTotalLabel: (total: number) => string;
  borderColor: string;
  surfaceColor: string;
  textPrimaryColor: string;
  textSecondaryColor: string;
  primaryColor: string;
  onChange: (
    splitType: ContributionSplitType,
    splitDetails?: ContributionSplitDetail[] | null
  ) => void;
}

const hashSeed = (seed: string) => {
  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash << 5) - hash + seed.charCodeAt(index);
    hash |= 0;
  }
  return Math.abs(hash);
};

const withAlpha = (hex: string, alpha: number) => {
  const normalized = hex.replace("#", "");
  const safeAlpha = Math.max(0, Math.min(1, alpha));
  const chunk =
    normalized.length === 3
      ? normalized
          .split("")
          .map((char) => `${char}${char}`)
          .join("")
      : normalized;
  const red = Number.parseInt(chunk.slice(0, 2), 16);
  const green = Number.parseInt(chunk.slice(2, 4), 16);
  const blue = Number.parseInt(chunk.slice(4, 6), 16);
  if ([red, green, blue].some((value) => Number.isNaN(value))) {
    return `rgba(0,0,0,${safeAlpha})`;
  }
  return `rgba(${red},${green},${blue},${safeAlpha})`;
};

const getParticipantPalette = (userId: string) => {
  const colorId =
    USER_AVATAR_COLOR_ORDER[hashSeed(userId) % USER_AVATAR_COLOR_ORDER.length] ??
    DEFAULT_USER_AVATAR_COLOR;
  return USER_AVATAR_COLORS[colorId];
};

const clampPercent = (value: number) => Math.min(100, Math.max(0, Math.round(value)));
const ICON_EASING = Easing.bezier(0.34, 1.56, 0.64, 1);

function EqualBarsIcon({ active, color }: { active: boolean; color: string }) {
  const first = useRef(new Animated.Value(1)).current;
  const second = useRef(new Animated.Value(1)).current;
  const hasMountedRef = useRef(false);
  const wasActiveRef = useRef(active);

  useEffect(() => {
    if (!hasMountedRef.current) {
      hasMountedRef.current = true;
      wasActiveRef.current = active;
      return;
    }

    if (active && !wasActiveRef.current) {
      first.setValue(0.3);
      second.setValue(0.3);
      Animated.timing(first, {
        toValue: 1,
        duration: 500,
        easing: ICON_EASING,
        useNativeDriver: true,
      }).start();
      Animated.timing(second, {
        toValue: 1,
        duration: 500,
        delay: 60,
        easing: ICON_EASING,
        useNativeDriver: true,
      }).start();
    } else if (!active) {
      first.setValue(1);
      second.setValue(1);
    }

    wasActiveRef.current = active;
  }, [active, first, second]);

  return (
    <View style={styles.equalIconWrap}>
      <Animated.View
        style={[
          styles.equalIconBar,
          { backgroundColor: color, transform: [{ scaleX: first }] },
        ]}
      />
      <Animated.View
        style={[
          styles.equalIconBar,
          { backgroundColor: color, transform: [{ scaleX: second }] },
        ]}
      />
    </View>
  );
}

function PersonalIcon({ active, color }: { active: boolean; color: string }) {
  const scale = useRef(new Animated.Value(1)).current;
  const hasMountedRef = useRef(false);
  const wasActiveRef = useRef(active);

  useEffect(() => {
    if (!hasMountedRef.current) {
      hasMountedRef.current = true;
      wasActiveRef.current = active;
      return;
    }

    if (active && !wasActiveRef.current) {
      scale.setValue(0.5);
      Animated.timing(scale, {
        toValue: 1,
        duration: 400,
        easing: ICON_EASING,
        useNativeDriver: true,
      }).start();
    } else if (!active) {
      scale.setValue(1);
    }

    wasActiveRef.current = active;
  }, [active, scale]);

  return (
    <Animated.Text style={[styles.personalIconText, { color, transform: [{ scale }] }]}>
      1
    </Animated.Text>
  );
}

function CustomBarsIcon({ active, color }: { active: boolean; color: string }) {
  const firstBar = useRef(new Animated.Value(1)).current;
  const secondBar = useRef(new Animated.Value(1)).current;
  const thirdBar = useRef(new Animated.Value(1)).current;
  const bars = [firstBar, secondBar, thirdBar];
  const hasMountedRef = useRef(false);
  const wasActiveRef = useRef(active);

  useEffect(() => {
    if (!hasMountedRef.current) {
      hasMountedRef.current = true;
      wasActiveRef.current = active;
      return;
    }

    if (active && !wasActiveRef.current) {
      [firstBar, secondBar, thirdBar].forEach((bar) => bar.setValue(0));
      [firstBar, secondBar, thirdBar].forEach((bar, index) => {
        Animated.timing(bar, {
          toValue: 1,
          duration: 450,
          delay: index * 60,
          easing: ICON_EASING,
          useNativeDriver: true,
        }).start();
      });
    } else if (!active) {
      [firstBar, secondBar, thirdBar].forEach((bar) => bar.setValue(1));
    }

    wasActiveRef.current = active;
  }, [active, firstBar, secondBar, thirdBar]);

  const heights = [10, 16, 12];

  return (
    <View style={styles.customIconWrap}>
      {bars.map((bar, index) => (
        <Animated.View
          key={`bar-${index + 1}`}
          style={[
            styles.customIconBar,
            {
              height: heights[index],
              backgroundColor: color,
              transform: [
                {
                  scaleY: bar,
                },
              ],
            },
          ]}
        />
      ))}
    </View>
  );
}

type SplitParticipantRowProps = {
  participant: FormParticipant;
  percent: number;
  borderColor: string;
  textPrimaryColor: string;
  onChangePercent: (value: number) => void;
};

function SplitParticipantRow({
  participant,
  percent,
  borderColor,
  textPrimaryColor,
  onChangePercent,
}: SplitParticipantRowProps) {
  const [trackWidth, setTrackWidth] = useState(0);
  const palette = getParticipantPalette(participant.userId);
  const initials = getAvatarInitials(undefined, participant.name);

  return (
    <View style={styles.sliderRow}>
      <View style={styles.sliderRowHeader}>
        <View style={styles.sliderNameWrap}>
          <View style={[styles.sliderAvatar, { backgroundColor: palette.bg }]}>
            <Text style={[styles.sliderAvatarText, { color: palette.fg }]}>{initials}</Text>
          </View>
          <Text style={[styles.sliderName, { color: textPrimaryColor }]}>{participant.name}</Text>
        </View>
        <Text style={[styles.sliderPercent, { color: textPrimaryColor }]}>{percent}%</Text>
      </View>

      <ProjectAmountSlider
        min={0}
        max={100}
        step={1}
        value={percent}
        onChange={onChangePercent}
        trackColor={borderColor}
        fillColor={withAlpha(palette.fg, 0.35)}
        thumbColor={palette.fg}
        trackWidth={trackWidth}
        onTrackLayout={setTrackWidth}
      />
    </View>
  );
}

export function SplitSelector({
  value,
  paidByBoth,
  participants,
  splitDetails,
  totalAmountMinor,
  equalLabel,
  personalLabel,
  customLabel,
  equalHintText,
  personalHintText,
  customHelperText,
  formatTotalLabel,
  borderColor,
  surfaceColor,
  textPrimaryColor,
  textSecondaryColor,
  primaryColor,
  onChange,
}: SplitSelectorProps) {
  const options = useMemo(() => participants.slice(0, 2), [participants]);
  const equalDisabled = !paidByBoth;
  const personalDisabled = paidByBoth;
  const [firstPercent, setFirstPercent] = useState(50);
  const panelProgress = useRef(new Animated.Value(value === "custom" ? 1 : 0)).current;

  const buildCustomSplit = useCallback(
    (firstPct: number) => {
      const first = options[0];
      const second = options[1];
      if (!first || !second) return null;

      const safeAmount = Math.max(0, totalAmountMinor);
      const safePercent = clampPercent(firstPct);
      const firstShare = Math.round((safePercent / 100) * safeAmount);
      const secondShare = safeAmount - firstShare;
      return [
        { userId: first.userId, shareMinor: firstShare },
        { userId: second.userId, shareMinor: secondShare },
      ];
    },
    [options, totalAmountMinor]
  );

  useEffect(() => {
    if (value === "equal" && equalDisabled) {
      onChange("personal", null);
      return;
    }
    if (value === "personal" && personalDisabled) {
      onChange("equal", null);
    }
  }, [equalDisabled, onChange, personalDisabled, value]);

  useEffect(() => {
    const first = options[0];
    if (!first) return;

    const firstDetail = (splitDetails ?? []).find((detail) => detail.userId === first.userId);
    if (totalAmountMinor <= 0 || !firstDetail) {
      setFirstPercent(50);
      return;
    }

    const pct = clampPercent((firstDetail.shareMinor / totalAmountMinor) * 100);
    setFirstPercent(pct);
  }, [options, splitDetails, totalAmountMinor]);

  useEffect(() => {
    Animated.timing(panelProgress, {
      toValue: value === "custom" ? 1 : 0,
      duration: 300,
      easing: Easing.out(Easing.ease),
      useNativeDriver: false,
    }).start();
  }, [panelProgress, value]);

  const handleSelectOption = (nextValue: ContributionSplitType) => {
    if (nextValue === "equal" && equalDisabled) return;
    if (nextValue === "personal" && personalDisabled) return;

    if (nextValue === "custom") {
      onChange("custom", buildCustomSplit(firstPercent));
      return;
    }

    onChange(nextValue, null);
  };

  const handleFirstPercentChange = (nextFirstPercent: number) => {
    const safeValue = clampPercent(nextFirstPercent);
    setFirstPercent(safeValue);
    if (value === "custom") {
      onChange("custom", buildCustomSplit(safeValue));
    }
  };

  const secondPercent = 100 - firstPercent;
  const totalPercent = firstPercent + secondPercent;

  const panelStyle = {
    height: panelProgress.interpolate({
      inputRange: [0, 1],
      outputRange: [0, 250],
    }),
    opacity: panelProgress,
  };

  const optionColor = (isActive: boolean) => (isActive ? primaryColor : textSecondaryColor);

  return (
    <View style={styles.container}>
      <View style={styles.optionGrid}>
        <Pressable
          onPress={() => handleSelectOption("equal")}
          disabled={equalDisabled}
          style={[
            styles.optionButton,
            {
              borderColor: value === "equal" ? primaryColor : borderColor,
              backgroundColor:
                value === "equal" ? withAlpha(primaryColor, 0.14) : surfaceColor,
              opacity: equalDisabled ? 0.35 : 1,
            },
          ]}
        >
          <EqualBarsIcon active={value === "equal"} color={optionColor(value === "equal")} />
          <Text style={[styles.optionLabel, { color: optionColor(value === "equal") }]}>
            {equalLabel}
          </Text>
        </Pressable>

        <Pressable
          onPress={() => handleSelectOption("personal")}
          disabled={personalDisabled}
          style={[
            styles.optionButton,
            {
              borderColor: value === "personal" ? primaryColor : borderColor,
              backgroundColor:
                value === "personal" ? withAlpha(primaryColor, 0.14) : surfaceColor,
              opacity: personalDisabled ? 0.35 : 1,
            },
          ]}
        >
          <PersonalIcon active={value === "personal"} color={optionColor(value === "personal")} />
          <Text style={[styles.optionLabel, { color: optionColor(value === "personal") }]}>
            {personalLabel}
          </Text>
        </Pressable>

        <Pressable
          onPress={() => handleSelectOption("custom")}
          style={[
            styles.optionButton,
            {
              borderColor: value === "custom" ? primaryColor : borderColor,
              backgroundColor:
                value === "custom" ? withAlpha(primaryColor, 0.14) : surfaceColor,
            },
          ]}
        >
          <CustomBarsIcon active={value === "custom"} color={optionColor(value === "custom")} />
          <Text style={[styles.optionLabel, { color: optionColor(value === "custom") }]}>
            {customLabel}
          </Text>
        </Pressable>
      </View>

      {equalDisabled || personalDisabled ? (
        <Text style={[styles.hintText, { color: textSecondaryColor }]}>
          {equalDisabled ? equalHintText : personalHintText}
        </Text>
      ) : null}

      <Animated.View
        style={[
          styles.customPanel,
          {
            borderColor,
            backgroundColor: surfaceColor,
          },
          panelStyle,
        ]}
      >
        <View style={styles.customPanelContent}>
          <Text style={[styles.customHelperText, { color: textSecondaryColor }]}>
            {customHelperText}
          </Text>
          {options.map((participant, index) => (
            <SplitParticipantRow
              key={participant.userId}
              participant={participant}
              percent={index === 0 ? firstPercent : secondPercent}
              borderColor={borderColor}
              textPrimaryColor={textPrimaryColor}
              onChangePercent={(next) =>
                handleFirstPercentChange(index === 0 ? next : 100 - next)
              }
            />
          ))}
          <Text
            style={[
              styles.totalText,
              { color: totalPercent === 100 ? "#16A34A" : "#DC2626" },
            ]}
          >
            {formatTotalLabel(totalPercent)}
          </Text>
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 10,
  },
  optionGrid: {
    flexDirection: "row",
    gap: 6,
  },
  optionButton: {
    flex: 1,
    minHeight: 98,
    borderWidth: 1.5,
    borderRadius: 12,
    paddingHorizontal: 6,
    paddingVertical: 10,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  optionLabel: {
    fontSize: 11,
    fontWeight: "600",
    textAlign: "center",
    lineHeight: 14,
  },
  equalIconWrap: {
    width: 36,
    height: 36,
    justifyContent: "center",
    alignItems: "center",
    gap: 5,
  },
  equalIconBar: {
    width: 20,
    height: 3,
    borderRadius: 999,
  },
  personalIconText: {
    fontSize: 22,
    lineHeight: 22,
    fontWeight: "700",
  },
  customIconWrap: {
    width: 36,
    height: 36,
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "center",
    gap: 3,
  },
  customIconBar: {
    width: 4,
    borderRadius: 2,
  },
  hintText: {
    fontSize: 12,
    lineHeight: 16,
  },
  customPanel: {
    overflow: "hidden",
    borderWidth: 1,
    borderRadius: 12,
  },
  customPanelContent: {
    gap: 10,
    padding: 12,
  },
  customHelperText: {
    fontSize: 12,
    lineHeight: 16,
  },
  sliderRow: {
    gap: 4,
  },
  sliderRowHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  sliderNameWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flex: 1,
  },
  sliderAvatar: {
    width: 24,
    height: 24,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  sliderAvatarText: {
    fontSize: 10,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  sliderName: {
    fontSize: 14,
    fontWeight: "500",
    flexShrink: 1,
  },
  sliderPercent: {
    width: 46,
    textAlign: "right",
    fontSize: 14,
    fontWeight: "600",
    fontVariant: ["tabular-nums"],
  },
  totalText: {
    fontSize: 12,
    fontWeight: "600",
  },
});
