/**
 * Offline Queue Service
 * Handles queueing of shift exchange actions when offline and syncing when online
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import exchangeService from './exchangeService';
import type {
  CreateExchangeRequest,
  CreateOpenShiftRequest,
} from './exchangeService';

// Storage keys
const QUEUE_STORAGE_KEY = '@shift_exchange_queue';
const QUEUE_METADATA_KEY = '@shift_exchange_queue_metadata';

// Action types that can be queued
export type QueueActionType =
  | 'CREATE_EXCHANGE'
  | 'ACCEPT_EXCHANGE'
  | 'CANCEL_EXCHANGE'
  | 'RELEASE_SHIFT'
  | 'CLAIM_SHIFT'
  | 'CANCEL_OPEN_REQUEST';

// Queue item structure
export interface QueuedAction {
  id: string;
  type: QueueActionType;
  payload: any;
  timestamp: number;
  retryCount: number;
  maxRetries: number;
  status: 'pending' | 'syncing' | 'failed' | 'synced';
  error?: string;
  metadata?: {
    shiftId?: number;
    venueName?: string;
    targetUser?: string;
  };
}

// Queue metadata
export interface QueueMetadata {
  totalQueued: number;
  totalSynced: number;
  totalFailed: number;
  lastSyncAttempt?: number;
  lastSuccessfulSync?: number;
}

class QueueService {
  private queue: QueuedAction[] = [];
  private metadata: QueueMetadata = {
    totalQueued: 0,
    totalSynced: 0,
    totalFailed: 0,
  };
  private isSyncing = false;
  private listeners: Array<(queue: QueuedAction[], metadata: QueueMetadata) => void> = [];

  constructor() {
    this.loadQueue();
  }

  /**
   * Load queue from AsyncStorage
   */
  private async loadQueue(): Promise<void> {
    try {
      const [queueJson, metadataJson] = await Promise.all([
        AsyncStorage.getItem(QUEUE_STORAGE_KEY),
        AsyncStorage.getItem(QUEUE_METADATA_KEY),
      ]);

      if (queueJson) {
        this.queue = JSON.parse(queueJson);
      }

      if (metadataJson) {
        this.metadata = JSON.parse(metadataJson);
      }

      this.notifyListeners();
    } catch (error) {
      console.error('Error loading queue:', error);
    }
  }

  /**
   * Save queue to AsyncStorage
   */
  private async saveQueue(): Promise<void> {
    try {
      await Promise.all([
        AsyncStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(this.queue)),
        AsyncStorage.setItem(QUEUE_METADATA_KEY, JSON.stringify(this.metadata)),
      ]);
    } catch (error) {
      console.error('Error saving queue:', error);
    }
  }

  /**
   * Add action to queue
   */
  async addToQueue(
    type: QueueActionType,
    payload: any,
    metadata?: QueuedAction['metadata']
  ): Promise<string> {
    const actionId = `${type}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const queuedAction: QueuedAction = {
      id: actionId,
      type,
      payload,
      timestamp: Date.now(),
      retryCount: 0,
      maxRetries: 3,
      status: 'pending',
      metadata,
    };

    this.queue.push(queuedAction);
    this.metadata.totalQueued++;

    await this.saveQueue();
    this.notifyListeners();

    return actionId;
  }

  /**
   * Remove action from queue
   */
  async removeFromQueue(actionId: string): Promise<void> {
    this.queue = this.queue.filter((action) => action.id !== actionId);
    await this.saveQueue();
    this.notifyListeners();
  }

  /**
   * Update action status
   */
  private async updateActionStatus(
    actionId: string,
    status: QueuedAction['status'],
    error?: string
  ): Promise<void> {
    const action = this.queue.find((a) => a.id === actionId);
    if (action) {
      action.status = status;
      if (error) {
        action.error = error;
      }
      await this.saveQueue();
      this.notifyListeners();
    }
  }

  /**
   * Sync pending actions with the server
   */
  async syncQueue(): Promise<{ success: number; failed: number }> {
    if (this.isSyncing) {
      console.log('Sync already in progress');
      return { success: 0, failed: 0 };
    }

    this.isSyncing = true;
    this.metadata.lastSyncAttempt = Date.now();

    const pendingActions = this.queue.filter(
      (action) => action.status === 'pending' || action.status === 'failed'
    );

    let successCount = 0;
    let failedCount = 0;

    for (const action of pendingActions) {
      try {
        await this.updateActionStatus(action.id, 'syncing');

        // Execute the action based on type
        await this.executeAction(action);

        // Mark as synced and remove from queue
        await this.removeFromQueue(action.id);
        successCount++;
        this.metadata.totalSynced++;
        this.metadata.lastSuccessfulSync = Date.now();
      } catch (error: any) {
        console.error(`Failed to sync action ${action.id}:`, error);

        // Increment retry count
        action.retryCount++;

        if (action.retryCount >= action.maxRetries) {
          // Max retries reached, mark as failed
          await this.updateActionStatus(action.id, 'failed', error.message);
          this.metadata.totalFailed++;
          failedCount++;
        } else {
          // Mark as pending for retry
          await this.updateActionStatus(action.id, 'pending', error.message);
          failedCount++;
        }
      }
    }

    this.isSyncing = false;
    await this.saveQueue();
    this.notifyListeners();

    return { success: successCount, failed: failedCount };
  }

  /**
   * Execute a queued action
   */
  private async executeAction(action: QueuedAction): Promise<void> {
    switch (action.type) {
      case 'CREATE_EXCHANGE':
        await exchangeService.createExchange(action.payload as CreateExchangeRequest);
        break;

      case 'ACCEPT_EXCHANGE':
        await exchangeService.acceptExchange(
          action.payload.exchangeId,
          action.payload.response
        );
        break;

      case 'CANCEL_EXCHANGE':
        await exchangeService.cancelExchange(action.payload.exchangeId);
        break;

      case 'RELEASE_SHIFT':
        await exchangeService.releaseShift(action.payload as CreateOpenShiftRequest);
        break;

      case 'CLAIM_SHIFT':
        await exchangeService.claimShift(action.payload.requestId);
        break;

      case 'CANCEL_OPEN_REQUEST':
        await exchangeService.cancelOpenShiftRequest(action.payload.requestId);
        break;

      default:
        throw new Error(`Unknown action type: ${action.type}`);
    }
  }

  /**
   * Get current queue
   */
  getQueue(): QueuedAction[] {
    return [...this.queue];
  }

  /**
   * Get queue metadata
   */
  getMetadata(): QueueMetadata {
    return { ...this.metadata };
  }

  /**
   * Get pending actions count
   */
  getPendingCount(): number {
    return this.queue.filter((action) => action.status === 'pending').length;
  }

  /**
   * Get failed actions count
   */
  getFailedCount(): number {
    return this.queue.filter((action) => action.status === 'failed').length;
  }

  /**
   * Clear all synced and old failed actions
   */
  async clearCompletedActions(): Promise<void> {
    const now = Date.now();
    const ONE_WEEK = 7 * 24 * 60 * 60 * 1000;

    this.queue = this.queue.filter((action) => {
      // Keep pending and syncing actions
      if (action.status === 'pending' || action.status === 'syncing') {
        return true;
      }

      // Keep failed actions less than a week old
      if (action.status === 'failed' && now - action.timestamp < ONE_WEEK) {
        return true;
      }

      return false;
    });

    await this.saveQueue();
    this.notifyListeners();
  }

  /**
   * Retry a failed action
   */
  async retryAction(actionId: string): Promise<void> {
    const action = this.queue.find((a) => a.id === actionId);
    if (action && action.status === 'failed') {
      action.status = 'pending';
      action.retryCount = 0;
      action.error = undefined;
      await this.saveQueue();
      this.notifyListeners();
    }
  }

  /**
   * Subscribe to queue changes
   */
  subscribe(listener: (queue: QueuedAction[], metadata: QueueMetadata) => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  /**
   * Notify all listeners of queue changes
   */
  private notifyListeners(): void {
    this.listeners.forEach((listener) => {
      listener([...this.queue], { ...this.metadata });
    });
  }

  /**
   * Check if currently syncing
   */
  isSyncInProgress(): boolean {
    return this.isSyncing;
  }

  /**
   * Clear entire queue (use with caution)
   */
  async clearQueue(): Promise<void> {
    this.queue = [];
    this.metadata = {
      totalQueued: 0,
      totalSynced: 0,
      totalFailed: 0,
    };
    await this.saveQueue();
    this.notifyListeners();
  }
}

// Export singleton instance
export default new QueueService();
