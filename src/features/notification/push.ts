import Constants from 'expo-constants';
import * as Device from 'expo-device';
import { Platform } from 'react-native';

import { loadNotifications } from '@/features/notification/notifications';
import { apiFetch } from '@/services/api';

const Notifications = loadNotifications();

if (Notifications) {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}

let currentPushToken: string | null = null;

function projectId() {
  return (
    Constants.expoConfig?.extra?.eas?.projectId ??
    Constants.easConfig?.projectId ??
    null
  );
}

export async function registerPushToken() {
  if (!Notifications) return;
  if (Platform.OS !== 'ios' && Platform.OS !== 'android') return;
  if (!Device.isDevice) return;

  const id = projectId();
  if (!id) return;

  const current = await Notifications.getPermissionsAsync();
  let status = current.status;
  if (status !== 'granted') {
    const requested = await Notifications.requestPermissionsAsync();
    status = requested.status;
  }
  if (status !== 'granted') return;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Ordens de serviço',
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }

  const token = (await Notifications.getExpoPushTokenAsync({ projectId: id })).data;
  currentPushToken = token;
  await apiFetch('/push-devices', {
    method: 'PUT',
    body: { token, platform: Platform.OS },
  });
}

export async function unregisterPushToken() {
  const token = currentPushToken;
  currentPushToken = null;
  if (!token) return;
  try {
    await apiFetch('/push-devices', { method: 'DELETE', body: { token } });
  } catch {
    // O logout segue mesmo se o aparelho não puder ser desregistrado.
  }
}
