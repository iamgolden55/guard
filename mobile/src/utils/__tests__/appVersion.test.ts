jest.mock('expo-constants', () => ({
  __esModule: true,
  default: {
    expoConfig: { ios: { buildNumber: '16' }, android: { versionCode: 16 }, extra: {} },
  },
}));
jest.mock('../../services/authService', () => ({ __esModule: true, default: {} }));

import { ApiError } from '../../services/api';
import { appVersionHeaders, onUpdateRequired } from '../appVersion';

describe('app version gate (client side)', () => {
  it('sends the platform and build on every request', () => {
    const headers = appVersionHeaders();
    expect(headers['X-App-Build']).toBe('16');
    expect(headers['X-App-Platform']).toBeDefined();
  });

  it('raises "update required" when the server answers 426', () => {
    const seen = jest.fn();
    const unsubscribe = onUpdateRequired(seen);
    new ApiError(426, 'Upgrade Required', '/api/v1/shifts/', { code: 'app_update_required' });
    unsubscribe();
    expect(seen).toHaveBeenCalledTimes(1);
  });

  it('stays quiet on other errors', () => {
    const seen = jest.fn();
    const unsubscribe = onUpdateRequired(seen);
    new ApiError(400, 'Bad Request', '/api/v1/shifts/');
    unsubscribe();
    expect(seen).not.toHaveBeenCalled();
  });
});
