/**
 * Leave Management Redux Slice
 * Manages leave types, balances, requests, and related state
 */

import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { leaveService } from '../../services/leaveService';
import type {
  LeaveType,
  LeaveBalance,
  LeaveRequest,
  LeaveRequestFormData,
  LeaveRequestFilterOptions,
  LeaveCalendarEvent,
  LeaveStatistics,
} from '../../types/leave.types';
import { logger } from '../../utils/logger';

interface LeaveState {
  // Leave Types
  leaveTypes: LeaveType[];
  leaveTypesLoading: boolean;
  leaveTypesError: string | null;

  // Balances
  balances: LeaveBalance[];
  balancesLoading: boolean;
  balancesError: string | null;

  // Requests
  requests: LeaveRequest[];
  requestsLoading: boolean;
  requestsError: string | null;
  requestsPagination: {
    count: number;
    next: string | null;
    previous: string | null;
    currentPage: number;
  };

  // Calendar
  calendarEvents: LeaveCalendarEvent[];
  calendarLoading: boolean;
  calendarError: string | null;
  selectedMonth: string | null;

  // Statistics
  statistics: LeaveStatistics | null;
  statisticsLoading: boolean;

  // Active Filters
  activeFilters: LeaveRequestFilterOptions;

  // UI State
  selectedRequest: LeaveRequest | null;
  successMessage: string | null;
  errorMessage: string | null;
}

const initialState: LeaveState = {
  leaveTypes: [],
  leaveTypesLoading: false,
  leaveTypesError: null,

  balances: [],
  balancesLoading: false,
  balancesError: null,

  requests: [],
  requestsLoading: false,
  requestsError: null,
  requestsPagination: {
    count: 0,
    next: null,
    previous: null,
    currentPage: 1,
  },

  calendarEvents: [],
  calendarLoading: false,
  calendarError: null,
  selectedMonth: null,

  statistics: null,
  statisticsLoading: false,

  activeFilters: {
    status: 'ALL',
    year: new Date().getFullYear(),
  },

  selectedRequest: null,
  successMessage: null,
  errorMessage: null,
};

/**
 * Async Thunks
 */

// Fetch Leave Types
export const fetchLeaveTypes = createAsyncThunk(
  'leave/fetchLeaveTypes',
  async (_, { rejectWithValue }) => {
    try {
      const leaveTypes = await leaveService.getLeaveTypes();
      return leaveTypes;
    } catch (error: any) {
      logger.error('[LeaveSlice] Error fetching leave types:', error);
      return rejectWithValue(error.message || 'Failed to fetch leave types');
    }
  }
);

// Fetch My Balances
export const fetchMyBalances = createAsyncThunk(
  'leave/fetchMyBalances',
  async (_, { rejectWithValue }) => {
    try {
      const balances = await leaveService.getMyBalances();
      return balances;
    } catch (error: any) {
      logger.error('[LeaveSlice] Error fetching balances:', error);
      return rejectWithValue(error.message || 'Failed to fetch leave balances');
    }
  }
);

// Fetch My Leave Requests
export const fetchMyLeaveRequests = createAsyncThunk(
  'leave/fetchMyLeaveRequests',
  async (filters: LeaveRequestFilterOptions | undefined, { rejectWithValue }) => {
    try {
      const response = await leaveService.getMyLeaveRequests(filters);
      return response;
    } catch (error: any) {
      logger.error('[LeaveSlice] Error fetching leave requests:', error);
      return rejectWithValue(error.message || 'Failed to fetch leave requests');
    }
  }
);

// Create Leave Request
export const createLeaveRequest = createAsyncThunk(
  'leave/createLeaveRequest',
  async (data: LeaveRequestFormData, { rejectWithValue }) => {
    try {
      const request = await leaveService.createLeaveRequest(data);
      return request;
    } catch (error: any) {
      logger.error('[LeaveSlice] Error creating leave request:', error);
      return rejectWithValue(error.message || 'Failed to create leave request');
    }
  }
);

// Cancel Leave Request
export const cancelLeaveRequest = createAsyncThunk(
  'leave/cancelLeaveRequest',
  async (requestId: number, { rejectWithValue }) => {
    try {
      await leaveService.cancelLeaveRequest(requestId);
      return requestId;
    } catch (error: any) {
      logger.error('[LeaveSlice] Error cancelling leave request:', error);
      return rejectWithValue(error.message || 'Failed to cancel leave request');
    }
  }
);

// Fetch Leave Calendar
export const fetchLeaveCalendar = createAsyncThunk(
  'leave/fetchLeaveCalendar',
  async (month: string | undefined, { rejectWithValue }) => {
    try {
      const events = await leaveService.getLeaveCalendar(month);
      return { events, month };
    } catch (error: any) {
      logger.error('[LeaveSlice] Error fetching calendar:', error);
      return rejectWithValue(error.message || 'Failed to fetch leave calendar');
    }
  }
);

// Fetch Leave Statistics
export const fetchLeaveStatistics = createAsyncThunk(
  'leave/fetchLeaveStatistics',
  async (year: number | undefined, { rejectWithValue }) => {
    try {
      const statistics = await leaveService.getLeaveStatistics(year);
      return statistics;
    } catch (error: any) {
      logger.error('[LeaveSlice] Error fetching statistics:', error);
      return rejectWithValue(error.message || 'Failed to fetch leave statistics');
    }
  }
);

/**
 * Leave Slice
 */
const leaveSlice = createSlice({
  name: 'leave',
  initialState,
  reducers: {
    // Set active filters
    setActiveFilters: (state, action: PayloadAction<LeaveRequestFilterOptions>) => {
      state.activeFilters = { ...state.activeFilters, ...action.payload };
    },

    // Clear active filters
    clearActiveFilters: (state) => {
      state.activeFilters = {
        status: 'ALL',
        year: new Date().getFullYear(),
      };
    },

    // Set selected request
    setSelectedRequest: (state, action: PayloadAction<LeaveRequest | null>) => {
      state.selectedRequest = action.payload;
    },

    // Clear messages
    clearMessages: (state) => {
      state.successMessage = null;
      state.errorMessage = null;
    },

    // Set success message
    setSuccessMessage: (state, action: PayloadAction<string>) => {
      state.successMessage = action.payload;
      state.errorMessage = null;
    },

    // Set error message
    setErrorMessage: (state, action: PayloadAction<string>) => {
      state.errorMessage = action.payload;
      state.successMessage = null;
    },

    // Reset leave state
    resetLeaveState: () => initialState,
  },
  extraReducers: (builder) => {
    // Fetch Leave Types
    builder.addCase(fetchLeaveTypes.pending, (state) => {
      state.leaveTypesLoading = true;
      state.leaveTypesError = null;
    });
    builder.addCase(fetchLeaveTypes.fulfilled, (state, action) => {
      state.leaveTypesLoading = false;
      state.leaveTypes = action.payload;
    });
    builder.addCase(fetchLeaveTypes.rejected, (state, action) => {
      state.leaveTypesLoading = false;
      state.leaveTypesError = action.payload as string;
    });

    // Fetch My Balances
    builder.addCase(fetchMyBalances.pending, (state) => {
      state.balancesLoading = true;
      state.balancesError = null;
    });
    builder.addCase(fetchMyBalances.fulfilled, (state, action) => {
      state.balancesLoading = false;
      state.balances = action.payload;
    });
    builder.addCase(fetchMyBalances.rejected, (state, action) => {
      state.balancesLoading = false;
      state.balancesError = action.payload as string;
    });

    // Fetch My Leave Requests
    builder.addCase(fetchMyLeaveRequests.pending, (state) => {
      state.requestsLoading = true;
      state.requestsError = null;
    });
    builder.addCase(fetchMyLeaveRequests.fulfilled, (state, action) => {
      state.requestsLoading = false;
      state.requests = action.payload.results;
      state.requestsPagination = {
        count: action.payload.count,
        next: action.payload.next,
        previous: action.payload.previous,
        currentPage: state.activeFilters.page || 1,
      };
    });
    builder.addCase(fetchMyLeaveRequests.rejected, (state, action) => {
      state.requestsLoading = false;
      state.requestsError = action.payload as string;
    });

    // Create Leave Request
    builder.addCase(createLeaveRequest.pending, (state) => {
      state.requestsLoading = true;
      state.requestsError = null;
    });
    builder.addCase(createLeaveRequest.fulfilled, (state, action) => {
      state.requestsLoading = false;
      state.requests.unshift(action.payload);
      state.successMessage = 'Leave request submitted successfully';
    });
    builder.addCase(createLeaveRequest.rejected, (state, action) => {
      state.requestsLoading = false;
      state.errorMessage = action.payload as string;
    });

    // Cancel Leave Request
    builder.addCase(cancelLeaveRequest.pending, (state) => {
      state.requestsLoading = true;
    });
    builder.addCase(cancelLeaveRequest.fulfilled, (state, action) => {
      state.requestsLoading = false;
      const requestId = action.payload;
      const request = state.requests.find(r => r.id === requestId);
      if (request) {
        request.status = 'CANCELLED';
      }
      state.successMessage = 'Leave request cancelled successfully';
    });
    builder.addCase(cancelLeaveRequest.rejected, (state, action) => {
      state.requestsLoading = false;
      state.errorMessage = action.payload as string;
    });

    // Fetch Leave Calendar
    builder.addCase(fetchLeaveCalendar.pending, (state) => {
      state.calendarLoading = true;
      state.calendarError = null;
    });
    builder.addCase(fetchLeaveCalendar.fulfilled, (state, action) => {
      state.calendarLoading = false;
      state.calendarEvents = action.payload.events;
      state.selectedMonth = action.payload.month || null;
    });
    builder.addCase(fetchLeaveCalendar.rejected, (state, action) => {
      state.calendarLoading = false;
      state.calendarError = action.payload as string;
    });

    // Fetch Leave Statistics
    builder.addCase(fetchLeaveStatistics.pending, (state) => {
      state.statisticsLoading = true;
    });
    builder.addCase(fetchLeaveStatistics.fulfilled, (state, action) => {
      state.statisticsLoading = false;
      state.statistics = action.payload;
    });
    builder.addCase(fetchLeaveStatistics.rejected, (state) => {
      state.statisticsLoading = false;
    });
  },
});

// Actions
export const {
  setActiveFilters,
  clearActiveFilters,
  setSelectedRequest,
  clearMessages,
  setSuccessMessage,
  setErrorMessage,
  resetLeaveState,
} = leaveSlice.actions;

// Selectors
export const selectLeaveTypes = (state: { leave: LeaveState }) => state.leave.leaveTypes;
export const selectLeaveBalances = (state: { leave: LeaveState }) => state.leave.balances;
export const selectLeaveRequests = (state: { leave: LeaveState }) => state.leave.requests;
export const selectLeaveCalendar = (state: { leave: LeaveState }) => state.leave.calendarEvents;
export const selectLeaveStatistics = (state: { leave: LeaveState }) => state.leave.statistics;
export const selectSelectedRequest = (state: { leave: LeaveState }) => state.leave.selectedRequest;
export const selectActiveFilters = (state: { leave: LeaveState }) => state.leave.activeFilters;
export const selectLeaveLoading = (state: { leave: LeaveState }) =>
  state.leave.leaveTypesLoading || state.leave.balancesLoading || state.leave.requestsLoading;

export default leaveSlice.reducer;
