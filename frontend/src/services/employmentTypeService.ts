import api from './api';

export interface EmploymentType {
  id: number;
  name: string;
  description: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  application_count: number;
}

export interface CreateEmploymentTypeRequest {
  name: string;
  description: string;
  is_active?: boolean;
}

export interface UpdateEmploymentTypeRequest {
  name?: string;
  description?: string;
  is_active?: boolean;
}

export const employmentTypeService = {
  async getEmploymentTypes(): Promise<EmploymentType[]> {
    const response = await api.get('/api/v1/employment-types/');
    return response.data;
  },

  async getActiveEmploymentTypes(): Promise<EmploymentType[]> {
    const response = await api.get('/api/v1/employment-types/active/');
    return response.data;
  },

  async getEmploymentType(id: number): Promise<EmploymentType> {
    const response = await api.get(`/api/v1/employment-types/${id}/`);
    return response.data;
  },

  async createEmploymentType(data: CreateEmploymentTypeRequest): Promise<EmploymentType> {
    const response = await api.post('/api/v1/employment-types/', data);
    return response.data;
  },

  async updateEmploymentType(id: number, data: UpdateEmploymentTypeRequest): Promise<EmploymentType> {
    const response = await api.patch(`/api/v1/employment-types/${id}/`, data);
    return response.data;
  },

  async deleteEmploymentType(id: number): Promise<void> {
    await api.delete(`/api/v1/employment-types/${id}/`);
  }
};