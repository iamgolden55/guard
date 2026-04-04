import { useMutation } from '@tanstack/react-query';
import schedulerService, { type ValidateParams } from '../../../../services/schedulerService';
import type { ValidationResult } from '../types/scheduler';

export function useShiftValidation() {
  return useMutation<ValidationResult, Error, ValidateParams>({
    mutationFn: (params) => schedulerService.validateShift(params),
  });
}
