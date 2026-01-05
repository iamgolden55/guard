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

    console.log('='.repeat(60));
    console.log('SYNC QUEUE DEBUG');
    console.log('='.repeat(60));
    console.log(`Total items: ${queue.length}`);
    console.log('');

    queue.forEach((item: any, index: number) => {
      console.log(`Item ${index + 1}:`);
      console.log(`  Type: ${item.type}`);
      console.log(`  Entity: ${item.entityType}`);
      console.log(`  Status: ${item.status}`);
      console.log(`  Attempts: ${item.attempts}`);
      console.log(`  Priority: ${item.priority}`);
      console.log(`  Created: ${item.createdAt}`);
      if (item.error) {
        console.log(`  Error: ${item.error}`);
      }
      console.log('');
    });

    console.log('='.repeat(60));

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

    console.log('='.repeat(60));
    console.log('SYNC QUEUE FIX COMPLETE');
    console.log('='.repeat(60));
    console.log(`Fixed: ${fixed} items`);
    console.log(`Removed: ${removed} items`);
    console.log(`Remaining: ${updatedQueue.length} items`);
    console.log('='.repeat(60));

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

    console.log('='.repeat(60));
    console.log('SYNC QUEUE CLEARED');
    console.log('='.repeat(60));
    console.log(`Removed ${count} items from sync queue`);
    console.log('='.repeat(60));

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
    console.log('='.repeat(60));
    console.log('FORCE SYNC - MANUAL TRIGGER NEEDED');
    console.log('='.repeat(60));
    console.log('Import syncService at the top and call syncService.processQueue()');
    console.log('='.repeat(60));

    return true;
  } catch (error) {
    logger.error('[Debug] Force sync failed', { error });
    throw error;
  }
}
