/**
 * AsyncStorage-based Database Service
 * Simple offline storage for shifts, incidents, and sync queue
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Shift } from '../store/slices/shiftsSlice';
import type { Incident } from '../types/incident';

// Storage keys
const STORAGE_KEYS = {
  SHIFTS: '@shifts',
  INCIDENTS: '@incidents',
  SYNC_QUEUE: '@sync_queue',
  LAST_SYNC: '@last_sync',
};

export interface SyncQueueItem {
  id: string;
  type: 'check_in' | 'check_out' | 'incident' | 'shift_check' | 'create';
  entityType: string;
  entityId: string;
  payload: any;
  priority: number;
  createdAt: string;
  attempts: number;
  status: 'pending' | 'processing' | 'failed';
  error?: string;
}

class DatabaseService {
  // ============== SHIFTS ==============

  async getShifts(): Promise<Shift[]> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.SHIFTS);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error('[Database] Error getting shifts:', error);
      return [];
    }
  }

  async getShift(id: number): Promise<Shift | null> {
    try {
      const shifts = await this.getShifts();
      return shifts.find((s) => s.id === id) || null;
    } catch (error) {
      console.error('[Database] Error getting shift:', error);
      return null;
    }
  }

  async saveShifts(shifts: Shift[]): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.SHIFTS, JSON.stringify(shifts));
    } catch (error) {
      console.error('[Database] Error saving shifts:', error);
      throw error;
    }
  }

  async updateShift(id: number, updates: Partial<Shift>): Promise<Shift | null> {
    try {
      const shifts = await this.getShifts();
      const index = shifts.findIndex((s) => s.id === id);

      if (index === -1) {
        console.error('[Database] Shift not found:', id);
        return null;
      }

      const updatedShift = { ...shifts[index], ...updates };
      shifts[index] = updatedShift;

      await this.saveShifts(shifts);
      return updatedShift;
    } catch (error) {
      console.error('[Database] Error updating shift:', error);
      throw error;
    }
  }

  async deleteShift(id: number): Promise<void> {
    try {
      const shifts = await this.getShifts();
      const filtered = shifts.filter((s) => s.id !== id);
      await this.saveShifts(filtered);
    } catch (error) {
      console.error('[Database] Error deleting shift:', error);
      throw error;
    }
  }

  // ============== INCIDENTS ==============

  async getIncidents(filters?: { shiftId?: number; status?: string }): Promise<Incident[]> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.INCIDENTS);
      const incidents: Incident[] = data ? JSON.parse(data) : [];

      if (!filters) {
        return incidents;
      }

      return incidents.filter((incident) => {
        if (filters.shiftId && incident.shift !== filters.shiftId) {
          return false;
        }
        if (filters.status && incident.status !== filters.status) {
          return false;
        }
        return true;
      });
    } catch (error) {
      console.error('[Database] Error getting incidents:', error);
      return [];
    }
  }

  async saveIncident(incident: Incident): Promise<Incident> {
    try {
      const incidents = await this.getIncidents();

      // Generate a temporary local ID if not present (use negative numbers for local IDs)
      const incidentWithId = {
        ...incident,
        id: incident.id || -Date.now(),
      };

      incidents.push(incidentWithId);
      await AsyncStorage.setItem(STORAGE_KEYS.INCIDENTS, JSON.stringify(incidents));

      return incidentWithId;
    } catch (error) {
      console.error('[Database] Error saving incident:', error);
      throw error;
    }
  }

  async updateIncident(id: number, updates: Partial<Incident>): Promise<void> {
    try {
      const incidents = await this.getIncidents();
      const index = incidents.findIndex((i) => i.id === id);

      if (index === -1) {
        console.error('[Database] Incident not found:', id);
        return;
      }

      incidents[index] = { ...incidents[index], ...updates };
      await AsyncStorage.setItem(STORAGE_KEYS.INCIDENTS, JSON.stringify(incidents));
    } catch (error) {
      console.error('[Database] Error updating incident:', error);
      throw error;
    }
  }

  // ============== SYNC QUEUE ==============

  async getSyncQueue(): Promise<SyncQueueItem[]> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.SYNC_QUEUE);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error('[Database] Error getting sync queue:', error);
      return [];
    }
  }

  async addToSyncQueue(item: Omit<SyncQueueItem, 'id' | 'createdAt' | 'attempts' | 'status'>): Promise<void> {
    try {
      const queue = await this.getSyncQueue();
      const newItem: SyncQueueItem = {
        ...item,
        id: `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        createdAt: new Date().toISOString(),
        attempts: 0,
        status: 'pending',
      };

      queue.push(newItem);

      // Sort by priority (1 = highest)
      queue.sort((a, b) => a.priority - b.priority);

      await AsyncStorage.setItem(STORAGE_KEYS.SYNC_QUEUE, JSON.stringify(queue));
    } catch (error) {
      console.error('[Database] Error adding to sync queue:', error);
      throw error;
    }
  }

  async updateSyncQueueItem(id: string, updates: Partial<SyncQueueItem>): Promise<void> {
    try {
      const queue = await this.getSyncQueue();
      const index = queue.findIndex((item) => item.id === id);

      if (index === -1) {
        console.error('[Database] Sync queue item not found:', id);
        return;
      }

      queue[index] = { ...queue[index], ...updates };
      await AsyncStorage.setItem(STORAGE_KEYS.SYNC_QUEUE, JSON.stringify(queue));
    } catch (error) {
      console.error('[Database] Error updating sync queue item:', error);
      throw error;
    }
  }

  async removeSyncQueueItem(id: string): Promise<void> {
    try {
      const queue = await this.getSyncQueue();
      const filtered = queue.filter((item) => item.id !== id);
      await AsyncStorage.setItem(STORAGE_KEYS.SYNC_QUEUE, JSON.stringify(filtered));
    } catch (error) {
      console.error('[Database] Error removing sync queue item:', error);
      throw error;
    }
  }

  async clearSyncQueue(): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.SYNC_QUEUE, JSON.stringify([]));
    } catch (error) {
      console.error('[Database] Error clearing sync queue:', error);
      throw error;
    }
  }

  // ============== LAST SYNC ==============

  async getLastSync(): Promise<Date | null> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.LAST_SYNC);
      return data ? new Date(data) : null;
    } catch (error) {
      console.error('[Database] Error getting last sync:', error);
      return null;
    }
  }

  async setLastSync(date: Date): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.LAST_SYNC, date.toISOString());
    } catch (error) {
      console.error('[Database] Error setting last sync:', error);
      throw error;
    }
  }

  // ============== UTILITIES ==============

  async clearAll(): Promise<void> {
    try {
      await AsyncStorage.multiRemove([
        STORAGE_KEYS.SHIFTS,
        STORAGE_KEYS.INCIDENTS,
        STORAGE_KEYS.SYNC_QUEUE,
        STORAGE_KEYS.LAST_SYNC,
      ]);
    } catch (error) {
      console.error('[Database] Error clearing all data:', error);
      throw error;
    }
  }

  async getStorageInfo(): Promise<{ shifts: number; incidents: number; queue: number }> {
    try {
      const [shifts, incidents, queue] = await Promise.all([
        this.getShifts(),
        this.getIncidents(),
        this.getSyncQueue(),
      ]);

      return {
        shifts: shifts.length,
        incidents: incidents.length,
        queue: queue.length,
      };
    } catch (error) {
      console.error('[Database] Error getting storage info:', error);
      return { shifts: 0, incidents: 0, queue: 0 };
    }
  }
}

export const database = new DatabaseService();
