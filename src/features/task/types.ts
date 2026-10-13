export type TaskStatus =
  | 'PENDING'
  | 'APPROVED'
  | 'REJECTED'
  | 'OPEN'
  | 'CLOSED'
  | 'EXPIRED'
  | 'EMERGENCY'
  | 'SCHEDULED'
  | 'IMPEDED'
  | 'IN_PROGRESS';

export type TaskFile = {
  url: string;
  type: string;
};

export type ChecklistItem = {
  id: string;
  question: string;
  expectedType: string;
  valueBoolean?: boolean | null;
  valueNumber?: number | null;
  valueText?: string | null;
};

export type ChecklistModule = {
  id: string;
  name: string;
  items?: ChecklistItem[];
};

export type TaskChecklist = {
  id: string;
  modules?: ChecklistModule[];
};

export type TaskPerson = {
  id: string;
  name?: string | null;
};

export type TaskClient = {
  id: string;
  name?: string | null;
  address?: string | null;
};

export type Task = {
  id: string;
  protocol?: string | null;
  title: string;
  description?: string | null;
  internalNote?: string | null;
  impedimentNote?: string | null;
  conclusionNote?: string | null;
  status: TaskStatus;
  approved?: boolean | null;
  date?: string | null;
  companyId?: string;
  client?: TaskClient | null;
  responsible?: TaskPerson | null;
  responsibleId?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  createdBy?: TaskPerson | null;
  createdById?: string | null;
  files?: TaskFile[];
  conclusionFiles?: TaskFile[];
  checklist?: TaskChecklist | null;
};

export type TaskListResponse = {
  count: number;
  data: Task[];
};

export function checklistItems(task?: Task | null) {
  return task?.checklist?.modules?.flatMap((module) => module.items ?? []) ?? [];
}

export function isChecklistItemAnswered(item: ChecklistItem) {
  const type = (item.expectedType || '').toUpperCase();
  if (type === 'BOOLEAN') return item.valueBoolean === true || item.valueBoolean === false;
  if (type === 'NUMBER') {
    return item.valueNumber !== null && item.valueNumber !== undefined && !Number.isNaN(item.valueNumber);
  }
  return Boolean(item.valueText && item.valueText.trim());
}

export function checklistProgress(task?: Task | null) {
  const items = checklistItems(task);
  const answered = items.filter(isChecklistItemAnswered).length;
  return { answered, total: items.length };
}
