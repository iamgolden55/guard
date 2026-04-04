import { useQuery } from '@tanstack/react-query';
import schedulerService, { type TimelineParams } from '../../../../services/schedulerService';
import type { ResourceTimelineResponse } from '../types/scheduler';

export function useResourceTimeline(params: TimelineParams, enabled = true) {
  return useQuery<ResourceTimelineResponse>({
    queryKey: ['scheduler', 'timeline', params],
    queryFn: () => schedulerService.getResourceTimeline(params),
    enabled: enabled && !!params.start && !!params.end,
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });
}
