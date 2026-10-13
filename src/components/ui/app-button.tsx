import { ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, ViewStyle } from 'react-native';

import { AppText } from '@/components/ui/app-text';
import { theme } from '@/constants/theme';

type AppButtonProps = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  tone?: 'primary' | 'secondary' | 'danger';
  color?: string;
};

export function AppButton({
  label,
  onPress,
  disabled,
  loading,
  tone = 'primary',
  color,
}: AppButtonProps) {
  const fill = color ?? theme.color.primary;
  const blocked = disabled || loading;
  const styleForTone: ViewStyle =
    tone === 'primary'
      ? { backgroundColor: fill, borderColor: fill }
      : tone === 'danger'
        ? { backgroundColor: theme.color.white, borderColor: theme.color.errorFill }
        : { backgroundColor: theme.color.white, borderColor: fill };

  const textColor =
    tone === 'primary' ? theme.color.white : tone === 'danger' ? theme.color.error : fill;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: blocked, busy: loading }}
      disabled={blocked}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        styleForTone,
        pressed && !blocked ? styles.pressed : null,
        blocked ? styles.disabled : null,
      ]}>
      {loading ? (
        <ActivityIndicator color={textColor} />
      ) : (
        <AppText variant="button" weight="semibold" color={textColor} style={styles.label}>
          {label}
        </AppText>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: theme.control,
    borderRadius: theme.radius,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  label: {
    textAlign: 'center',
  },
  pressed: {
    opacity: 0.86,
  },
  disabled: {
    opacity: 0.45,
  },
});
