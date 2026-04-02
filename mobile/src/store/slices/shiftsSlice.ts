import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import type { RootState } from '../index';
import { shiftsService, PaginationParams } from '../../services/shiftsService';
import { database } from '../../services/database';

/**
 * Co-worker interface for multi-staff shifts
 */
export interface Coworker {
  id: number;
  first_name: string;
  last_name: string;
  profile_photo?: string | null;
  shift_id: number;
  check_in_time?: string | null;
  check_out_time?: string | null;
  status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled' | 'pending_approval' | 'approved' | 'no_show';
}

export interface Shift {
  id: number;
  venue: {
    id: number;
    name: string;
    address: string;
    latitude: number;
    longitude: number;
    venue_terms?: string;
    requires_fire_exit_check?: boolean;
    requires_capacity_check?: boolean;
    requires_id_scan?: boolean;
  };
  start_time: string;
  end_time: string;
  required_security_role: string;
  actual_start_time?: string;
  actual_end_time?: string;
  status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled' | 'pending_approval' | 'approved' | 'no_show';
  check_in_time?: string;
  check_out_time?: string;
  check_in_latitude?: number;
  check_in_longitude?: number;
  check_out_latitude?: number;
  check_out_longitude?: number;
  check_in_location?: {
    latitude: number;
    longitude: number;
  };
  check_out_location?: {
    latitude: number;
    longitude: number;
  };
  check_in_photo?: string;
  check_out_photo?: string;
  check_in_signature?: string;
  check_out_signature?: string;
  break_start_time?: string;
  break_end_time?: string;
  notes?: string;
  sync_status: 'synced' | 'pending' | 'failed';

  // Multi-staff shift fields
  shift_group?: string | null;
  coworkers?: Coworker[];

  // Transfer status fields
  pending_exchange?: {
    id: number;
    status: 'pending' | 'accepted_by_target';
    target_user: {
      id: number;
      first_name: string;
      last_name: string;
    };
    created_at: string;
    request_reason: string;
  };

  pending_release?: {
    id: number;
    status: 'open' | 'claimed';
    created_at: string;
    request_reason: string;
    claimed_by?: {
      id: number;
      first_name: string;
      last_name: string;
    };
  };

  approved_transfer?: {
    id: number;
    target_user: {
      id: number;
      first_name: string;
      last_name: string;
    };
    approved_at: string;
    was_auto_approved: boolean;
  };
}

interface PaginationState {
  currentPage: number;
  totalCount: number;
  hasMore: boolean;
  pageSize: number;
}

interface ShiftsState {
  activeShift: Shift | null;
  upcomingShifts: Shift[];
  pastScheduledShifts: Shift[];
  completedShifts: Shift[];
  isLoading: boolean;
  isLoadingMore: boolean;
  error: string | null;
  lastFetch: string | null;
  pagination: PaginationState;
  recentlyCheckedOutShiftIds: number[];  // Track shifts to prevent race condition on refetch
}

const initialState: ShiftsState = {
  activeShift: null,
  upcomingShifts: [],
  pastScheduledShifts: [],
  completedShifts: [],
  isLoading: false,
  isLoadingMore: false,
  error: null,
  lastFetch: null,
  pagination: {
    currentPage: 1,
    totalCount: 0,
    hasMore: false,
    pageSize: 10,
  },
  recentlyCheckedOutShiftIds: [],
};

// Async thunk to fetch shifts from API (first page)
export const fetchShifts = createAsyncThunk(
  'shifts/fetchShifts',
  async (params: PaginationParams = {}, { rejectWithValue }) => {
    try {
      // Default to page 1 and pageSize 20
      const paginationParams: PaginationParams = {
        page: params.page || 1,
        pageSize: params.pageSize || 10,
      };

      // Fetch from API with pagination
      const response = await shiftsService.fetchShifts(paginationParams);

      // Save to local database for offline access
      await database.saveShifts(response.results);

      return response;
    } catch (error: any) {
      // If offline, try to load from local database
      try {
        const localShifts = await database.getShifts();
        if (localShifts.length > 0) {
          return {
            count: localShifts.length,
            next: null,
            previous: null,
            results: localShifts,
          };
        }
      } catch (dbError) {
        console.error('[ShiftsSlice] Error loading from local DB:', dbError);
      }

      return rejectWithValue(error.message || 'Failed to fetch shifts');
    }
  }
);

// Async thunk to load more shifts (next page)
export const loadMoreShifts = createAsyncThunk(
  'shifts/loadMoreShifts',
  async (_, { getState, rejectWithValue }) => {
    try {
      const state = getState() as RootState;
      const { currentPage, pageSize, hasMore } = state.shifts.pagination;

      // Don't load if there's no more data
      if (!hasMore) {
        return null;
      }

      // Fetch next page
      const nextPage = currentPage + 1;
      const response = await shiftsService.fetchShifts({
        page: nextPage,
        pageSize,
      });

      // Save to local database for offline access
      await database.saveShifts(response.results);

      return response;
    } catch (error: any) {
      return rejectWithValue(error.message || 'Failed to load more shifts');
    }
  }
);

const shiftsSlice = createSlice({
  name: 'shifts',
  initialState,
  reducers: {
    setActiveShift: (state, action: PayloadAction<Shift | null>) => {
      state.activeShift = action.payload;
    },
    setUpcomingShifts: (state, action: PayloadAction<Shift[]>) => {
      state.upcomingShifts = action.payload;
    },
    setPastScheduledShifts: (state, action: PayloadAction<Shift[]>) => {
      state.pastScheduledShifts = action.payload;
    },
    setCompletedShifts: (state, action: PayloadAction<Shift[]>) => {
      state.completedShifts = action.payload;
    },
    updateShift: (state, action: PayloadAction<Shift>) => {
      const shift = action.payload;

      // Update active shift if it matches
      if (state.activeShift?.id === shift.id) {
        state.activeShift = shift;
      }

      // Update in upcoming shifts
      const upcomingIndex = state.upcomingShifts.findIndex(s => s.id === shift.id);
      if (upcomingIndex !== -1) {
        state.upcomingShifts[upcomingIndex] = shift;
      }

      // Update in completed shifts
      const completedIndex = state.completedShifts.findIndex(s => s.id === shift.id);
      if (completedIndex !== -1) {
        state.completedShifts[completedIndex] = shift;
      }
    },
    checkInShift: (
      state,
      action: PayloadAction<{
        shiftId: number;
        location: { latitude: number; longitude: number };
        photo?: string;
        signature?: string;
        syncStatus?: 'synced' | 'pending' | 'failed';
        checkInTime?: string;  // Server-provided timestamp for consistency
      }>
    ) => {
      const { shiftId, location, photo, signature, syncStatus, checkInTime } = action.payload;
      const shift = state.upcomingShifts.find(s => s.id === shiftId);

      if (shift) {
        shift.status = 'in_progress';
        // Use server timestamp if available, fallback to local time for offline scenarios
        shift.check_in_time = checkInTime || new Date().toISOString();
        shift.check_in_location = location;
        shift.check_in_photo = photo;
        shift.check_in_signature = signature;
        shift.sync_status = syncStatus || 'pending';
        state.activeShift = shift;

        // Remove from upcoming shifts to avoid duplicates
        state.upcomingShifts = state.upcomingShifts.filter(s => s.id !== shiftId);
      }
    },
    checkOutShift: (
      state,
      action: PayloadAction<{
        shiftId: number;
        location: { latitude: number; longitude: number };
        photo?: string;
        signature?: string;
        syncStatus?: 'synced' | 'pending' | 'failed';
      }>
    ) => {
      const { shiftId, location, photo, signature, syncStatus } = action.payload;

      if (state.activeShift?.id === shiftId) {
        state.activeShift.status = 'completed';
        state.activeShift.check_out_time = new Date().toISOString();
        state.activeShift.check_out_location = location;
        state.activeShift.check_out_photo = photo;
        state.activeShift.check_out_signature = signature;
        state.activeShift.sync_status = syncStatus || 'pending';

        // Track this shift as recently checked out to prevent race condition on refetch
        if (!state.recentlyCheckedOutShiftIds.includes(shiftId)) {
          state.recentlyCheckedOutShiftIds.push(shiftId);
        }

        // Move to completed shifts
        state.completedShifts.unshift(state.activeShift);
        state.activeShift = null;
      }
    },
    startBreak: (
      state,
      action: PayloadAction<{
        shiftId: number;
        syncStatus?: 'synced' | 'pending' | 'failed';
      }>
    ) => {
      const { shiftId, syncStatus } = action.payload;
      if (state.activeShift?.id === shiftId) {
        state.activeShift.break_start_time = new Date().toISOString();
        state.activeShift.sync_status = syncStatus || 'pending';
      }
    },
    endBreak: (
      state,
      action: PayloadAction<{
        shiftId: number;
        syncStatus?: 'synced' | 'pending' | 'failed';
      }>
    ) => {
      const { shiftId, syncStatus } = action.payload;
      if (state.activeShift?.id === shiftId) {
        state.activeShift.break_end_time = new Date().toISOString();
        state.activeShift.sync_status = syncStatus || 'pending';
      }
    },
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.isLoading = action.payload;
    },
    setError: (state, action: PayloadAction<string | null>) => {
      state.error = action.payload;
    },
    setLastFetch: (state, action: PayloadAction<string>) => {
      state.lastFetch = action.payload;
    },
  },
  extraReducers: (builder) => {
    builder
      // Fetch shifts (first page)
      .addCase(fetchShifts.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchShifts.fulfilled, (state, action) => {
        state.isLoading = false;
        state.lastFetch = new Date().toISOString();

        const response = action.payload;
        const shifts = response.results;

        // Ensure pagination state exists (handle migration from old state)
        if (!state.pagination) {
          state.pagination = {
            currentPage: 1,
            totalCount: 0,
            hasMore: false,
            pageSize: 4,
          };
        }

        // Update pagination state
        state.pagination.currentPage = 1;
        state.pagination.totalCount = response.count;
        state.pagination.hasMore = response.next !== null;

        // Categorize shifts (replace existing)
        const now = new Date();

        // Find active shift (in_progress), EXCLUDING recently checked-out shifts
        // This prevents race condition where backend hasn't processed checkout yet
        const recentlyCheckedOut = state.recentlyCheckedOutShiftIds || [];
        state.activeShift = shifts.find(
          s => s.status === 'in_progress' &&
               !recentlyCheckedOut.includes(s.id)
        ) || null;

        // Clear tracking for shifts that are now confirmed as completed by backend
        const confirmedCompletedIds = shifts
          .filter(s => ['completed', 'approved', 'pending_approval', 'no_show'].includes(s.status))
          .map(s => s.id);
        state.recentlyCheckedOutShiftIds = recentlyCheckedOut.filter(
          id => !confirmedCompletedIds.includes(id)
        );

        // Upcoming shifts (scheduled and future)
        state.upcomingShifts = shifts
          .filter(s => s.status === 'scheduled' && new Date(s.start_time) >= now)
          .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());

        // Past scheduled shifts (scheduled but start time has passed - missed/overdue)
        state.pastScheduledShifts = shifts
          .filter(s => s.status === 'scheduled' && new Date(s.start_time) < now)
          .sort((a, b) => new Date(b.start_time).getTime() - new Date(a.start_time).getTime());

        // Completed shifts (includes 'completed', 'approved', and 'no_show' statuses)
        state.completedShifts = shifts
          .filter(s => s.status === 'completed' || s.status === 'approved' || s.status === 'no_show')
          .sort((a, b) => new Date(b.end_time).getTime() - new Date(a.end_time).getTime());
      })
      .addCase(fetchShifts.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      })
      // Load more shifts (next pages)
      .addCase(loadMoreShifts.pending, (state) => {
        state.isLoadingMore = true;
        state.error = null;
      })
      .addCase(loadMoreShifts.fulfilled, (state, action) => {
        state.isLoadingMore = false;

        // If no response, we're done
        if (!action.payload) {
          return;
        }

        const response = action.payload;
        const shifts = response.results;

        // Ensure pagination state exists (handle migration from old state)
        if (!state.pagination) {
          state.pagination = {
            currentPage: 1,
            totalCount: 0,
            hasMore: false,
            pageSize: 4,
          };
        }

        // Update pagination state
        state.pagination.currentPage += 1;
        state.pagination.hasMore = response.next !== null;

        // Categorize and append new shifts (avoid duplicates)
        const now = new Date();
        const existingIds = new Set([
          ...state.upcomingShifts.map(s => s.id),
          ...state.pastScheduledShifts.map(s => s.id),
          ...state.completedShifts.map(s => s.id),
        ]);

        const newShifts = shifts.filter(s => !existingIds.has(s.id));

        // Append upcoming shifts
        const newUpcoming = newShifts
          .filter(s => s.status === 'scheduled' && new Date(s.start_time) >= now);
        state.upcomingShifts = [...state.upcomingShifts, ...newUpcoming]
          .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());

        // Append past scheduled shifts
        const newPastScheduled = newShifts
          .filter(s => s.status === 'scheduled' && new Date(s.start_time) < now);
        state.pastScheduledShifts = [...state.pastScheduledShifts, ...newPastScheduled]
          .sort((a, b) => new Date(b.start_time).getTime() - new Date(a.start_time).getTime());

        // Append completed shifts
        const newCompleted = newShifts
          .filter(s => s.status === 'completed' || s.status === 'approved' || s.status === 'no_show');
        state.completedShifts = [...state.completedShifts, ...newCompleted]
          .sort((a, b) => new Date(b.end_time).getTime() - new Date(a.end_time).getTime());
      })
      .addCase(loadMoreShifts.rejected, (state, action) => {
        state.isLoadingMore = false;
        state.error = action.payload as string;
      });
  },
});

export const {
  setActiveShift,
  setUpcomingShifts,
  setPastScheduledShifts,
  setCompletedShifts,
  updateShift,
  checkInShift,
  checkOutShift,
  startBreak,
  endBreak,
  setLoading,
  setError,
  setLastFetch,
} = shiftsSlice.actions;

// Selectors
export const selectActiveShift = (state: RootState) => state.shifts.activeShift;
export const selectUpcomingShifts = (state: RootState) => state.shifts.upcomingShifts;
export const selectPastScheduledShifts = (state: RootState) => state.shifts.pastScheduledShifts;
export const selectCompletedShifts = (state: RootState) => state.shifts.completedShifts;
export const selectShiftsLoading = (state: RootState) => state.shifts.isLoading;
export const selectShiftsLoadingMore = (state: RootState) => state.shifts.isLoadingMore;
export const selectShiftsPagination = (state: RootState) => state.shifts.pagination;
export const selectShiftsHasMore = (state: RootState) => state.shifts.pagination.hasMore;
export const selectShiftsError = (state: RootState) => state.shifts.error;

export default shiftsSlice.reducer;
