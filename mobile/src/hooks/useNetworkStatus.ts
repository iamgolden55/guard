/**
 * useNetworkStatus Hook
 * Monitor network connectivity and sync queue status
 */

import { useState, useEffect } from 'react';
import { syncService } from '../services/syncService';

export interface NetworkStatus {
  isOnline: boolean;
  isSyncing: boolean;
  queueCount: number;
}

export const useNetworkStatus = () => {
  const [status, setStatus] = useState<NetworkStatus>({
    isOnline: true,
    isSyncing: false,
    queueCount: 0,
  });

  useEffect(() => {
    // Initialize sync service (safe to call multiple times)
    syncService.init();

    // Subscribe to sync service updates
    const unsubscribe = syncService.subscribe((state) => {
      setStatus({
        isOnline: state.isOnline,
        isSyncing: state.isSyncing,
        queueCount: state.queueCount,
      });
    });

    // Cleanup subscription on unmount
    return () => {
      unsubscribe();
    };
  }, []);

  return status;
};
