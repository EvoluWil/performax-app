import { MaterialIcons } from '@expo/vector-icons';
import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query';
import { Redirect, useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppButton } from '@/components/ui/app-button';
import { AppText } from '@/components/ui/app-text';
import { CenteredLoading } from '@/components/ui/centered-loading';
import { Screen } from '@/components/ui/screen';
import { theme } from '@/constants/theme';
import {
  listTaskNotifications,
  markAllTaskNotificationsRead,
  markNotificationRead,
  notificationQueryKey,
  TaskNotification,
  unreadTaskCount,
} from '@/features/notification/notification-api';
import { useBrand } from '@/providers/brand-provider';
import { useCompany } from '@/providers/session-provider';

function formatWhen(value: string) {
  return new Date(value).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function NotificationScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { company } = useCompany();
  const brand = useBrand();
  const queryClient = useQueryClient();
  const [markingAll, setMarkingAll] = useState(false);

  const unread = useQuery({
    queryKey: ['notifications', company?.id, 'unread'],
    enabled: Boolean(company),
    queryFn: ({ signal }) => unreadTaskCount(company!.id, signal),
    refetchInterval: 60_000,
  });

  const list = useInfiniteQuery({
    queryKey: company ? notificationQueryKey(company.id) : ['notifications', 'none'],
    enabled: Boolean(company),
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam, signal }) => listTaskNotifications(company!.id, pageParam, signal),
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });

  if (!company) return <Redirect href="/companies" />;

  const items = list.data?.pages.flatMap((page) => page.data) ?? [];
  const count = unread.data?.count ?? 0;

  async function refresh() {
    await queryClient.invalidateQueries({ queryKey: ['notifications', company!.id] });
  }

  async function openItem(item: TaskNotification) {
    if (!item.readAt) {
      await markNotificationRead(company!.id, item.id);
      await refresh();
    }
    router.push({ pathname: '/task/[taskId]', params: { taskId: item.entityId } });
  }

  async function markAll() {
    setMarkingAll(true);
    try {
      await markAllTaskNotificationsRead(company!.id);
      await refresh();
    } finally {
      setMarkingAll(false);
    }
  }

  return (
    <Screen
      header={
        <View style={[styles.header, { backgroundColor: brand.primary, paddingTop: insets.top + 12 }]}>
          <View style={styles.headerRow}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Voltar"
              onPress={() => router.back()}
              style={styles.iconButton}>
              <MaterialIcons name="arrow-back" size={28} color={theme.color.white} />
            </Pressable>
            <View style={styles.headerCopy}>
              <AppText variant="title" color={theme.color.white}>
                Notificações
              </AppText>
              <AppText color={theme.color.white}>Ordens de serviço</AppText>
            </View>
          </View>
        </View>
      }>
      {count > 0 ? (
        <View style={styles.markAll}>
          <AppButton
            label={markingAll ? 'Marcando…' : 'Marcar todas como lidas'}
            tone="secondary"
            color={brand.primary}
            disabled={markingAll}
            onPress={() => void markAll()}
          />
        </View>
      ) : null}
      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[styles.list, items.length === 0 ? styles.listEmpty : null]}
        refreshControl={
          <RefreshControl
            refreshing={list.isRefetching && !list.isFetchingNextPage}
            onRefresh={() => void list.refetch()}
            tintColor={brand.primary}
          />
        }
        onEndReached={() => {
          if (list.hasNextPage && !list.isFetchingNextPage) void list.fetchNextPage();
        }}
        ListEmptyComponent={
          list.isLoading ? (
            <CenteredLoading label="Carregando notificações…" color={brand.primary} />
          ) : list.isError ? (
            <View style={styles.message}>
              <AppText color={theme.color.error} accessibilityRole="alert">
                Não foi possível carregar as notificações.
              </AppText>
              <AppButton label="Tentar de novo" onPress={() => void list.refetch()} color={brand.primary} />
            </View>
          ) : (
            <AppText>Nenhuma notificação de OS.</AppText>
          )
        }
        ListFooterComponent={
          list.isFetchingNextPage ? <ActivityIndicator color={brand.primary} style={styles.footer} /> : null
        }
        renderItem={({ item }) => (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${item.title}. ${item.body}`}
            onPress={() => void openItem(item)}
            style={[styles.card, item.readAt ? null : { borderColor: brand.primary, backgroundColor: theme.color.surface }]}>
            <AppText weight="semibold">{item.title}</AppText>
            <AppText>{item.body}</AppText>
            <AppText variant="meta">{formatWhen(item.createdAt)}</AppText>
          </Pressable>
        )}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: theme.space,
    paddingBottom: 16,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerCopy: {
    flex: 1,
    gap: 4,
  },
  iconButton: {
    width: 56,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
  },
  markAll: {
    paddingHorizontal: theme.space,
    paddingTop: 16,
  },
  list: {
    padding: theme.space,
    gap: 12,
    flexGrow: 1,
  },
  listEmpty: {
    flex: 1,
    justifyContent: 'center',
  },
  card: {
    borderWidth: 2,
    borderColor: theme.color.line,
    borderRadius: theme.radius,
    padding: 16,
    gap: 4,
    marginBottom: 12,
    backgroundColor: theme.color.white,
  },
  message: {
    alignItems: 'center',
    gap: 12,
  },
  footer: {
    marginVertical: 16,
  },
});
