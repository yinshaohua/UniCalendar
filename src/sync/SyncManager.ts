import { CalendarSource, SyncState } from '../models/types';
import { IcsSyncAdapter } from './IcsSyncAdapter';
import { EventStore } from '../store/EventStore';

export class SyncManager {
  private state: SyncState = { status: 'idle', lastSyncTime: null };
  private onStateChange: (state: SyncState) => void;
  private eventStore: EventStore;
  private icsAdapter: IcsSyncAdapter = new IcsSyncAdapter();

  constructor(onStateChange: (state: SyncState) => void, eventStore: EventStore) {
    this.onStateChange = onStateChange;
    this.eventStore = eventStore;
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

    // Compute sync date range: 3 months before and after now
    const now = new Date();
    const rangeStart = new Date(now);
    rangeStart.setMonth(rangeStart.getMonth() - 3);
    const rangeEnd = new Date(now);
    rangeEnd.setMonth(rangeEnd.getMonth() + 3);

    const enabledSources = sources.filter(s => s.enabled);
    const errors: string[] = [];

    const results = await Promise.allSettled(
      enabledSources.map(async (source) => {
        if (source.type === 'ics') {
          const events = await this.icsAdapter.sync(source, rangeStart, rangeEnd);
          this.eventStore.replaceEvents(source.id, events);
          console.log(`[UniCalendar] Synced ${events.length} events from ICS source "${source.name}"`);
        } else {
          console.warn(`[UniCalendar] Source "${source.name}" type "${source.type}" is not yet supported. Use ICS type instead.`);
        }
      }),
    );

    for (let i = 0; i < results.length; i++) {
      const result = results[i]!;
      if (result.status === 'rejected') {
        const source = enabledSources[i]!;
        const reason = result.reason instanceof Error
          ? result.reason.message
          : String(result.reason);
        errors.push(`${source.name}: ${reason}`);
      }
    }

    if (errors.length > 0) {
      this.setState({
        status: 'error',
        message: errors.join('; '),
        lastSyncTime: previousLastSyncTime,
      });
    } else {
      this.setState({ status: 'idle', lastSyncTime: Date.now() });
    }
  }
}
