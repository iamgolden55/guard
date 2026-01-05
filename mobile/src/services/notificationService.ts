import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { API_CONFIG, NOTIFICATION_CONFIG } from '../utils/constants';
import api from './api';

// Configure notification behavior
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

interface Shift {
  id: number;
  start_time: string;
  end_time: string;
  venue: {
    name: string;
    address: string;
  };
  status: string;
}

interface ScheduledNotification {
  notificationId: string;
  shiftId: number;
  type: 'advance' | 'soon' | 'imminent' | 'final';
  scheduledTime: string;
}

const STORAGE_KEY = {
  PUSH_TOKEN: '@push_token',
  SCHEDULED_NOTIFICATIONS: '@scheduled_notifications',
  NOTIFICATION_PERMISSIONS: '@notification_permissions',
};

class NotificationService {
  private pushToken: string | null = null;
  private notificationListener: Notifications.Subscription | null = null;
  private responseListener: Notifications.Subscription | null = null;

  /**
   * Request notification permissions from the user
   * Required before scheduling or receiving notifications
   */
  async requestPermissions(): Promise<boolean> {
    try {
      // Check if we're on a physical device
      if (!Device.isDevice) {
        console.warn('Push notifications only work on physical devices');
        return false;
      }

      // Get existing permissions
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      // If not granted, request permissions
      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      const granted = finalStatus === 'granted';

      // Store permission status
      await AsyncStorage.setItem(
        STORAGE_KEY.NOTIFICATION_PERMISSIONS,
        JSON.stringify({ granted, timestamp: new Date().toISOString() })
      );

      if (!granted) {
        console.warn('Notification permissions not granted');
      }

      return granted;
    } catch (error) {
      console.error('Error requesting notification permissions:', error);
      return false;
    }
  }

  /**
   * Check if notification permissions are granted
   */
  async hasPermissions(): Promise<boolean> {
    try {
      const { status } = await Notifications.getPermissionsAsync();
      return status === 'granted';
    } catch (error) {
      console.error('Error checking notification permissions:', error);
      return false;
    }
  }

  /**
   * Create notification channels for Android
   * Channels allow users to control notification settings per category
   */
  async createNotificationChannels(): Promise<void> {
    if (Platform.OS === 'android') {
      try {
        // Shift Reminders Channel
        await Notifications.setNotificationChannelAsync(
          NOTIFICATION_CONFIG.CHANNELS.SHIFT_REMINDERS,
          {
            name: 'Shift Reminders',
            importance: Notifications.AndroidImportance.HIGH,
            vibrationPattern: [0, 250, 250, 250],
            lightColor: '#2196F3',
            sound: 'default',
            description: 'Notifications for upcoming shifts and shift reminders',
          }
        );

        // Incident Alerts Channel
        await Notifications.setNotificationChannelAsync(
          NOTIFICATION_CONFIG.CHANNELS.INCIDENT_ALERTS,
          {
            name: 'Incident Alerts',
            importance: Notifications.AndroidImportance.MAX,
            vibrationPattern: [0, 500, 250, 500],
            lightColor: '#FF0000',
            sound: 'default',
            description: 'Critical incident notifications requiring immediate attention',
          }
        );

        // Sync Status Channel
        await Notifications.setNotificationChannelAsync(
          NOTIFICATION_CONFIG.CHANNELS.SYNC_STATUS,
          {
            name: 'Sync Status',
            importance: Notifications.AndroidImportance.LOW,
            vibrationPattern: [0, 100],
            lightColor: '#4CAF50',
            description: 'Offline sync status and completion notifications',
          }
        );

        console.log('Notification channels created successfully');
      } catch (error) {
        console.error('Error creating notification channels:', error);
      }
    }
  }

  /**
   * Register for push notifications and get Expo push token
   * This token is sent to the backend for remote push notifications
   *
   * NOTE: This is OPTIONAL and only needed for remote push notifications.
   * Local notifications (shift reminders) work WITHOUT push tokens!
   */
  async registerPushToken(): Promise<string | null> {
    try {
      // Skip push token registration in Expo Go (not supported on Android SDK 53+)
      const isExpoGo = Constants.executionEnvironment === 'storeClient';
      if (isExpoGo && Platform.OS === 'android') {
        console.log('[Notifications] 📱 Running in Expo Go - remote push not available');
        console.log('[Notifications] ✅ Local shift reminders will work offline!');
        console.log('[Notifications] 💡 Use a development build for remote push notifications');
        return null;
      }

      // Skip push token registration if no valid project ID configured
      // This is expected in development - local notifications will still work!
      if (!API_CONFIG.EXPO_PROJECT_ID || API_CONFIG.EXPO_PROJECT_ID === 'your-expo-project-id') {
        console.log('[Notifications] Skipping push token registration (no project ID configured)');
        console.log('[Notifications] ✅ Local notifications will still work!');
        return null;
      }

      if (!Device.isDevice) {
        console.log('[Notifications] Push tokens only work on physical devices (simulator detected)');
        return null;
      }

      // Check permissions first
      const hasPermission = await this.hasPermissions();
      if (!hasPermission) {
        console.warn('[Notifications] Cannot register push token without permissions');
        return null;
      }

      // Get Expo push token
      const tokenData = await Notifications.getExpoPushTokenAsync({
        projectId: API_CONFIG.EXPO_PROJECT_ID,
      });
      const token = tokenData.data;

      this.pushToken = token;

      // Store token locally
      await AsyncStorage.setItem(STORAGE_KEY.PUSH_TOKEN, token);

      // Register token with backend
      await this.registerTokenWithBackend(token);

      console.log('[Notifications] ✅ Push token registered:', token);
      return token;
    } catch (error) {
      // Don't spam console with errors - this is expected without valid project ID
      console.log('[Notifications] Push token registration skipped');
      console.log('[Notifications] ✅ Local notifications will still work!');
      return null;
    }
  }

  /**
   * Register push token with backend
   */
  private async registerTokenWithBackend(token: string): Promise<void> {
    try {
      await api.post('/api/v1/notifications/devices/', {
        token,
        platform: Platform.OS,
        device_id: Device.osInternalBuildId || 'unknown',
      });
      console.log('Push token registered with backend successfully');
    } catch (error: any) {
      // Handle duplicate token gracefully (HTTP 400)
      if (error?.statusCode === 400) {
        console.log('[Notifications] Push token already registered (skipping)');
      } else {
        console.error('Error registering token with backend:', error);
      }
      // Don't throw - local notifications will still work
    }
  }

  /**
   * Schedule shift reminder notifications
   * Creates two notifications: advance (3h before) and final (45min before)
   * WITH DEDUPLICATION: Checks if notifications already exist before scheduling
   */
  async scheduleShiftReminder(shift: Shift): Promise<string[]> {
    try {
      // Only schedule for upcoming shifts
      if (shift.status !== 'scheduled') {
        return [];
      }

      const shiftStartTime = new Date(shift.start_time);
      const now = new Date();

      // Don't schedule if shift has already started
      if (shiftStartTime <= now) {
        return [];
      }

      // DEDUPLICATION CHECK: Check if notifications already exist for this shift
      const existingNotifications = await this.getNotificationsForShift(shift.id);

      if (existingNotifications.length > 0) {
        // Validate they're still correct (shift time hasn't changed)
        const isStillValid = this.validateExistingNotifications(existingNotifications, shift);

        if (isStillValid) {
          console.log(
            `[Notifications] ⏭️  Notifications already scheduled for shift ${shift.id}, skipping (${existingNotifications.length} existing)`
          );
          return existingNotifications.map(n => n.notificationId);
        } else {
          // Shift time changed, cancel old notifications and schedule new ones
          console.log(
            `[Notifications] 🔄 Shift ${shift.id} time changed, rescheduling notifications`
          );
          await this.cancelShiftReminders(shift.id);
        }
      }

      const notificationIds: string[] = [];
      const scheduledNotifications: ScheduledNotification[] = [];

      // Calculate trigger times
      const advanceReminderTime = new Date(
        shiftStartTime.getTime() - NOTIFICATION_CONFIG.ADVANCE_REMINDER_HOURS * 60 * 60 * 1000
      );
      const soonReminderTime = new Date(
        shiftStartTime.getTime() - NOTIFICATION_CONFIG.SOON_REMINDER_MINUTES * 60 * 1000
      );
      const imminentReminderTime = new Date(
        shiftStartTime.getTime() - NOTIFICATION_CONFIG.IMMINENT_REMINDER_MINUTES * 60 * 1000
      );

      // Schedule advance reminder (3 hours before)
      if (advanceReminderTime > now) {
        const advanceId = await Notifications.scheduleNotificationAsync({
          content: {
            title: '📅 Shift Reminder',
            body: `Your shift at ${shift.venue.name} starts in ${NOTIFICATION_CONFIG.ADVANCE_REMINDER_HOURS} hours`,
            data: {
              shiftId: shift.id,
              type: 'advance_reminder',
              screen: 'ShiftDetails',
            },
            sound: 'default',
            priority: Notifications.AndroidNotificationPriority.HIGH,
          },
          trigger: {
            channelId: NOTIFICATION_CONFIG.CHANNELS.SHIFT_REMINDERS,
            date: advanceReminderTime,
          },
        });

        notificationIds.push(advanceId);
        scheduledNotifications.push({
          notificationId: advanceId,
          shiftId: shift.id,
          type: 'advance',
          scheduledTime: advanceReminderTime.toISOString(),
        });
      }

      // Schedule soon reminder (45 minutes before)
      if (soonReminderTime > now) {
        const soonId = await Notifications.scheduleNotificationAsync({
          content: {
            title: '⏰ Shift Starting Soon!',
            body: `Your shift at ${shift.venue.name} starts in ${NOTIFICATION_CONFIG.SOON_REMINDER_MINUTES} minutes. Get ready!`,
            data: {
              shiftId: shift.id,
              type: 'soon_reminder',
              screen: 'ShiftDetails',
            },
            sound: 'default',
            priority: Notifications.AndroidNotificationPriority.HIGH,
          },
          trigger: {
            channelId: NOTIFICATION_CONFIG.CHANNELS.SHIFT_REMINDERS,
            date: soonReminderTime,
          },
        });

        notificationIds.push(soonId);
        scheduledNotifications.push({
          notificationId: soonId,
          shiftId: shift.id,
          type: 'soon',
          scheduledTime: soonReminderTime.toISOString(),
        });
      }

      // Schedule imminent reminder (5 minutes before)
      if (imminentReminderTime > now) {
        const imminentId = await Notifications.scheduleNotificationAsync({
          content: {
            title: '🚨 Almost Time!',
            body: `Your shift at ${shift.venue.name} starts in ${NOTIFICATION_CONFIG.IMMINENT_REMINDER_MINUTES} minutes. Head to the venue now!`,
            data: {
              shiftId: shift.id,
              type: 'imminent_reminder',
              screen: 'ShiftDetails',
            },
            sound: 'default',
            priority: Notifications.AndroidNotificationPriority.MAX,
          },
          trigger: {
            channelId: NOTIFICATION_CONFIG.CHANNELS.SHIFT_REMINDERS,
            date: imminentReminderTime,
          },
        });

        notificationIds.push(imminentId);
        scheduledNotifications.push({
          notificationId: imminentId,
          shiftId: shift.id,
          type: 'imminent',
          scheduledTime: imminentReminderTime.toISOString(),
        });
      }

      // Store scheduled notifications for later reference
      if (scheduledNotifications.length > 0) {
        await this.storeScheduledNotifications(scheduledNotifications);
      }

      console.log(
        `[Notifications] ✅ Scheduled ${notificationIds.length} NEW notifications for shift ${shift.id} (${shift.venue.name})`
      );
      return notificationIds;
    } catch (error) {
      console.error('Error scheduling shift reminder:', error);
      return [];
    }
  }

  /**
   * Get notifications for a specific shift
   * Helper method to check if notifications already exist
   */
  private async getNotificationsForShift(shiftId: number): Promise<ScheduledNotification[]> {
    const allNotifications = await this.getScheduledNotifications();
    return allNotifications.filter(n => n.shiftId === shiftId);
  }

  /**
   * Validate if existing notifications are still correct for the shift
   * Returns true if existing notifications match the current shift schedule
   */
  private validateExistingNotifications(
    existing: ScheduledNotification[],
    shift: Shift
  ): boolean {
    if (existing.length === 0) return false;

    // Check if scheduled times match current shift start time
    const shiftStartTime = new Date(shift.start_time);
    const expectedAdvance = new Date(
      shiftStartTime.getTime() - NOTIFICATION_CONFIG.ADVANCE_REMINDER_HOURS * 60 * 60 * 1000
    );
    const expectedSoon = new Date(
      shiftStartTime.getTime() - NOTIFICATION_CONFIG.SOON_REMINDER_MINUTES * 60 * 1000
    );
    const expectedImminent = new Date(
      shiftStartTime.getTime() - NOTIFICATION_CONFIG.IMMINENT_REMINDER_MINUTES * 60 * 1000
    );

    // Find notifications by type
    const advanceNotif = existing.find(n => n.type === 'advance');
    const soonNotif = existing.find(n => n.type === 'soon' || n.type === 'final'); // Support legacy 'final' type
    const imminentNotif = existing.find(n => n.type === 'imminent');

    // Validate times (allow 1 minute tolerance for rounding differences)
    const tolerance = 60 * 1000; // 1 minute
    const advanceValid = advanceNotif
      ? Math.abs(new Date(advanceNotif.scheduledTime).getTime() - expectedAdvance.getTime()) < tolerance
      : true;
    const soonValid = soonNotif
      ? Math.abs(new Date(soonNotif.scheduledTime).getTime() - expectedSoon.getTime()) < tolerance
      : true;
    const imminentValid = imminentNotif
      ? Math.abs(new Date(imminentNotif.scheduledTime).getTime() - expectedImminent.getTime()) < tolerance
      : true;

    return advanceValid && soonValid && imminentValid;
  }

  /**
   * Cancel all notifications for a specific shift
   */
  async cancelShiftReminders(shiftId: number): Promise<void> {
    try {
      // Get stored scheduled notifications
      const stored = await AsyncStorage.getItem(STORAGE_KEY.SCHEDULED_NOTIFICATIONS);
      if (!stored) return;

      const scheduledNotifications: ScheduledNotification[] = JSON.parse(stored);
      const notificationsForShift = scheduledNotifications.filter(n => n.shiftId === shiftId);

      // Cancel each notification
      for (const notification of notificationsForShift) {
        await Notifications.cancelScheduledNotificationAsync(notification.notificationId);
      }

      // Remove from stored notifications
      const remaining = scheduledNotifications.filter(n => n.shiftId !== shiftId);
      await AsyncStorage.setItem(STORAGE_KEY.SCHEDULED_NOTIFICATIONS, JSON.stringify(remaining));

      console.log(`Cancelled ${notificationsForShift.length} notifications for shift ${shiftId}`);
    } catch (error) {
      console.error('Error cancelling shift reminders:', error);
    }
  }

  /**
   * Cancel all scheduled notifications
   */
  async cancelAllNotifications(): Promise<void> {
    try {
      await Notifications.cancelAllScheduledNotificationsAsync();
      await AsyncStorage.removeItem(STORAGE_KEY.SCHEDULED_NOTIFICATIONS);
      console.log('All notifications cancelled');
    } catch (error) {
      console.error('Error cancelling all notifications:', error);
    }
  }

  /**
   * Store scheduled notifications for tracking
   * WITH DEDUPLICATION: Removes existing notifications for the same shifts before adding new ones
   */
  private async storeScheduledNotifications(
    notifications: ScheduledNotification[]
  ): Promise<void> {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY.SCHEDULED_NOTIFICATIONS);
      const existing: ScheduledNotification[] = stored ? JSON.parse(stored) : [];

      // Get shift IDs from new notifications
      const shiftIds = new Set(notifications.map(n => n.shiftId));

      // Remove any existing notifications for the same shifts (deduplication)
      const filtered = existing.filter(n => !shiftIds.has(n.shiftId));

      // Add new notifications
      const updated = [...filtered, ...notifications];

      await AsyncStorage.setItem(STORAGE_KEY.SCHEDULED_NOTIFICATIONS, JSON.stringify(updated));
      console.log(
        `[Notifications] 💾 Stored ${notifications.length} new notifications (removed ${existing.length - filtered.length} duplicates)`
      );
    } catch (error) {
      console.error('Error storing scheduled notifications:', error);
    }
  }

  /**
   * Get all scheduled notifications
   */
  async getScheduledNotifications(): Promise<ScheduledNotification[]> {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY.SCHEDULED_NOTIFICATIONS);
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      console.error('Error getting scheduled notifications:', error);
      return [];
    }
  }

  /**
   * Setup notification listeners for handling incoming notifications
   * and user interactions with notifications
   */
  setupNotificationListeners(
    onNotificationReceived?: (notification: Notifications.Notification) => void,
    onNotificationTapped?: (response: Notifications.NotificationResponse) => void
  ): void {
    // Listener for notifications received while app is foregrounded
    this.notificationListener = Notifications.addNotificationReceivedListener(notification => {
      console.log('Notification received:', notification);
      if (onNotificationReceived) {
        onNotificationReceived(notification);
      }
    });

    // Listener for user tapping on notifications
    this.responseListener = Notifications.addNotificationResponseReceivedListener(response => {
      console.log('Notification tapped:', response);
      if (onNotificationTapped) {
        onNotificationTapped(response);
      }
    });
  }

  /**
   * Remove notification listeners
   */
  removeNotificationListeners(): void {
    if (this.notificationListener) {
      this.notificationListener.remove();
      this.notificationListener = null;
    }
    if (this.responseListener) {
      this.responseListener.remove();
      this.responseListener = null;
    }
  }

  /**
   * Send a test notification (for debugging)
   */
  async sendTestNotification(): Promise<void> {
    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: '🧪 Test Notification',
          body: 'This is a test notification from the app',
          data: { test: true },
        },
        trigger: null, // Immediate notification
      });
    } catch (error) {
      console.error('Error sending test notification:', error);
    }
  }

  /**
   * Send a test shift reminder notification (simulates real notification)
   */
  async sendTestShiftReminder(shiftId: number = 123, venueName: string = 'Test Venue'): Promise<void> {
    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: '⏰ Shift Starting Soon!',
          body: `Your shift at ${venueName} starts in 45 minutes. Don't forget to check in!`,
          data: {
            shiftId: shiftId,
            type: 'final_reminder',
            screen: 'ShiftDetails',
          },
          sound: 'default',
          priority: Notifications.AndroidNotificationPriority.MAX,
        },
        trigger: null, // Immediate notification
      });
      console.log('Test shift reminder sent');
    } catch (error) {
      console.error('Error sending test shift reminder:', error);
    }
  }

  /**
   * Schedule a test notification for 10 seconds from now
   */
  async scheduleTestNotification(delaySeconds: number = 10): Promise<string> {
    try {
      const notificationId = await Notifications.scheduleNotificationAsync({
        content: {
          title: '📅 Test Scheduled Notification',
          body: `This notification was scheduled ${delaySeconds} seconds ago`,
          data: { test: true },
          sound: 'default',
        },
        trigger: {
          seconds: delaySeconds,
          channelId: NOTIFICATION_CONFIG.CHANNELS.SHIFT_REMINDERS,
        },
      });
      console.log(`Test notification scheduled for ${delaySeconds} seconds from now`);
      return notificationId;
    } catch (error) {
      console.error('Error scheduling test notification:', error);
      throw error;
    }
  }

  /**
   * Get notification badge count
   */
  async getBadgeCount(): Promise<number> {
    try {
      return await Notifications.getBadgeCountAsync();
    } catch (error) {
      console.error('Error getting badge count:', error);
      return 0;
    }
  }

  /**
   * Set notification badge count
   */
  async setBadgeCount(count: number): Promise<void> {
    try {
      await Notifications.setBadgeCountAsync(count);
    } catch (error) {
      console.error('Error setting badge count:', error);
    }
  }

  /**
   * Clear notification badge
   */
  async clearBadge(): Promise<void> {
    try {
      await Notifications.setBadgeCountAsync(0);
    } catch (error) {
      console.error('Error clearing badge:', error);
    }
  }

  /**
   * Get the stored push token
   */
  async getStoredPushToken(): Promise<string | null> {
    try {
      return await AsyncStorage.getItem(STORAGE_KEY.PUSH_TOKEN);
    } catch (error) {
      console.error('Error getting stored push token:', error);
      return null;
    }
  }

  /**
   * Check if a notification is exchange-related
   * Exchange notifications include: exchange_request, exchange_accepted,
   * exchange_approved, exchange_rejected, exchange_cancelled
   */
  isExchangeNotification(notification: Notifications.Notification): boolean {
    const data = notification.request.content.data;
    if (!data || !data.type) return false;

    const exchangeTypes = [
      'exchange_request',
      'exchange_accepted',
      'exchange_approved',
      'exchange_rejected',
      'exchange_cancelled',
    ];

    return exchangeTypes.includes(data.type as string);
  }

  /**
   * Get navigation info from a notification
   * Returns the screen name and params to navigate to based on notification type
   */
  getNavigationFromNotification(notification: Notifications.Notification): {
    screen: string;
    params?: Record<string, any>;
  } | null {
    const data = notification.request.content.data;
    if (!data) return null;

    // Exchange-related notifications
    if (this.isExchangeNotification(notification)) {
      return {
        screen: (data.screen as string) || 'ShiftExchanges',
        params: {
          exchangeId: data.exchangeId,
          shiftId: data.shiftId,
          highlightExchangeId: data.exchangeId,
        },
      };
    }

    // Shift-related notifications
    if (data.shiftId) {
      return {
        screen: (data.screen as string) || 'ShiftDetails',
        params: {
          shiftId: data.shiftId,
        },
      };
    }

    // Available shifts batch notification
    if (data.type === 'available_shifts_batch') {
      return {
        screen: 'AvailableShifts',
        params: {},
      };
    }

    // Default screen from notification data
    if (data.screen) {
      return {
        screen: data.screen as string,
        params: {},
      };
    }

    return null;
  }

  /**
   * Handle exchange notification received
   * This can be used to trigger UI updates when an exchange notification arrives
   */
  handleExchangeNotification(
    notification: Notifications.Notification,
    onRefreshNeeded?: () => void
  ): void {
    if (!this.isExchangeNotification(notification)) return;

    const data = notification.request.content.data;
    console.log('[Notifications] 🔄 Exchange notification received:', data?.type);

    // Trigger refresh callback if provided
    if (onRefreshNeeded) {
      onRefreshNeeded();
    }
  }
}

// Export singleton instance
export default new NotificationService();
