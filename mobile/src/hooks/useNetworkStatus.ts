/**
 * useNetworkStatus Hook
 * Monitor network connectivity and sync queue status
 */

import { useState, useEffect } from 'react';
import { Alert } from 'react-native';
import { syncService, type SyncFailure, type SyncState } from '../services/syncService';
import { logger } from '../utils/logger';

/** Actions whose permanent failure means an attendance record does not exist. */
const ATTENDANCE_ACTIONS: SyncFailure['type'][] = ['check_in', 'check_out'];

export type NetworkStatus = SyncState;

/** The server's reason, without the "HTTP 400:" prefix ApiError adds. */
const serverReason = (message: string) => message.replace(/^HTTP \d+:\s*/, '');

export const useNetworkStatus = () => {
  const [status, setStatus] = useState<NetworkStatus>({
    isOnline: true,
    isSyncing: false,
    queueCount: 0,
    failedCount: 0,
  });

  useEffect(() => {
    // Initialize sync service (safe to call multiple times)
    syncService.init();

    // Subscribe to sync service updates
    const unsubscribe = syncService.subscribe(setStatus);

    // A queued attendance action that exhausts its retries used to end at a
    // logger.warn. The officer had been told "saved locally, will sync when
    // you have internet"; they worked the shift; no record of it existed and
    // nobody was told. Say so, to the person who can still do something
    // about it.
    const unsubscribeFailures = syncService.onPermanentFailure(
      (failure: SyncFailure) => {
        logger.error('[useNetworkStatus] Sync gave up on a queued action', failure);
        if (failure.type === 'create_incident') {
          // The officer was told the report was submitted. Say it wasn't, and why.
          Alert.alert(
            'Your incident report was not sent',
            `The office did not accept it: ${serverReason(failure.message)}\n\n` +
            'It is kept on this phone. Tap the banner at the top to try again or ' +
            'discard it, and tell your manager if it is urgent.',
          );
          return;
        }
        if (!ATTENDANCE_ACTIONS.includes(failure.type)) {
          return;
        }
        const what = failure.type === 'check_in' ? 'check-in' : 'check-out';
        Alert.alert(
          `Your ${what} could not be saved`,
          `We could not send your ${what} for shift #${failure.entityId} to the ` +
          'office, and we have stopped trying. Your attendance for this shift ' +
          'is not recorded.\n\nContact your manager so they can record it for ' +
          'you.',
          [{ text: 'I understand' }],
          { cancelable: false },
        );
      },
    );

    // Cleanup subscription on unmount
    return () => {
      unsubscribe();
      unsubscribeFailures();
    };
  }, []);

  return status;
};
