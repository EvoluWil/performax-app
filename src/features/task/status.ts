import { MaterialIcons } from '@expo/vector-icons';

import { TaskStatus } from '@/features/task/types';
import { theme } from '@/constants/theme';

export const START_STATUSES: TaskStatus[] = [
  'PENDING',
  'OPEN',
  'SCHEDULED',
  'EMERGENCY',
  'APPROVED',
  'EXPIRED',
];

export const TODO_STATUSES: TaskStatus[] = [
  'PENDING',
  'OPEN',
  'APPROVED',
  'SCHEDULED',
  'EMERGENCY',
  'EXPIRED',
];

export const OPEN_STATUSES: TaskStatus[] = [...TODO_STATUSES, 'IN_PROGRESS', 'IMPEDED'];

export const CLOSED_STATUSES: TaskStatus[] = ['CLOSED', 'REJECTED'];

export type TaskChip = 'all' | 'progress' | 'todo' | 'impeded' | 'closed';

export const TASK_CHIPS: { id: TaskChip; label: string }[] = [
  { id: 'all', label: 'Todas' },
  { id: 'progress', label: 'Em andamento' },
  { id: 'todo', label: 'Para fazer' },
  { id: 'impeded', label: 'Impedidas' },
  { id: 'closed', label: 'Encerradas' },
];

export function statusesForChip(chip: TaskChip): TaskStatus[] {
  if (chip === 'progress') return ['IN_PROGRESS'];
  if (chip === 'todo') return TODO_STATUSES;
  if (chip === 'impeded') return ['IMPEDED'];
  if (chip === 'closed') return CLOSED_STATUSES;
  return OPEN_STATUSES;
}

type Presentation = {
  label: string;
  icon: keyof typeof MaterialIcons.glyphMap;
  color: string;
  fill: string;
};

const PRESENTATION: Record<TaskStatus, Presentation> = {
  PENDING: { label: 'Pendente', icon: 'schedule', color: theme.color.warning, fill: theme.color.warningFill },
  APPROVED: { label: 'Aprovada', icon: 'check', color: theme.color.success, fill: theme.color.successFill },
  REJECTED: { label: 'Rejeitada', icon: 'cancel', color: theme.color.error, fill: '#FDE8EB' },
  OPEN: { label: 'Em aberto', icon: 'inbox', color: theme.color.primaryDark, fill: '#F3EEFF' },
  CLOSED: { label: 'Fechada', icon: 'check-circle', color: theme.color.text, fill: theme.color.surface },
  EXPIRED: { label: 'Em atraso', icon: 'warning', color: theme.color.error, fill: '#FDE8EB' },
  EMERGENCY: { label: 'Emergencial', icon: 'priority-high', color: theme.color.error, fill: '#FDE8EB' },
  SCHEDULED: { label: 'Agendada', icon: 'event', color: theme.color.primaryDark, fill: '#F3EEFF' },
  IMPEDED: { label: 'Impedida', icon: 'block', color: theme.color.warning, fill: theme.color.warningFill },
  IN_PROGRESS: { label: 'Em progresso', icon: 'play-arrow', color: theme.color.success, fill: theme.color.successFill },
};

export function statusPresentation(status: TaskStatus): Presentation {
  return PRESENTATION[status] ?? {
    label: status,
    icon: 'help-outline',
    color: theme.color.text,
    fill: theme.color.surface,
  };
}

export function isUrgent(status: TaskStatus) {
  return status === 'EMERGENCY' || status === 'EXPIRED';
}

export function formatWhen(value?: string | null) {
  if (!value) return 'Sem previsão';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Sem previsão';
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(date);
}

export function firstName(name?: string) {
  const piece = name?.trim().split(/\s+/)[0];
  return piece || 'operador';
}
