import api from './api';

export interface User {
  id: number;
  username: string;
  first_name: string;
  last_name: string;
  email: string;
  full_name: string;
  role: string;
  is_approved: boolean;
  employment_type: string | null;
  created_at: string;
  updated_at: string;
}

export interface StaffUser {
  id: number;
  username: string;
  first_name: string;
  last_name: string;
  email: string;
  full_name: string;
  is_approved: boolean;
  employment_type: string | null;
}

class UserService {
  async getUsers(): Promise<User[]> {
    const response = await api.get<User[]>('/api/v1/users/');
    return response.data;
  }

  async getUserById(userId: number): Promise<User> {
    const response = await api.get<User>(`/api/v1/users/${userId}/`);
    return response.data;
  }

  async getStaffUsers(): Promise<StaffUser[]> {
    const response = await api.get<StaffUser[]>('/api/v1/users/staff/');
    return response.data;
  }

  async createUser(userData: Partial<User>): Promise<User> {
    const response = await api.post<User>('/api/v1/users/', userData);
    return response.data;
  }

  async updateUser(userId: number, userData: Partial<User>): Promise<User> {
    const response = await api.patch<User>(`/api/v1/users/${userId}/`, userData);
    return response.data;
  }

  async deleteUser(userId: number): Promise<void> {
    await api.delete(`/api/v1/users/${userId}/`);
  }

  async getCurrentUser(): Promise<User> {
    const response = await api.get<User>('/api/v1/users/me/');
    return response.data;
  }

  async updateCurrentUser(userData: Partial<User>): Promise<User> {
    const response = await api.patch<User>('/api/v1/users/me/', userData);
    return response.data;
  }
}

export default new UserService();