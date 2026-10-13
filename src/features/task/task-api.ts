import { Query } from 'nestjs-prisma-querybuilder-interface';

import { statusesForChip, TaskChip } from '@/features/task/status';
import { Task, TaskFile, TaskListResponse } from '@/features/task/types';
import { apiFetch } from '@/services/api';

const PAGE_SIZE = 20;

export function taskQueryKey(
  companyId: string,
  mine: 'assigned' | 'created',
  chip: TaskChip,
  term: string,
) {
  return ['tasks', companyId, mine, chip, term] as const;
}

export function buildTaskQuery(page: number, chip: TaskChip, term: string): Query {
  const filter: NonNullable<Query['filter']> = [
    {
      path: 'status',
      operator: 'in',
      value: statusesForChip(chip).join(';'),
      filterGroup: 'and',
    },
  ];

  const trimmed = term.trim();
  if (trimmed) {
    filter.push({
      or: [
        { path: 'protocol', operator: 'contains', value: trimmed, insensitive: true },
        { path: 'title', operator: 'contains', value: trimmed, insensitive: true },
        { path: 'description', operator: 'contains', value: trimmed, insensitive: true },
        {
          path: 'client',
          filterGroup: 'or',
          filter: [
            { path: 'name', operator: 'contains', value: trimmed, insensitive: true, filterGroup: 'or' },
            { path: 'address', operator: 'contains', value: trimmed, insensitive: true, filterGroup: 'or' },
          ],
        },
      ],
    } as NonNullable<Query['filter']>[number]);
  }

  return {
    select: 'all',
    populate: [
      { path: 'client', select: 'id name address' },
      { path: 'responsible', select: 'id name' },
      { path: 'createdBy', select: 'id name' },
      { path: 'type', select: 'id name' },
    ],
    sort: { field: 'date', criteria: 'asc' },
    limit: PAGE_SIZE,
    page,
    filter,
  };
}

export function fetchTasks(
  companyId: string,
  mine: 'assigned' | 'created',
  chip: TaskChip,
  term: string,
  page: number,
  signal?: AbortSignal,
) {
  return apiFetch<TaskListResponse>(`/companies/${companyId}/tasks`, {
    signal,
    query: buildTaskQuery(page, chip, term),
    searchParams: { mine },
  });
}

export function fetchTask(companyId: string, taskId: string, signal?: AbortSignal) {
  return apiFetch<Task>(`/companies/${companyId}/tasks/${taskId}`, { signal });
}

export function updateTask(companyId: string, taskId: string, body: Record<string, unknown>) {
  return apiFetch<{ ok: boolean }>(`/companies/${companyId}/tasks/${taskId}`, {
    method: 'PUT',
    body,
  });
}

export function updateChecklistItem(
  companyId: string,
  checklistId: string,
  itemId: string,
  body: { valueBoolean?: boolean; valueNumber?: number; valueText?: string },
) {
  return apiFetch<{ ok: boolean }>(
    `/companies/${companyId}/checklists/${checklistId}/items/${itemId}`,
    { method: 'PUT', body },
  );
}

export async function appendTaskFiles(
  companyId: string,
  taskId: string,
  field: 'files' | 'conclusionFiles',
  file: TaskFile,
) {
  const current = await fetchTask(companyId, taskId);
  const existing = current[field] ?? [];
  const next = existing.some((item) => item.url === file.url) ? existing : [...existing, file];
  await updateTask(companyId, taskId, { [field]: next });
  return fetchTask(companyId, taskId);
}

export const TASK_PAGE_SIZE = PAGE_SIZE;
