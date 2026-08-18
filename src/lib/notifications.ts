import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { supabase } from '@/lib/supabase';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export async function registerPushNotifications(userId: string) {
  if (Platform.OS === 'web') return { error: 'Push web será configurado junto da hospedagem.' };
  if (!Device.isDevice) return { error: 'Use um aparelho físico para ativar notificações.' };

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('appointments', {
      name: 'Agendamentos',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 150, 250],
      lightColor: '#135DFF',
    });
  }

  const current = await Notifications.getPermissionsAsync();
  const permission = current.status === 'granted' ? current : await Notifications.requestPermissionsAsync();
  if (permission.status !== 'granted') return { error: 'Permissão de notificações não concedida.' };

  const projectId = process.env.EXPO_PUBLIC_EAS_PROJECT_ID
    ?? Constants.expoConfig?.extra?.eas?.projectId
    ?? Constants.easConfig?.projectId;
  if (!projectId) return { error: 'Vincule o projeto ao EAS para gerar o token push.' };

  const token = await Notifications.getExpoPushTokenAsync({ projectId });
  if (!supabase) return { error: 'Backend ainda não configurado.' };
  const { error } = await supabase.from('push_tokens').upsert({
    user_id: userId,
    expo_push_token: token.data,
    platform: Platform.OS,
    active: true,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'expo_push_token' });
  return error ? { error: error.message } : { token: token.data };
}
