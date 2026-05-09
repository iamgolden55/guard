import { useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';

import notificationWebSocket from '../services/NotificationWebSocket';
import type { NotificationSocketMessage } from '../services/NotificationWebSocket';
import { logger } from '../utils/logger';

export type InvoicePaidEvent = NotificationSocketMessage;

/**
 * Subscribes to the user's notifications WebSocket and fires `onPaid` whenever
 * an `invoice_paid` event arrives while the host screen is focused. The
 * subscription is created/destroyed in lockstep with focus, mirroring
 * useShiftRealtimeRefresh.
 */
export function useInvoicePaidCelebration(
  onPaid: (event: InvoicePaidEvent) => void,
): void {
  useFocusEffect(
    useCallback(() => {
      const unsubscribe = notificationWebSocket.addNotificationListener((message) => {
        if (message.type !== 'notification') {
          return;
        }
        if (message.notification_type !== 'invoice_paid') {
          return;
        }
        logger.info('[useInvoicePaidCelebration] Invoice paid event received', {
          relatedId: message.related_id,
        });
        try {
          onPaid(message);
        } catch (error) {
          logger.error('[useInvoicePaidCelebration] onPaid callback failed', error);
        }
      });

      void notificationWebSocket.connect();

      return () => {
        unsubscribe();
      };
    }, [onPaid]),
  );
}
