import { useCallback, useRef } from 'react';
import { useFocusEffect } from '@react-navigation/native';

import notificationWebSocket from '../services/NotificationWebSocket';
import { logger } from '../utils/logger';

const SHIFT_NOTIFICATION_TYPES = new Set([
  'shift_assigned',
  'shift_removed',
  'shift_updated',
  'shift_reassigned',
]);

export function useShiftRealtimeRefresh(onShiftEvent: () => Promise<void> | void): void {
  const inFlightRef = useRef(false);
  const queuedRef = useRef(false);

  const flushRefresh = useCallback(async () => {
    if (inFlightRef.current) {
      queuedRef.current = true;
      return;
    }

    inFlightRef.current = true;
    try {
      await onShiftEvent();
    } catch (error) {
      logger.error('[useShiftRealtimeRefresh] Refresh failed', error);
    } finally {
      inFlightRef.current = false;
      if (queuedRef.current) {
        queuedRef.current = false;
        void flushRefresh();
      }
    }
  }, [onShiftEvent]);

  useFocusEffect(
    useCallback(() => {
      const unsubscribe = notificationWebSocket.addNotificationListener((message) => {
        if (message.type !== 'notification') {
          return;
        }

        if (message.related_type !== 'shift') {
          return;
        }

        if (!message.notification_type || !SHIFT_NOTIFICATION_TYPES.has(message.notification_type)) {
          return;
        }

        logger.info('[useShiftRealtimeRefresh] Shift event received', {
          notificationType: message.notification_type,
          relatedId: message.related_id,
        });
        void flushRefresh();
      });

      void notificationWebSocket.connect();

      return () => {
        unsubscribe();
      };
    }, [flushRefresh]),
  );
}
