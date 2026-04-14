import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import type { RootState } from '../index';
import { shiftsService } from '../../services/shiftsService';
import type { Shift } from './shiftsSlice';

export type ManageShiftsFilter =
  | 'all'
  | 'pending_approval'
  | 'scheduled'
  | 'in_progress'
  | 'completed';

interface PaginationState {
  currentPage: number;
  totalCount: number;
  hasMore: boolean;
  pageSize: number;
}

interface ManageShiftsState {
  shifts: Shift[];
  pagination: PaginationState;
  filter: ManageShiftsFilter;
  isLoading: boolean;
  isLoadingMore: boolean;
  isMutating: boolean;
  error: string | null;
  lastFetch: string | null;
}

const initialState: ManageShiftsState = {
  shifts: [],
  pagination: {
    currentPage: 1,
    totalCount: 0,
    hasMore: false,
    pageSize: 6,
  },
  filter: 'all',
  isLoading: false,
  isLoadingMore: false,
  isMutating: false,
  error: null,
  lastFetch: null,
};

interface FetchParams {
  page?: number;
  pageSize?: number;
  status?: string;
}

export const fetchAllCompanyShifts = createAsyncThunk(
  'manageShifts/fetchAll',
  async (params: FetchParams = {}, { rejectWithValue }) => {
    try {
      const { page = 1, pageSize = 6, status } = params;
      return await shiftsService.getAllCompanyShifts({ page, pageSize, status });
    } catch (error: any) {
      return rejectWithValue(error?.message || 'Failed to fetch company shifts');
    }
  }
);

interface CreateShiftPayload {
  staff_user: number;
  venue: number;
  start_time: string;
  end_time: string;
  required_security_role?: string;
  notes?: string;
  hourly_rate?: number | null;
  is_special_event?: boolean;
  status?: string;
  is_published?: boolean;
}

interface CreateMultiStaffPayload {
  staff_users: number[];
  venue: number;
  start_time: string;
  end_time: string;
  required_security_role?: string;
  notes?: string;
  hourly_rate?: number | null;
  is_special_event?: boolean;
  status?: string;
}

export const createShiftThunk = createAsyncThunk(
  'manageShifts/create',
  async (payload: CreateShiftPayload, { dispatch, getState, rejectWithValue }) => {
    try {
      const created = await shiftsService.createShift(payload);
      const state = getState() as RootState;
      const filter = state.manageShifts.filter;
      const status = filter === 'all' ? undefined : filter;
      // Refetch page 1 so the new shift lands at its server-determined position.
      dispatch(fetchAllCompanyShifts({ page: 1, pageSize: 6, status }));
      return created;
    } catch (error: any) {
      return rejectWithValue(
        error?.response?.data?.detail || error?.message || 'Failed to create shift'
      );
    }
  }
);

export const createMultiStaffShiftsThunk = createAsyncThunk(
  'manageShifts/createMultiStaff',
  async (payload: CreateMultiStaffPayload, { dispatch, getState, rejectWithValue }) => {
    try {
      const result = await shiftsService.createMultiStaffShifts(payload);
      const state = getState() as RootState;
      const filter = state.manageShifts.filter;
      const status = filter === 'all' ? undefined : filter;
      dispatch(fetchAllCompanyShifts({ page: 1, pageSize: 6, status }));
      return result;
    } catch (error: any) {
      return rejectWithValue(
        error?.response?.data?.detail ||
          error?.response?.data?.error ||
          error?.message ||
          'Failed to create shifts'
      );
    }
  }
);

interface ApprovePayload {
  shiftId: number;
  approved: boolean;
  managerSignature?: string;
  managerNotes?: string;
}

export const approveShiftThunk = createAsyncThunk(
  'manageShifts/approve',
  async (payload: ApprovePayload, { rejectWithValue }) => {
    try {
      const { shiftId, ...rest } = payload;
      return await shiftsService.approveShift(shiftId, rest);
    } catch (error: any) {
      return rejectWithValue(
        error?.response?.data?.detail ||
          error?.response?.data?.error ||
          error?.message ||
          'Failed to approve shift'
      );
    }
  }
);

interface UpdatePayload {
  shiftId: number;
  patch: {
    start_time?: string;
    end_time?: string;
    notes?: string;
    hourly_rate?: number | null;
    is_special_event?: boolean;
  };
}

export const updateShiftThunk = createAsyncThunk(
  'manageShifts/update',
  async ({ shiftId, patch }: UpdatePayload, { rejectWithValue }) => {
    try {
      return await shiftsService.updateShift(shiftId, patch);
    } catch (error: any) {
      return rejectWithValue(
        error?.response?.data?.detail || error?.message || 'Failed to update shift'
      );
    }
  }
);

export const cancelShiftThunk = createAsyncThunk(
  'manageShifts/cancel',
  async (shiftId: number, { rejectWithValue }) => {
    try {
      return await shiftsService.cancelShift(shiftId);
    } catch (error: any) {
      return rejectWithValue(
        error?.response?.data?.detail || error?.message || 'Failed to cancel shift'
      );
    }
  }
);

export const loadMoreCompanyShifts = createAsyncThunk(
  'manageShifts/loadMore',
  async (_, { getState, rejectWithValue }) => {
    try {
      const state = getState() as RootState;
      const { currentPage, pageSize, hasMore } = state.manageShifts.pagination;
      const filter = state.manageShifts.filter;

      if (!hasMore) return null;

      const status = filter === 'all' ? undefined : filter;
      return await shiftsService.getAllCompanyShifts({
        page: currentPage + 1,
        pageSize,
        status,
      });
    } catch (error: any) {
      return rejectWithValue(error?.message || 'Failed to load more shifts');
    }
  }
);

const manageShiftsSlice = createSlice({
  name: 'manageShifts',
  initialState,
  reducers: {
    setFilter: (state, action: PayloadAction<ManageShiftsFilter>) => {
      state.filter = action.payload;
    },
    clearError: (state) => {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchAllCompanyShifts.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchAllCompanyShifts.fulfilled, (state, action) => {
        state.isLoading = false;
        state.lastFetch = new Date().toISOString();

        const response = action.payload;
        state.shifts = response.results;
        state.pagination.currentPage = 1;
        state.pagination.totalCount = response.count;
        state.pagination.hasMore = response.next !== null;
      })
      .addCase(fetchAllCompanyShifts.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      })
      .addCase(createShiftThunk.pending, (state) => {
        state.isMutating = true;
        state.error = null;
      })
      .addCase(createShiftThunk.fulfilled, (state) => {
        state.isMutating = false;
      })
      .addCase(createShiftThunk.rejected, (state, action) => {
        state.isMutating = false;
        state.error = action.payload as string;
      })
      .addCase(createMultiStaffShiftsThunk.pending, (state) => {
        state.isMutating = true;
        state.error = null;
      })
      .addCase(createMultiStaffShiftsThunk.fulfilled, (state) => {
        state.isMutating = false;
      })
      .addCase(createMultiStaffShiftsThunk.rejected, (state, action) => {
        state.isMutating = false;
        state.error = action.payload as string;
      })
      .addCase(approveShiftThunk.pending, (state) => {
        state.isMutating = true;
        state.error = null;
      })
      .addCase(approveShiftThunk.fulfilled, (state, action) => {
        state.isMutating = false;
        const updated = action.payload;
        const idx = state.shifts.findIndex((s) => s.id === updated.id);
        if (idx !== -1) state.shifts[idx] = updated;
      })
      .addCase(approveShiftThunk.rejected, (state, action) => {
        state.isMutating = false;
        state.error = action.payload as string;
      })
      .addCase(updateShiftThunk.pending, (state) => {
        state.isMutating = true;
        state.error = null;
      })
      .addCase(updateShiftThunk.fulfilled, (state, action) => {
        state.isMutating = false;
        const updated = action.payload;
        const idx = state.shifts.findIndex((s) => s.id === updated.id);
        if (idx !== -1) state.shifts[idx] = updated;
      })
      .addCase(updateShiftThunk.rejected, (state, action) => {
        state.isMutating = false;
        state.error = action.payload as string;
      })
      .addCase(cancelShiftThunk.pending, (state) => {
        state.isMutating = true;
        state.error = null;
      })
      .addCase(cancelShiftThunk.fulfilled, (state, action) => {
        state.isMutating = false;
        const updated = action.payload;
        const idx = state.shifts.findIndex((s) => s.id === updated.id);
        if (idx !== -1) state.shifts[idx] = updated;
      })
      .addCase(cancelShiftThunk.rejected, (state, action) => {
        state.isMutating = false;
        state.error = action.payload as string;
      })
      .addCase(loadMoreCompanyShifts.pending, (state) => {
        state.isLoadingMore = true;
      })
      .addCase(loadMoreCompanyShifts.fulfilled, (state, action) => {
        state.isLoadingMore = false;
        if (!action.payload) return;

        const response = action.payload;
        const existingIds = new Set(state.shifts.map((s) => s.id));
        const newShifts = response.results.filter((s) => !existingIds.has(s.id));

        state.shifts = [...state.shifts, ...newShifts];
        state.pagination.currentPage += 1;
        state.pagination.hasMore = response.next !== null;
      })
      .addCase(loadMoreCompanyShifts.rejected, (state, action) => {
        state.isLoadingMore = false;
        state.error = action.payload as string;
      });
  },
});

export const { setFilter, clearError } = manageShiftsSlice.actions;

export const selectManageShifts = (state: RootState) => state.manageShifts.shifts;
export const selectManageShiftsFilter = (state: RootState) => state.manageShifts.filter;
export const selectManageShiftsLoading = (state: RootState) => state.manageShifts.isLoading;
export const selectManageShiftsLoadingMore = (state: RootState) =>
  state.manageShifts.isLoadingMore;
export const selectManageShiftsPagination = (state: RootState) =>
  state.manageShifts.pagination;
export const selectManageShiftsHasMore = (state: RootState) =>
  state.manageShifts.pagination.hasMore;
export const selectManageShiftsError = (state: RootState) => state.manageShifts.error;
export const selectManageShiftsMutating = (state: RootState) =>
  state.manageShifts.isMutating;

export const selectManageShiftsFiltered = (state: RootState): Shift[] => {
  const { shifts, filter } = state.manageShifts;
  if (filter === 'all') return shifts;
  return shifts.filter((s) => s.status === filter);
};

export default manageShiftsSlice.reducer;
