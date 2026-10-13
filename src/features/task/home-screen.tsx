import { MaterialIcons } from '@expo/vector-icons';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { Redirect, useRouter } from 'expo-router';
import { yupResolver } from '@hookform/resolvers/yup';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import * as yup from 'yup';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  SectionList,
  StyleSheet,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppButton } from '@/components/ui/app-button';
import { AppText } from '@/components/ui/app-text';
import { CenteredLoading } from '@/components/ui/centered-loading';
import { OptionDrawer } from '@/components/ui/option-drawer';
import { TextInput } from '@/components/forms/text-input';
import { Screen } from '@/components/ui/screen';
import { StatusBadge } from '@/components/ui/status-badge';
import { theme } from '@/constants/theme';
import { unreadTaskCount } from '@/features/notification/notification-api';
import { fetchTask, fetchTasks, taskQueryKey } from '@/features/task/task-api';
import {
  firstName,
  formatWhen,
  isUrgent,
  TASK_CHIPS,
  TaskChip,
  TODO_STATUSES,
} from '@/features/task/status';
import { Task } from '@/features/task/types';
import { useOffline } from '@/hooks/use-offline';
import { useBrand } from '@/providers/brand-provider';
import { useCompany, useSession } from '@/providers/session-provider';
import { clearLastTaskId, loadLastTaskId, saveLastTaskId } from '@/services/session-store';

type Mine = 'assigned' | 'created';

const searchSchema = yup.object({
  term: yup.string().defined(),
});

type SearchValues = yup.InferType<typeof searchSchema>;

function SearchBox({ onDebounced }: { onDebounced: (value: string) => void }) {
  const { control, watch } = useForm<SearchValues>({
    resolver: yupResolver(searchSchema),
    defaultValues: { term: '' },
  });
  const term = watch('term');

  useEffect(() => {
    const timer = setTimeout(() => onDebounced(term.trim()), 400);
    return () => clearTimeout(timer);
  }, [onDebounced, term]);

  return (
    <View style={styles.searchBox} collapsable={false}>
      <MaterialIcons name="search" size={24} color={theme.color.muted} />
      <TextInput
        control={control}
        name="term"
        blockStyle={styles.searchWrap}
        accessibilityLabel="Buscar protocolo, cliente ou endereço"
        placeholder="Protocolo, cliente ou endereço"
        autoCorrect={false}
        autoCapitalize="none"
        style={styles.search}
      />
    </View>
  );
}

export function HomeScreen() {
  'use no memo';
  const { user, userId, signOut, userLoading, userError } = useSession();
  const { company, companies, loading, ready, error } = useCompany();
  const brand = useBrand();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const offline = useOffline();
  const [debounced, setDebounced] = useState('');
  const [chip, setChip] = useState<TaskChip>('all');
  const [mine, setMine] = useState<Mine>('assigned');
  const [lastTaskId, setLastTaskId] = useState<string | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);

  const onSearchChange = useCallback((value: string) => {
    setDebounced(value);
  }, []);

  useEffect(() => {
    if (!userId || !company) {
      setLastTaskId(null);
      return;
    }
    let active = true;
    loadLastTaskId(userId, company.id).then((stored) => {
      if (active) setLastTaskId(stored);
    });
    return () => {
      active = false;
    };
  }, [company, userId]);

  const unreadQuery = useQuery({
    queryKey: ['notifications', company?.id, 'unread'],
    enabled: Boolean(company) && !offline,
    queryFn: ({ signal }) => unreadTaskCount(company!.id, signal),
    refetchInterval: 60_000,
  });

  const tasksQuery = useInfiniteQuery({
    queryKey: company ? taskQueryKey(company.id, mine, chip, debounced) : ['tasks', 'none'],
    enabled: Boolean(company) && !offline,
    initialPageParam: 1,
    queryFn: ({ pageParam, signal }) =>
      fetchTasks(company!.id, mine, chip, debounced, pageParam, signal),
    getNextPageParam: (lastPage, pages) => {
      const loaded = pages.reduce((sum, page) => sum + (page.data?.length ?? 0), 0);
      if (loaded < (lastPage.count ?? 0)) return pages.length + 1;
      return undefined;
    },
  });

  const tasks = useMemo(
    () => tasksQuery.data?.pages.flatMap((page) => page.data ?? []) ?? [],
    [tasksQuery.data],
  );

  const continueQuery = useQuery({
    queryKey: ['task', company?.id, lastTaskId, 'continue'],
    enabled: Boolean(company && lastTaskId) && !offline,
    queryFn: ({ signal }) => fetchTask(company!.id, lastTaskId!, signal),
  });

  useEffect(() => {
    if (!userId || !company || !lastTaskId) return;
    const task = continueQuery.data;
    const stillMine = task && task.status === 'IN_PROGRESS' && task.responsibleId === userId;
    if (continueQuery.isSuccess && !stillMine) {
      void clearLastTaskId(userId, company.id);
      setLastTaskId(null);
    }
    if (continueQuery.isError) {
      void clearLastTaskId(userId, company.id);
      setLastTaskId(null);
    }
  }, [company, continueQuery.data, continueQuery.isError, continueQuery.isSuccess, lastTaskId, userId]);

  if (!ready || loading || userLoading) {
    return (
      <Screen>
        <CenteredLoading label="Carregando sua fila…" color={brand.primary} />
      </Screen>
    );
  }

  if (userError || error) {
    return (
      <Screen>
        <View style={styles.message}>
          <AppText color={theme.color.error} accessibilityRole="alert">
            {userError?.message || error?.message}
          </AppText>
          <AppButton label="Sair" tone="secondary" color={brand.primary} onPress={() => signOut()} />
        </View>
      </Screen>
    );
  }

  if (!company) return <Redirect href="/companies" />;

  const continueTask =
    continueQuery.data?.status === 'IN_PROGRESS' && continueQuery.data.responsibleId === userId
      ? continueQuery.data
      : null;
  const sections = groupTasks(tasks, chip);
  const searchPending = tasksQuery.isFetching && !tasksQuery.isFetchingNextPage;
  const filterActive = chip !== 'all';
  const filterLabel = TASK_CHIPS.find((item) => item.id === chip)?.label ?? 'Filtros';

  function openTask(task: Task) {
    if (task.status === 'IN_PROGRESS' && task.responsibleId === userId) {
      void saveLastTaskId(userId, company!.id, task.id);
      setLastTaskId(task.id);
    }
    router.push({ pathname: '/task/[taskId]', params: { taskId: task.id } });
  }

  return (
    <Screen
      header={
        <View style={[styles.header, { backgroundColor: brand.primary, paddingTop: insets.top + 12 }]}>
          <View style={styles.headerRow}>
            <View style={styles.headerCopy}>
              <AppText variant="title" color={theme.color.white}>
                Olá, {firstName(user?.name)}
              </AppText>
              <AppText color={theme.color.white}>{company.name}</AppText>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={
                (unreadQuery.data?.count ?? 0) > 0
                  ? `Notificações, ${unreadQuery.data?.count} não lidas`
                  : 'Notificações'
              }
              onPress={() => router.push('/notifications')}
              style={styles.iconButton}>
              <MaterialIcons name="notifications-none" size={28} color={theme.color.white} />
              {(unreadQuery.data?.count ?? 0) > 0 ? (
                <View style={styles.badge}>
                  <AppText weight="semibold" color={theme.color.white} style={styles.badgeText}>
                    {(unreadQuery.data?.count ?? 0) > 99 ? '99+' : unreadQuery.data?.count}
                  </AppText>
                </View>
              ) : null}
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Menu da conta"
              onPress={() => setAccountOpen(true)}
              style={styles.iconButton}>
              <MaterialIcons name="more-vert" size={28} color={theme.color.white} />
            </Pressable>
          </View>
        </View>
      }>
      <View style={styles.chrome}>
        <View style={styles.searchRow}>
          <SearchBox onDebounced={onSearchChange} />
          <View style={styles.spinner} pointerEvents="none">
            <ActivityIndicator
              color={brand.primary}
              animating={searchPending}
              style={{ opacity: searchPending ? 1 : 0 }}
            />
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={filterActive ? `Filtros, ${filterLabel}` : 'Filtros'}
            onPress={() => setFiltersOpen(true)}
            style={[styles.filterButton, filterActive ? { borderColor: brand.primary } : null]}>
            <MaterialIcons name="tune" size={26} color={filterActive ? brand.primary : theme.color.text} />
            {filterActive ? <View style={[styles.filterDot, { backgroundColor: brand.primary }]} /> : null}
          </Pressable>
        </View>

        <View style={styles.tabs}>
          <Tab
            label="Próximas OS"
            selected={mine === 'assigned'}
            color={brand.primary}
            onPress={() => setMine('assigned')}
          />
          <Tab
            label="Criadas por mim"
            selected={mine === 'created'}
            color={brand.primary}
            onPress={() => setMine('created')}
          />
        </View>
      </View>

      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        keyboardShouldPersistTaps="always"
        keyboardDismissMode="none"
        automaticallyAdjustKeyboardInsets={false}
        contentContainerStyle={[styles.list, sections.length === 0 ? styles.listEmpty : null]}
        stickySectionHeadersEnabled={false}
        refreshControl={
          <RefreshControl
            refreshing={tasksQuery.isRefetching && !tasksQuery.isFetchingNextPage}
            onRefresh={() => tasksQuery.refetch()}
            tintColor={brand.primary}
          />
        }
        onEndReached={() => {
          if (tasksQuery.hasNextPage && !tasksQuery.isFetchingNextPage) {
            void tasksQuery.fetchNextPage();
          }
        }}
        ListHeaderComponent={
          continueTask ? (
            <View style={[styles.continue, { borderColor: brand.primary }]}>
              <AppText variant="meta" weight="semibold" color={brand.primary}>
                Continuar atendimento
              </AppText>
              <AppText weight="semibold">OS {continueTask.protocol ?? '—'}</AppText>
              <AppText>{continueTask.title}</AppText>
              <AppButton label="Abrir OS" color={brand.primary} onPress={() => openTask(continueTask)} />
            </View>
          ) : null
        }
        renderSectionHeader={({ section }) => (
          <View style={styles.section}>
            <AppText weight="semibold">{section.title}</AppText>
            <AppText variant="meta">{section.data.length}</AppText>
          </View>
        )}
        renderItem={({ item }) => (
          <TaskCard task={item} color={brand.primary} onPress={() => openTask(item)} />
        )}
        ListEmptyComponent={
          tasksQuery.isLoading ? (
            <CenteredLoading label="Carregando ordens de serviço…" color={brand.primary} />
          ) : tasksQuery.isError ? (
            <View style={styles.message}>
              <AppText color={theme.color.error} accessibilityRole="alert">
                {tasksQuery.error instanceof Error
                  ? tasksQuery.error.message
                  : 'Não foi possível carregar as OS.'}
              </AppText>
              <AppButton label="Tentar de novo" onPress={() => tasksQuery.refetch()} color={brand.primary} />
            </View>
          ) : offline ? (
            <AppText>Sem conexão para carregar a fila.</AppText>
          ) : (
            <AppText>
              {debounced
                ? 'Nenhuma OS encontrada para essa busca.'
                : mine === 'created'
                  ? 'Você ainda não criou OS nesta empresa.'
                  : 'Nenhuma OS atribuída a você neste grupo.'}
            </AppText>
          )
        }
        ListFooterComponent={
          tasksQuery.isFetchingNextPage ? (
            <ActivityIndicator color={brand.primary} style={styles.footer} />
          ) : null
        }
      />

      <OptionDrawer visible={filtersOpen} title="Filtros" onClose={() => setFiltersOpen(false)}>
        {TASK_CHIPS.map((item) => {
          const selected = item.id === chip;
          return (
            <Pressable
              key={item.id}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              accessibilityLabel={item.label}
              onPress={() => {
                setChip(item.id);
                setFiltersOpen(false);
              }}
              style={[styles.option, selected ? { borderColor: brand.primary, backgroundColor: '#F3EEFF' } : null]}>
              <AppText weight="semibold" color={selected ? brand.primary : theme.color.text}>
                {item.label}
              </AppText>
            </Pressable>
          );
        })}
      </OptionDrawer>

      <OptionDrawer visible={accountOpen} title="Conta" onClose={() => setAccountOpen(false)}>
        {companies.length > 1 ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Trocar empresa"
            onPress={() => {
              setAccountOpen(false);
              router.push('/companies');
            }}
            style={styles.option}>
            <MaterialIcons name="apartment" size={22} color={theme.color.text} />
            <AppText weight="semibold">Trocar empresa</AppText>
          </Pressable>
        ) : null}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Sair"
          onPress={() => {
            setAccountOpen(false);
            void signOut();
          }}
          style={styles.option}>
          <MaterialIcons name="logout" size={22} color={theme.color.error} />
          <AppText weight="semibold" color={theme.color.error}>
            Sair
          </AppText>
        </Pressable>
      </OptionDrawer>
    </Screen>
  );
}

function Tab({
  label,
  selected,
  color,
  onPress,
}: {
  label: string;
  selected: boolean;
  color: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityState={{ selected }}
      accessibilityLabel={label}
      onPress={onPress}
      style={[styles.tab, selected ? { backgroundColor: color, borderColor: color } : null]}>
      <AppText weight="semibold" color={selected ? theme.color.white : theme.color.text} style={styles.tabLabel}>
        {label}
      </AppText>
    </Pressable>
  );
}

function TaskCard({ task, color, onPress }: { task: Task; color: string; onPress: () => void }) {
  const urgent = isUrgent(task.status);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`OS ${task.protocol ?? task.title}`}
      onPress={onPress}
      style={[styles.card, urgent ? { borderColor: theme.color.warning } : null]}>
      <View style={styles.cardTop}>
        <AppText weight="semibold" color={color}>
          OS {task.protocol ?? '—'}
        </AppText>
        <StatusBadge status={task.status} urgent={urgent} />
      </View>
      <AppText weight="semibold">{task.title}</AppText>
      <InfoLine icon="person" text={task.client?.name || 'Sem cliente'} />
      <InfoLine icon="place" text={task.client?.address || 'Sem endereço'} />
      <InfoLine icon="event" text={`Prevista para ${formatWhen(task.date)}`} />
      {urgent ? (
        <AppText weight="semibold" color={theme.color.warning}>
          Urgente
        </AppText>
      ) : null}
      {task.status === 'IMPEDED' && task.impedimentNote ? (
        <AppText variant="meta" numberOfLines={2}>
          {task.impedimentNote}
        </AppText>
      ) : null}
    </Pressable>
  );
}

function InfoLine({ icon, text }: { icon: keyof typeof MaterialIcons.glyphMap; text: string }) {
  return (
    <View style={styles.infoLine}>
      <MaterialIcons name={icon} size={20} color={theme.color.muted} />
      <AppText style={styles.infoText}>{text}</AppText>
    </View>
  );
}

function groupTasks(tasks: Task[], chip: TaskChip) {
  if (chip !== 'all') {
    if (!tasks.length) return [];
    const label = TASK_CHIPS.find((item) => item.id === chip)?.label ?? 'Ordens';
    return [{ title: label, data: tasks }];
  }

  return [
    { title: 'Em andamento', data: tasks.filter((task) => task.status === 'IN_PROGRESS') },
    { title: 'Para fazer', data: tasks.filter((task) => TODO_STATUSES.includes(task.status)) },
    { title: 'Impedidas', data: tasks.filter((task) => task.status === 'IMPEDED') },
  ].filter((section) => section.data.length);
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: theme.space,
    paddingBottom: 16,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
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
  badge: {
    position: 'absolute',
    top: 6,
    right: 4,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.color.errorFill,
  },
  badgeText: {
    fontSize: 12,
    lineHeight: 16,
  },
  list: {
    padding: theme.space,
    gap: 12,
    flexGrow: 1,
  },
  listEmpty: {
    flex: 1,
  },
  chrome: {
    paddingHorizontal: theme.space,
    paddingTop: 16,
    gap: 12,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  searchBox: {
    flex: 1,
    height: theme.control,
    borderWidth: 2,
    borderColor: theme.color.line,
    borderRadius: theme.radius,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: theme.color.white,
  },
  searchWrap: {
    flex: 1,
    minHeight: 0,
  },
  search: {
    height: 40,
    fontFamily: theme.font.regular,
    fontSize: theme.text.body,
    color: theme.color.text,
    paddingVertical: 0,
  },
  spinner: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterButton: {
    width: theme.control,
    height: theme.control,
    borderWidth: 2,
    borderColor: theme.color.line,
    borderRadius: theme.radius,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.color.white,
  },
  filterDot: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  tabs: {
    flexDirection: 'row',
    gap: 8,
  },
  tab: {
    flex: 1,
    minHeight: theme.control,
    borderWidth: 2,
    borderColor: theme.color.line,
    borderRadius: theme.radius,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  tabLabel: {
    fontSize: 16,
    textAlign: 'center',
  },
  continue: {
    borderWidth: 3,
    borderRadius: theme.radius,
    padding: 16,
    gap: 8,
    backgroundColor: theme.color.surface,
  },
  section: {
    marginTop: 8,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  card: {
    borderWidth: 2,
    borderColor: theme.color.line,
    borderRadius: theme.radius,
    padding: 16,
    gap: 8,
    marginBottom: 12,
    backgroundColor: theme.color.white,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  infoLine: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  infoText: {
    flex: 1,
  },
  option: {
    minHeight: theme.control,
    borderWidth: 2,
    borderColor: theme.color.line,
    borderRadius: theme.radius,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  message: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    padding: theme.space,
  },
  footer: {
    marginVertical: 16,
  },
});
