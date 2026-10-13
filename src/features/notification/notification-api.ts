import { apiFetch } from '@/services/api';

export type TaskNotification = {
  id: string;
  domain: 'TASK';
  type: string;
  entityId: string;
  title: string;
  body: string;
  readAt: string | null;
  createdAt: string;
};

export type NotificationPage = {
  data: TaskNotification[];
  nextCursor: string | null;
};

export function notificationQueryKey(companyId: string) {
  return ['notifications', companyId, 'TASK'] as const;
}

export function listTaskNotifications(
  companyId: string,
  cursor?: string,
  signal?: AbortSignal,
) {
  return apiFetch<NotificationPage>(`/companies/${companyId}/notifications`, {
    signal,
    searchParams: {
      domain: 'TASK',
      limit: '20',
      ...(cursor ? { cursor } : {}),
    },
  });
}

export function unreadTaskCount(companyId: string, signal?: AbortSignal) {
  return apiFetch<{ count: number }>(`/companies/${companyId}/notifications/unread-count`, {
    signal,
    searchParams: { domain: 'TASK' },
  });
}

export function markNotificationRead(companyId: string, notificationId: string) {
  return apiFetch<{ ok: boolean }>(
    `/companies/${companyId}/notifications/${notificationId}/read`,
    { method: 'PUT' },
  );
}

export function markAllTaskNotificationsRead(companyId: string) {
  return apiFetch<{ ok: boolean }>(`/companies/${companyId}/notifications/read-all`, {
    method: 'PUT',
    searchParams: { domain: 'TASK' },
  });
}
