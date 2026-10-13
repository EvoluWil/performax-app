import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useRef } from 'react';
import { AppState, Platform } from 'react-native';

import { markNotificationRead } from '@/features/notification/notification-api';
import { loadNotifications } from '@/features/notification/notifications';
import { registerPushToken } from '@/features/notification/push';
import { useCompany, useSession } from '@/providers/session-provider';

const Notifications = loadNotifications();

type PushData = {
  companyId?: string;
  entityId?: string;
  notificationId?: string;
  domain?: string;
};

export function NotificationBridge() {
  const { tokens } = useSession();
  const { selectCompany } = useCompany();
  const router = useRouter();
  const queryClient = useQueryClient();
  const handled = useRef<string | null>(null);

  const openFromData = useCallback(
    async (data: unknown) => {
      if (!data || typeof data !== 'object') return;
      const payload = data as PushData;
      if (payload.domain && payload.domain !== 'TASK') return;
      if (!payload.entityId) return;

      const key = payload.notificationId ?? payload.entityId;
      if (handled.current === key) return;
      handled.current = key;

      if (payload.companyId) await selectCompany(payload.companyId);
      if (payload.companyId && payload.notificationId) {
        void markNotificationRead(payload.companyId, payload.notificationId).catch(() => undefined);
      }
      router.push({ pathname: '/task/[taskId]', params: { taskId: payload.entityId } });
    },
    [router, selectCompany],
  );

  useEffect(() => {
    if (!tokens || (Platform.OS !== 'ios' && Platform.OS !== 'android')) return;
    void registerPushToken();
  }, [tokens]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        void queryClient.invalidateQueries({ queryKey: ['notifications'] });
      }
    });
    return () => sub.remove();
  }, [queryClient]);

  useEffect(() => {
    if (!Notifications || !tokens || (Platform.OS !== 'ios' && Platform.OS !== 'android')) return;

    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      void openFromData(response.notification.request.content.data);
    });

    void Notifications.getLastNotificationResponseAsync().then((response) => {
      if (response) void openFromData(response.notification.request.content.data);
    });

    return () => subscription.remove();
  }, [openFromData, tokens]);

  return null;
}
