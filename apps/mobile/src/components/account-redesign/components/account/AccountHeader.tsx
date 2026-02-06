import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, typography, spacing, radii } from '../../theme/tokens';
import type { Account } from '../../types/account';

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
  return (
    <View style={styles.container}>
      <View style={styles.left}>
        <View style={styles.iconContainer}>
          <Text style={styles.icon}>{account.icon}</Text>
        </View>
        <View>
          <Text style={styles.name}>{account.name}</Text>
          <Text style={styles.type}>
            {account.type} · {account.currency}
          </Text>
        </View>
      </View>

      <View style={styles.actions}>
        <Pressable
          style={({ pressed }) => [styles.iconBtn, pressed && styles.iconBtnPressed]}
          onPress={onSearchPress}
          hitSlop={8}
        >
          <Ionicons name="search-outline" size={16} color={colors.textSecondary} />
        </Pressable>
        <Pressable
          style={({ pressed }) => [styles.iconBtn, pressed && styles.iconBtnPressed]}
          onPress={onSettingsPress}
          hitSlop={8}
        >
          <Ionicons name="settings-outline" size={16} color={colors.textSecondary} />
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
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: {
    fontSize: 16,
  },
  name: {
    fontFamily: typography.family.sansBold,
    fontSize: typography.size['2xl'],
    color: colors.textPrimary,
    letterSpacing: -0.3,
  },
  type: {
    fontFamily: typography.family.sansMedium,
    fontSize: typography.size.sm,
    color: colors.textTertiary,
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
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBtnPressed: {
    borderColor: colors.textSecondary,
    backgroundColor: colors.surfaceAlt,
  },
});
