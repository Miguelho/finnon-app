import { useEffect, useMemo, useRef } from "react";
import { Animated, Easing, Pressable, StyleSheet, Text, View } from "react-native";
import {
  DEFAULT_USER_AVATAR_COLOR,
  getAvatarInitials,
  USER_AVATAR_COLORS,
  USER_AVATAR_COLOR_ORDER,
} from "@poleursus/shared";

type FormParticipant = {
  userId: string;
  name: string;
  role: "viewer" | "contributor" | "admin";
};

interface PaidBySelectorProps {
  participants: FormParticipant[];
  currentUserId: string | null;
  value: string | null;
  bothSelected: boolean;
  bothLabel: string;
  borderColor: string;
  surfaceColor: string;
  mutedTextColor: string;
  primaryColor: string;
  onChange: (value: string | null, bothSelected: boolean) => void;
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

type PayerOptionProps = {
  participant: FormParticipant;
  active: boolean;
  mutedTextColor: string;
  borderColor: string;
  surfaceColor: string;
  onPress: () => void;
};

function PayerOption({
  participant,
  active,
  mutedTextColor,
  borderColor,
  surfaceColor,
  onPress,
}: PayerOptionProps) {
  const palette = getParticipantPalette(participant.userId);
  const progress = useRef(new Animated.Value(active ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(progress, {
      toValue: active ? 1 : 0,
      duration: 200,
      easing: Easing.out(Easing.ease),
      useNativeDriver: false,
    }).start();
  }, [active, progress]);

  const initials = getAvatarInitials(undefined, participant.name);
  const animatedStyle = {
    backgroundColor: progress.interpolate({
      inputRange: [0, 1],
      outputRange: [surfaceColor, withAlpha(palette.bg, 0.7)],
    }),
    borderColor: progress.interpolate({
      inputRange: [0, 1],
      outputRange: [borderColor, withAlpha(palette.fg, 0.45)],
    }),
  };

  return (
    <Pressable onPress={onPress} style={styles.optionPressable}>
      <Animated.View style={[styles.option, animatedStyle]}>
        <View
          style={[
            styles.avatar,
            {
              backgroundColor: palette.bg,
            },
          ]}
        >
          <Text style={[styles.avatarText, { color: palette.fg }]}>{initials}</Text>
        </View>
        <Text
          numberOfLines={1}
          style={[styles.optionLabel, { color: active ? palette.fg : mutedTextColor }]}
        >
          {participant.name}
        </Text>
      </Animated.View>
    </Pressable>
  );
}

export function PaidBySelector({
  participants,
  currentUserId,
  value,
  bothSelected,
  bothLabel,
  borderColor,
  surfaceColor,
  mutedTextColor,
  primaryColor,
  onChange,
}: PaidBySelectorProps) {
  const options = useMemo(() => participants.slice(0, 2), [participants]);
  const fallbackId =
    currentUserId && options.some((member) => member.userId === currentUserId)
      ? currentUserId
      : options[0]?.userId ?? null;
  const selectedId = value ?? fallbackId;

  return (
    <View style={styles.container}>
      <View style={[styles.bothTrack, { borderColor, backgroundColor: surfaceColor }]}>
        <Pressable
          onPress={() => onChange(null, true)}
          style={[
            styles.bothButton,
            {
              borderColor: bothSelected ? primaryColor : "transparent",
              backgroundColor: bothSelected ? withAlpha(primaryColor, 0.15) : "transparent",
            },
          ]}
        >
          <View style={styles.bothAvatars}>
            {options.map((participant, index) => {
              const palette = getParticipantPalette(participant.userId);
              const initials = getAvatarInitials(undefined, participant.name);
              return (
                <View
                  key={participant.userId}
                  style={[
                    styles.bothAvatar,
                    index > 0 ? styles.bothAvatarOverlap : null,
                    { backgroundColor: palette.bg, borderColor: surfaceColor },
                  ]}
                >
                  <Text style={[styles.bothAvatarText, { color: palette.fg }]}>{initials}</Text>
                </View>
              );
            })}
          </View>
          <Text style={[styles.bothLabel, { color: bothSelected ? primaryColor : mutedTextColor }]}>
            {bothLabel}
          </Text>
        </Pressable>
      </View>

      <View style={styles.memberRow}>
        {options.map((participant) => (
          <PayerOption
            key={participant.userId}
            participant={participant}
            active={bothSelected || selectedId === participant.userId}
            mutedTextColor={mutedTextColor}
            borderColor={borderColor}
            surfaceColor={surfaceColor}
            onPress={() => onChange(participant.userId, false)}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 8,
  },
  bothTrack: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 3,
  },
  memberRow: {
    flexDirection: "row",
    gap: 6,
  },
  optionPressable: {
    flex: 1,
  },
  option: {
    minHeight: 32,
    borderWidth: 1,
    borderRadius: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingHorizontal: 8,
  },
  avatar: {
    width: 18,
    height: 18,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    fontSize: 8,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  optionLabel: {
    flexShrink: 1,
    fontSize: 12,
    fontWeight: "600",
  },
  bothButton: {
    width: "100%",
    borderWidth: 1,
    borderRadius: 9,
    paddingHorizontal: 10,
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  bothAvatars: {
    flexDirection: "row",
  },
  bothAvatar: {
    width: 18,
    height: 18,
    borderRadius: 999,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  bothAvatarOverlap: {
    marginLeft: -6,
  },
  bothAvatarText: {
    fontSize: 8,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  bothLabel: {
    fontSize: 13,
    fontWeight: "600",
  },
});
