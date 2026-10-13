import { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/ui/app-text';
import { theme } from '@/constants/theme';
import { useOffline } from '@/hooks/use-offline';

export function Screen({
  children,
  header,
}: {
  children: ReactNode;
  header?: ReactNode;
}) {
  const insets = useSafeAreaInsets();
  const offline = useOffline();

  return (
    <View style={[styles.screen, { paddingBottom: insets.bottom }]}>
      {header}
      {offline ? (
        <View style={styles.offline} accessibilityRole="alert">
          <AppText weight="semibold" color={theme.color.warning}>
            Sem conexão. As alterações ficam indisponíveis até a rede voltar.
          </AppText>
        </View>
      ) : null}
      <View style={styles.body}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: theme.color.background,
  },
  body: {
    flex: 1,
  },
  offline: {
    backgroundColor: theme.color.warningFill,
    paddingHorizontal: theme.space,
    paddingVertical: 12,
  },
});
