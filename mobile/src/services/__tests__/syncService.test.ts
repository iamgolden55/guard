/**
 * The offline attendance queue — AUDIT-2026-09-17 P0-B, MOB-1, MOB-2.
 *
 * Until these tests, `syncService` had no coverage at all, while being the only
 * thing standing between a check-in on a weak signal and an officer paid
 * nothing for a worked shift.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

// api.ts imports expo-constants (published as untransformed ESM) and the auth
// service; neither is under test here.
jest.mock('expo-constants', () => ({
  __esModule: true,
  default: { expoConfig: { extra: { apiBaseUrl: 'http://test.invalid' } } },
}));
jest.mock('../authService', () => ({ __esModule: true, default: {} }));

jest.mock('../api', () => {
  const actual = jest.requireActual('../api');
  return {
    ...actual,
    apiService: { post: jest.fn(), put: jest.fn() },
  };
});

import { ApiError, apiService } from '../api';
import { database } from '../database';
import { syncService } from '../syncService';

const post = apiService.post as jest.Mock;

const CHECK_IN = {
  type: 'check_in' as const,
  entityType: 'shifts',
  entityId: '42',
  payload: {
    shift_id: 42,
    latitude: 51.5,
    longitude: -0.12,
    check_in_time: '2026-09-19T21:03:00.000Z',
  },
  priority: 1,
};

async function queue() {
  return database.getSyncQueue();
}

function goOnline(online: boolean) {
  (syncService as any).isOnline = online;
}

beforeEach(async () => {
  await AsyncStorage.clear();
  post.mockReset();
  goOnline(false);
  (syncService as any).isSyncing = false;
});

describe('syncService', () => {
  it('keeps a check-in queued while offline', async () => {
    await syncService.addToQueue(CHECK_IN);

    const items = await queue();
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ type: 'check_in', status: 'pending', attempts: 0 });
    expect(post).not.toHaveBeenCalled();
  });

  it('replays a queued check-in as an offline replay carrying the officer’s own time', async () => {
    await syncService.addToQueue(CHECK_IN);
    post.mockResolvedValueOnce({ shift: { id: 42 } });

    goOnline(true);
    await syncService.startSync();

    expect(post).toHaveBeenCalledTimes(1);
    const [, body] = post.mock.calls[0];
    expect(body).toMatchObject({
      shift_id: 42,
      offline_replay: true,
      occurred_at: '2026-09-19T21:03:00.000Z',
    });
    expect(await queue()).toHaveLength(0);
  });

  it('drops an item the server says is already done instead of retrying it', async () => {
    await syncService.addToQueue(CHECK_IN);
    post.mockRejectedValueOnce(
      new ApiError(400, 'Bad Request', '/x', {
        detail: 'Shift already checked in',
        code: 'already_checked_in',
      }),
    );

    goOnline(true);
    await syncService.startSync();

    expect(await queue()).toHaveLength(0);
  });

  it('tells someone when it gives up, and keeps the failed item as evidence', async () => {
    await syncService.addToQueue(CHECK_IN);
    const [item] = await queue();
    await database.updateSyncQueueItem(item.id, { attempts: 4 });
    post.mockRejectedValueOnce(new ApiError(500, 'Server Error', '/x'));

    const failures: any[] = [];
    const unsubscribe = syncService.onPermanentFailure((f) => failures.push(f));
    goOnline(true);
    await syncService.startSync();
    unsubscribe();

    expect(failures).toHaveLength(1);
    expect(failures[0]).toMatchObject({ type: 'check_in', entityId: '42' });
    const [kept] = await queue();
    expect(kept).toMatchObject({ status: 'failed', attempts: 5 });
  });

  it('puts an item stranded in processing back in the queue', async () => {
    // The app was killed between sending the request and hearing back.
    await syncService.addToQueue(CHECK_IN);
    const [item] = await queue();
    await database.updateSyncQueueItem(item.id, { status: 'processing' });

    const recovered = await syncService.recoverInterruptedItems();

    expect(recovered).toBe(1);
    const [after] = await queue();
    expect(after.status).toBe('pending');
  });
});
