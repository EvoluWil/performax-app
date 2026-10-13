import { StatusBar } from 'expo-status-bar';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppButton } from '@/components/ui/app-button';
import { AppText } from '@/components/ui/app-text';
import { CenteredLoading } from '@/components/ui/centered-loading';
import { theme } from '@/constants/theme';
import { useBrand } from '@/providers/brand-provider';
import { useCompany, useSession } from '@/providers/session-provider';
import { useRouter } from 'expo-router';

export function CompanyScreen() {
  const { companies, company, loading, error, selectCompany } = useCompany();
  const { signOut, userError } = useSession();
  const brand = useBrand();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  async function choose(companyId: string) {
    await selectCompany(companyId);
    router.replace('/');
  }

  if (loading) {
    return (
      <View style={[styles.screen, { paddingTop: insets.top }]}>
        <StatusBar style="dark" />
        <CenteredLoading label="Carregando empresas…" color={brand.primary} />
      </View>
    );
  }

  return (
    <View style={[styles.screen, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 16 }]}>
      <StatusBar style="dark" />
      <AppText variant="title">Escolha a empresa</AppText>
      <AppText variant="meta">Só aparecem empresas em que você acessa ordens de serviço.</AppText>

      {error || userError ? (
        <View style={styles.center}>
          <AppText color={theme.color.error} accessibilityRole="alert">
            {error?.message || userError?.message}
          </AppText>
        </View>
      ) : null}

      {!error && companies.length === 0 ? (
        <View style={styles.center}>
          <AppText>Nenhuma empresa com acesso a ordens de serviço.</AppText>
          <AppText variant="meta">Peça o acesso à OS para a empresa em que você atende.</AppText>
        </View>
      ) : null}

      <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
        {companies.map((item) => {
          const selected = item.id === company?.id;
          return (
            <Pressable
              key={item.id}
              accessibilityRole="button"
              accessibilityLabel={item.name}
              accessibilityState={{ selected }}
              onPress={() => choose(item.id)}
              style={[styles.row, selected ? { borderColor: brand.primary } : null]}>
              <AppText weight="semibold">{item.name}</AppText>
              <AppText variant="meta">{selected ? 'Empresa atual' : 'Usar esta empresa'}</AppText>
            </Pressable>
          );
        })}
      </ScrollView>

      <AppButton label="Sair" tone="secondary" color={brand.primary} onPress={() => signOut()} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: theme.color.background,
    paddingHorizontal: theme.space,
    gap: 16,
  },
  center: {
    gap: 12,
    paddingVertical: 12,
  },
  list: {
    flex: 1,
  },
  listContent: {
    gap: 12,
  },
  row: {
    minHeight: theme.control,
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: theme.color.line,
    borderRadius: theme.radius,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: theme.color.surface,
    gap: 4,
  },
});
