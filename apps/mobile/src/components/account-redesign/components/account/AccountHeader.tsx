import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { typography, spacing, radii } from '../../theme/tokens';
import type { Account } from '../../types/account';
import { useUserTheme } from '../../../../contexts/UserThemeContext';

interface AccountHeaderProps {
  account: Account;
  onSettingsPress?: () => void;
  onSearchPress?: () => void;
}

export function AccountHeader({
  account,
  onSettingsPress,
  onSearchPress,
}: AccountHeaderProps) {
  const { tokens: userTokens } = useUserTheme();

  return (
    <View style={styles.container}>
      <View style={styles.left}>
        <View style={[styles.iconContainer, { backgroundColor: userTokens.surfaceAlt }]}>
          <Text style={styles.icon}>{account.icon}</Text>
        </View>
        <View>
          <Text style={[styles.name, { color: userTokens.textPrimary }]}>{account.name}</Text>
          <Text style={[styles.type, { color: userTokens.textSecondary }]}>
            {account.type} · {account.currency}
          </Text>
        </View>
      </View>

      <View style={styles.actions}>
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
          <Ionicons name="search-outline" size={16} color={userTokens.textSecondary} />
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
          <Ionicons name="settings-outline" size={16} color={userTokens.textSecondary} />
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
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: {
    fontSize: 16,
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
    gap: spacing.md,
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
