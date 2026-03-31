import { CalendarSource, SyncState } from '../models/types';

export class SyncManager {
  private state: SyncState = { status: 'idle', lastSyncTime: null };
  private onStateChange: (state: SyncState) => void;

  constructor(onStateChange: (state: SyncState) => void) {
    this.onStateChange = onStateChange;
  }

  private setState(newState: SyncState): void {
    this.state = newState;
    this.onStateChange(this.state);
  }

  getState(): SyncState {
    return this.state;
  }

  async syncAll(sources: CalendarSource[]): Promise<void> {
    if (sources.length === 0) {
      return;
    }

    const previousLastSyncTime = this.state.status === 'idle' || this.state.status === 'error'
      ? this.state.lastSyncTime
      : null;

    this.setState({ status: 'syncing', startedAt: Date.now() });

    try {
      // Phase 1: no actual fetching — simulate sync
      await Promise.all(sources.map(() => Promise.resolve()));
      this.setState({ status: 'idle', lastSyncTime: Date.now() });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.setState({ status: 'error', message, lastSyncTime: previousLastSyncTime });
    }
  }
}
