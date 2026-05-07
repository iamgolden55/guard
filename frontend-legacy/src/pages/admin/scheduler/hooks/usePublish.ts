import { useMutation, useQueryClient } from '@tanstack/react-query';
import schedulerService from '../../../../services/schedulerService';
import type { PublishRequest, PublishResponse } from '../types/scheduler';

export function usePublish() {
  const queryClient = useQueryClient();

  return useMutation<PublishResponse, Error, PublishRequest>({
    mutationFn: (params) => schedulerService.publishShifts(params),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scheduler', 'timeline'] });
      queryClient.invalidateQueries({ queryKey: ['scheduler', 'health'] });
    },
  });
}
