/**
 * A manager's shift save that the server refuses, end to end through the
 * service and the slice (REACT-NATIVE-Q / -N).
 *
 * One double-booking produced two Sentry errors — one from shiftsService, one
 * from the list screen re-logging the slice's shared `error` — and the alert
 * read "HTTP 400: non_field_errors: …". A refusal is now a breadcrumb, the
 * alert says what the conflict is, and only real failures reach Sentry.
 */
jest.mock('expo-constants', () => ({
  __esModule: true,
  default: { expoConfig: { extra: { apiBaseUrl: 'http://test.invalid' } } },
}));
jest.mock('../../../services/authService', () => ({ __esModule: true, default: {} }));
jest.mock('../../../services/notificationService', () => ({ __esModule: true, default: {} }));
jest.mock('../../../utils/logger', () => ({
  logger: { error: jest.fn(), warn: jest.fn(), info: jest.fn(), debug: jest.fn() },
}));
jest.mock('../../../services/api', () => {
  const actual = jest.requireActual('../../../services/api');
  return {
    ...actual,
    apiService: { get: jest.fn(), post: jest.fn(), patch: jest.fn(), put: jest.fn(), delete: jest.fn() },
  };
});

import { configureStore } from '@reduxjs/toolkit';
import { ApiError, NetworkError, apiService } from '../../../services/api';
import { logger } from '../../../utils/logger';
import reducer, {
  createMultiStaffShiftsThunk,
  createShiftThunk,
  updateShiftThunk,
} from '../manageShiftsSlice';

const OVERLAP =
  'This staff member already has a shift during this time: 2026-09-25 17:00 - 00:00 at Small Bar';

const post = apiService.post as jest.Mock;
const patch = apiService.patch as jest.Mock;
const get = apiService.get as jest.Mock;

const store = () => configureStore({ reducer: { manageShifts: reducer } });

const shift = {
  staff_user: 7,
  venue: 3,
  start_time: '2026-09-25T17:00:00Z',
  end_time: '2026-09-25T23:00:00Z',
};

beforeEach(() => {
  jest.clearAllMocks();
  get.mockResolvedValue({ results: [], count: 0, current_page: 1, total_pages: 1 });
});

describe('a refused shift save', () => {
  it('rejects with the conflict in plain words', async () => {
    post.mockRejectedValue(
      new ApiError(400, 'Bad Request', '/api/v1/shifts/', { non_field_errors: [OVERLAP] }),
    );
    const s = store();
    const action = await s.dispatch(createShiftThunk(shift) as any);
    expect(action.payload).toBe('Already on shift 17:00–00:00 at Small Bar on Fri 25 Sep.');
  });

  it('sends nothing to Sentry', async () => {
    post.mockRejectedValue(
      new ApiError(400, 'Bad Request', '/api/v1/shifts/', { non_field_errors: [OVERLAP] }),
    );
    await store().dispatch(createShiftThunk(shift) as any);
    expect(logger.error).not.toHaveBeenCalled();
  });

  it('leaves the list error alone, so the list screen does not report it again', async () => {
    post.mockRejectedValue(
      new ApiError(400, 'Bad Request', '/api/v1/shifts/', { non_field_errors: [OVERLAP] }),
    );
    const s = store();
    await s.dispatch(createShiftThunk(shift) as any);
    expect(s.getState().manageShifts.error).toBeNull();
    expect(s.getState().manageShifts.isMutating).toBe(false);
  });

  it('is handled the same way for an edit', async () => {
    patch.mockRejectedValue(
      new ApiError(400, 'Bad Request', '/api/v1/shifts/5/', { non_field_errors: [OVERLAP] }),
    );
    const s = store();
    const action = await s.dispatch(
      updateShiftThunk({ shiftId: 5, patch: { start_time: shift.start_time } }) as any,
    );
    expect(action.payload).toBe('Already on shift 17:00–00:00 at Small Bar on Fri 25 Sep.');
    expect(logger.error).not.toHaveBeenCalled();
    expect(s.getState().manageShifts.error).toBeNull();
  });

  it('shows a multi-staff refusal without the status code, and does not report it', async () => {
    post.mockRejectedValue(
      new ApiError(400, 'Bad Request', '/api/v1/shifts/create_multi_staff/', {
        non_field_errors: ['Some staff members have conflicting shifts: Sam: already has shift at Small Bar (18:00 - 01:00)'],
      }),
    );
    const action = await store().dispatch(
      createMultiStaffShiftsThunk({ ...shift, staff_users: [7, 8] }) as any,
    );
    expect(action.payload).toBe(
      'Some staff members have conflicting shifts: Sam: already has shift at Small Bar (18:00 - 01:00)',
    );
    expect(logger.error).not.toHaveBeenCalled();
  });
});

describe('a shift save that really failed', () => {
  it('still reaches Sentry for a 5xx', async () => {
    const error = new ApiError(502, 'Bad Gateway', '/api/v1/shifts/', undefined);
    post.mockRejectedValue(error);
    const action = await store().dispatch(createShiftThunk(shift) as any);
    expect(logger.error).toHaveBeenCalledWith('[ShiftsService] Error creating shift:', error);
    expect(action.payload).not.toMatch(/HTTP/);
  });

  it('still reaches Sentry when the phone has no connection', async () => {
    const error = new NetworkError('No internet connection');
    patch.mockRejectedValue(error);
    await store().dispatch(updateShiftThunk({ shiftId: 5, patch: {} }) as any);
    expect(logger.error).toHaveBeenCalledWith('[ShiftsService] Error updating shift:', error);
  });
});
