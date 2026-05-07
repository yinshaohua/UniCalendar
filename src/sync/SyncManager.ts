import { CalendarSource, SyncState } from '../models/types';
import { IcsSyncAdapter } from './IcsSyncAdapter';
import { CalDavSyncAdapter } from './CalDavSyncAdapter';
import { GoogleSyncAdapter } from './GoogleSyncAdapter';
import { GoogleAuthHelper, GoogleTokenError } from './GoogleAuthHelper';
import { EventStore } from '../store/EventStore';

export class SyncManager {
  private state: SyncState = { status: 'idle', lastSyncTime: null };
  private onStateChange: (state: SyncState) => void;
  private eventStore: EventStore;
  private icsAdapter: IcsSyncAdapter = new IcsSyncAdapter();
  private caldavAdapter: CalDavSyncAdapter = new CalDavSyncAdapter(this.icsAdapter);
  private authHelper: GoogleAuthHelper = new GoogleAuthHelper();
  private googleAdapter: GoogleSyncAdapter = new GoogleSyncAdapter(this.authHelper);

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

    // Clean up orphaned events from deleted sources
    const sourceIds = new Set(sources.map(s => s.id));
    this.eventStore.removeOrphanedEvents(sourceIds);

    const enabledSources = sources.filter(s => s.enabled);
    const errors: string[] = [];

    const results = await Promise.allSettled(
      enabledSources.map(async (source) => {
        if (source.type === 'ics') {
          const events = await this.icsAdapter.sync(source, rangeStart, rangeEnd);
          this.eventStore.replaceEvents(source.id, events);
          console.debug(`[UniCalendar] Synced ${events.length} events from ICS source "${source.name}"`);
        } else if (source.type === 'caldav') {
          const events = await this.caldavAdapter.sync(source, rangeStart, rangeEnd);
          this.eventStore.replaceEvents(source.id, events);
          console.debug(`[UniCalendar] Synced ${events.length} events from CalDAV source "${source.name}"`);
        } else if (source.type === 'google') {
          const events = await this.googleAdapter.sync(source, rangeStart, rangeEnd);
          this.eventStore.replaceEvents(source.id, events);
          console.debug(`[UniCalendar] Synced ${events.length} events from Google source "${source.name}"`);
        } else {
          console.warn(`[UniCalendar] Source "${source.name}" type "${String(source.type)}" is not yet supported.`);
        }
      }),
    );

    for (let i = 0; i < results.length; i++) {
      const result = results[i]!;
      if (result.status === 'rejected') {
        const source = enabledSources[i]!;
        const reason = this.formatSyncError(result.reason);
        console.error(`[UniCalendar] Sync error for "${source.name}":`, result.reason);
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

  private formatSyncError(reason: unknown): string {
    if (reason instanceof GoogleTokenError) {
      console.error('[UniCalendar] Google token flow diagnostic', reason.toLogObject());
      return reason.userMessage;
    }

    return reason instanceof Error
      ? reason.message
      : String(reason);
  }
}
