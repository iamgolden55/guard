import { useState, useCallback } from 'react';
import type { SchedulerFilters, GroupBy } from '../types/scheduler';

const DEFAULT_FILTERS: SchedulerFilters = {
  venueIds: [],
  staffIds: [],
  roles: [],
  status: '',
  groupBy: 'staff',
};

export function useSchedulerFilters() {
  const [filters, setFilters] = useState<SchedulerFilters>(DEFAULT_FILTERS);

  const setGroupBy = useCallback((groupBy: GroupBy) => {
    setFilters((prev) => ({ ...prev, groupBy }));
  }, []);

  const setVenueIds = useCallback((venueIds: number[]) => {
    setFilters((prev) => ({ ...prev, venueIds }));
  }, []);

  const setStaffIds = useCallback((staffIds: number[]) => {
    setFilters((prev) => ({ ...prev, staffIds }));
  }, []);

  const setRoles = useCallback((roles: string[]) => {
    setFilters((prev) => ({ ...prev, roles }));
  }, []);

  const setStatus = useCallback((status: string) => {
    setFilters((prev) => ({ ...prev, status }));
  }, []);

  const reset = useCallback(() => {
    setFilters(DEFAULT_FILTERS);
  }, []);

  return {
    filters,
    setGroupBy,
    setVenueIds,
    setStaffIds,
    setRoles,
    setStatus,
    reset,
  };
}
