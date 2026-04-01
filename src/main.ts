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
import { GoogleAuthHelper } from './sync/GoogleAuthHelper';

export default class UniCalendarPlugin extends Plugin {
  settings: UniCalendarSettings = DEFAULT_SETTINGS;
  eventStore: EventStore = new EventStore();
  syncManager: SyncManager = new SyncManager(() => { /* replaced in onload */ }, this.eventStore);
  pendingOAuthVerifiers: Map<string, string> = new Map();
  private eventCache: EventCache = DEFAULT_CACHE;
  private syncIntervalId: number | null = null;

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

    // OAuth2 callback handler for Google Calendar authorization
    this.registerObsidianProtocolHandler('uni-calendar', async (data) => {
      const { code, state } = data;
      if (!code || !state) return;

      // Find the Google source that initiated this auth flow
      const source = this.settings.sources.find(
        s => s.type === 'google' && s.id === state
      );
      if (!source?.google) {
        new Notice('未找到对应的Google日历源');
        return;
      }

      try {
        const authHelper = new GoogleAuthHelper();
        const codeVerifier = this.pendingOAuthVerifiers.get(source.id);
        if (!codeVerifier) {
          new Notice('授权会话已过期，请重新授权');
          return;
        }

        const redirectUri = source.google.redirectUri || 'obsidian://uni-calendar/oauth-callback';
        const tokens = await authHelper.exchangeCode(
          code,
          source.google.clientId,
          source.google.clientSecret,
          redirectUri,
          codeVerifier,
        );

        source.google.accessToken = tokens.accessToken;
        source.google.refreshToken = tokens.refreshToken;
        source.google.tokenExpiry = tokens.tokenExpiry;

        this.pendingOAuthVerifiers.delete(source.id);
        await this.saveSettings();
        new Notice('Google 日历授权成功！');
      } catch (err) {
        new Notice('Google 授权失败: ' + (err instanceof Error ? err.message : String(err)));
      }
    });

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

  private refreshCalendarViews(): void {
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
