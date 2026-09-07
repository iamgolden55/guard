/**
 * Debug utility to inspect and fix sync queue items
 *
 * Usage in app:
 * import { debugSyncQueue, clearAllSyncQueue, fixSyncQueueTypes } from '@/utils/debugSyncQueue';
 *
 * Then call from a button or console:
 * await debugSyncQueue(); // Shows queue contents
 * await fixSyncQueueTypes(); // Manually fix action types
 * await clearAllSyncQueue(); // Nuclear option - clears everything
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { logger } from '@/utils/logger';

const STORAGE_KEYS = {
  SYNC_QUEUE: '@sync_queue',
};

/**
 * Debug: Show all items in sync queue
 */
export async function debugSyncQueue() {
  try {
    const queueJson = await AsyncStorage.getItem(STORAGE_KEYS.SYNC_QUEUE);
    const queue = queueJson ? JSON.parse(queueJson) : [];

    logger.debug('='.repeat(60));
    logger.debug('SYNC QUEUE DEBUG');
    logger.debug('='.repeat(60));
    logger.debug(`Total items: ${queue.length}`);
    logger.debug('');

    queue.forEach((item: any, index: number) => {
      logger.debug(`Item ${index + 1}:`);
      logger.debug(`  Type: ${item.type}`);
      logger.debug(`  Entity: ${item.entityType}`);
      logger.debug(`  Status: ${item.status}`);
      logger.debug(`  Attempts: ${item.attempts}`);
      logger.debug(`  Priority: ${item.priority}`);
      logger.debug(`  Created: ${item.createdAt}`);
      if (item.error) {
        logger.debug(`  Error: ${item.error}`);
      }
      logger.debug('');
    });

    logger.debug('='.repeat(60));

    return queue;
  } catch (error) {
    logger.error('[Debug] Failed to read sync queue', { error });
    throw error;
  }
}

/**
 * Fix: Manually fix action types in sync queue
 */
export async function fixSyncQueueTypes() {
  try {
    const queueJson = await AsyncStorage.getItem(STORAGE_KEYS.SYNC_QUEUE);
    const queue = queueJson ? JSON.parse(queueJson) : [];

    let fixed = 0;
    let removed = 0;

    const updatedQueue = queue
      .map((item: any) => {
        // Fix incidents with 'create' type
        if (item.entityType === 'incidents' && item.type === 'create') {
          fixed++;
          logger.info('[Debug] Fixed item', { id: item.id, oldType: 'create', newType: 'create_incident' });
          return {
            ...item,
            type: 'create_incident',
            attempts: 0,
            status: 'pending',
            error: undefined,
          };
        }
        return item;
      })
      .filter((item: any) => {
        // Remove any items with invalid types that can't be fixed
        const validTypes = [
          'check_in',
          'check_out',
          'start_break',
          'end_break',
          'create_incident',
          'update_incident',
          'create_shift_check',
          'update_shift',
        ];
        if (!validTypes.includes(item.type)) {
          removed++;
          logger.warn('[Debug] Removed invalid item', { id: item.id, type: item.type });
          return false;
        }
        return true;
      });

    await AsyncStorage.setItem(STORAGE_KEYS.SYNC_QUEUE, JSON.stringify(updatedQueue));

    logger.debug('='.repeat(60));
    logger.debug('SYNC QUEUE FIX COMPLETE');
    logger.debug('='.repeat(60));
    logger.debug(`Fixed: ${fixed} items`);
    logger.debug(`Removed: ${removed} items`);
    logger.debug(`Remaining: ${updatedQueue.length} items`);
    logger.debug('='.repeat(60));

    return { fixed, removed, remaining: updatedQueue.length };
  } catch (error) {
    logger.error('[Debug] Failed to fix sync queue', { error });
    throw error;
  }
}

/**
 * Nuclear option: Clear entire sync queue
 * WARNING: This will delete all pending sync items!
 */
export async function clearAllSyncQueue() {
  try {
    const queueJson = await AsyncStorage.getItem(STORAGE_KEYS.SYNC_QUEUE);
    const queue = queueJson ? JSON.parse(queueJson) : [];
    const count = queue.length;

    await AsyncStorage.setItem(STORAGE_KEYS.SYNC_QUEUE, JSON.stringify([]));

    logger.debug('='.repeat(60));
    logger.debug('SYNC QUEUE CLEARED');
    logger.debug('='.repeat(60));
    logger.debug(`Removed ${count} items from sync queue`);
    logger.debug('='.repeat(60));

    logger.warn('[Debug] Cleared entire sync queue', { count });

    return count;
  } catch (error) {
    logger.error('[Debug] Failed to clear sync queue', { error });
    throw error;
  }
}

/**
 * Force sync: Process sync queue immediately
 */
export async function forceSyncNow() {
  try {
    // Note: Import syncService at the top of your file where you use this function
    // to avoid dynamic imports which don't work in React Native development builds
    logger.info('[Debug] Forcing sync now - import syncService manually');
    logger.debug('='.repeat(60));
    logger.debug('FORCE SYNC - MANUAL TRIGGER NEEDED');
    logger.debug('='.repeat(60));
    logger.debug('Import syncService at the top and call syncService.processQueue()');
    logger.debug('='.repeat(60));

    return true;
  } catch (error) {
    logger.error('[Debug] Force sync failed', { error });
    throw error;
  }
}
