import { MaterialIcons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { yupResolver } from '@hookform/resolvers/yup';
import { ReactNode, useState } from 'react';
import { useForm } from 'react-hook-form';
import * as yup from 'yup';
import {
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { TextInput } from '@/components/forms/text-input';
import { AppButton } from '@/components/ui/app-button';
import { AppText } from '@/components/ui/app-text';
import { CenteredLoading } from '@/components/ui/centered-loading';
import { OptionDrawer } from '@/components/ui/option-drawer';
import { Screen } from '@/components/ui/screen';
import { StatusBadge } from '@/components/ui/status-badge';
import { theme } from '@/constants/theme';
import { ChecklistSection } from '@/features/task/checklist-section';
import { isImageFile, pickTaskFile, pickTaskPhoto, uploadTaskAttachment, uploadTaskPhoto } from '@/features/task/evidence';
import { formatWhen, isUrgent, START_STATUSES } from '@/features/task/status';
import { appendTaskFiles, fetchTask, updateTask } from '@/features/task/task-api';
import { checklistProgress, Task, TaskFile } from '@/features/task/types';
import { useOffline } from '@/hooks/use-offline';
import { useBrand } from '@/providers/brand-provider';
import { useCompany, useSession } from '@/providers/session-provider';
import { clearLastTaskId, saveLastTaskId } from '@/services/session-store';

const NOTE_LIMIT = 1000;

export function TaskScreen() {
  'use no memo';
  const { taskId } = useLocalSearchParams<{ taskId: string }>();
  const { company, canWrite } = useCompany();
  const { userId } = useSession();
  const brand = useBrand();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const offline = useOffline();
  const queryClient = useQueryClient();
  const [noteMode, setNoteMode] = useState<'impediment' | 'conclusion' | null>(null);
  const [drawer, setDrawer] = useState<'actions' | 'start' | 'resolve' | 'pause' | 'conclusion' | 'impediment' | null>(
    null,
  );
  const [formKey, setFormKey] = useState(0);
  const [actionError, setActionError] = useState('');
  const [photoMessage, setPhotoMessage] = useState('');
  const [photoError, setPhotoError] = useState('');
  const [pendingFile, setPendingFile] = useState<TaskFile | null>(null);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [extraFiles, setExtraFiles] = useState<TaskFile[]>([]);

  const taskQuery = useQuery({
    queryKey: ['task', company?.id, taskId],
    enabled: Boolean(company && taskId),
    queryFn: ({ signal }) => fetchTask(company!.id, String(taskId), signal),
  });

  const task = taskQuery.data;
  const isResponsible = Boolean(task && userId && task.responsibleId === userId);
  const executable = Boolean(isResponsible && canWrite && task?.approved !== false && !offline);
  const canStart = Boolean(executable && task && START_STATUSES.includes(task.status));
  const inProgress = task?.status === 'IN_PROGRESS';
  const impeded = task?.status === 'IMPEDED';

  async function refresh() {
    await Promise.all([
      taskQuery.refetch(),
      queryClient.invalidateQueries({ queryKey: ['tasks', company?.id] }),
    ]);
  }

  const mutation = useMutation({
    mutationFn: (body: Record<string, unknown>) => updateTask(company!.id, String(taskId), body),
    onSuccess: async () => {
      setActionError('');
      setNoteMode(null);
      setExtraFiles([]);
      setPhotoMessage('');
      setPhotoError('');
      setDrawer(null);
      await refresh();
    },
    onError: (error: Error) => {
      setActionError(error.message);
    },
  });

  async function remember() {
    if (!company || !task || !userId || task.status !== 'IN_PROGRESS' || !isResponsible) return;
    await saveLastTaskId(userId, company.id, task.id);
  }

  async function forget() {
    if (!company || !userId) return;
    await clearLastTaskId(userId, company.id);
  }

  async function start() {
    await mutation.mutateAsync({ status: 'IN_PROGRESS' });
    if (company && userId && task) await saveLastTaskId(userId, company.id, task.id);
  }

  function closeNote() {
    setNoteMode(null);
    setExtraFiles([]);
    setPhotoMessage('');
    setPhotoError('');
  }

  function closeDrawer() {
    closeNote();
    setDrawer(null);
  }

  function openForm(mode: 'conclusion' | 'impediment') {
    setFormKey((current) => current + 1);
    setExtraFiles([]);
    setPhotoMessage('');
    setPhotoError('');
    setNoteMode(mode);
    setDrawer(mode);
  }

  async function submitNote(trimmed: string) {
    if (noteMode === 'impediment') {
      await mutation.mutateAsync({ status: 'IMPEDED', impedimentNote: trimmed });
      await forget();
      return;
    }
    const current = await fetchTask(company!.id, String(taskId));
    const conclusionFiles = [...(current.conclusionFiles ?? [])];
    for (const file of extraFiles) {
      if (!conclusionFiles.some((item) => item.url === file.url)) conclusionFiles.push(file);
    }
    await mutation.mutateAsync({
      status: 'CLOSED',
      conclusionNote: trimmed,
      conclusionFiles,
    });
    await forget();
  }

  async function linkAttachment(uploaded: TaskFile) {
    if (!company || !task) return;
    setPendingFile(uploaded);
    setPhotoMessage('Vinculando arquivo à OS…');
    await appendTaskFiles(company.id, task.id, 'files', uploaded);
    setPendingFile(null);
    setPhotoMessage('Arquivo salvo');
    await refresh();
  }

  async function attachPhoto() {
    if (!company || !task) return;
    setPhotoError('');
    setPhotoBusy(true);
    setPhotoMessage('Enviando foto…');
    try {
      const uri = await pickTaskPhoto('camera');
      if (!uri) {
        setPhotoMessage('');
        setPhotoBusy(false);
        return;
      }
      const uploaded = await uploadTaskPhoto(task.id, uri, 'evidence');
      await linkAttachment(uploaded);
    } catch (error) {
      setPhotoMessage('');
      setPhotoError(error instanceof Error ? error.message : 'Não foi possível salvar a foto.');
    } finally {
      setPhotoBusy(false);
    }
  }

  async function retryAttachment() {
    if (!pendingFile) return;
    setPhotoError('');
    setPhotoBusy(true);
    try {
      await linkAttachment(pendingFile);
    } catch (error) {
      setPhotoMessage('');
      setPhotoError(error instanceof Error ? error.message : 'Não foi possível salvar o arquivo.');
    } finally {
      setPhotoBusy(false);
    }
  }

  async function attachDocument() {
    if (!company || !task) return;
    setPhotoError('');
    setPhotoBusy(true);
    setPhotoMessage('Enviando arquivo…');
    try {
      const picked = await pickTaskFile();
      if (!picked) {
        setPhotoMessage('');
        setPhotoBusy(false);
        return;
      }
      const uploaded = await uploadTaskAttachment(task.id, picked, 'evidence');
      await linkAttachment(uploaded);
    } catch (error) {
      setPhotoMessage('');
      setPhotoError(error instanceof Error ? error.message : 'Não foi possível salvar o arquivo.');
    } finally {
      setPhotoBusy(false);
    }
  }

  async function addConclusionPhoto(source: 'camera' | 'library') {
    if (!task) return;
    setPhotoError('');
    setPhotoBusy(true);
    setPhotoMessage('Enviando foto…');
    try {
      const uri = await pickTaskPhoto(source);
      if (!uri) {
        setPhotoMessage('');
        return;
      }
      const uploaded = await uploadTaskPhoto(task.id, uri, 'conclusion');
      setExtraFiles((current) =>
        current.some((item) => item.url === uploaded.url) ? current : [...current, uploaded],
      );
      setPhotoMessage('A foto entra na OS quando você concluir.');
    } catch (error) {
      setPhotoMessage('');
      setPhotoError(error instanceof Error ? error.message : 'Não foi possível enviar a foto.');
    } finally {
      setPhotoBusy(false);
    }
  }

  function openRoute() {
    const point = taskPoint(task);
    if (!point) return;
    const url = Platform.select({
      ios: `http://maps.apple.com/?ll=${point.latitude},${point.longitude}`,
      android: `geo:${point.latitude},${point.longitude}?q=${point.latitude},${point.longitude}`,
      default: `https://www.google.com/maps/search/?api=1&query=${point.latitude},${point.longitude}`,
    });
    if (url) void Linking.openURL(url);
  }

  if (!company) {
    return (
      <Screen>
        <View style={styles.message}>
          <AppText>Escolha a empresa antes de abrir a OS.</AppText>
          <AppButton label="Escolher empresa" onPress={() => router.replace('/companies')} color={brand.primary} />
        </View>
      </Screen>
    );
  }

  if (taskQuery.isLoading) {
    return (
      <Screen>
        <CenteredLoading label="Carregando a ordem de serviço…" color={brand.primary} />
      </Screen>
    );
  }

  if (taskQuery.isError || !task) {
    return (
      <Screen>
        <View style={styles.message}>
          <AppText color={theme.color.error} accessibilityRole="alert">
            {taskQuery.error instanceof Error ? taskQuery.error.message : 'Não foi possível abrir esta OS.'}
          </AppText>
          <AppButton label="Tentar de novo" onPress={() => taskQuery.refetch()} color={brand.primary} />
        </View>
      </Screen>
    );
  }

  const progress = checklistProgress(task);
  const point = taskPoint(task);
  const closed = task.status === 'CLOSED' || task.status === 'REJECTED';
  const actionChoices: Array<'start' | 'resolve' | 'conclusion' | 'impediment' | 'pause'> = [];
  if (canStart) actionChoices.push('start');
  if (executable && impeded) actionChoices.push('resolve');
  if (executable && inProgress) {
    actionChoices.push('conclusion');
    actionChoices.push('impediment');
  }
  if (isResponsible && inProgress) actionChoices.push('pause');
  const onlyAction = actionChoices.length === 1 ? actionChoices[0] : null;
  const actionLabel =
    onlyAction === 'start'
      ? 'Iniciar'
      : onlyAction === 'resolve'
        ? 'Resolver impedimento'
        : onlyAction === 'pause'
          ? 'Pausar'
          : 'Ações';

  return (
    <Screen
      header={
        <View style={[styles.header, { backgroundColor: brand.primary, paddingTop: insets.top + 8 }]}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Voltar"
            onPress={() => router.back()}
            style={styles.back}>
            <MaterialIcons name="arrow-back" size={28} color={theme.color.white} />
          </Pressable>
          <AppText variant="title" color={theme.color.white}>
            OS {task.protocol ?? '—'}
          </AppText>
        </View>
      }>
      <View style={styles.detail}>
        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="always"
          keyboardDismissMode="none"
          automaticallyAdjustKeyboardInsets={false}>
          <View style={styles.titleRow}>
            <AppText variant="title" style={styles.title}>
              {task.title}
            </AppText>
            <StatusBadge status={task.status} urgent={isUrgent(task.status)} />
          </View>

          <View style={styles.card}>
            <InfoRow icon="person" label="Cliente" value={task.client?.name || 'Sem cliente'} />
            <InfoRow icon="place" label="Endereço" value={task.client?.address || 'Sem endereço'} />
            <InfoRow icon="event" label="Previsão" value={formatWhen(task.date)} />
            <InfoRow icon="notes" label="Descrição" value={task.description || 'Sem descrição'} />
            {task.internalNote ? <InfoRow icon="sticky-note-2" label="Nota interna" value={task.internalNote} /> : null}
            {task.impedimentNote ? (
              <InfoRow icon="report-problem" label="Impedimento" value={task.impedimentNote} />
            ) : null}
            {point ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Abrir rota"
                onPress={openRoute}
                style={styles.route}>
                <MaterialIcons name="directions" size={22} color={brand.primary} />
                <AppText weight="semibold" color={brand.primary}>
                  Abrir rota
                </AppText>
              </Pressable>
            ) : null}
          </View>

          {task.approved === false ? (
            <AppText weight="semibold" color={theme.color.warning}>
              Aguardando aprovação
            </AppText>
          ) : null}
          {!isResponsible ? (
            <AppText>
              Esta OS está com {task.responsible?.name || 'outro responsável'}. Você pode consultar, sem executar.
            </AppText>
          ) : null}
          {isResponsible && !canWrite ? <AppText>Você pode ver esta OS, sem alterar.</AppText> : null}

          <ChecklistSection
            companyId={company.id}
            task={task}
            editable={executable && !closed}
            color={brand.primary}
            onSaved={refresh}
          />

          <Fold title="Arquivos" summary={task.files?.length ? `${task.files.length} arquivo(s)` : 'Nenhum arquivo'}>
            <Evidence
              files={task.files ?? []}
              color={brand.primary}
              message={photoMessage}
              error={photoError}
              busy={photoBusy}
              enabled={executable && (inProgress || impeded)}
              onCamera={() => void attachPhoto()}
              onFile={() => void attachDocument()}
              onRetry={pendingFile ? () => void retryAttachment() : undefined}
            />
          </Fold>

          {task.conclusionNote || (task.conclusionFiles?.length ?? 0) > 0 ? (
            <Fold title="Conclusão" summary="Resumo final">
              {task.conclusionNote ? <AppText>{task.conclusionNote}</AppText> : null}
              <PhotoStrip files={task.conclusionFiles ?? []} />
            </Fold>
          ) : null}
        </ScrollView>

        {actionChoices.length ? (
          <View style={styles.actions}>
            {actionError && drawer === null ? (
              <AppText color={theme.color.error} accessibilityRole="alert">
                {actionError}
              </AppText>
            ) : null}
            <AppButton
              label={actionLabel}
              color={brand.primary}
              loading={mutation.isPending && drawer === null}
              onPress={() => {
                if (!onlyAction) {
                  setDrawer('actions');
                  return;
                }
                if (onlyAction === 'conclusion' || onlyAction === 'impediment') openForm(onlyAction);
                else setDrawer(onlyAction);
              }}
            />
          </View>
        ) : null}
      </View>

      <OptionDrawer
        visible={drawer !== null}
        title={drawerTitle(drawer)}
        onClose={closeDrawer}>
        {drawer === 'actions' ? (
          <View style={styles.stack}>
            {executable && inProgress ? (
              <DrawerOption icon="task-alt" label="Concluir OS" onPress={() => openForm('conclusion')} />
            ) : null}
            {executable && inProgress ? (
              <DrawerOption icon="report-problem" label="Registrar impedimento" onPress={() => openForm('impediment')} />
            ) : null}
            {isResponsible && inProgress ? (
              <DrawerOption icon="pause-circle" label="Pausar e voltar para a fila" onPress={() => setDrawer('pause')} />
            ) : null}
          </View>
        ) : null}
        {drawer === 'start' ? (
          <ConfirmAction
            hint="A OS passa a ficar em andamento e entra no cartão de continuar."
            label="Confirmar início"
            color={brand.primary}
            loading={mutation.isPending}
            onPress={() => void start()}
          />
        ) : null}
        {drawer === 'resolve' ? (
          <ConfirmAction
            hint="O impedimento sai e a OS volta para a fila de trabalho."
            label="Confirmar"
            color={brand.primary}
            loading={mutation.isPending}
            onPress={() => {
              void mutation.mutateAsync({ status: 'OPEN' }).then(() => forget());
            }}
          />
        ) : null}
        {drawer === 'pause' ? (
          <ConfirmAction
            hint="A OS continua em andamento. Você volta para a fila e pode retomar pelo cartão Continuar."
            label="Pausar e voltar"
            color={brand.primary}
            loading={false}
            onPress={async () => {
              await remember();
              router.replace('/');
            }}
          />
        ) : null}
        {drawer === 'conclusion' ? (
          <ConclusionForm
            key={formKey}
            task={task}
            color={brand.primary}
            actionError={actionError}
            photoMessage={photoMessage}
            photoError={photoError}
            photoBusy={photoBusy}
            offline={offline}
            extraFiles={extraFiles}
            progress={progress}
            loading={mutation.isPending}
            onCamera={() => addConclusionPhoto('camera')}
            onLibrary={() => addConclusionPhoto('library')}
            onConfirm={(note) => void submitNote(note)}
          />
        ) : null}
        {drawer === 'impediment' ? (
          <ImpedimentForm
            key={formKey}
            color={brand.primary}
            actionError={actionError}
            loading={mutation.isPending}
            onConfirm={(note) => void submitNote(note)}
          />
        ) : null}
      </OptionDrawer>
    </Screen>
  );
}

function taskPoint(task?: Task | null) {
  const latitude = task?.latitude;
  const longitude = task?.longitude;
  if (typeof latitude !== 'number' || typeof longitude !== 'number') return null;
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  return { latitude, longitude };
}

function InfoRow({
  icon,
  label,
  value,
}: {
  icon: keyof typeof MaterialIcons.glyphMap;
  label: string;
  value: string;
}) {
  return (
    <View style={styles.infoRow}>
      <MaterialIcons name={icon} size={22} color={theme.color.muted} />
      <View style={styles.infoCopy}>
        <AppText variant="meta">{label}</AppText>
        <AppText>{value}</AppText>
      </View>
    </View>
  );
}

function Fold({ title, summary, children }: { title: string; summary: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <View style={styles.card}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={`${title}, ${summary}`}
        onPress={() => setOpen((current) => !current)}
        style={styles.foldHeader}>
        <View style={styles.infoCopy}>
          <AppText weight="semibold">{title}</AppText>
          <AppText variant="meta">{summary}</AppText>
        </View>
        <MaterialIcons name={open ? 'expand-less' : 'expand-more'} size={28} color={theme.color.text} />
      </Pressable>
      {open ? children : null}
    </View>
  );
}

function Evidence({
  files,
  color,
  message,
  error,
  busy,
  enabled,
  onCamera,
  onFile,
  onRetry,
}: {
  files: TaskFile[];
  color: string;
  message: string;
  error: string;
  busy: boolean;
  enabled: boolean;
  onCamera: () => void;
  onFile: () => void;
  onRetry?: () => void;
}) {
  const [open, setOpen] = useState(false);

  function choose(action: () => void) {
    setOpen(false);
    setTimeout(action, 350);
  }

  return (
    <View style={styles.stack}>
      <FileList files={files} />
      {files.length === 0 ? <AppText variant="meta">Nenhum arquivo anexado.</AppText> : null}
      {message ? <AppText>{message}</AppText> : null}
      {error ? (
        <AppText color={theme.color.error} accessibilityRole="alert">
          {error}
        </AppText>
      ) : null}
      {enabled ? (
        <AppButton
          label="Adicionar anexos"
          tone="secondary"
          color={color}
          onPress={() => setOpen(true)}
          disabled={busy}
        />
      ) : null}
      {enabled && error && onRetry ? (
        <AppButton label="Tentar de novo" color={color} onPress={onRetry} disabled={busy} />
      ) : null}
      <OptionDrawer visible={open} title="Adicionar anexos" onClose={() => setOpen(false)}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Tirar foto"
          onPress={() => choose(onCamera)}
          style={styles.option}>
          <MaterialIcons name="photo-camera" size={22} color={theme.color.text} />
          <AppText weight="semibold">Tirar foto</AppText>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Anexar arquivo"
          onPress={() => choose(onFile)}
          style={styles.option}>
          <MaterialIcons name="attach-file" size={22} color={theme.color.text} />
          <AppText weight="semibold">Anexar arquivo</AppText>
        </Pressable>
      </OptionDrawer>
    </View>
  );
}

function FileList({ files }: { files: TaskFile[] }) {
  if (!files.length) return null;
  const images = files.filter(isImageFile);
  const documents = files.filter((file) => !isImageFile(file));
  return (
    <View style={styles.stack}>
      {images.length ? (
        <View style={styles.photos}>
          {images.map((file) => (
            <Image key={file.url} source={{ uri: file.url }} style={styles.photo} accessibilityLabel="Arquivo da OS" />
          ))}
        </View>
      ) : null}
      {documents.map((file) => (
        <Pressable
          key={file.url}
          accessibilityRole="link"
          accessibilityLabel={fileLabel(file)}
          onPress={() => void Linking.openURL(file.url)}
          style={styles.fileRow}>
          <MaterialIcons name="insert-drive-file" size={22} color={theme.color.muted} />
          <AppText style={styles.infoText}>{fileLabel(file)}</AppText>
        </Pressable>
      ))}
    </View>
  );
}

function fileLabel(file: TaskFile) {
  const name = decodeURIComponent(file.url.split('?')[0]?.split('/').pop() ?? '');
  return name || file.type.toUpperCase();
}

function PhotoStrip({ files }: { files: TaskFile[] }) {
  if (!files.length) return null;
  return (
    <View style={styles.photos}>
      {files.map((file) => (
        <Image key={file.url} source={{ uri: file.url }} style={styles.photo} accessibilityLabel="Foto da OS" />
      ))}
    </View>
  );
}

function drawerTitle(drawer: string | null) {
  if (drawer === 'actions') return 'Ações';
  if (drawer === 'start') return 'Iniciar';
  if (drawer === 'resolve') return 'Resolver impedimento';
  if (drawer === 'pause') return 'Pausar';
  if (drawer === 'conclusion') return 'Concluir OS';
  if (drawer === 'impediment') return 'Registrar impedimento';
  return 'Ações';
}

function DrawerOption({
  icon,
  label,
  onPress,
}: {
  icon: keyof typeof MaterialIcons.glyphMap;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={styles.option}>
      <MaterialIcons name={icon} size={22} color={theme.color.text} />
      <AppText weight="semibold">{label}</AppText>
    </Pressable>
  );
}

function ConfirmAction({
  hint,
  label,
  color,
  loading,
  onPress,
}: {
  hint: string;
  label: string;
  color: string;
  loading: boolean;
  onPress: () => void;
}) {
  return (
    <View style={styles.stack}>
      <AppText>{hint}</AppText>
      <AppButton label={label} color={color} loading={loading} onPress={onPress} />
    </View>
  );
}

const conclusionSchema = yup.object({
  note: yup.string().trim().required('Escreva o resumo final.').max(NOTE_LIMIT, 'Use no máximo 1000 caracteres.'),
});

const impedimentSchema = yup.object({
  note: yup.string().trim().required('Escreva o motivo do impedimento.').max(NOTE_LIMIT, 'Use no máximo 1000 caracteres.'),
});

type NoteValues = yup.InferType<typeof conclusionSchema>;

function ConclusionForm({
  task,
  color,
  actionError,
  photoMessage,
  photoError,
  photoBusy,
  offline,
  extraFiles,
  progress,
  loading,
  onCamera,
  onLibrary,
  onConfirm,
}: {
  task: Task;
  color: string;
  actionError: string;
  photoMessage: string;
  photoError: string;
  photoBusy: boolean;
  offline: boolean;
  extraFiles: TaskFile[];
  progress: { answered: number; total: number };
  loading: boolean;
  onCamera: () => void;
  onLibrary: () => void;
  onConfirm: (note: string) => void;
}) {
  const { control, handleSubmit, watch } = useForm<NoteValues>({
    resolver: yupResolver(conclusionSchema),
    defaultValues: { note: '' },
  });
  const note = watch('note');
  const incomplete = progress.total > 0 && progress.answered < progress.total;
  return (
    <View style={styles.stack}>
      <AppText weight="semibold">OS {task.protocol ?? '—'}</AppText>
      <AppText>{task.title}</AppText>
      <AppText weight="semibold">
        Checklist {progress.answered} de {progress.total}
      </AppText>
      {incomplete ? (
        <AppText color={theme.color.warning}>Ainda há itens sem resposta. Você pode concluir mesmo assim.</AppText>
      ) : (
        <AppText variant="meta">Checklist em dia.</AppText>
      )}
      <AppText weight="semibold">Fotos finais</AppText>
      <AppText variant="meta">
        {extraFiles.length ? `${extraFiles.length} foto(s) entram na OS ao confirmar.` : 'Fotos do encerramento são opcionais.'}
      </AppText>
      {photoMessage ? <AppText>{photoMessage}</AppText> : null}
      {photoError ? (
        <AppText color={theme.color.error} accessibilityRole="alert">
          {photoError}
        </AppText>
      ) : null}
      <AppButton label="Tirar foto" tone="secondary" color={color} disabled={photoBusy || offline} onPress={onCamera} />
      <AppButton label="Escolher foto" tone="secondary" color={color} disabled={photoBusy || offline} onPress={onLibrary} />
      <View style={styles.foldHeader}>
        <AppText weight="semibold">Nota final</AppText>
        <AppText variant="meta">
          {note.length}/{NOTE_LIMIT}
        </AppText>
      </View>
      <TextInput
        control={control}
        name="note"
        accessibilityLabel="Nota final"
        placeholder="Escreva o resumo do que foi feito"
        multiline
        maxLength={NOTE_LIMIT}
        containerStyle={styles.note}
      />
      <AppText variant="meta">A nota é obrigatória.</AppText>
      {actionError ? (
        <AppText color={theme.color.error} accessibilityRole="alert">
          {actionError}
        </AppText>
      ) : null}
      <AppButton
        label="Confirmar conclusão"
        onPress={() => void handleSubmit((values) => onConfirm(values.note.trim()))()}
        loading={loading}
        color={color}
      />
    </View>
  );
}

function ImpedimentForm({
  color,
  actionError,
  loading,
  onConfirm,
}: {
  color: string;
  actionError: string;
  loading: boolean;
  onConfirm: (note: string) => void;
}) {
  const { control, handleSubmit, watch } = useForm<NoteValues>({
    resolver: yupResolver(impedimentSchema),
    defaultValues: { note: '' },
  });
  const note = watch('note');
  return (
    <View style={styles.stack}>
      <AppText>Escreva por que a OS não pode seguir agora.</AppText>
      <TextInput
        control={control}
        name="note"
        accessibilityLabel="Motivo do impedimento"
        placeholder="Motivo do impedimento"
        multiline
        maxLength={NOTE_LIMIT}
        containerStyle={styles.note}
      />
      <AppText variant="meta">
        {note.length}/{NOTE_LIMIT}
      </AppText>
      {actionError ? (
        <AppText color={theme.color.error} accessibilityRole="alert">
          {actionError}
        </AppText>
      ) : null}
      <AppButton
        label="Registrar impedimento"
        onPress={() => void handleSubmit((values) => onConfirm(values.note.trim()))()}
        loading={loading}
        color={color}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  detail: {
    flex: 1,
  },
  actions: {
    gap: 8,
    paddingHorizontal: theme.space,
    paddingTop: 12,
    paddingBottom: 12,
    borderTopWidth: 2,
    borderTopColor: theme.color.line,
    backgroundColor: theme.color.white,
  },
  header: {
    paddingHorizontal: theme.space,
    paddingBottom: 16,
    gap: 8,
  },
  back: {
    width: 56,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: -12,
  },
  content: {
    padding: theme.space,
    gap: 16,
  },
  message: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    padding: theme.space,
  },
  titleRow: {
    gap: 8,
  },
  title: {
    fontSize: 28,
    lineHeight: 36,
  },
  card: {
    borderWidth: 2,
    borderColor: theme.color.line,
    borderRadius: theme.radius,
    padding: 16,
    gap: 12,
    backgroundColor: theme.color.white,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  infoCopy: {
    flex: 1,
    gap: 2,
  },
  route: {
    minHeight: theme.control,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  foldHeader: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  stack: {
    gap: 12,
  },
  photos: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  fileRow: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
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
  photo: {
    width: 96,
    height: 96,
    borderRadius: theme.radius,
    backgroundColor: theme.color.surface,
  },
  pause: {
    minHeight: theme.control,
    alignItems: 'center',
    justifyContent: 'center',
  },
  note: {
    borderWidth: 2,
    borderColor: theme.color.line,
    borderRadius: theme.radius,
    paddingHorizontal: 16,
    backgroundColor: theme.color.white,
  },
});
