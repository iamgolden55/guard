/**
 * Sync Service
 * Manages offline-first synchronization with exponential backoff retry logic
 * Updated to use AsyncStorage instead of WatermelonDB
 */

import NetInfo, { NetInfoState } from '@react-native-community/netinfo';
import { AppState } from 'react-native';
import { jwtDecode } from 'jwt-decode';
import { database } from './database';
import type { SyncQueueItem } from './database';
import { apiService } from './api';
import { logger } from '../utils/logger';
import { API_ENDPOINTS } from '../config/api.config';
import { readToken } from './tokenStorage';
import { missingPhotosNote, uploadEvidencePhotos } from './evidencePhotoService';

// Sync action types.
//
// 'start_break' and 'end_break' used to be here, queueing POSTs to
// /shifts/{id}/start_break/ and /end_break/. Neither endpoint has ever
// existed. Nothing enqueued them — the Redux actions were imported only by an
// unrouted screen — but had the UI been wired, every break would have 404'd,
// burned five retries and been dropped silently while the app showed the
// officer as on break. Breaks are not implemented end to end; see
// `manage.py report_unrecorded_breaks` for what that currently costs.
export type SyncActionType =
  | 'check_in'
  | 'check_out'
  | 'create_incident'
  | 'update_incident'
  | 'create_shift_check'
  | 'create_logbook_signoff'
  | 'update_shift';

/** A queued action that exhausted its retries and will not be sent again. */
export interface SyncFailure {
  type: SyncActionType;
  entityType: string;
  entityId: string;
  attempts: number;
  message: string;
  /** HTTP status when the server refused it; absent for network failures. */
  status?: number;
}

/** What the banner shows: how many items are still to send, and how many gave up. */
export interface SyncState {
  isOnline: boolean;
  isSyncing: boolean;
  queueCount: number;
  failedCount: number;
}

/**
 * The server looked at the request and said no (validation, permissions, not
 * found). Sending the same payload again gets the same answer, so there is no
 * point retrying it. 401 (session), 408 (timeout) and 429 (rate limit) can
 * succeed later and are retried.
 */
const isRefusedByServer = (status: unknown): status is number =>
  typeof status === 'number' && status >= 400 && status < 500 &&
  status !== 401 && status !== 408 && status !== 429;

class SyncService {
  private isSyncing = false;
  private isOnline = false;
  private maxRetries = 5;
  private retryDelays = [1000, 2000, 5000, 10000, 30000]; // Exponential backoff in ms
  private listeners: Set<(state: SyncState) => void> = new Set();
  private failureListeners: Array<(failure: SyncFailure) => void> = [];
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
    void this.recoverInterruptedItems();
    this.setupNetworkListener();
    // A retry is a timer, and timers stop while the app is in the background,
    // so an item could sit "waiting to sync" for as long as the app stayed
    // open. Try again whenever the app comes back to the foreground.
    AppState.addEventListener('change', (next) => {
      if (next === 'active' && this.isOnline) {
        void this.startSync();
      }
    });
  }

  /**
   * Put items left in `processing` back in the queue.
   *
   * An item is marked `processing` just before its request is sent. If the
   * app is killed before the reply, it stayed `processing` forever — never
   * retried, never counted, never reported. Replaying it is safe: the server
   * answers a duplicate check-in or check-out with an `already_*` code, which
   * `isAlreadyCompletedError` treats as done.
   */
  async recoverInterruptedItems(): Promise<number> {
    try {
      const queue = await database.getSyncQueue();
      const stranded = queue.filter((item) => item.status === 'processing');
      for (const item of stranded) {
        await database.updateSyncQueueItem(item.id, { status: 'pending' });
      }
      if (stranded.length > 0) {
        logger.info('[SyncService] Re-queued interrupted items', { count: stranded.length });
        this.notifyListeners();
      }
      return stranded.length;
    } catch (error) {
      logger.error('[SyncService] Could not recover interrupted items', { error });
      return 0;
    }
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
      await database.addToSyncQueue({ ...action, ownerId: await this.currentUserId() });

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
        // Signed out, or someone else signed in, mid-sync: the rest wait for
        // their owner.
        if (action.ownerId !== (await this.currentUserId())) {
          logger.info('[SyncService] Account changed, pausing sync');
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
    const queue = await this.myQueue();

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
      // 4xx responses are usually expected business-rule rejections (e.g. location
      // verification failed, shift already closed). Don't page Sentry on those —
      // surface as a warning. Reserve error reporting for 5xx and unclassified failures.
      const status = error?.statusCode ?? error?.response?.status;
      const payload = {
        type: queueItem.type,
        error: error?.message,
        status,
        response: error?.response,
      };
      if (typeof status === 'number' && status >= 400 && status < 500) {
        logger.warn('[SyncService] Action rejected by server', payload);
      } else {
        logger.error('[SyncService] Action failed', payload);
      }
      await this.handleActionFailure(queueItem, error);
    }
  }

  /**
   * Execute sync action by type
   */
  private async executeAction(type: SyncActionType, payload: any) {
    switch (type) {
      // Everything reaching this queue was captured offline and is being
      // replayed. Saying so lets the server keep the device's own timestamp
      // beside its own — an 18:00 check-in that syncs at 23:00 used to be
      // recorded as 23:00, and one syncing after midnight was rejected as
      // "from a previous date", which is how a worked shift ended up with no
      // attendance record at all.
      case 'check_in':
        await apiService.post(API_ENDPOINTS.SHIFTS.CHECK_IN(payload.shift_id), {
          ...payload,
          offline_replay: true,
          occurred_at: payload.check_in_time,
        });
        break;
      case 'check_out':
        await apiService.post(API_ENDPOINTS.SHIFTS.CHECK_OUT(payload.shift_id), {
          ...payload,
          offline_replay: true,
          occurred_at: payload.check_out_time,
        });
        break;
      case 'create_incident':
        await apiService.post(API_ENDPOINTS.INCIDENTS.CREATE, await this.withUploadedPhotos(payload));
        break;
      case 'update_incident':
        await apiService.put(API_ENDPOINTS.INCIDENTS.UPDATE(payload.id), payload);
        break;
      case 'create_shift_check':
        await apiService.post(API_ENDPOINTS.SHIFT_CHECKS.CREATE, payload);
        break;
      case 'create_logbook_signoff':
        await apiService.post('/api/v1/capacity-logbooks/', payload);
        break;
      case 'update_shift':
        await apiService.put(API_ENDPOINTS.SHIFTS.DETAIL(payload.id), payload);
        break;
      default:
        throw new Error(`Unknown action type: ${type}`);
    }
  }

  /**
   * A queued report's photos are paths on this phone. Upload them and send
   * their URLs. A failure worth retrying throws, so the report is retried
   * with its photos; a photo that can never be stored (no storage configured,
   * refused) is left out and the report says so, rather than holding the
   * report back.
   */
  private async withUploadedPhotos(payload: any) {
    const { photo_uris: photoUris, ...body } = payload ?? {};
    if (!Array.isArray(photoUris) || photoUris.length === 0) return body;
    const { urls, missing } = await uploadEvidencePhotos(photoUris);
    if (urls.length > 0) body.photos = urls;
    if (missing > 0) {
      body.description = [body.description, missingPhotosNote(missing)].filter(Boolean).join('\n\n');
    }
    return body;
  }

  /**
   * Did the server already record this action? Then the queue item is stale
   * and can be dropped rather than retried.
   *
   * This used to decide by substring-matching English error prose — 'already
   * checked in' — which worked only by coincidence of wording. One copy edit
   * to that message would have turned a correctly-completed action into five
   * retries and then a silently failed item, with the officer's attendance
   * never recorded and nobody told.
   *
   * The server now returns a stable `code` on these responses. Match on that.
   * The prose check stays as a fallback so an older backend still behaves.
   */
  private isAlreadyCompletedError(error: any, actionType: SyncActionType): boolean {
    const code = error?.response?.data?.code || error?.response?.code || error?.code;
    const COMPLETED_CODES: Partial<Record<SyncActionType, string>> = {
      check_in: 'already_checked_in',
      check_out: 'already_checked_out',
    };
    if (code && COMPLETED_CODES[actionType] === code) {
      return true;
    }

    const errorMessage = (error?.message || error?.response?.detail || '').toLowerCase();
    if (actionType === 'check_in') {
      return errorMessage.includes('already checked in') ||
             errorMessage.includes('shift already checked in');
    }
    if (actionType === 'check_out') {
      return errorMessage.includes('already checked out') ||
             errorMessage.includes('shift already checked out');
    }
    return false;
  }

  /**
   * Tell somebody when a queued action is given up on for good.
   *
   * Registered by the app shell; each listener decides how to surface it. Kept
   * as a listener list rather than an Alert here so the service stays free of
   * UI, and so a failure raised while the app is backgrounded can be handled
   * differently from one raised in the foreground.
   */
  onPermanentFailure(listener: (failure: SyncFailure) => void): () => void {
    this.failureListeners.push(listener);
    return () => {
      this.failureListeners = this.failureListeners.filter((l) => l !== listener);
    };
  }

  private notifyPermanentFailure(queueItem: SyncQueueItem, error: any) {
    const failure: SyncFailure = {
      type: queueItem.type,
      entityType: queueItem.entityType,
      entityId: queueItem.entityId,
      attempts: queueItem.attempts + 1,
      message: error?.message || 'Unknown error',
      status: error?.statusCode ?? error?.response?.status,
    };
    for (const listener of this.failureListeners) {
      try {
        listener(failure);
      } catch (listenerError) {
        logger.error('[SyncService] Failure listener threw', listenerError);
      }
    }
  }

  /**
   * Handle action failure with exponential backoff
   */
  private async handleActionFailure(queueItem: SyncQueueItem, error: any) {
    // Check if this is an "already done" error - if so, remove the stale entry
    if (this.isAlreadyCompletedError(error, queueItem.type)) {
      logger.info('[SyncService] Action already completed on server, removing stale queue entry', {
        type: queueItem.type,
        entityId: queueItem.entityId,
      });
      await database.removeSyncQueueItem(queueItem.id);
      // Update entity sync status to synced since server confirms it's done
      await this.updateEntitySyncStatus(queueItem.entityType, queueItem.entityId, 'synced');
      return;
    }

    const newAttempts = queueItem.attempts + 1;
    const status = error?.statusCode ?? error?.response?.status;

    if (newAttempts >= this.maxRetries || isRefusedByServer(status)) {
      logger.warn('[SyncService] Giving up on action, marking as failed', { status });
      await database.updateSyncQueueItem(queueItem.id, {
        status: 'failed',
        attempts: newAttempts,
        error: error.message,
      });

      await this.updateEntitySyncStatus(queueItem.entityType, queueItem.entityId, 'failed');

      // The officer was told "saved locally; will sync when you have
      // internet". They worked the shift. If this is where it ends, no
      // attendance record exists and — until now — the only trace was a
      // logger.warn nobody reads. Silent failure is the actual harm here.
      this.notifyPermanentFailure(queueItem, error);
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
        await database.updateIncident(Number(entityId), { sync_status: status });
      }
    } catch (error) {
      logger.error('[SyncService] Error updating entity sync status', { error });
    }
  }

  /**
   * Get sync queue statistics
   */
  async getQueueStats() {
    const queue = await this.myQueue();

    const pendingCount = queue.filter((item) => item.status === 'pending').length;
    const failedCount = queue.filter((item) => item.status === 'failed').length;

    return {
      pending: pendingCount,
      failed: failedCount,
      total: pendingCount + failedCount,
    };
  }

  /**
   * Clear failed items from queue.
   *
   * Deliberately not called at startup any more: a failed attendance item is
   * the only record that an officer tried to check in or out, and deleting it
   * on launch erased the evidence. Keep this for an explicit user action.
   */
  async clearFailedItems() {
    const queue = await this.myQueue();
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
    const queue = await this.myQueue();
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
  subscribe(listener: (state: SyncState) => void) {
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
  private async notifyListener(listener: (state: SyncState) => void) {
    const stats = await this.getQueueStats();
    listener({
      isOnline: this.isOnline,
      isSyncing: this.isSyncing,
      queueCount: stats.pending,
      failedCount: stats.failed,
    });
  }

  /** Items the queue has given up on, oldest first, for the officer to review. */
  async getFailedItems(): Promise<SyncQueueItem[]> {
    const queue = await this.myQueue();
    return queue
      .filter((item) => item.status === 'failed')
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  }

  /**
   * The signed-in account, from the stored access token (only its `user_id`
   * claim is read; an expired token still names its owner). Null when nobody
   * is signed in or the keychain can't be read.
   */
  private async currentUserId(): Promise<number | null> {
    try {
      const token = await readToken('accessToken');
      if (!token) return null;
      const userId = Number(jwtDecode<{ user_id?: number | string }>(token).user_id);
      return Number.isFinite(userId) ? userId : null;
    } catch {
      return null;
    }
  }

  /**
   * The signed-in account's items. Nothing when nobody is signed in; other
   * accounts' items wait on the phone until their owner signs in again.
   *
   * Items queued before owners were recorded are claimed by the account
   * signed in now, which is who the old code would have sent them as.
   */
  private async myQueue(): Promise<SyncQueueItem[]> {
    const userId = await this.currentUserId();
    if (userId === null) return [];
    const queue = await database.getSyncQueue();
    for (const item of queue) {
      if (item.ownerId === undefined || item.ownerId === null) {
        await database.updateSyncQueueItem(item.id, { ownerId: userId });
        item.ownerId = userId;
      }
    }
    return queue.filter((item) => item.ownerId === userId);
  }

  /**
   * Call after signing in or out: the banner counts the new account's items,
   * and anything that account left waiting is sent.
   */
  accountChanged() {
    this.notifyListeners();
    void this.startSync();
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
