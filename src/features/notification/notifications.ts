import { isRunningInExpoGo } from 'expo';
import { Platform } from 'react-native';

type NotificationsModule = typeof import('expo-notifications');

// O import estático de expo-notifications chama o registro automático de push
// e, no Expo Go no Android, isso lança erro e impede o app de abrir.
export function pushNotificationsSupported() {
  return !(isRunningInExpoGo() && Platform.OS === 'android');
}

export function loadNotifications(): NotificationsModule | null {
  if (!pushNotificationsSupported()) return null;
  return require('expo-notifications') as NotificationsModule;
}
