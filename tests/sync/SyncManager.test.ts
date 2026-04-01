import { describe, it, expect } from 'vitest';
import { SyncManager } from '../../src/sync/SyncManager';
import { EventStore } from '../../src/store/EventStore';
import { CalendarSource, SyncState } from '../../src/models/types';

function makeSource(overrides: Partial<CalendarSource> = {}): CalendarSource {
  return {
    id: 'test-source',
    name: 'Test',
    type: 'google', // Use non-ICS type for state tests (avoids network calls)
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
});
