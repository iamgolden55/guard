/**
 * Offline-Aware Exchange Service
 * Automatically queues exchange actions when offline
 */

import NetInfo from '@react-native-community/netinfo';
import exchangeService from './exchangeService';
import queueService, { QueueActionType } from './queueService';
import type {
  CreateExchangeRequest,
  CreateOpenShiftRequest,
  ShiftExchange,
  OpenShiftRequest,
  ExchangeActionResponse,
  OpenShiftActionResponse,
} from './exchangeService';

class OfflineExchangeService {
  /**
   * Check if device is online
   */
  private async isOnline(): Promise<boolean> {
    const state = await NetInfo.fetch();
    return state.isConnected === true && state.isInternetReachable !== false;
  }

  /**
   * Create a shift exchange (with offline support)
   */
  async createExchange(data: CreateExchangeRequest): Promise<ShiftExchange | string> {
    const online = await this.isOnline();

    if (!online) {
      // Queue for later sync
      const actionId = await queueService.addToQueue('CREATE_EXCHANGE', data, {
        shiftId: data.original_shift,
        targetUser: `User ${data.target_user}`,
      });

      return actionId; // Return queue ID instead of exchange object
    }

    // Execute immediately if online
    return await exchangeService.createExchange(data);
  }

  /**
   * Accept a shift exchange (with offline support)
   */
  async acceptExchange(
    exchangeId: number,
    response?: string
  ): Promise<ExchangeActionResponse | string> {
    const online = await this.isOnline();

    if (!online) {
      // Queue for later sync
      const actionId = await queueService.addToQueue(
        'ACCEPT_EXCHANGE',
        { exchangeId, response },
        { shiftId: exchangeId }
      );

      return actionId; // Return queue ID
    }

    // Execute immediately if online
    return await exchangeService.acceptExchange(exchangeId, response);
  }

  /**
   * Cancel a shift exchange (with offline support)
   */
  async cancelExchange(exchangeId: number): Promise<{ message: string } | string> {
    const online = await this.isOnline();

    if (!online) {
      // Queue for later sync
      const actionId = await queueService.addToQueue(
        'CANCEL_EXCHANGE',
        { exchangeId },
        { shiftId: exchangeId }
      );

      return actionId; // Return queue ID
    }

    // Execute immediately if online
    return await exchangeService.cancelExchange(exchangeId);
  }

  /**
   * Release shift to open pool (with offline support)
   */
  async releaseShift(data: CreateOpenShiftRequest): Promise<OpenShiftRequest | string> {
    const online = await this.isOnline();

    if (!online) {
      // Queue for later sync
      const actionId = await queueService.addToQueue('RELEASE_SHIFT', data, {
        shiftId: data.original_shift,
      });

      return actionId; // Return queue ID
    }

    // Execute immediately if online
    return await exchangeService.releaseShift(data);
  }

  /**
   * Claim an open shift (with offline support)
   */
  async claimShift(requestId: number): Promise<OpenShiftActionResponse | string> {
    const online = await this.isOnline();

    if (!online) {
      // Queue for later sync
      const actionId = await queueService.addToQueue(
        'CLAIM_SHIFT',
        { requestId },
        { shiftId: requestId }
      );

      return actionId; // Return queue ID
    }

    // Execute immediately if online
    return await exchangeService.claimShift(requestId);
  }

  /**
   * Cancel an open shift request (with offline support)
   */
  async cancelOpenShiftRequest(requestId: number): Promise<{ message: string } | string> {
    const online = await this.isOnline();

    if (!online) {
      // Queue for later sync
      const actionId = await queueService.addToQueue(
        'CANCEL_OPEN_REQUEST',
        { requestId },
        { shiftId: requestId }
      );

      return actionId; // Return queue ID
    }

    // Execute immediately if online
    return await exchangeService.cancelOpenShiftRequest(requestId);
  }

  /**
   * Read-only methods (delegate directly to exchangeService)
   */

  async getMyExchanges(): Promise<ShiftExchange[]> {
    return await exchangeService.getMyExchanges();
  }

  async getMyOpenShiftRequests(): Promise<OpenShiftRequest[]> {
    return await exchangeService.getMyOpenShiftRequests();
  }

  async getAvailableShifts(): Promise<OpenShiftRequest[]> {
    return await exchangeService.getAvailableShifts();
  }

  async getAllExchangeActivities() {
    return await exchangeService.getAllExchangeActivities();
  }

  async getPendingExchanges(): Promise<ShiftExchange[]> {
    return await exchangeService.getPendingExchanges();
  }

  async getAcceptedExchanges(): Promise<ShiftExchange[]> {
    return await exchangeService.getAcceptedExchanges();
  }

  /**
   * Sync queued actions
   */
  async syncQueuedActions(): Promise<{ success: number; failed: number }> {
    const online = await this.isOnline();

    if (!online) {
      throw new Error('Cannot sync while offline');
    }

    return await queueService.syncQueue();
  }

  /**
   * Get queue status
   */
  getQueueStatus() {
    return {
      pending: queueService.getPendingCount(),
      failed: queueService.getFailedCount(),
      queue: queueService.getQueue(),
      metadata: queueService.getMetadata(),
      isSyncing: queueService.isSyncInProgress(),
    };
  }

  /**
   * Subscribe to queue changes
   */
  subscribeToQueue(listener: Parameters<typeof queueService.subscribe>[0]) {
    return queueService.subscribe(listener);
  }

  /**
   * Retry a failed action
   */
  async retryFailedAction(actionId: string): Promise<void> {
    await queueService.retryAction(actionId);
    return this.syncQueuedActions().then(() => undefined);
  }

  /**
   * Clear completed actions
   */
  async clearCompletedActions(): Promise<void> {
    return await queueService.clearCompletedActions();
  }
}

// Export singleton instance
export default new OfflineExchangeService();
