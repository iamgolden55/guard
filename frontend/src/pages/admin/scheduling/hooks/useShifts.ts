import { useState, useCallback } from 'react';
import type { ScheduleShift, FilterState } from '../types';
import { getShifts, updateShift, deleteShift } from '../../../../services/api';
import shiftService from '../../../../services/shiftService';
import type { Shift } from '../../../../types';

export function useShifts() {
  const [shifts, setShifts] = useState<ScheduleShift[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedShifts, setSelectedShifts] = useState<Set<number>>(new Set());
  const [isSelectionMode, setIsSelectionMode] = useState(false);

  // Load shifts with optional filters
  const loadShifts = useCallback(async (filters?: FilterState) => {
    try {
      setIsLoading(true);
      setError(null);

      const filteredShiftsFromApi = await getShifts({
        venueId: filters?.venueId || undefined,
        staffId: filters?.staffId || undefined
      });

      // Map API response to ScheduleShift type
      const mappedShifts: ScheduleShift[] = filteredShiftsFromApi.map((shift: any) => {
        const startDate = new Date(shift.start_time);
        const endDate = new Date(shift.end_time);

        return {
          id: shift.id,
          venueId: shift.venue,
          venueName: shift.venue_details?.name || 'Unknown Venue',
          staffId: shift.staff_user || null,
          staffName: shift.staff_details
            ? `${shift.staff_details.first_name} ${shift.staff_details.last_name}`
            : null,
          date: startDate,
          startTime: startDate.toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
          }),
          endTime: endDate.toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
          }),
          isPublished: true,
          isRecurring: false,
          status: shift.status,
          shiftGroup: shift.shift_group || null,
          requiredSecurityRole: shift.required_security_role || 'sg'
        };
      });

      setShifts(mappedShifts);
    } catch (err) {
      console.error('Error loading shifts:', err);
      setError(err instanceof Error ? err.message : 'An error occurred while loading shifts');
      setShifts([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Get shifts for a specific day
  const getShiftsForDay = useCallback((date: Date): ScheduleShift[] => {
    return shifts.filter(shift => {
      const shiftDate = new Date(shift.date);
      return shiftDate.getDate() === date.getDate() &&
             shiftDate.getMonth() === date.getMonth() &&
             shiftDate.getFullYear() === date.getFullYear();
    });
  }, [shifts]);

  // Create a single shift
  const createShift = useCallback(async (shiftData: Partial<Shift>): Promise<boolean> => {
    try {
      setIsLoading(true);
      setError(null);
      await shiftService.createShift(shiftData);
      return true;
    } catch (err: any) {
      console.error('Error creating shift:', err);

      let errorMessage = 'An error occurred while creating the shift';
      if (err.response?.data) {
        const responseData = err.response.data;
        if (typeof responseData === 'string') {
          errorMessage = responseData;
        } else if (responseData.detail) {
          errorMessage = responseData.detail;
        } else if (responseData.non_field_errors) {
          errorMessage = Array.isArray(responseData.non_field_errors)
            ? responseData.non_field_errors.join(', ')
            : responseData.non_field_errors;
        } else {
          const fieldErrors = Object.entries(responseData)
            .map(([field, errors]: [string, any]) => {
              const errorList = Array.isArray(errors) ? errors : [errors];
              return `${field}: ${errorList.join(', ')}`;
            })
            .join('; ');
          if (fieldErrors) errorMessage = fieldErrors;
        }
      }
      setError(errorMessage);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Create multi-staff shifts
  const createMultiStaffShifts = useCallback(async (
    venue: number,
    staffUsers: number[],
    startTime: string,
    endTime: string,
    notes?: string,
    hourlyRate?: number | null,
    isSpecialEvent?: boolean
  ): Promise<boolean> => {
    try {
      setIsLoading(true);
      setError(null);

      await shiftService.createMultiStaffShifts({
        venue,
        staff_users: staffUsers,
        start_time: startTime,
        end_time: endTime,
        status: 'scheduled',
        required_security_role: 'sg',
        notes: notes || '',
        hourly_rate: hourlyRate,
        is_special_event: isSpecialEvent || false
      });

      return true;
    } catch (err: any) {
      console.error('Error creating multi-staff shifts:', err);
      if (err.response?.status === 400) {
        const errorData = err.response.data;
        const errorMessage = errorData.detail || Object.values(errorData).join(', ');
        setError(errorMessage);
      } else {
        setError(err instanceof Error ? err.message : 'An error occurred while creating the shifts');
      }
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Update a shift
  const handleUpdateShift = useCallback(async (
    shiftId: number,
    updateData: any
  ): Promise<boolean> => {
    try {
      setIsLoading(true);
      setError(null);

      const updatedShift = await updateShift(shiftId.toString(), updateData);

      if (updatedShift) {
        await loadShifts();
        return true;
      }
      return false;
    } catch (err) {
      console.error('Error updating shift:', err);
      setError(err instanceof Error ? err.message : 'An error occurred while updating the shift');
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [loadShifts]);

  // Delete a shift
  const handleDeleteShift = useCallback(async (shiftId: number): Promise<boolean> => {
    try {
      setIsLoading(true);
      const success = await deleteShift(shiftId.toString());

      if (success) {
        setShifts(prev => prev.filter(s => s.id !== shiftId));
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error deleting shift:', error);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Bulk delete shifts
  const handleBulkDelete = useCallback(async (): Promise<boolean> => {
    try {
      setIsLoading(true);
      let allSuccessful = true;

      for (const shiftId of selectedShifts) {
        const success = await deleteShift(shiftId.toString());
        if (!success) allSuccessful = false;
      }

      if (allSuccessful) {
        setShifts(prev => prev.filter(s => !selectedShifts.has(s.id)));
        setSelectedShifts(new Set());
        setIsSelectionMode(false);
      }

      return allSuccessful;
    } catch (error) {
      console.error('Error bulk deleting shifts:', error);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [selectedShifts]);

  // Selection mode functions
  const toggleSelectionMode = useCallback(() => {
    setIsSelectionMode(prev => {
      if (prev) setSelectedShifts(new Set());
      return !prev;
    });
  }, []);

  const toggleShiftSelection = useCallback((shiftId: number) => {
    setSelectedShifts(prev => {
      const newSelected = new Set(prev);
      if (newSelected.has(shiftId)) {
        newSelected.delete(shiftId);
      } else {
        newSelected.add(shiftId);
      }
      return newSelected;
    });
  }, []);

  const selectAllShifts = useCallback(() => {
    setSelectedShifts(new Set(shifts.map(s => s.id)));
  }, [shifts]);

  const clearAllSelections = useCallback(() => {
    setSelectedShifts(new Set());
  }, []);

  return {
    shifts,
    isLoading,
    error,
    setError,
    selectedShifts,
    isSelectionMode,
    loadShifts,
    getShiftsForDay,
    createShift,
    createMultiStaffShifts,
    handleUpdateShift,
    handleDeleteShift,
    handleBulkDelete,
    toggleSelectionMode,
    toggleShiftSelection,
    selectAllShifts,
    clearAllSelections
  };
}
