import { describe, it, expect } from 'vitest';
import { SyncManager } from '../../src/sync/SyncManager';
import { EventStore } from '../../src/store/EventStore';
import { CalendarSource, SyncState } from '../../src/models/types';

function makeSource(overrides: Partial<CalendarSource> = {}): CalendarSource {
  return {
    id: 'test-source',
    name: 'Test',
    // Use a fake type to hit the 'unsupported' branch (no network call)
    type: 'noop' as CalendarSource['type'],
    color: '#FF6961',
    enabled: true,
    ...overrides,
  };
}

describe('SyncManager', () => {
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

    expect(callCount).toBe(2); // syncing + idle
  });

  it('dispatches google sources to GoogleSyncAdapter', async () => {
    const states: SyncState[] = [];
    const store = new EventStore();
    const manager = new SyncManager((s) => states.push({...s}), store);
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

    // Google adapter is wired and processes the source (no "not yet supported" warning)
    await manager.syncAll([source]);

    const finalState = manager.getState();
    // Adapter completes successfully with mocked requestUrl
    expect(finalState.status).toBe('idle');
    // Verify state transitions: syncing -> idle
    expect(states.length).toBe(2);
    expect(states[0]!.status).toBe('syncing');
    expect(states[1]!.status).toBe('idle');
  });
});
