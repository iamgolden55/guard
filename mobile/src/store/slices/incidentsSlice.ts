import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import type { RootState } from '../index';

export interface Incident {
  id: string; // UUID for offline creation
  shift_id: number;
  incident_type: 'injury' | 'property_damage' | 'disturbance' | 'security_breach' | 'other';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  location: string;
  incident_time: string;
  photos: string[];
  voice_notes: string[];
  witnesses: string[];
  actions_taken: string;
  police_notified: boolean;
  police_reference?: string;
  ambulance_called: boolean;
  manager_notified: boolean;
  created_at: string;
  sync_status: 'synced' | 'pending' | 'failed';
}

interface IncidentsState {
  incidents: Incident[];
  isLoading: boolean;
  error: string | null;
}

const initialState: IncidentsState = {
  incidents: [],
  isLoading: false,
  error: null,
};

const incidentsSlice = createSlice({
  name: 'incidents',
  initialState,
  reducers: {
    addIncident: (state, action: PayloadAction<Incident>) => {
      state.incidents.unshift(action.payload);
    },
    updateIncident: (state, action: PayloadAction<Incident>) => {
      const index = state.incidents.findIndex(i => i.id === action.payload.id);
      if (index !== -1) {
        state.incidents[index] = action.payload;
      }
    },
    setIncidents: (state, action: PayloadAction<Incident[]>) => {
      state.incidents = action.payload;
    },
    deleteIncident: (state, action: PayloadAction<string>) => {
      state.incidents = state.incidents.filter(i => i.id !== action.payload);
    },
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.isLoading = action.payload;
    },
    setError: (state, action: PayloadAction<string | null>) => {
      state.error = action.payload;
    },
  },
});

export const {
  addIncident,
  updateIncident,
  setIncidents,
  deleteIncident,
  setLoading,
  setError,
} = incidentsSlice.actions;

// Selectors
export const selectIncidents = (state: RootState) => state.incidents.incidents;
export const selectPendingIncidents = (state: RootState) =>
  state.incidents.incidents.filter(i => i.sync_status === 'pending');
export const selectIncidentsLoading = (state: RootState) => state.incidents.isLoading;

export default incidentsSlice.reducer;
