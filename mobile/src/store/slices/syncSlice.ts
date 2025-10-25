import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import type { RootState } from '../index';

export interface SyncQueueItem {
  id: string;
  type: 'shift_checkin' | 'shift_checkout' | 'incident' | 'shift_break' | 'shift_update';
  priority: 'high' | 'medium' | 'low';
  data: any;
  retryCount: number;
  maxRetries: number;
  createdAt: string;
  lastAttempt?: string;
  error?: string;
}

interface SyncState {
  queue: SyncQueueItem[];
  isSyncing: boolean;
  isOnline: boolean;
  lastSuccessfulSync?: string;
  syncErrors: string[];
}

const initialState: SyncState = {
  queue: [],
  isSyncing: false,
  isOnline: true,
  syncErrors: [],
};

const syncSlice = createSlice({
  name: 'sync',
  initialState,
  reducers: {
    addToQueue: (state, action: PayloadAction<SyncQueueItem>) => {
      // Add to queue sorted by priority
      const priorities = { high: 0, medium: 1, low: 2 };
      const insertIndex = state.queue.findIndex(
        item => priorities[item.priority] > priorities[action.payload.priority]
      );

      if (insertIndex === -1) {
        state.queue.push(action.payload);
      } else {
        state.queue.splice(insertIndex, 0, action.payload);
      }
    },
    removeFromQueue: (state, action: PayloadAction<string>) => {
      state.queue = state.queue.filter(item => item.id !== action.payload);
    },
    updateQueueItem: (state, action: PayloadAction<SyncQueueItem>) => {
      const index = state.queue.findIndex(item => item.id === action.payload.id);
      if (index !== -1) {
        state.queue[index] = action.payload;
      }
    },
    incrementRetryCount: (state, action: PayloadAction<string>) => {
      const item = state.queue.find(item => item.id === action.payload);
      if (item) {
        item.retryCount += 1;
        item.lastAttempt = new Date().toISOString();
      }
    },
    setError: (
      state,
      action: PayloadAction<{ id: string; error: string }>
    ) => {
      const item = state.queue.find(item => item.id === action.payload.id);
      if (item) {
        item.error = action.payload.error;
        state.syncErrors.push(action.payload.error);
      }
    },
    clearQueue: (state) => {
      state.queue = [];
    },
    setSyncing: (state, action: PayloadAction<boolean>) => {
      state.isSyncing = action.payload;
    },
    setOnlineStatus: (state, action: PayloadAction<boolean>) => {
      state.isOnline = action.payload;
    },
    setLastSuccessfulSync: (state, action: PayloadAction<string>) => {
      state.lastSuccessfulSync = action.payload;
    },
    clearSyncErrors: (state) => {
      state.syncErrors = [];
    },
  },
});

export const {
  addToQueue,
  removeFromQueue,
  updateQueueItem,
  incrementRetryCount,
  setError,
  clearQueue,
  setSyncing,
  setOnlineStatus,
  setLastSuccessfulSync,
  clearSyncErrors,
} = syncSlice.actions;

// Selectors
export const selectSyncQueue = (state: RootState) => state.sync.queue;
export const selectIsSyncing = (state: RootState) => state.sync.isSyncing;
export const selectIsOnline = (state: RootState) => state.sync.isOnline;
export const selectSyncQueueCount = (state: RootState) => state.sync.queue.length;
export const selectHighPriorityCount = (state: RootState) =>
  state.sync.queue.filter(item => item.priority === 'high').length;

export default syncSlice.reducer;
