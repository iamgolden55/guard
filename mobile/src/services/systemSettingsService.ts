/**
 * System Settings Service
 * Fetches company-wide pay-rate defaults used by the create/edit shift forms.
 * Module-level cache keeps repeated form opens from hitting the API each time.
 */

import { apiService } from './api';
import { logger } from '../utils/logger';

export interface SystemRates {
  staticRate: number;
  standardRate: number;
}

let cached: SystemRates | null = null;

const parseRate = (raw: unknown): number | null => {
  if (raw == null) return null;
  const n = typeof raw === 'number' ? raw : parseFloat(String(raw));
  return Number.isFinite(n) ? n : null;
};

export const systemSettingsService = {
  /**
   * Fetch the company's pay-rate defaults from the backend.
   * Throws if the request fails or the response is missing the expected fields —
   * callers must handle the error state explicitly rather than receiving silent
   * fallback values.
   */
  async getSystemRates(forceRefresh = false): Promise<SystemRates> {
    if (cached && !forceRefresh) return cached;

    const response = await apiService.get<any>('/api/v1/settings/');
    const staticRate = parseRate(response?.default_hourly_rate);
    const standardRate = parseRate(response?.special_event_pay_rate);

    if (staticRate == null || standardRate == null) {
      logger.error('[SystemSettings] Missing rates in response', response);
      throw new Error('System settings response missing pay rates');
    }

    cached = { staticRate, standardRate };
    return cached;
  },

  clearCache() {
    cached = null;
  },
};
