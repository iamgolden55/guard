import api from './api';
import type {
  DeputyConfig,
  DeputyStatus,
  DeputyEmployee,
  DeputyTimesheet,
  FieldMapping,
  SyncLog
} from '../types';

class DeputyService {
  // Configuration and status
  async getDeputyConfig(): Promise<DeputyConfig> {
    const response = await api.get<DeputyConfig>('/api/v1/deputy/config/');
    return response.data;
  }

  async updateDeputyConfig(data: {
    apiEndpoint: string,
    apiKey: string,
    isActive: boolean
  }): Promise<DeputyConfig> {
    const response = await api.put<DeputyConfig>('/api/v1/deputy/config/', data);
    return response.data;
  }

  async getDeputyStatus(): Promise<DeputyStatus> {
    const response = await api.get<DeputyStatus>('/api/v1/deputy/status/');
    return response.data;
  }

  // Sync operations
  async syncEmployees(): Promise<SyncLog> {
    const response = await api.post<SyncLog>('/api/v1/deputy/sync-employees/');
    return response.data;
  }

  async syncTimesheets(): Promise<SyncLog> {
    const response = await api.post<SyncLog>('/api/v1/deputy/sync-timesheets/');
    return response.data;
  }

  // Employee operations
  async getDeputyEmployees(): Promise<DeputyEmployee[]> {
    const response = await api.get<DeputyEmployee[]>('/api/v1/deputy/employees/');
    return response.data;
  }

  async mapEmployeeToUser(deputyEmployeeId: number, userId: number): Promise<DeputyEmployee> {
    const response = await api.post<DeputyEmployee>(`/api/v1/deputy/employees/${deputyEmployeeId}/map/`, {
      user_id: userId
    });
    return response.data;
  }

  // Timesheet operations
  async getDeputyTimesheets(filters?: {
    startDate?: string,
    endDate?: string,
    imported?: boolean
  }): Promise<DeputyTimesheet[]> {
    let url = '/api/v1/deputy/timesheets/';

    if (filters) {
      const queryParams = new URLSearchParams();

      if (filters.startDate) queryParams.append('start_date', filters.startDate);
      if (filters.endDate) queryParams.append('end_date', filters.endDate);
      if (filters.imported !== undefined) queryParams.append('imported', filters.imported.toString());

      if (queryParams.toString()) {
        url += `?${queryParams.toString()}`;
      }
    }

    const response = await api.get<DeputyTimesheet[]>(url);
    return response.data;
  }

  async importTimesheet(timesheetId: number): Promise<DeputyTimesheet> {
    const response = await api.post<DeputyTimesheet>(`/api/v1/deputy/timesheets/${timesheetId}/import/`);
    return response.data;
  }

  // Field mapping
  async getFieldMappings(): Promise<FieldMapping[]> {
    const response = await api.get<FieldMapping[]>('/api/v1/deputy/field-mappings/');
    return response.data;
  }

  async createFieldMapping(data: {
    sourceField: string,
    targetField: string
  }): Promise<FieldMapping> {
    const response = await api.post<FieldMapping>('/api/v1/deputy/field-mappings/', data);
    return response.data;
  }

  async updateFieldMapping(mappingId: number, data: {
    sourceField?: string,
    targetField?: string,
    isActive?: boolean
  }): Promise<FieldMapping> {
    const response = await api.patch<FieldMapping>(`/api/v1/deputy/field-mappings/${mappingId}/`, data);
    return response.data;
  }

  async deleteFieldMapping(mappingId: number): Promise<void> {
    await api.delete(`/api/v1/deputy/field-mappings/${mappingId}/`);
  }

  // Sync logs
  async getSyncLogs(): Promise<SyncLog[]> {
    const response = await api.get<SyncLog[]>('/api/v1/deputy/sync-logs/');
    return response.data;
  }
}

export default new DeputyService();
