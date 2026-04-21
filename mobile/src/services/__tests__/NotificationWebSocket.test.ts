import * as SecureStore from 'expo-secure-store';

import notificationWebSocket from '../NotificationWebSocket';

jest.mock('expo-secure-store');
jest.mock('react-native', () => ({
  AppState: {
    addEventListener: jest.fn(() => ({ remove: jest.fn() })),
    currentState: 'active',
  },
}));
jest.mock('../../utils/constants', () => ({
  API_CONFIG: {
    WS_URL: 'ws://localhost:8000/ws',
  },
}));
jest.mock('../../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

class MockWebSocket {
  static OPEN = 1;
  static CLOSED = 3;

  readyState = MockWebSocket.OPEN;
  onopen: (() => void) | null = null;
  onclose: ((event: { code: number; reason: string }) => void) | null = null;
  onerror: ((error: unknown) => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;

  constructor(public url: string) {
    setTimeout(() => {
      this.onopen?.();
    }, 0);
  }

  send(_data: string) {}

  close(code?: number, reason?: string) {
    this.readyState = MockWebSocket.CLOSED;
    this.onclose?.({ code: code ?? 1000, reason: reason ?? '' });
  }

  simulateMessage(data: Record<string, unknown>) {
    this.onmessage?.({ data: JSON.stringify(data) });
  }
}

(global as unknown as { WebSocket: typeof MockWebSocket }).WebSocket = MockWebSocket;

describe('NotificationWebSocketService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (SecureStore.getItemAsync as jest.Mock).mockResolvedValue('test-token');
  });

  afterEach(() => {
    notificationWebSocket.disconnect();
  });

  it('connects using the stored access token', async () => {
    const removeListener = notificationWebSocket.addNotificationListener(jest.fn());
    await notificationWebSocket.connect();
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(SecureStore.getItemAsync).toHaveBeenCalledWith('accessToken');
    expect(notificationWebSocket.connected).toBe(true);

    removeListener();
  });

  it('forwards notification messages to listeners', async () => {
    const listener = jest.fn();
    const removeListener = notificationWebSocket.addNotificationListener(listener);

    await notificationWebSocket.connect();
    await new Promise((resolve) => setTimeout(resolve, 10));

    const socket = (notificationWebSocket as unknown as { ws: MockWebSocket | null }).ws;
    socket?.simulateMessage({
      type: 'notification',
      notification_type: 'shift_assigned',
      related_type: 'shift',
      related_id: '42',
      title: 'Shift Assigned',
      message: 'Assigned',
      timestamp: new Date().toISOString(),
    });

    expect(listener).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'notification',
        notification_type: 'shift_assigned',
        related_id: '42',
      }),
    );

    removeListener();
  });

  it('disconnects when the last notification listener is removed', async () => {
    const removeListener = notificationWebSocket.addNotificationListener(jest.fn());
    await notificationWebSocket.connect();
    await new Promise((resolve) => setTimeout(resolve, 10));

    removeListener();

    expect(notificationWebSocket.connected).toBe(false);
  });
});
