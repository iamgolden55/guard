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

// Who is signed in: a JWT naming `user_id`, as the keychain would hold.
jest.mock('../tokenStorage', () => ({ readToken: jest.fn() }));

import { ApiError, apiService } from '../api';
import { readToken } from '../tokenStorage';
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

const jwtFor = (userId: number) =>
  `h.${Buffer.from(JSON.stringify({ user_id: userId, exp: 0 })).toString('base64')}.s`;

function signIn(userId: number | null) {
  (readToken as jest.Mock).mockResolvedValue(userId === null ? null : jwtFor(userId));
}

function goOnline(online: boolean) {
  (syncService as any).isOnline = online;
}

beforeEach(async () => {
  await AsyncStorage.clear();
  post.mockReset();
  goOnline(false);
  (syncService as any).isSyncing = false;
  signIn(1);
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

  describe('an incident report the server refuses', () => {
    const INCIDENT = {
      type: 'create_incident' as const,
      entityType: 'incidents',
      entityId: '7',
      payload: { venue: 3, shift: 42, description: 'Fight at the door', severity: 'medium', actions_taken: '' },
      priority: 1,
    };
    const REFUSED = new ApiError(400, 'Bad Request', '/api/v1/incidents/', {
      actions_taken: ['This field may not be blank.'],
    });

    it('gives up at once, says why, and stops counting it as waiting', async () => {
      await syncService.addToQueue(INCIDENT);
      post.mockRejectedValue(REFUSED);

      const failures: any[] = [];
      const unsubscribe = syncService.onPermanentFailure((f) => failures.push(f));
      const states: any[] = [];
      const unsubscribeState = syncService.subscribe((state) => states.push(state));
      goOnline(true);
      await syncService.startSync();
      await new Promise((resolve) => setTimeout(resolve, 0));
      unsubscribe();
      unsubscribeState();

      // One request, not five: the same payload gets the same answer.
      expect(post).toHaveBeenCalledTimes(1);
      expect(failures).toEqual([
        expect.objectContaining({
          type: 'create_incident',
          status: 400,
          message: 'HTTP 400: actions_taken: This field may not be blank.',
        }),
      ]);
      expect(states[states.length - 1]).toMatchObject({ queueCount: 0, failedCount: 1 });
      expect(await syncService.getFailedItems()).toEqual([
        expect.objectContaining({ type: 'create_incident', status: 'failed' }),
      ]);
    });

    it('can be sent again once the server accepts it', async () => {
      await syncService.addToQueue(INCIDENT);
      post.mockRejectedValueOnce(REFUSED);
      goOnline(true);
      await syncService.startSync();

      post.mockResolvedValueOnce({ id: 99 });
      await syncService.retryFailedItems();
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(post).toHaveBeenCalledTimes(2);
      expect(await queue()).toHaveLength(0);
    });

    it('can be discarded by the officer', async () => {
      await syncService.addToQueue(INCIDENT);
      post.mockRejectedValueOnce(REFUSED);
      goOnline(true);
      await syncService.startSync();

      await syncService.clearFailedItems();

      expect(await queue()).toHaveLength(0);
    });
  });

  it('keeps retrying a server error rather than giving up', async () => {
    jest.useFakeTimers();
    await syncService.addToQueue(CHECK_IN);
    post.mockRejectedValueOnce(new ApiError(503, 'Service Unavailable', '/x'));
    goOnline(true);
    await syncService.startSync();
    jest.useRealTimers();

    const [item] = await queue();
    expect(item).toMatchObject({ status: 'pending', attempts: 1 });
  });

  it('sends what is waiting when the app comes back to the foreground', async () => {
    const { AppState } = require('react-native');
    const listen = jest.spyOn(AppState, 'addEventListener');
    (syncService as any).initialized = false;
    syncService.init();
    const onChange = listen.mock.calls.find(([event]) => event === 'change')?.[1] as (s: string) => void;
    expect(onChange).toBeDefined();

    await syncService.addToQueue(CHECK_IN);
    post.mockResolvedValueOnce({});
    goOnline(true);
    onChange('active');
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(post).toHaveBeenCalledTimes(1);
    expect(await queue()).toHaveLength(0);
    listen.mockRestore();
  });

  describe('belongs to the account that made it', () => {
    it("sends an officer's report only while that officer is signed in", async () => {
      signIn(1);
      await syncService.addToQueue(CHECK_IN);
      expect((await queue())[0].ownerId).toBe(1);

      // A manager signs in on the officer's phone: nothing is sent as them.
      signIn(2);
      goOnline(true);
      await syncService.startSync();
      expect(post).not.toHaveBeenCalled();
      expect(await syncService.getQueueStats()).toMatchObject({ total: 0 });

      // The officer signs back in: it goes.
      signIn(1);
      post.mockResolvedValueOnce({});
      await syncService.startSync();
      expect(post).toHaveBeenCalledTimes(1);
      expect(await queue()).toHaveLength(0);
    });

    it('keeps items waiting while nobody is signed in', async () => {
      await syncService.addToQueue(CHECK_IN);
      signIn(null);
      goOnline(true);
      await syncService.startSync();

      expect(post).not.toHaveBeenCalled();
      expect(await queue()).toHaveLength(1);
    });

    it('stops part-way if the account changes mid-sync', async () => {
      await syncService.addToQueue(CHECK_IN);
      await syncService.addToQueue({ ...CHECK_IN, entityId: '43', payload: { ...CHECK_IN.payload, shift_id: 43 } });
      post.mockImplementationOnce(async () => {
        signIn(2);
        return {};
      });
      goOnline(true);
      await syncService.startSync();

      expect(post).toHaveBeenCalledTimes(1);
      expect(await queue()).toHaveLength(1);
    });

    it('lets one account discard or retry only its own failed items', async () => {
      await syncService.addToQueue(CHECK_IN);
      const [mine] = await queue();
      await database.updateSyncQueueItem(mine.id, { status: 'failed', attempts: 5 });
      signIn(2);

      expect(await syncService.getFailedItems()).toEqual([]);
      await syncService.clearFailedItems();
      expect(await queue()).toHaveLength(1);
    });

    it('gives items queued before owners existed to the account signed in now', async () => {
      await database.addToSyncQueue(CHECK_IN);
      expect((await queue())[0].ownerId).toBeUndefined();
      signIn(5);

      expect(await syncService.getQueueStats()).toMatchObject({ pending: 1 });
      expect((await queue())[0].ownerId).toBe(5);
    });
  });
});

