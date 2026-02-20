import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Search, Settings } from "lucide-react-native";
import { typography, spacing, radii } from '../../theme/tokens';
import type { Account, AccountContributor } from '../../types/account';
import { useUserTheme } from '../../../../contexts/UserThemeContext';

interface AccountHeaderProps {
  account: Account;
  contributors: AccountContributor[];
  onSettingsPress?: () => void;
  onSearchPress?: () => void;
}

export function AccountHeader({
  account,
  contributors,
  onSettingsPress,
  onSearchPress,
}: AccountHeaderProps) {
  const { tokens: userTokens } = useUserTheme();
  const showContributors = contributors.length >= 2;

  return (
    <View style={styles.container}>
      <View style={styles.left}>
        <View
          style={[
            styles.iconContainer,
            {
              backgroundColor: userTokens.surfaceAlt,
              borderColor: userTokens.border,
            },
          ]}
        >
          <Text style={[styles.icon, { color: userTokens.textPrimary }]}>
            {account.icon}
          </Text>
        </View>
        <View>
          <Text style={[styles.name, { color: userTokens.textPrimary }]}>{account.name}</Text>
          <Text style={[styles.type, { color: userTokens.textSecondary }]}>
            {account.type} · {account.currency}
          </Text>
        </View>
      </View>

      <View style={styles.actions}>
        {showContributors ? (
          <View style={styles.memberAvatars}>
            {contributors.slice(0, 4).map((contributor, index) => (
              <View
                key={`${contributor.userId}-avatar`}
                style={[
                  styles.memberAvatar,
                  {
                    backgroundColor: contributor.color,
                    borderColor: userTokens.background,
                  },
                  index > 0 && styles.memberAvatarOverlap,
                ]}
              >
                <Text style={styles.memberAvatarText}>{contributor.initials}</Text>
              </View>
            ))}
          </View>
        ) : null}

        <Pressable
          style={({ pressed }) => [
            styles.iconBtn,
            {
              borderColor: userTokens.border,
              backgroundColor: userTokens.surface,
            },
            pressed && styles.iconBtnPressed,
            pressed && { backgroundColor: userTokens.surfaceAlt, borderColor: userTokens.textSecondary },
          ]}
          onPress={onSearchPress}
          hitSlop={8}
        >
          <Search size={16} color={userTokens.textSecondary} />
        </Pressable>
        <Pressable
          style={({ pressed }) => [
            styles.iconBtn,
            {
              borderColor: userTokens.border,
              backgroundColor: userTokens.surface,
            },
            pressed && styles.iconBtnPressed,
            pressed && { backgroundColor: userTokens.surfaceAlt, borderColor: userTokens.textSecondary },
          ]}
          onPress={onSettingsPress}
          hitSlop={8}
        >
          <Settings size={16} color={userTokens.textSecondary} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing['4xl'],
    paddingTop: spacing.xl,
    paddingBottom: spacing['3xl'],
  },
  left: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: radii.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: {
    fontSize: 16,
    fontFamily: typography.family.sansBold,
  },
  name: {
    fontFamily: typography.family.sansBold,
    fontSize: typography.size['2xl'],
    letterSpacing: -0.3,
  },
  type: {
    fontFamily: typography.family.sansMedium,
    fontSize: typography.size.sm,
    marginTop: 1,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  memberAvatars: {
    flexDirection: 'row',
    marginRight: spacing.sm,
  },
  memberAvatar: {
    width: 24,
    height: 24,
    borderRadius: 999,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  memberAvatarOverlap: {
    marginLeft: -8,
  },
  memberAvatarText: {
    fontFamily: typography.family.sansBold,
    fontSize: 8,
    color: "#FFFFFF",
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: radii.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBtnPressed: {
    opacity: 0.95,
  },
});
