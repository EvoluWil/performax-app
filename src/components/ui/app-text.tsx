import { ReactNode } from 'react';
import { Text, TextProps, TextStyle } from 'react-native';

import { theme } from '@/constants/theme';

type AppTextProps = TextProps & {
  children: ReactNode;
  variant?: 'body' | 'title' | 'meta' | 'button';
  color?: string;
  weight?: 'regular' | 'semibold' | 'bold';
};

export function AppText({
  children,
  variant = 'body',
  color = theme.color.text,
  weight,
  style,
  ...props
}: AppTextProps) {
  const resolvedWeight = weight ?? (variant === 'title' || variant === 'button' ? 'semibold' : 'regular');
  const variantStyle: TextStyle = {
    body: { fontSize: theme.text.body, lineHeight: 26 },
    title: { fontSize: theme.text.title, lineHeight: 34 },
    meta: { fontSize: theme.text.meta, lineHeight: 22, color: theme.color.muted },
    button: { fontSize: theme.text.body, lineHeight: 24 },
  }[variant];

  return (
    <Text
      allowFontScaling
      {...props}
      style={[
        { fontFamily: theme.font[resolvedWeight], color: variant === 'meta' ? theme.color.muted : color },
        variantStyle,
        style,
      ]}>
      {children}
    </Text>
  );
}
