import { useEffect, useRef } from 'react';
import * as Notifications from 'expo-notifications';
import notificationService from '../services/notificationService';
import { navigate, isNavigationReady } from '../navigation/navigationRef';
import { logger } from '../utils/logger';

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
        logger.debug('[Notifications] 🔔 Initializing notification system...');

        // Step 1: Request permissions
        logger.debug('[Notifications] Step 1/4: Requesting permissions...');
        const hasPermission = await notificationService.requestPermissions();
        if (!hasPermission) {
          logger.warn('[Notifications] ⚠️ Permissions not granted - notifications disabled');
          return;
        }
        logger.debug('[Notifications] ✅ Permissions granted');

        // Step 2: Create notification channels (Android)
        logger.debug('[Notifications] Step 2/4: Creating notification channels...');
        await notificationService.createNotificationChannels();
        logger.debug('[Notifications] ✅ Channels created');

        // Step 3: Register push token (OPTIONAL - only for remote push)
        // NOTE: Push token registration now happens after login in useAuth hook
        logger.debug('[Notifications] Step 3/4: Push token will be registered after login');
        // Push token registration moved to useAuth to ensure authentication

        // Step 4: Setup notification listeners
        logger.debug('[Notifications] Step 4/4: Setting up notification listeners...');
        notificationService.setupNotificationListeners(
          // Handler for notifications received while app is foregrounded
          (notification) => {
            logger.debug('[Notifications] 📬 Notification received in foreground:', notification);
            // You can show a custom in-app notification here if needed
          },
          // Handler for user tapping on notification
          (response) => {
            logger.debug('[Notifications] 👆 Notification tapped');
            handleNotificationTapped(response);
          }
        );
        logger.debug('[Notifications] ✅ Listeners ready');

        logger.debug('[Notifications] 🎉 Notification system initialized successfully!');
        logger.debug('[Notifications] ℹ️  Local shift reminders will work offline');
        isInitialized.current = true;
      } catch (error) {
        logger.error('[Notifications] ❌ Error initializing notifications:', error);
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
      logger.debug('Notification tapped with data:', data);

      // Check if navigation is ready
      if (!isNavigationReady()) {
        logger.warn('Navigation not ready yet, waiting...');
        // Retry after a short delay to allow navigation to initialize
        setTimeout(() => handleNotificationTapped(response), 500);
        return;
      }

      // Navigate based on notification data
      if (data.screen === 'ShiftDetails' && data.shiftId) {
        // Deep link to shift details screen with shiftId
        logger.debug('[Notifications] Navigating to ShiftDetails with ID:', data.shiftId);
        navigate('Main', {
          screen: 'ShiftDetails',
          params: { shiftId: data.shiftId }  // Pass shiftId, not full shift object
        });
      } else if (data.screen === 'AvailableShifts') {
        // Deep link to available shifts
        logger.debug('[Notifications] Navigating to AvailableShifts');
        navigate('Main', {
          screen: 'AvailableShifts'
        });
      } else if (data.screen === 'ShiftExchanges') {
        // Deep link to shift exchanges
        logger.debug('[Notifications] Navigating to ShiftExchanges');
        navigate('Main', {
          screen: 'ShiftExchanges'
        });
      } else if (data.screen === 'Shifts') {
        // shift_removed / shift_reassigned. The backend names this 'Shifts';
        // the tab is registered as 'Calendar', so this branch used to fall
        // through and the tap did nothing at all.
        logger.debug('[Notifications] Navigating to the shifts tab');
        navigate('Main', {
          screen: 'Tabs',
          params: { screen: 'Calendar' },
        });
      } else if (data.screen === 'ShiftScheduling') {
        // shift_cancelled, sent to a manager — the Manage tab is the nearest
        // thing this app has to a scheduling surface.
        logger.debug('[Notifications] Navigating to the manage tab');
        navigate('Main', {
          screen: 'Tabs',
          params: { screen: 'Manage' },
        });
      } else if (data.screen) {
        logger.warn('[Notifications] No route for notification screen', {
          screen: data.screen,
        });
      }

      // Clear the notification badge
      notificationService.clearBadge();
    } catch (error) {
      logger.error('Error handling notification tap:', error);
    }
  };

  return {
    isInitialized: isInitialized.current,
  };
};
