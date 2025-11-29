import { useEffect, useRef } from 'react';
import * as Notifications from 'expo-notifications';
import notificationService from '../services/notificationService';
import { navigate, isNavigationReady } from '../navigation/navigationRef';

/**
 * Custom hook to manage notifications
 * Handles initialization, permissions, listeners, and deep linking
 */
export const useNotifications = () => {
  const isInitialized = useRef(false);

  useEffect(() => {
    // Prevent duplicate initialization
    if (isInitialized.current) {
      return;
    }

    // Initialize notifications
    const initNotifications = async () => {
      try {
        console.log('[Notifications] 🔔 Initializing notification system...');

        // Step 1: Request permissions
        console.log('[Notifications] Step 1/4: Requesting permissions...');
        const hasPermission = await notificationService.requestPermissions();
        if (!hasPermission) {
          console.warn('[Notifications] ⚠️ Permissions not granted - notifications disabled');
          return;
        }
        console.log('[Notifications] ✅ Permissions granted');

        // Step 2: Create notification channels (Android)
        console.log('[Notifications] Step 2/4: Creating notification channels...');
        await notificationService.createNotificationChannels();
        console.log('[Notifications] ✅ Channels created');

        // Step 3: Register push token (OPTIONAL - only for remote push)
        console.log('[Notifications] Step 3/4: Registering push token (optional)...');
        await notificationService.registerPushToken();
        // Push token registration logs its own status

        // Step 4: Setup notification listeners
        console.log('[Notifications] Step 4/4: Setting up notification listeners...');
        notificationService.setupNotificationListeners(
          // Handler for notifications received while app is foregrounded
          (notification) => {
            console.log('[Notifications] 📬 Notification received in foreground:', notification);
            // You can show a custom in-app notification here if needed
          },
          // Handler for user tapping on notification
          (response) => {
            console.log('[Notifications] 👆 Notification tapped');
            handleNotificationTapped(response);
          }
        );
        console.log('[Notifications] ✅ Listeners ready');

        console.log('[Notifications] 🎉 Notification system initialized successfully!');
        console.log('[Notifications] ℹ️  Local shift reminders will work offline');
        isInitialized.current = true;
      } catch (error) {
        console.error('[Notifications] ❌ Error initializing notifications:', error);
      }
    };

    initNotifications();

    // Cleanup listeners on unmount
    return () => {
      notificationService.removeNotificationListeners();
    };
  }, []); // Remove navigation from dependencies

  /**
   * Handle notification tap - deep link to appropriate screen
   */
  const handleNotificationTapped = (response: Notifications.NotificationResponse) => {
    try {
      const data = response.notification.request.content.data;
      console.log('Notification tapped with data:', data);

      // Check if navigation is ready
      if (!isNavigationReady()) {
        console.warn('Navigation not ready yet, waiting...');
        // Retry after a short delay to allow navigation to initialize
        setTimeout(() => handleNotificationTapped(response), 500);
        return;
      }

      // Navigate based on notification data
      if (data.screen === 'ShiftDetails' && data.shiftId) {
        // Deep link to shift details screen with shiftId
        console.log('[Notifications] Navigating to ShiftDetails with ID:', data.shiftId);
        navigate('Main', {
          screen: 'ShiftDetails',
          params: { shiftId: data.shiftId }  // Pass shiftId, not full shift object
        });
      } else if (data.screen === 'AvailableShifts') {
        // Deep link to available shifts
        console.log('[Notifications] Navigating to AvailableShifts');
        navigate('Main', {
          screen: 'AvailableShifts'
        });
      } else if (data.screen === 'ShiftExchanges') {
        // Deep link to shift exchanges
        console.log('[Notifications] Navigating to ShiftExchanges');
        navigate('Main', {
          screen: 'ShiftExchanges'
        });
      }

      // Clear the notification badge
      notificationService.clearBadge();
    } catch (error) {
      console.error('Error handling notification tap:', error);
    }
  };

  return {
    isInitialized: isInitialized.current,
  };
};
