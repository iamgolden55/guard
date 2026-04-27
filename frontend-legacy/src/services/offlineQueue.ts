/**
 * IndexedDB-backed offline queue for check-in/check-out submissions.
 *
 * Guards working at venues with unreliable connectivity can complete
 * check-in/check-out flows even when the API is unreachable.  GPS,
 * photo and signature data are persisted in IndexedDB and replayed
 * automatically once connectivity is restored.
 */

import shiftService from './shiftService';

export interface PendingSubmission {
  id: string;
  type: 'check-in' | 'check-out';
  shiftId: number;
  timestamp: string;
  data: {
    latitude: number;
    longitude: number;
    accuracy: number;
    photo?: string;       // base64
    signature?: string;   // base64
    venue_terms_accepted?: boolean;
  };
  retryCount: number;
  createdAt: string;
}

const DB_NAME = 'mead-security-offline';
const STORE_NAME = 'pending-submissions';
const DB_VERSION = 1;
const MAX_RETRIES = 10;

export class OfflineQueue {
  private db: IDBDatabase | null = null;

  /**
   * Open (or create) the IndexedDB database and return the handle.
   * Subsequent calls return the cached handle.
   */
  async init(): Promise<IDBDatabase> {
    if (this.db) return this.db;

    return new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
          store.createIndex('by_created', 'createdAt', { unique: false });
          store.createIndex('by_type', 'type', { unique: false });
        }
      };

      request.onsuccess = () => {
        this.db = request.result;

        // If the database connection is closed unexpectedly, reset the
        // cached handle so that the next call to init() re-opens it.
        this.db.onclose = () => {
          this.db = null;
        };

        resolve(this.db);
      };

      request.onerror = () => {
        reject(new Error(`Failed to open IndexedDB: ${request.error?.message}`));
      };
    });
  }

  /**
   * Add a pending submission to the queue.
   */
  async add(submission: PendingSubmission): Promise<void> {
    const db = await this.init();

    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const request = store.put(submission);

      request.onsuccess = () => resolve();
      request.onerror = () =>
        reject(new Error(`Failed to add submission: ${request.error?.message}`));
    });
  }

  /**
   * Get all pending submissions, ordered oldest-first.
   */
  async getAll(): Promise<PendingSubmission[]> {
    const db = await this.init();

    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const index = store.index('by_created');
      const request = index.getAll();

      request.onsuccess = () => resolve(request.result as PendingSubmission[]);
      request.onerror = () =>
        reject(new Error(`Failed to read submissions: ${request.error?.message}`));
    });
  }

  /**
   * Return the number of pending submissions.
   */
  async count(): Promise<number> {
    const db = await this.init();

    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const request = store.count();

      request.onsuccess = () => resolve(request.result);
      request.onerror = () =>
        reject(new Error(`Failed to count submissions: ${request.error?.message}`));
    });
  }

  /**
   * Remove a submission by id (after successful sync).
   */
  async remove(id: string): Promise<void> {
    const db = await this.init();

    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const request = store.delete(id);

      request.onsuccess = () => resolve();
      request.onerror = () =>
        reject(new Error(`Failed to remove submission: ${request.error?.message}`));
    });
  }

  /**
   * Update a submission (e.g. increment retryCount).
   */
  private async update(submission: PendingSubmission): Promise<void> {
    return this.add(submission); // put() upserts by keyPath
  }

  /**
   * Walk through every pending submission, attempt the API call, and
   * return how many succeeded vs failed.
   */
  async processQueue(): Promise<{ succeeded: number; failed: number }> {
    const items = await this.getAll();
    let succeeded = 0;
    let failed = 0;

    for (const item of items) {
      try {
        const payload = {
          location: {
            latitude: item.data.latitude,
            longitude: item.data.longitude,
            accuracy: item.data.accuracy,
          },
          photo: item.data.photo || '',
          signature: item.data.signature || '',
        };

        if (item.type === 'check-in') {
          await shiftService.checkInShift(item.shiftId, payload);
        } else {
          await shiftService.checkOutShift(item.shiftId, payload);
        }

        await this.remove(item.id);
        succeeded++;
      } catch {
        item.retryCount++;

        // Drop submissions that have exceeded the retry limit to avoid
        // permanent queue bloat.  The guard will need to retry manually.
        if (item.retryCount >= MAX_RETRIES) {
          await this.remove(item.id);
        } else {
          await this.update(item);
        }

        failed++;
      }
    }

    return { succeeded, failed };
  }

  /**
   * Build a PendingSubmission object with a unique id and current timestamp.
   */
  static createSubmission(
    type: 'check-in' | 'check-out',
    shiftId: number,
    data: PendingSubmission['data'],
  ): PendingSubmission {
    return {
      id: `${type}-${shiftId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      type,
      shiftId,
      timestamp: new Date().toISOString(),
      data,
      retryCount: 0,
      createdAt: new Date().toISOString(),
    };
  }
}

export const offlineQueue = new OfflineQueue();
