import { useQuery } from '@tanstack/react-query';
import schedulerService from '../../../../services/schedulerService';
import type { ScheduleHealth } from '../types/scheduler';

export function useScheduleHealth(
  params: { start: string; end: string; venue_ids?: number[] },
  enabled = true
) {
  return useQuery<ScheduleHealth>({
    queryKey: ['scheduler', 'health', params],
    queryFn: () => schedulerService.getScheduleHealth(params),
    enabled: enabled && !!params.start && !!params.end,
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });
}
