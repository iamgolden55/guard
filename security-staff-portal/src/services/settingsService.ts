import api from './api';

export interface SystemSettings {
  id?: number;
  company_name: string;
  support_email: string;
  support_phone: string;
  default_hourly_rate: number;
  special_event_pay_rate: number;
  default_payment_terms: string;
  invoice_prefix: string;
  automatic_invoicing: boolean;
  email_notifications: boolean;
  sms_notifications: boolean;
  shift_reminders: boolean;
  invoice_reminders: boolean;
  report_generation: boolean;
  require_signatures: boolean;
  require_manager_approval: boolean;
  require_shift_photos: boolean;
  session_timeout: number;
  allow_shift_exchange: boolean;
  created_at?: string;
  updated_at?: string;
}

export const settingsService = {
  async getSettings(): Promise<SystemSettings> {
    const response = await api.get<SystemSettings>('settings/');
    return response.data;
  },

  async updateSettings(data: Partial<SystemSettings>): Promise<SystemSettings> {
    const response = await api.put<SystemSettings>('settings/', data);
    return response.data;
  }
};

export default settingsService; 