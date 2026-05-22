import { CalendarSource, SyncState, UniCalendarSettings, CalDavCache } from '../models/types';
import { IcsSyncAdapter } from './IcsSyncAdapter';
import { CalDavSyncAdapter } from './CalDavSyncAdapter';
import { GoogleSyncAdapter } from './GoogleSyncAdapter';
import { GoogleAuthHelper, GoogleTokenError } from './GoogleAuthHelper';
import { EventStore } from '../store/EventStore';

export class SyncManager {
  private state: SyncState = { status: 'idle', lastSyncTime: null };
  private activeSyncPromise: Promise<void> | null = null;
  private onStateChange: (state: SyncState) => void;
  private eventStore: EventStore;
  private settingsProvider?: () => Pick<UniCalendarSettings, 'syncWindowPastMonths' | 'syncWindowFutureMonths'>;
  private caldavCacheProvider?: () => CalDavCache;
  private onCaldavCacheChange?: (cache: CalDavCache) => void;
  private icsAdapter: IcsSyncAdapter = new IcsSyncAdapter();
  private caldavAdapter: CalDavSyncAdapter = new CalDavSyncAdapter(this.icsAdapter);
  private authHelper: GoogleAuthHelper = new GoogleAuthHelper();
  private googleAdapter: GoogleSyncAdapter = new GoogleSyncAdapter(this.authHelper);

  constructor(
    onStateChange: (state: SyncState) => void,
    eventStore: EventStore,
    settingsProvider?: () => Pick<UniCalendarSettings, 'syncWindowPastMonths' | 'syncWindowFutureMonths'>,
    caldavCacheProvider?: () => CalDavCache,
    onCaldavCacheChange?: (cache: CalDavCache) => void,
  ) {
    this.onStateChange = onStateChange;
    this.eventStore = eventStore;
    this.settingsProvider = settingsProvider;
    this.caldavCacheProvider = caldavCacheProvider;
    this.onCaldavCacheChange = onCaldavCacheChange;
  }

  private setState(newState: SyncState): void {
    this.state = newState;
    this.onStateChange(this.state);
  }

  getState(): SyncState {
    return this.state;
  }

  async syncAll(sources: CalendarSource[]): Promise<void> {
    if (this.activeSyncPromise) {
      console.debug('[UniCalendar] Sync already in progress; reusing active sync promise');
      return this.activeSyncPromise;
    }

    this.activeSyncPromise = this.syncAllInternal(sources);
    try {
      await this.activeSyncPromise;
    } finally {
      this.activeSyncPromise = null;
    }
  }

  private async syncAllInternal(sources: CalendarSource[]): Promise<void> {
    if (sources.length === 0) {
      return;
    }

    const previousLastSyncTime = this.state.status === 'idle' || this.state.status === 'error'
      ? this.state.lastSyncTime
      : null;

    this.setState({ status: 'syncing', startedAt: Date.now() });

    const syncStartedAt = performance.now();
    const windowConfig = this.settingsProvider?.() ?? {
      syncWindowPastMonths: 1,
      syncWindowFutureMonths: 3,
    };
    const pastMonths = this.normalizeSyncWindowMonths(windowConfig.syncWindowPastMonths, 1);
    const futureMonths = this.normalizeSyncWindowMonths(windowConfig.syncWindowFutureMonths, 3);

    const now = new Date();
    const rangeStart = new Date(now);
    rangeStart.setMonth(rangeStart.getMonth() - pastMonths);
    const rangeEnd = new Date(now);
    rangeEnd.setMonth(rangeEnd.getMonth() + futureMonths);

    console.debug(
      `[UniCalendar] Sync started: totalSources=${sources.length}, enabledSources=${sources.filter(s => s.enabled).length}, window=${rangeStart.toISOString()}..${rangeEnd.toISOString()} (past=${pastMonths}m future=${futureMonths}m)`,
    );

    const sourceIds = new Set(sources.map(s => s.id));
    this.eventStore.removeOrphanedEvents(sourceIds);

    const enabledSources = sources.filter(s => s.enabled);
    const errors: string[] = [];

    const results = await Promise.allSettled(
      enabledSources.map(async (source) => {
        const sourceStartedAt = performance.now();
        const sourceLabel = `${source.type}:${source.name}`;
        console.debug(`[UniCalendar] Source sync started: ${sourceLabel}`);

        if (source.type === 'ics') {
          const events = await this.icsAdapter.sync(source, rangeStart, rangeEnd);
          this.eventStore.replaceEvents(source.id, events);
          console.debug(`[UniCalendar] Source sync finished: ${sourceLabel}, events=${events.length}, durationMs=${Math.round(performance.now() - sourceStartedAt)}`);
        } else if (source.type === 'caldav') {
          const events = await this.caldavAdapter.sync(source, rangeStart, rangeEnd, {
            cache: this.caldavCacheProvider?.(),
            onCacheChange: this.onCaldavCacheChange,
          });
          this.eventStore.replaceEvents(source.id, events);
          console.debug(`[UniCalendar] Source sync finished: ${sourceLabel}, events=${events.length}, durationMs=${Math.round(performance.now() - sourceStartedAt)}`);
        } else if (source.type === 'google') {
          const events = await this.googleAdapter.sync(source, rangeStart, rangeEnd);
          this.eventStore.replaceEvents(source.id, events);
          console.debug(`[UniCalendar] Source sync finished: ${sourceLabel}, events=${events.length}, durationMs=${Math.round(performance.now() - sourceStartedAt)}`);
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

    console.debug(`[UniCalendar] Sync finished: durationMs=${Math.round(performance.now() - syncStartedAt)}, errors=${errors.length}`);

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

  private normalizeSyncWindowMonths(value: number | undefined, fallback: number): number {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      return fallback;
    }

    return Math.max(0, Math.min(12, Math.round(value)));
  }

  private formatSyncError(reason: unknown): string {
    if (reason instanceof GoogleTokenError) {
      console.error('[UniCalendar] Google token flow diagnostic', reason.toLogObject());
      return reason.userMessage;
    }

    return reason instanceof Error ? reason.message : String(reason);
  }
}
