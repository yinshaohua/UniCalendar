import { App, Notice, Plugin, WorkspaceLeaf } from 'obsidian';
import {
  UniCalendarSettings,
  UniCalendarData,
  DEFAULT_SETTINGS,
  DEFAULT_CACHE,
  DEFAULT_HOLIDAY_CACHE,
  EventCache,
  SyncState,
  HolidayCache,
  HolidayCacheEntry,
} from './models/types';
import { HolidayFetcher } from './lunar/HolidayFetcher';
import { EventStore } from './store/EventStore';
import { SyncManager } from './sync/SyncManager';
import { CalendarView, VIEW_TYPE_CALENDAR } from './views/CalendarView';
import { UniCalendarSettingsTab } from './settings/SettingsTab';

export default class UniCalendarPlugin extends Plugin {
  settings: UniCalendarSettings = DEFAULT_SETTINGS;
  eventStore: EventStore = new EventStore();
  syncManager: SyncManager = new SyncManager(() => { /* replaced in onload */ }, this.eventStore);
  private eventCache: EventCache = DEFAULT_CACHE;
  private holidayCache: HolidayCache = DEFAULT_HOLIDAY_CACHE;
  private holidayFetcher: HolidayFetcher = new HolidayFetcher();
  private isHolidayFetching = false;
  private syncIntervalId: number | null = null;
  private lastSyncStatus: SyncState['status'] = 'idle';

  async onload(): Promise<void> {
    await this.loadPluginData();

    this.eventStore = new EventStore();
    this.eventStore.load(this.eventCache);

    this.syncManager = new SyncManager((state) => this.onSyncStateChange(state), this.eventStore);

    this.registerView(VIEW_TYPE_CALENDAR, (leaf) => new CalendarView(leaf, this));

    this.addRibbonIcon('calendar', '统一日历: 打开日历', () => {
      void this.activateView();
    });

    this.addCommand({
      id: 'open-calendar',
      name: '打开日历',
      callback: () => {
        void this.activateView();
      },
    });

    this.addSettingTab(new UniCalendarSettingsTab(this.app, this));

    this.app.workspace.onLayoutReady(() => {
      this.loadHolidayDataIntoViews();
      void this.triggerSync();
      this.registerSyncInterval();
    });
  }

  onunload(): void {
    if (this.syncIntervalId !== null) {
      window.clearInterval(this.syncIntervalId);
    }
  }

  async activateView(): Promise<void> {
    const leaves = this.app.workspace.getLeavesOfType(VIEW_TYPE_CALENDAR);
    if (leaves.length > 0 && leaves[0]) {
      this.app.workspace.revealLeaf(leaves[0]);
      if (this.settings.sources.length > 0) {
        void this.triggerSync();
      }
      return;
    }

    const leaf: WorkspaceLeaf | null = this.app.workspace.getLeaf('tab');
    if (leaf) {
      await leaf.setViewState({ type: VIEW_TYPE_CALENDAR, active: true });
      this.app.workspace.revealLeaf(leaf);
      if (this.settings.sources.length > 0) {
        void this.triggerSync();
      }
    }
  }

  async loadPluginData(): Promise<void> {
    const data = await this.loadData();
    const typedData = data as Partial<UniCalendarData> | null;
    this.settings = Object.assign({}, DEFAULT_SETTINGS, typedData?.settings);
    this.eventCache = Object.assign({}, DEFAULT_CACHE, typedData?.eventCache);
    this.holidayCache = Object.assign({}, DEFAULT_HOLIDAY_CACHE, typedData?.holidayCache);
  }

  async savePluginData(): Promise<void> {
    await this.saveData({
      settings: this.settings,
      eventCache: this.eventStore.save(),
      holidayCache: this.holidayCache,
    } as UniCalendarData);
  }

  async saveSettings(): Promise<void> {
    await this.savePluginData();
    this.registerSyncInterval();
    // Update all open calendar views
    this.app.workspace.getLeavesOfType(VIEW_TYPE_CALENDAR).forEach(leaf => {
      if (leaf.view instanceof CalendarView) {
        leaf.view.updateEmptyState(this.settings.sources.length > 0);
        leaf.view.rerender();
      }
    });
    // Re-sync after settings change
    void this.triggerSync();
  }

  async triggerSync(): Promise<void> {
    try {
      this.eventStore.setSourceOrder(this.settings.sources.map(s => s.id));
      await this.syncManager.syncAll(this.settings.sources);
      await this.savePluginData();
      this.refreshCalendarViews();
    } catch (err) {
      console.error('[UniCalendar] Sync failed:', err);
      new Notice('同步失败: ' + (err instanceof Error ? err.message : String(err)));
    }
    // Per D-03: non-blocking holiday data update piggybacking on calendar sync
    this.checkAndUpdateHolidays().catch(err => {
      console.error('[UniCalendar] Holiday check error:', err);
    });
  }

  refreshCalendarViews(): void {
    this.app.workspace.getLeavesOfType(VIEW_TYPE_CALENDAR).forEach(leaf => {
      if (leaf.view instanceof CalendarView) {
        const view = leaf.view as CalendarView;
        const state = this.syncManager.getState();
        view.updateSyncStatus(state, this.settings.sources.length);
        view.rerender();
      }
    });
  }

  openSettings(): void {
    type AppWithSettings = App & {
      setting: {
        open: () => void;
        openTabById: (id: string) => void;
      };
    };

    const appWithSettings = this.app as AppWithSettings;
    appWithSettings.setting.open();
    appWithSettings.setting.openTabById(this.manifest.id);
  }

  private onSyncStateChange(state: SyncState): void {
    // Show Notice on first transition to error
    if (state.status === 'error' && this.lastSyncStatus !== 'error') {
      const msg = state.message || '未知错误';
      new Notice(`同步出错: ${msg}`, 8000);
    }
    this.lastSyncStatus = state.status;

    this.app.workspace.getLeavesOfType(VIEW_TYPE_CALENDAR).forEach(leaf => {
      if (leaf.view instanceof CalendarView) {
        (leaf.view as CalendarView).updateSyncStatus(state, this.settings.sources.length);
      }
    });
  }

  private buildHolidayMap(): Map<string, { name: string; isOffDay: boolean }> {
    const map = new Map<string, { name: string; isOffDay: boolean }>();
    for (const entries of Object.values(this.holidayCache.years)) {
      for (const entry of entries) {
        map.set(entry.date, { name: entry.name, isOffDay: entry.isOffDay });
      }
    }
    return map;
  }

  private loadHolidayDataIntoViews(): void {
    const map = this.buildHolidayMap();
    this.app.workspace.getLeavesOfType(VIEW_TYPE_CALENDAR).forEach(leaf => {
      if (leaf.view instanceof CalendarView) {
        (leaf.view as CalendarView).holidayService.loadDynamicData(map);
      }
    });
  }

  private async checkAndUpdateHolidays(): Promise<void> {
    // Per Research pitfall 5: prevent concurrent fetches
    if (this.isHolidayFetching) return;

    const now = Date.now();
    const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;

    // Per D-03: only fetch if >24h since last successful fetch
    if (this.holidayCache.lastFetchTime !== null &&
        now - this.holidayCache.lastFetchTime < TWENTY_FOUR_HOURS) {
      return;
    }

    this.isHolidayFetching = true;
    try {
      const currentYear = new Date().getFullYear();
      // Per D-05: fetch current year + next year
      const dataMap = await this.holidayFetcher.fetchYears([currentYear, currentYear + 1]);

      if (dataMap.size > 0) {
        // Convert Map back to cache structure grouped by year
        const years: Record<string, HolidayCacheEntry[]> = {};
        for (const [date, info] of dataMap) {
          const year = date.substring(0, 4);
          if (!years[year]) years[year] = [];
          years[year]!.push({ date, name: info.name, isOffDay: info.isOffDay });
        }
        this.holidayCache = { lastFetchTime: now, years };
        await this.savePluginData();
        this.loadHolidayDataIntoViews();
        this.refreshCalendarViews();
      }
    } catch (err) {
      // Per D-07: show Notice on failure, continue with cache/static data
      console.error('[UniCalendar] Holiday update failed:', err);
      new Notice('节假日数据更新失败，将使用缓存数据');
    } finally {
      this.isHolidayFetching = false;
    }
  }

  private registerSyncInterval(): void {
    if (this.syncIntervalId !== null) {
      window.clearInterval(this.syncIntervalId);
    }
    this.syncIntervalId = window.setInterval(() => {
      void this.triggerSync();
    }, this.settings.syncInterval * 60 * 1000);
    this.registerInterval(this.syncIntervalId);
  }
}
