import { useState, useCallback } from 'react';
import type { FilterState } from '../types';

export function useFilters() {
  const [filters, setFilters] = useState<FilterState>({
    venueId: null,
    staffId: null,
    status: null
  });

  const setVenueFilter = useCallback((venueId: string | null) => {
    setFilters(prev => ({ ...prev, venueId }));
  }, []);

  const setStaffFilter = useCallback((staffId: string | null) => {
    setFilters(prev => ({ ...prev, staffId }));
  }, []);

  const setStatusFilter = useCallback((status: string | null) => {
    setFilters(prev => ({ ...prev, status }));
  }, []);

  const clearFilters = useCallback(() => {
    setFilters({
      venueId: null,
      staffId: null,
      status: null
    });
  }, []);

  const hasActiveFilters = filters.venueId !== null ||
                           filters.staffId !== null ||
                           filters.status !== null;

  return {
    filters,
    setVenueFilter,
    setStaffFilter,
    setStatusFilter,
    clearFilters,
    hasActiveFilters
  };
}
