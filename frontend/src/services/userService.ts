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
  staff_profile_id: number | null;
  username: string;
  first_name: string;
  last_name: string;
  email: string;
  role: string;
  full_name: string;
  is_approved: boolean;
  employment_type: string | null;
  pay_frequency?: "weekly" | "monthly";
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

  async inviteStaff(payload: {
    username: string;
    first_name: string;
    last_name: string;
    email: string;
  }): Promise<{
    message: string;
    user: User;
    welcome_email_queued: boolean;
    password_setup_expires_at: string;
  }> {
    const response = await api.post('/api/v1/users/invite/', payload);
    return response.data;
  }

  async resendInvite(userId: number): Promise<{
    message: string;
    welcome_email_queued: boolean;
    password_setup_expires_at: string;
  }> {
    const response = await api.post(`/api/v1/users/${userId}/resend-invite/`);
    return response.data;
  }

  async unlockAccount(userId: number): Promise<{
    message: string;
    was_locked: boolean;
  }> {
    const response = await api.post(`/api/v1/users/${userId}/unlock-account/`);
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