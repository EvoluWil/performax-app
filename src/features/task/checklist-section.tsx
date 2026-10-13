import { yupResolver } from '@hookform/resolvers/yup';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Pressable, StyleSheet, View } from 'react-native';
import * as yup from 'yup';

import { TextInput } from '@/components/forms/text-input';
import { AppButton } from '@/components/ui/app-button';
import { AppText } from '@/components/ui/app-text';
import { theme } from '@/constants/theme';
import { updateChecklistItem } from '@/features/task/task-api';
import {
  ChecklistItem,
  checklistProgress,
  isChecklistItemAnswered,
  Task,
} from '@/features/task/types';

type ItemState = 'saving' | 'saved' | 'error';

export function ChecklistSection({
  companyId,
  task,
  editable,
  color = theme.color.primary,
  onSaved,
}: {
  companyId: string;
  task: Task;
  editable: boolean;
  color?: string;
  onSaved: () => Promise<unknown>;
}) {
  const [open, setOpen] = useState(false);
  const [states, setStates] = useState<Record<string, ItemState>>({});
  const progress = checklistProgress(task);
  const modules = task.checklist?.modules ?? [];
  const ratio = progress.total > 0 ? progress.answered / progress.total : 0;

  async function save(item: ChecklistItem, body: { valueBoolean?: boolean; valueNumber?: number; valueText?: string }) {
    if (!task.checklist?.id) return;
    setStates((current) => ({ ...current, [item.id]: 'saving' }));
    try {
      await updateChecklistItem(companyId, task.checklist.id, item.id, body);
      setStates((current) => ({ ...current, [item.id]: 'saved' }));
      await onSaved();
    } catch {
      setStates((current) => ({ ...current, [item.id]: 'error' }));
    }
  }

  if (!modules.length) return null;

  return (
    <View style={styles.box}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={`Checklist, ${progress.answered} de ${progress.total} itens preenchidos`}
        onPress={() => setOpen((current) => !current)}
        style={styles.header}>
        <View style={styles.headerRow}>
          <AppText weight="semibold">Checklist</AppText>
          <AppText weight="semibold">
            {progress.answered} de {progress.total}
          </AppText>
        </View>
        <View style={styles.track} accessibilityElementsHidden>
          <View style={[styles.fill, { width: `${Math.round(ratio * 100)}%`, backgroundColor: color }]} />
        </View>
        <AppText variant="meta">{open ? 'Toque para recolher' : 'Toque para abrir'}</AppText>
      </Pressable>

      {open
        ? modules.map((module) => (
            <View key={module.id} style={styles.module}>
              <AppText weight="semibold">{module.name}</AppText>
              {(module.items ?? []).map((item) => (
                <ChecklistField
                  key={`${item.id}:${item.valueText ?? ''}:${item.valueNumber ?? ''}`}
                  item={item}
                  editable={editable}
                  color={color}
                  state={states[item.id]}
                  onSave={save}
                />
              ))}
            </View>
          ))
        : null}
    </View>
  );
}

const numberSchema = yup.object({
  value: yup
    .string()
    .defined()
    .test('number', 'Digite um número válido.', (value) => {
      if (!value.trim()) return true;
      return Number.isFinite(Number(value.replace(',', '.')));
    }),
});

const textSchema = yup.object({
  value: yup.string().defined(),
});

type FieldValues = yup.InferType<typeof textSchema>;

function numberDraft(value: string) {
  const cleaned = value.replace(/[^\d,]/g, '');
  const [head, ...rest] = cleaned.split(',');
  return rest.length ? `${head},${rest.join('')}` : head;
}

function ChecklistField({
  item,
  editable,
  color,
  state,
  onSave,
}: {
  item: ChecklistItem;
  editable: boolean;
  color: string;
  state?: ItemState;
  onSave: (
    item: ChecklistItem,
    body: { valueBoolean?: boolean; valueNumber?: number; valueText?: string },
  ) => Promise<void>;
}) {
  const type = (item.expectedType || 'TEXT').toUpperCase();
  const initial =
    type === 'NUMBER'
      ? item.valueNumber === null || item.valueNumber === undefined
        ? ''
        : String(item.valueNumber).replace('.', ',')
      : (item.valueText ?? '');
  const { control, handleSubmit, watch } = useForm<FieldValues>({
    resolver: yupResolver(type === 'NUMBER' ? numberSchema : textSchema),
    defaultValues: { value: initial },
  });
  const draft = watch('value');

  const saveDraft = handleSubmit((values) => {
    if (!draftChanged(type, values.value, item)) return;
    if (type === 'NUMBER') {
      void onSave(item, { valueNumber: Number(values.value.replace(',', '.')) });
      return;
    }
    void onSave(item, { valueText: values.value.trim() });
  });

  return (
    <View style={styles.item}>
      <AppText>{item.question}</AppText>
      {type === 'BOOLEAN' ? (
        <View style={styles.choices}>
          <Choice
            label="Sim"
            selected={item.valueBoolean === true}
            disabled={!editable || state === 'saving'}
            onPress={() => onSave(item, { valueBoolean: true })}
            color={color}
          />
          <Choice
            label="Não"
            selected={item.valueBoolean === false}
            disabled={!editable || state === 'saving'}
            color={color}
            onPress={() => onSave(item, { valueBoolean: false })}
          />
        </View>
      ) : (
        <TextInput
          control={control}
          name="value"
          disabled={!editable || state === 'saving'}
          accessibilityLabel={item.question}
          keyboardType={type === 'NUMBER' ? 'numbers-and-punctuation' : 'default'}
          multiline={type !== 'NUMBER'}
          format={type === 'NUMBER' ? numberDraft : undefined}
          containerStyle={type === 'NUMBER' ? styles.numberInput : styles.input}
        />
      )}
      {type !== 'BOOLEAN' ? (
        <AppButton
          label={
            state === 'saving'
              ? 'Salvando'
              : state === 'error'
                ? 'Erro'
                : state === 'saved' && !draftChanged(type, draft, item)
                  ? 'Salvo'
                  : 'Salvar'
          }
          color={color}
          disabled={!editable || state === 'saving'}
          loading={state === 'saving'}
          onPress={() => void saveDraft()}
        />
      ) : null}
      <AppText variant="meta" style={state === 'error' ? { color: theme.color.error } : undefined}>
        {state === 'saving'
          ? 'Salvando'
          : state === 'saved'
            ? 'Salvo'
            : state === 'error'
              ? 'Erro. Toque em Salvar de novo.'
              : isChecklistItemAnswered(item)
                ? 'Preenchido'
                : 'Sem resposta'}
      </AppText>
    </View>
  );
}

function draftChanged(type: string, draft: string, item: ChecklistItem) {
  if (type === 'NUMBER') {
    const parsed = Number(draft.replace(',', '.'));
    if (!Number.isFinite(parsed)) return draft.trim().length > 0;
    return parsed !== item.valueNumber;
  }
  return draft.trim() !== (item.valueText ?? '').trim();
}

function Choice({
  label,
  selected,
  disabled,
  color,
  onPress,
}: {
  label: string;
  selected: boolean;
  disabled: boolean;
  color: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected, disabled }}
      accessibilityLabel={label}
      disabled={disabled}
      onPress={onPress}
      style={[
        styles.choice,
        selected ? { backgroundColor: color, borderColor: color } : null,
        disabled ? styles.disabled : null,
      ]}>
      <AppText weight="semibold" color={selected ? theme.color.white : theme.color.text}>
        {label}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  box: {
    borderWidth: 2,
    borderColor: theme.color.line,
    borderRadius: theme.radius,
    padding: 16,
    gap: 12,
  },
  header: {
    gap: 8,
    minHeight: theme.control,
    justifyContent: 'center',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  track: {
    height: 8,
    borderRadius: 4,
    backgroundColor: theme.color.line,
    overflow: 'hidden',
  },
  fill: {
    height: 8,
  },
  module: {
    gap: 12,
  },
  item: {
    gap: 8,
  },
  choices: {
    flexDirection: 'row',
    gap: 12,
  },
  choice: {
    minHeight: theme.control,
    minWidth: 96,
    borderWidth: 2,
    borderColor: theme.color.line,
    borderRadius: theme.radius,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  disabled: {
    opacity: 0.5,
  },
  numberInput: {
    borderWidth: 2,
    borderColor: theme.color.line,
    borderRadius: theme.radius,
    paddingHorizontal: 16,
    backgroundColor: theme.color.white,
  },
  input: {
    borderWidth: 2,
    borderColor: theme.color.line,
    borderRadius: theme.radius,
    paddingHorizontal: 16,
    backgroundColor: theme.color.white,
  },
});
