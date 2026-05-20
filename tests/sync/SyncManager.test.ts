import { describe, it, expect, vi, beforeEach, afterEach, type MockInstance } from 'vitest';
import { SyncManager } from '../../src/sync/SyncManager';
import { EventStore } from '../../src/store/EventStore';
import { CalendarSource, SyncState } from '../../src/models/types';
import { GoogleTokenError } from '../../src/sync/GoogleAuthHelper';

function makeSource(overrides: Partial<CalendarSource> = {}): CalendarSource {
  return {
    id: 'test-source',
    name: 'Test',
    type: 'noop' as CalendarSource['type'],
    color: '#FF6961',
    enabled: true,
    ...overrides,
  };
}

describe('SyncManager', () => {
  let consoleErrorSpy: MockInstance;

  beforeEach(() => {
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it('initial state is idle with null lastSyncTime', () => {
    const manager = new SyncManager(() => {}, new EventStore());
    const state = manager.getState();

    expect(state.status).toBe('idle');
    if (state.status === 'idle') {
      expect(state.lastSyncTime).toBeNull();
    }
  });

  it('syncAll transitions to syncing then idle', async () => {
    const states: SyncState[] = [];
    const manager = new SyncManager((s) => states.push({ ...s }), new EventStore());

    await manager.syncAll([makeSource()]);

    expect(states).toHaveLength(2);
    expect(states[0]!.status).toBe('syncing');
    expect(states[1]!.status).toBe('idle');
    if (states[1]!.status === 'idle') {
      expect(states[1]!.lastSyncTime).toBeGreaterThan(0);
    }
  });

  it('syncAll with empty sources is a no-op', async () => {
    const states: SyncState[] = [];
    const manager = new SyncManager((s) => states.push({ ...s }), new EventStore());

    await manager.syncAll([]);

    expect(states).toHaveLength(0);
    expect(manager.getState().status).toBe('idle');
  });

  it('state change callback fires on transitions', async () => {
    let callCount = 0;
    const manager = new SyncManager(() => { callCount++; }, new EventStore());

    await manager.syncAll([makeSource()]);

    expect(callCount).toBe(2);
  });

  it('dispatches google sources to GoogleSyncAdapter', async () => {
    const states: SyncState[] = [];
    const store = new EventStore();
    const manager = new SyncManager((s) => states.push({ ...s }), store);
    const source = makeSource({
      type: 'google',
      google: {
        clientId: 'test-id',
        clientSecret: 'test-secret',
        accessToken: 'valid-token',
        refreshToken: 'refresh-token',
        tokenExpiry: Date.now() + 3600000,
        calendarId: 'primary',
        calendarName: 'My Calendar',
      },
    });

    await manager.syncAll([source]);

    const finalState = manager.getState();
    expect(finalState.status).toBe('idle');
    expect(states.length).toBe(2);
    expect(states[0]!.status).toBe('syncing');
    expect(states[1]!.status).toBe('idle');
  });

  it('surfaces structured Google token errors to sync state', async () => {
    const states: SyncState[] = [];
    const manager = new SyncManager((s) => states.push({ ...s }), new EventStore());
    const source = makeSource({
      type: 'google',
      name: 'Google 主日历',
      google: {
        clientId: 'test-id',
        clientSecret: 'test-secret',
        refreshToken: 'refresh-token',
        tokenExpiry: Date.now() - 1000,
        calendarId: 'primary',
        calendarName: 'My Calendar',
      },
    });

    const tokenError = new GoogleTokenError({
      operation: 'refresh',
      kind: 'invalid_grant',
      userMessage: 'Google 刷新令牌已失效或被撤销，请重新授权。',
      logMessage: '刷新访问令牌失败：Google 返回 invalid_grant',
      status: 400,
      apiError: 'invalid_grant',
    });

    const googleAdapter = (manager as unknown as { googleAdapter: { sync: (source: CalendarSource, rangeStart: Date, rangeEnd: Date) => Promise<never> } }).googleAdapter;
    vi.spyOn(googleAdapter, 'sync').mockImplementationOnce(async (inputSource) => {
      if (inputSource.google) {
        inputSource.google.lastSyncError = {
          message: tokenError.userMessage,
          kind: tokenError.kind,
          operation: tokenError.operation,
          timestamp: Date.now(),
          status: tokenError.status,
          apiError: tokenError.apiError,
          apiErrorDescription: tokenError.apiErrorDescription,
        };
      }
      throw tokenError;
    });

    await manager.syncAll([source]);

    const finalState = manager.getState();
    expect(finalState.status).toBe('error');
    if (finalState.status === 'error') {
      expect(finalState.message).toContain('Google 主日历');
      expect(finalState.message).toContain('Google 刷新令牌已失效或被撤销，请重新授权。');
    }
    expect(source.google?.lastSyncError?.operation).toBe('refresh');
    expect(source.google?.lastSyncError?.kind).toBe('invalid_grant');
    expect(consoleErrorSpy).toHaveBeenCalled();
    expect(states.at(-1)?.status).toBe('error');
  });

  it('passes source-level CalDAV fallback timeout and cache hooks', async () => {
    const cache = { bySource: {} };
    const onCacheChange = vi.fn();
    const manager = new SyncManager(
      () => {},
      new EventStore(),
      () => ({
        syncWindowPastMonths: 1,
        syncWindowFutureMonths: 3,
        caldavFallbackFetchEnabled: false,
      }),
      () => cache,
      onCacheChange,
    );
    const source = makeSource({
      type: 'caldav',
      caldav: {
        serverUrl: 'https://caldav.feishu.cn',
        username: 'user@example.com',
        password: 'secret',
        calendarPath: '/calendar/primary/',
        fallbackFetchEnabled: true,
        fallbackTimeoutMs: 8000,
      },
    });

    const caldavAdapter = (manager as unknown as { caldavAdapter: { sync: (source: CalendarSource, rangeStart: Date, rangeEnd: Date, options?: { fallbackFetchEnabled?: boolean; fallbackTimeoutMs?: number; cache?: unknown; onCacheChange?: unknown }) => Promise<unknown[]> } }).caldavAdapter;
    const syncSpy = vi.spyOn(caldavAdapter, 'sync').mockResolvedValueOnce([]);

    await manager.syncAll([source]);

    expect(syncSpy).toHaveBeenCalledOnce();
    expect(syncSpy.mock.calls[0]?.[3]).toMatchObject({
      fallbackFetchEnabled: true,
      fallbackTimeoutMs: 8000,
      cache,
      onCacheChange,
    });
  });
});
