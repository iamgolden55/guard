import { useState, useEffect, useCallback, useRef } from 'react';
import { offlineQueue } from '../services/offlineQueue';

export interface OfflineSyncState {
  /** Whether the browser currently reports as online. */
  isOnline: boolean;
  /** Number of submissions sitting in the IndexedDB queue. */
  pendingCount: number;
  /** True while the queue is being processed. */
  isSyncing: boolean;
  /** Result message after the latest sync attempt. */
  lastSyncResult: string | null;
  /** Manually trigger a sync. */
  syncNow: () => Promise<void>;
  /** Refresh the pending count from IndexedDB. */
  refreshCount: () => Promise<void>;
}

export function useOfflineSync(): OfflineSyncState {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingCount, setPendingCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncResult, setLastSyncResult] = useState<string | null>(null);
  const syncInProgress = useRef(false);

  const refreshCount = useCallback(async () => {
    try {
      const count = await offlineQueue.count();
      setPendingCount(count);
    } catch {
      // IndexedDB may not be available (e.g. private browsing).
    }
  }, []);

  const syncNow = useCallback(async () => {
    // Prevent concurrent sync runs.
    if (syncInProgress.current || !navigator.onLine) return;
    syncInProgress.current = true;
    setIsSyncing(true);
    setLastSyncResult(null);

    try {
      const { succeeded, failed } = await offlineQueue.processQueue();

      if (succeeded > 0 && failed === 0) {
        setLastSyncResult(`All ${succeeded} submission${succeeded > 1 ? 's' : ''} synced successfully.`);
      } else if (succeeded > 0 && failed > 0) {
        setLastSyncResult(
          `${succeeded} synced, ${failed} still pending. Will retry automatically.`,
        );
      } else if (failed > 0) {
        setLastSyncResult(`${failed} submission${failed > 1 ? 's' : ''} failed to sync. Will retry when connection improves.`);
      }
      // If both are 0 there was nothing to sync — no message needed.
    } catch {
      setLastSyncResult('Sync encountered an unexpected error.');
    } finally {
      setIsSyncing(false);
      syncInProgress.current = false;
      await refreshCount();
    }
  }, [refreshCount]);

  // --- Online / offline listeners ---
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      // Auto-sync when connectivity returns.
      syncNow();
    };

    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [syncNow]);

  // --- Initial count on mount ---
  useEffect(() => {
    refreshCount();
  }, [refreshCount]);

  // --- Auto-dismiss the sync result after 8 seconds ---
  useEffect(() => {
    if (!lastSyncResult) return;
    const timer = setTimeout(() => setLastSyncResult(null), 8000);
    return () => clearTimeout(timer);
  }, [lastSyncResult]);

  return {
    isOnline,
    pendingCount,
    isSyncing,
    lastSyncResult,
    syncNow,
    refreshCount,
  };
}
