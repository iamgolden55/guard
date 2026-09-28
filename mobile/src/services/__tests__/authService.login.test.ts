/**
 * App Review rejected build 16 because the reviewer "could not sign in". Every
 * login failure read "please check your credentials", so a slow network and a
 * wrong password looked the same. These pin that each cause says what it is.
 */
import axios from 'axios';
import authService from '../authService';

jest.mock('../../config/api.config', () => ({
  API_ENDPOINTS: { AUTH: { LOGIN: '/api/v1/login/', PROFILE: '/api/v1/profiles/me' } },
  getAuthHeaders: () => ({}),
}));
jest.mock('../notificationService', () => ({ __esModule: true, default: {} }));
jest.mock('expo-web-browser', () => ({ maybeCompleteAuthSession: jest.fn() }));

const post = jest.spyOn(axios, 'post');

const failWith = (error: any) => {
  post.mockRejectedValueOnce(error);
  return authService.login({ username: 'a@b.c', password: 'x' });
};

describe('authService.login error messages', () => {
  afterEach(() => post.mockReset());

  it('waits long enough for a slow first response', async () => {
    post.mockResolvedValueOnce({ data: { access: 'a', refresh: 'r' } });
    await authService.login({ username: 'a@b.c', password: 'x' });
    expect(post.mock.calls[0][2]).toEqual(expect.objectContaining({ timeout: 45000 }));
  });

  it('a wrong password says so', async () => {
    await expect(
      failWith({ response: { status: 401, data: { message: 'Invalid username/email or password' } } }),
    ).rejects.toThrow('Incorrect email or password');
  });

  it('a timeout is not reported as bad credentials', async () => {
    await expect(failWith({ code: 'ECONNABORTED', message: 'timeout of 45000ms exceeded' }))
      .rejects.toThrow('took too long');
  });

  it('no connection is not reported as bad credentials', async () => {
    await expect(failWith({ message: 'Network Error' })).rejects.toThrow("Can't reach Mead Security");
  });

  it('a lockout shows the server explanation', async () => {
    await expect(
      failWith({ response: { status: 403, data: { message: 'Account is locked', detail: 'Locked for 30 more minutes.' } } }),
    ).rejects.toThrow('Locked for 30 more minutes.');
  });

  it('a server error shows its status', async () => {
    await expect(failWith({ response: { status: 502, data: {} } })).rejects.toThrow('error 502');
  });
});
