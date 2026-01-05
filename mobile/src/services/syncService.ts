/**
 * Sync Service
 * Manages offline-first synchronization with exponential backoff retry logic
 * Updated to use AsyncStorage instead of WatermelonDB
 */

import NetInfo, { NetInfoState } from '@react-native-community/netinfo';
import { database } from './database';
import type { SyncQueueItem } from './database';
import { apiService } from './api';
import { logger } from '../utils/logger';
import { API_ENDPOINTS } from '../config/api.config';

// Sync action types
export type SyncActionType =
  | 'check_in'
  | 'check_out'
  | 'start_break'
  | 'end_break'
  | 'create_incident'
  | 'update_incident'
  | 'create_shift_check'
  | 'update_shift';

class SyncService {
  private isSyncing = false;
  private isOnline = false;
  private maxRetries = 5;
  private retryDelays = [1000, 2000, 5000, 10000, 30000]; // Exponential backoff in ms
  private listeners: Set<(state: { isOnline: boolean; isSyncing: boolean; queueCount: number }) => void> = new Set();
  private initialized = false;

  constructor() {
    // Don't set up network listener in constructor - defer until init() is called
  }

  /**
   * Initialize the sync service - must be called after React Native is ready
   */
  init() {
    if (this.initialized) {
      return;
    }
    this.initialized = true;
    this.setupNetworkListener();
  }

  /**
   * Set up network status monitoring
   */
  private setupNetworkListener() {
    NetInfo.addEventListener((state: NetInfoState) => {
      const wasOnline = this.isOnline;

      // Handle null isInternetReachable gracefully (can be null during initialization)
      // Only consider online if both connected and reachable are explicitly true
      const isConnected = state.isConnected === true;
      const isReachable = state.isInternetReachable === true;
      this.isOnline = isConnected && isReachable;

      logger.info('[SyncService] Network status', {
        isOnline: this.isOnline,
        type: state.type,
        isConnected: state.isConnected,
        isInternetReachable: state.isInternetReachable,
      });

      // Start sync when coming back online (but not on first load with null state)
      if (!wasOnline && this.isOnline && state.isInternetReachable !== null) {
        logger.info('[SyncService] Device came online, starting sync');
        this.startSync();
      }

      this.notifyListeners();
    });
  }

  /**
   * Add action to sync queue
   */
  async addToQueue(action: {
    type: SyncActionType;
    entityType: string;
    entityId: string;
    payload: any;
    priority: number;
  }): Promise<string> {
    try {
      await database.addToSyncQueue(action);

      logger.info('[SyncService] Added action to queue', { type: action.type });

      // If online, start sync immediately
      if (this.isOnline) {
        this.startSync();
      }

      this.notifyListeners();

      return action.entityId;
    } catch (error) {
      logger.error('[SyncService] Error adding to queue', { error });
      throw error;
    }
  }

  /**
   * Start sync process
   */
  async startSync() {
    if (this.isSyncing || !this.isOnline) {
      logger.debug('[SyncService] Sync already in progress or offline');
      return;
    }

    this.isSyncing = true;
    this.notifyListeners();

    try {
      logger.info('[SyncService] Starting sync...');
      const pendingActions = await this.getPendingActions();
      logger.info('[SyncService] Found pending actions', { count: pendingActions.length });

      for (const action of pendingActions) {
        if (!this.isOnline) {
          logger.info('[SyncService] Device went offline, pausing sync');
          break;
        }

        await this.processAction(action);
      }

      await database.setLastSync(new Date());
      logger.info('[SyncService] Sync complete');
    } catch (error) {
      logger.error('[SyncService] Sync error', { error });
    } finally {
      this.isSyncing = false;
      this.notifyListeners();
    }
  }

  /**
   * Get pending actions sorted by priority
   */
  private async getPendingActions(): Promise<SyncQueueItem[]> {
    const queue = await database.getSyncQueue();

    return queue
      .filter((item) =>
        (item.status === 'pending' || item.status === 'failed') &&
        item.attempts < this.maxRetries
      )
      .sort((a, b) => {
        // Sort by priority first (1 = highest), then by creation date
        if (a.priority !== b.priority) {
          return a.priority - b.priority;
        }
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      });
  }

  /**
   * Process a single sync action
   */
  private async processAction(queueItem: SyncQueueItem) {
    try {
      await database.updateSyncQueueItem(queueItem.id, {
        status: 'processing',
      });

      logger.info('[SyncService] Processing action', {
        type: queueItem.type,
        entityId: queueItem.entityId
      });

      // Execute the sync action
      await this.executeAction(queueItem.type, queueItem.payload);

      // Remove from queue on success
      await database.removeSyncQueueItem(queueItem.id);

      // Update entity sync status
      await this.updateEntitySyncStatus(queueItem.entityType, queueItem.entityId, 'synced');

      logger.info('[SyncService] Action completed', { type: queueItem.type });
    } catch (error: any) {
      logger.error('[SyncService] Action failed', {
        type: queueItem.type,
        error: error.message
      });
      await this.handleActionFailure(queueItem, error);
    }
  }

  /**
   * Execute sync action by type
   */
  private async executeAction(type: SyncActionType, payload: any) {
    switch (type) {
      case 'check_in':
        await apiService.post(API_ENDPOINTS.SHIFTS.CHECK_IN(payload.shift_id), payload);
        break;
      case 'check_out':
        await apiService.post(API_ENDPOINTS.SHIFTS.CHECK_OUT(payload.shift_id), payload);
        break;
      case 'start_break':
        await apiService.post(API_ENDPOINTS.SHIFTS.START_BREAK(payload.shift_id), payload);
        break;
      case 'end_break':
        await apiService.post(API_ENDPOINTS.SHIFTS.END_BREAK(payload.shift_id), payload);
        break;
      case 'create_incident':
        await apiService.post(API_ENDPOINTS.INCIDENTS.CREATE, payload);
        break;
      case 'update_incident':
        await apiService.put(API_ENDPOINTS.INCIDENTS.UPDATE(payload.id), payload);
        break;
      case 'create_shift_check':
        await apiService.post(API_ENDPOINTS.SHIFT_CHECKS.CREATE, payload);
        break;
      case 'update_shift':
        await apiService.put(API_ENDPOINTS.SHIFTS.DETAIL(payload.id), payload);
        break;
      default:
        throw new Error(`Unknown action type: ${type}`);
    }
  }

  /**
   * Handle action failure with exponential backoff
   */
  private async handleActionFailure(queueItem: SyncQueueItem, error: any) {
    const newAttempts = queueItem.attempts + 1;

    if (newAttempts >= this.maxRetries) {
      logger.warn('[SyncService] Max retries reached, marking as failed');
      await database.updateSyncQueueItem(queueItem.id, {
        status: 'failed',
        attempts: newAttempts,
        error: error.message,
      });

      await this.updateEntitySyncStatus(queueItem.entityType, queueItem.entityId, 'failed');
    } else {
      const delay = this.retryDelays[Math.min(newAttempts - 1, this.retryDelays.length - 1)];
      logger.info('[SyncService] Scheduling retry', { attempt: newAttempts, delay });

      await database.updateSyncQueueItem(queueItem.id, {
        status: 'pending',
        attempts: newAttempts,
        error: error.message,
      });

      // Schedule retry with exponential backoff
      setTimeout(() => {
        if (this.isOnline) {
          this.startSync();
        }
      }, delay);
    }
  }

  /**
   * Update entity sync status in database
   */
  private async updateEntitySyncStatus(
    entityType: string,
    entityId: string,
    status: 'synced' | 'pending' | 'failed'
  ) {
    try {
      if (entityType === 'shifts') {
        await database.updateShift(Number(entityId), { sync_status: status });
      } else if (entityType === 'incidents') {
        await database.updateIncident(entityId, { syncStatus: status });
      }
    } catch (error) {
      logger.error('[SyncService] Error updating entity sync status', { error });
    }
  }

  /**
   * Get sync queue statistics
   */
  async getQueueStats() {
    const queue = await database.getSyncQueue();

    const pendingCount = queue.filter((item) => item.status === 'pending').length;
    const failedCount = queue.filter((item) => item.status === 'failed').length;

    return {
      pending: pendingCount,
      failed: failedCount,
      total: pendingCount + failedCount,
    };
  }

  /**
   * Clear failed items from queue
   */
  async clearFailedItems() {
    const queue = await database.getSyncQueue();
    const failedItems = queue.filter((item) => item.status === 'failed');

    for (const item of failedItems) {
      await database.removeSyncQueueItem(item.id);
    }

    logger.info('[SyncService] Cleared failed items', { count: failedItems.length });
    this.notifyListeners();
  }

  /**
   * Retry all failed items
   */
  async retryFailedItems() {
    const queue = await database.getSyncQueue();
    const failedItems = queue.filter((item) => item.status === 'failed');

    for (const item of failedItems) {
      await database.updateSyncQueueItem(item.id, {
        status: 'pending',
        attempts: 0,
        error: undefined,
      });
    }

    logger.info('[SyncService] Retrying failed items', { count: failedItems.length });
    this.notifyListeners();

    if (this.isOnline) {
      this.startSync();
    }
  }

  /**
   * Subscribe to sync state changes
   */
  subscribe(listener: (state: { isOnline: boolean; isSyncing: boolean; queueCount: number }) => void) {
    this.listeners.add(listener);

    // Immediately notify with current state
    this.notifyListener(listener);

    // Return unsubscribe function
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Notify all listeners of state change
   */
  private async notifyListeners() {
    for (const listener of this.listeners) {
      await this.notifyListener(listener);
    }
  }

  /**
   * Notify single listener with current state
   */
  private async notifyListener(
    listener: (state: { isOnline: boolean; isSyncing: boolean; queueCount: number }) => void
  ) {
    const stats = await this.getQueueStats();
    listener({
      isOnline: this.isOnline,
      isSyncing: this.isSyncing,
      queueCount: stats.total,
    });
  }

  /**
   * Get current network status
   */
  getNetworkStatus() {
    return {
      isOnline: this.isOnline,
      isSyncing: this.isSyncing,
    };
  }
}

// Export singleton instance
export const syncService = new SyncService();
export default syncService;
