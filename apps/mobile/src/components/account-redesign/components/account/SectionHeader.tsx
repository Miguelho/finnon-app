import { View, Text, StyleSheet, Pressable } from 'react-native';
import { typography, spacing } from '../../theme/tokens';
import { useUserTheme } from '../../../../contexts/UserThemeContext';

interface SectionHeaderProps {
  title: string;
  actionLabel?: string;
  onActionPress?: () => void;
}

export function SectionHeader({
  title,
  actionLabel,
  onActionPress,
}: SectionHeaderProps) {
  const { tokens: userTokens, primaryActionColor } = useUserTheme();

  return (
    <View style={styles.container}>
      <Text style={[styles.title, { color: userTokens.textPrimary }]}>{title}</Text>
      {actionLabel && (
        <Pressable onPress={onActionPress} hitSlop={8}>
          <Text style={[styles.action, { color: primaryActionColor }]}>{actionLabel}</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing['4xl'],
    marginBottom: spacing.lg,
    marginTop: spacing.xs,
  },
  title: {
    fontFamily: typography.family.sansBold,
    fontSize: typography.size.lg,
    letterSpacing: -0.2,
  },
  action: {
    fontFamily: typography.family.sansSemiBold,
    fontSize: typography.size.base,
  },
});
