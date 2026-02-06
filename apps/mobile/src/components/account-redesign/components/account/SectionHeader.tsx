import { View, Text, StyleSheet, Pressable } from 'react-native';
import { colors, typography, spacing } from '../../theme/tokens';

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
  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>
      {actionLabel && (
        <Pressable onPress={onActionPress} hitSlop={8}>
          <Text style={styles.action}>{actionLabel}</Text>
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
    color: colors.textPrimary,
    letterSpacing: -0.2,
  },
  action: {
    fontFamily: typography.family.sansSemiBold,
    fontSize: typography.size.base,
    color: colors.accent,
  },
});
