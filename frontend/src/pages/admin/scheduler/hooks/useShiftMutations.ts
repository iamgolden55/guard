import { useMutation, useQueryClient } from '@tanstack/react-query';
import schedulerService from '../../../../services/schedulerService';
import type { CreateShiftParams } from '../../../../services/schedulerService';
import type { BulkUpdateRequest, ResourceTimelineResponse } from '../types/scheduler';

export function useShiftMutations() {
  const queryClient = useQueryClient();

  const invalidateTimeline = () => {
    queryClient.invalidateQueries({ queryKey: ['scheduler', 'timeline'] });
    queryClient.invalidateQueries({ queryKey: ['scheduler', 'health'] });
  };

  const createShift = useMutation({
    mutationFn: (params: CreateShiftParams) => schedulerService.createShift(params),
    onSuccess: invalidateTimeline,
  });

  const updateShift = useMutation({
    mutationFn: ({ id, ...params }: { id: number } & Partial<CreateShiftParams>) =>
      schedulerService.updateShift(id, params),
    onSuccess: invalidateTimeline,
  });

  const deleteShift = useMutation({
    mutationFn: (id: number) => schedulerService.deleteShift(id),
    onSuccess: invalidateTimeline,
  });

  const bulkUpdate = useMutation({
    mutationFn: (request: BulkUpdateRequest) => schedulerService.bulkUpdateShifts(request),
    onMutate: async (request) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['scheduler', 'timeline'] });

      // Snapshot previous value
      const previousData = queryClient.getQueriesData<ResourceTimelineResponse>({
        queryKey: ['scheduler', 'timeline'],
      });

      // Optimistic update: apply changes to cached events
      queryClient.setQueriesData<ResourceTimelineResponse>(
        { queryKey: ['scheduler', 'timeline'] },
        (old) => {
          if (!old) return old;
          const updatedEvents = old.events.map((event) => {
            const update = request.updates.find((u) => u.id === event.id);
            if (!update) return event;
            return {
              ...event,
              start: update.start_time || event.start,
              end: update.end_time || event.end,
              resourceId: update.staff_user != null
                ? `staff_${update.staff_user}`
                : event.resourceId,
            };
          });
          return { ...old, events: updatedEvents };
        }
      );

      return { previousData };
    },
    onError: (_err, _vars, context) => {
      // Rollback on error
      if (context?.previousData) {
        for (const [queryKey, data] of context.previousData) {
          queryClient.setQueryData(queryKey, data);
        }
      }
    },
    onSettled: invalidateTimeline,
  });

  return { createShift, updateShift, deleteShift, bulkUpdate };
}
