import { Notice, Plugin, WorkspaceLeaf } from 'obsidian';
import {
  UniCalendarSettings,
  UniCalendarData,
  DEFAULT_SETTINGS,
  DEFAULT_CACHE,
  EventCache,
  SyncState,
} from './models/types';
import { EventStore } from './store/EventStore';
import { SyncManager } from './sync/SyncManager';
import { CalendarView, VIEW_TYPE_CALENDAR } from './views/CalendarView';
import { UniCalendarSettingsTab } from './settings/SettingsTab';

export default class UniCalendarPlugin extends Plugin {
  settings: UniCalendarSettings = DEFAULT_SETTINGS;
  eventStore: EventStore = new EventStore();
  syncManager: SyncManager = new SyncManager(() => { /* replaced in onload */ }, this.eventStore);
  private eventCache: EventCache = DEFAULT_CACHE;
  private syncIntervalId: number | null = null;
  private lastSyncStatus: SyncState['status'] = 'idle';

  async onload(): Promise<void> {
    await this.loadPluginData();

    this.eventStore = new EventStore();
    this.eventStore.load(this.eventCache);

    this.syncManager = new SyncManager((state) => this.onSyncStateChange(state), this.eventStore);

    this.registerView(VIEW_TYPE_CALENDAR, (leaf) => new CalendarView(leaf, this));

    this.addRibbonIcon('calendar', 'UniCalendar: 打开日历', () => {
      this.activateView();
    });

    this.addCommand({
      id: 'open-calendar',
      name: '打开日历',
      callback: () => this.activateView(),
    });

    this.addSettingTab(new UniCalendarSettingsTab(this.app, this));

    this.app.workspace.onLayoutReady(() => {
      this.triggerSync();
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
        this.triggerSync();
      }
      return;
    }

    const leaf: WorkspaceLeaf | null = this.app.workspace.getLeaf('tab');
    if (leaf) {
      await leaf.setViewState({ type: VIEW_TYPE_CALENDAR, active: true });
      this.app.workspace.revealLeaf(leaf);
      if (this.settings.sources.length > 0) {
        this.triggerSync();
      }
    }
  }

  async loadPluginData(): Promise<void> {
    const data = await this.loadData() as Partial<UniCalendarData> | null;
    this.settings = Object.assign({}, DEFAULT_SETTINGS, data?.settings);
    this.eventCache = Object.assign({}, DEFAULT_CACHE, data?.eventCache);
  }

  async savePluginData(): Promise<void> {
    await this.saveData({
      settings: this.settings,
      eventCache: this.eventStore.save(),
    } as UniCalendarData);
  }

  async saveSettings(): Promise<void> {
    await this.savePluginData();
    this.registerSyncInterval();
    // Update all open calendar views
    this.app.workspace.getLeavesOfType(VIEW_TYPE_CALENDAR).forEach(leaf => {
      if (leaf.view instanceof CalendarView) {
        const view = leaf.view as CalendarView;
        view.updateEmptyState(this.settings.sources.length > 0);
        view.rerender();
      }
    });
    // Re-sync after settings change
    this.triggerSync();
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (this.app as any).setting.open();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (this.app as any).setting.openTabById(this.manifest.id);
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

  private registerSyncInterval(): void {
    if (this.syncIntervalId !== null) {
      window.clearInterval(this.syncIntervalId);
    }
    this.syncIntervalId = window.setInterval(() => {
      this.triggerSync();
    }, this.settings.syncInterval * 60 * 1000);
    this.registerInterval(this.syncIntervalId);
  }
}
