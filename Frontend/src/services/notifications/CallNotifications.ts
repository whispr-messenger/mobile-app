/**
 * CallNotifications - Service pour gérer les notifications push pour les appels entrants
 * Utilise expo-notifications pour afficher des notifications natives
 */

import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

// Configuration des notifications
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export interface CallNotificationData {
  callId: string;
  fromUserId: string;
  fromDisplayName: string;
  fromAvatarUrl?: string;
  callType: 'audio' | 'video';
  conversationId?: string;
}

class CallNotificationsService {
  private static instance: CallNotificationsService;
  private notificationListener: any = null;
  private responseListener: any = null;

  private constructor() {
    console.log('[CallNotifications] Service initialized');
  }

  static getInstance(): CallNotificationsService {
    if (!CallNotificationsService.instance) {
      CallNotificationsService.instance = new CallNotificationsService();
    }
    return CallNotificationsService.instance;
  }

  /**
   * Demande les permissions pour les notifications
   */
  async requestPermissions(): Promise<boolean> {
    try {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== 'granted') {
        console.warn('[CallNotifications] Notification permissions not granted');
        return false;
      }

      // Configuration spécifique pour Android
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('incoming-calls', {
          name: 'Appels entrants',
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#FF6B6B',
          sound: 'default',
        });
      }

      console.log('[CallNotifications] Permissions granted');
      return true;
    } catch (error) {
      console.error('[CallNotifications] Error requesting permissions:', error);
      return false;
    }
  }

  /**
   * Affiche une notification pour un appel entrant
   */
  async showIncomingCallNotification(data: CallNotificationData): Promise<string | null> {
    try {
      const hasPermission = await this.requestPermissions();
      if (!hasPermission) {
        console.warn('[CallNotifications] Cannot show notification: no permission');
        return null;
      }

      const notificationId = await Notifications.scheduleNotificationAsync({
        content: {
          title: data.fromDisplayName,
          body: data.callType === 'video' ? 'Appel vidéo entrant' : 'Appel audio entrant',
          data: {
            type: 'incoming_call',
            ...data,
          },
          sound: true,
          priority: Notifications.AndroidNotificationPriority.MAX,
          categoryIdentifier: 'incoming_call',
        },
        trigger: null, // Notification immédiate
      });

      console.log('[CallNotifications] Notification shown:', notificationId);
      return notificationId;
    } catch (error) {
      console.error('[CallNotifications] Error showing notification:', error);
      return null;
    }
  }

  /**
   * Annule une notification d'appel
   */
  async cancelCallNotification(notificationId: string): Promise<void> {
    try {
      await Notifications.cancelScheduledNotificationAsync(notificationId);
      console.log('[CallNotifications] Notification cancelled:', notificationId);
    } catch (error) {
      console.error('[CallNotifications] Error cancelling notification:', error);
    }
  }

  /**
   * Configure les actions de notification (Accepter/Rejeter)
   */
  async setupNotificationActions(): Promise<void> {
    try {
      // Actions pour Android
      if (Platform.OS === 'android') {
        await Notifications.setNotificationCategoryAsync('incoming_call', [
          {
            identifier: 'accept_call',
            buttonTitle: 'Accepter',
            options: {
              opensAppToForeground: true,
            },
          },
          {
            identifier: 'reject_call',
            buttonTitle: 'Rejeter',
            options: {
              opensAppToForeground: false,
            },
          },
        ]);
      }

      console.log('[CallNotifications] Notification actions configured');
    } catch (error) {
      console.error('[CallNotifications] Error setting up notification actions:', error);
    }
  }

  /**
   * Configure les listeners pour les réponses aux notifications
   */
  setupNotificationListeners(
    onNotificationReceived: (data: CallNotificationData) => void,
    onNotificationResponse?: (response: Notifications.NotificationResponse) => void
  ): void {
    // Listener pour les notifications reçues quand l'app est au premier plan
    this.notificationListener = Notifications.addNotificationReceivedListener((notification) => {
      const data = notification.request.content.data;
      if (data.type === 'incoming_call') {
        console.log('[CallNotifications] Incoming call notification received');
        onNotificationReceived(data as CallNotificationData);
      }
    });

    // Listener pour les réponses aux notifications (boutons Accepter/Rejeter)
    if (onNotificationResponse) {
      this.responseListener = Notifications.addNotificationResponseReceivedListener(
        onNotificationResponse
      );
    }

    console.log('[CallNotifications] Notification listeners setup');
  }

  /**
   * Nettoie les listeners
   */
  cleanup(): void {
    if (this.notificationListener) {
      Notifications.removeNotificationSubscription(this.notificationListener);
      this.notificationListener = null;
    }
    if (this.responseListener) {
      Notifications.removeNotificationSubscription(this.responseListener);
      this.responseListener = null;
    }
    console.log('[CallNotifications] Listeners cleaned up');
  }

  /**
   * Obtient le token de notification push (pour le backend)
   */
  async getPushToken(): Promise<string | null> {
    try {
      const hasPermission = await this.requestPermissions();
      if (!hasPermission) {
        return null;
      }

      const tokenData = await Notifications.getExpoPushTokenAsync();
      console.log('[CallNotifications] Push token obtained');
      return tokenData.data;
    } catch (error) {
      console.error('[CallNotifications] Error getting push token:', error);
      return null;
    }
  }
}

export default CallNotificationsService;
