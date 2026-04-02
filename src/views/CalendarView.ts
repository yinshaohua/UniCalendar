import { ItemView, WorkspaceLeaf, Notice, setIcon } from 'obsidian';
import { CalendarEvent, SyncState } from '../models/types';
import { EventStore } from '../store/EventStore';
import { EventDetailModal } from './EventDetailModal';

export const VIEW_TYPE_CALENDAR = 'uni-calendar-view';

const CALENDAR_CSS = `
.uni-calendar-view {
  padding: var(--size-4-3);
  font-family: var(--font-interface);
  color: var(--text-normal);
  background: var(--background-primary);
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: auto;
}

/* === Toolbar === */
.uni-calendar-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--size-4-3);
  padding-bottom: var(--size-4-3);
  box-shadow: 0 1px 0 var(--background-modifier-border);
  flex-shrink: 0;
}
.uni-calendar-toolbar-left {
  display: flex;
  align-items: center;
  gap: var(--size-4-2);
}
.uni-calendar-toolbar-right {
  display: flex;
  align-items: center;
  gap: var(--size-4-2);
}

/* Month label */
.uni-calendar-month-label {
  font-size: 1.1em;
  font-weight: 700;
  color: var(--text-normal);
  min-width: 240px;
  user-select: none;
}

/* Nav buttons — use Obsidian clickable-icon pattern */
.uni-calendar-nav-btn {
  background: transparent;
  border: none;
  cursor: pointer;
  color: var(--text-muted);
  padding: 4px 8px;
  border-radius: var(--radius-s);
  font-size: 1em;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s ease;
}
.uni-calendar-nav-btn:hover {
  color: var(--text-normal);
  background: var(--background-modifier-hover);
}
.uni-calendar-today-btn {
  background: transparent;
  border: 1px solid var(--background-modifier-border);
  cursor: pointer;
  color: var(--text-normal);
  padding: 2px 10px;
  border-radius: var(--radius-s);
  font-size: var(--font-ui-smaller);
  font-weight: 500;
  transition: all 0.15s ease;
}
.uni-calendar-today-btn:hover {
  background: var(--background-modifier-hover);
}

/* View mode tabs — Obsidian segmented control style */
.uni-calendar-view-tabs {
  display: inline-flex;
  background: var(--background-secondary);
  border-radius: var(--radius-s);
  padding: 2px;
  gap: 1px;
}
.uni-calendar-view-tab {
  padding: 3px 12px;
  border: none;
  background: transparent;
  cursor: pointer;
  color: var(--text-muted);
  font-size: var(--font-ui-smaller);
  border-radius: var(--radius-s);
  font-weight: 500;
  transition: all 0.15s ease;
}
.uni-calendar-view-tab:hover {
  color: var(--text-normal);
}
.uni-calendar-view-tab.active {
  background: var(--interactive-accent);
  color: var(--text-on-accent);
  font-weight: 600;
}

/* Sync status in toolbar */
.uni-calendar-sync-info {
  display: flex;
  align-items: center;
  gap: var(--size-4-1);
  font-size: var(--font-ui-smaller);
  color: var(--text-faint);
}
.uni-calendar-sync-info.is-error {
  color: var(--text-error);
  cursor: pointer;
}
.uni-calendar-sync-info.is-syncing {
  color: var(--text-accent);
}
.uni-calendar-sync-btn {
  background: transparent;
  border: none;
  cursor: pointer;
  color: var(--text-muted);
  padding: 4px;
  border-radius: var(--radius-s);
  display: flex;
  align-items: center;
  transition: all 0.15s ease;
}
.uni-calendar-sync-btn:hover {
  color: var(--text-normal);
  background: var(--background-modifier-hover);
}
.uni-calendar-settings-btn {
  background: transparent;
  border: none;
  cursor: pointer;
  color: var(--text-muted);
  padding: 4px;
  border-radius: var(--radius-s);
  display: flex;
  align-items: center;
  transition: all 0.15s ease;
}
.uni-calendar-settings-btn:hover {
  color: var(--text-normal);
  background: var(--background-modifier-hover);
}

/* === Content area === */
.uni-calendar-content {
  position: relative;
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

/* === Month grid === */
.uni-calendar-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  flex: 1;
  border: 1px solid var(--background-modifier-border);
  border-radius: var(--radius-m);
  overflow: hidden;
}
.uni-calendar-day-header {
  padding: 6px 4px;
  text-align: center;
  font-size: var(--font-ui-smaller);
  color: var(--text-muted);
  background: var(--background-secondary);
  font-weight: 600;
  border-bottom: 1px solid var(--background-modifier-border);
}
.uni-calendar-day {
  padding: 4px 6px;
  min-height: 70px;
  background: var(--background-primary);
  color: var(--text-normal);
  font-size: var(--font-ui-small);
  font-weight: 500;
  border-right: 1px solid color-mix(in srgb, var(--background-modifier-border) 50%, transparent);
  border-bottom: 1px solid color-mix(in srgb, var(--background-modifier-border) 50%, transparent);
}
.uni-calendar-day:nth-child(7n) {
  border-right: none;
}
.uni-calendar-day-outside {
  color: var(--text-faint);
  background: var(--background-secondary-alt, var(--background-secondary));
}
.uni-calendar-day-today {
  background: color-mix(in srgb, var(--interactive-accent) 12%, var(--background-primary));
  transition: background 0.3s ease;
}
.uni-calendar-day-today .uni-calendar-day-number {
  background: var(--interactive-accent);
  color: var(--text-on-accent);
  border-radius: 50%;
  width: 24px;
  height: 24px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
}

/* === Week grid === */
.uni-calendar-week-grid {
  display: grid;
  grid-template-columns: 50px repeat(7, 1fr);
  flex: 1;
  border: 1px solid var(--background-modifier-border);
  border-radius: var(--radius-m);
  overflow: hidden;
}
.uni-calendar-week-header-corner {
  background: var(--background-secondary);
  border-bottom: 1px solid var(--background-modifier-border);
  border-right: 1px solid var(--background-modifier-border);
}
.uni-calendar-week-day-header {
  padding: 6px 4px;
  text-align: center;
  font-size: var(--font-ui-smaller);
  color: var(--text-muted);
  background: var(--background-secondary);
  font-weight: 600;
  border-bottom: 1px solid var(--background-modifier-border);
  border-right: 1px solid var(--background-modifier-border-variant, var(--background-modifier-border));
}
.uni-calendar-week-day-header:last-child {
  border-right: none;
}
.uni-calendar-week-day-header.is-today {
  color: var(--interactive-accent);
  font-weight: 700;
}
.uni-calendar-week-hour-label {
  padding: 2px 6px;
  font-size: 11px;
  color: var(--text-faint);
  text-align: right;
  background: var(--background-secondary);
  border-right: 1px solid var(--background-modifier-border);
  border-bottom: 1px solid color-mix(in srgb, var(--background-modifier-border) 50%, transparent);
  min-height: 40px;
}
.uni-calendar-week-cell {
  min-height: 40px;
  background: var(--background-primary);
  border-right: 1px solid color-mix(in srgb, var(--background-modifier-border) 50%, transparent);
  border-bottom: 1px solid color-mix(in srgb, var(--background-modifier-border) 50%, transparent);
}
.uni-calendar-week-cell:nth-child(8n) {
  border-right: none;
}
.uni-calendar-week-cell.is-today {
  background: color-mix(in srgb, var(--interactive-accent) 5%, var(--background-primary));
  transition: background 0.3s ease;
}

/* === Day grid === */
.uni-calendar-day-grid {
  display: grid;
  grid-template-columns: 50px 1fr;
  flex: 1;
  border: 1px solid var(--background-modifier-border);
  border-radius: var(--radius-m);
  overflow: hidden;
}
.uni-calendar-day-view-header {
  grid-column: 1 / -1;
  padding: 8px 12px;
  font-size: var(--font-ui-small);
  font-weight: 600;
  color: var(--text-normal);
  background: var(--background-secondary);
  border-bottom: 1px solid var(--background-modifier-border);
}
.uni-calendar-day-hour-label {
  padding: 2px 6px;
  font-size: 11px;
  color: var(--text-faint);
  text-align: right;
  background: var(--background-secondary);
  border-right: 1px solid var(--background-modifier-border);
  border-bottom: 1px solid color-mix(in srgb, var(--background-modifier-border) 50%, transparent);
  min-height: 48px;
}
.uni-calendar-day-hour-cell {
  min-height: 48px;
  background: var(--background-primary);
  border-bottom: 1px solid color-mix(in srgb, var(--background-modifier-border) 50%, transparent);
}

/* === Event Bars (Month View) === */
.uni-calendar-day-events {
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin-top: 4px;
}
.uni-calendar-event-bar {
  display: flex;
  align-items: center;
  padding: 4px 8px;
  background: var(--background-secondary);
  border-radius: 6px;
  cursor: pointer;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: var(--font-ui-smaller);
  color: var(--text-normal);
  min-height: 20px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.08);
  transition: box-shadow 0.15s ease, background 0.15s ease;
}
.uni-calendar-event-bar:hover {
  background: var(--background-modifier-hover);
  box-shadow: 0 2px 6px rgba(0,0,0,0.12);
}
.uni-calendar-event-bar-time {
  color: var(--text-muted);
  margin-right: 4px;
  font-size: var(--font-ui-smaller);
  flex-shrink: 0;
}
.uni-calendar-event-bar-title {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.uni-calendar-overflow {
  padding: 4px 8px;
  font-size: var(--font-ui-smaller);
  color: var(--text-accent);
  cursor: pointer;
}
.uni-calendar-overflow:hover {
  text-decoration: underline;
}
.uni-calendar-day-number-link {
  cursor: pointer;
}
.uni-calendar-day-number-link:hover {
  text-decoration: underline;
}

/* === Event Blocks (Week/Day View) === */
.uni-calendar-event-block {
  position: absolute;
  left: 0;
  right: 0;
  min-height: 20px;
  border-radius: 8px;
  padding: 4px 8px;
  cursor: pointer;
  overflow: hidden;
  z-index: 2;
  box-sizing: border-box;
  box-shadow: 0 1px 3px rgba(0,0,0,0.08);
  transition: box-shadow 0.15s ease, background 0.15s ease;
}
.uni-calendar-event-block:hover {
  z-index: 3;
  box-shadow: 0 2px 6px rgba(0,0,0,0.12);
}
.uni-calendar-event-block-title {
  font-size: var(--font-ui-small);
  font-weight: 600;
  color: var(--text-normal);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.uni-calendar-event-block-time {
  font-size: var(--font-ui-smaller);
  font-weight: 400;
  color: var(--text-muted);
}

/* === Current Time Indicator === */
.uni-calendar-now-line {
  position: absolute;
  left: 0;
  right: 0;
  border-top: 2px solid var(--text-error);
  z-index: 5;
  pointer-events: none;
}
.uni-calendar-now-dot {
  position: absolute;
  left: -3px;
  top: -4px;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--text-error);
}

/* === Restructured Week Grid === */
.uni-calendar-week-grid-new {
  display: flex;
  flex-direction: column;
  flex: 1;
  border: 1px solid var(--background-modifier-border);
  border-radius: var(--radius-m);
  overflow: auto;
}
.uni-calendar-week-header-row {
  display: flex;
  flex-shrink: 0;
}
.uni-calendar-week-header-row .uni-calendar-week-header-corner {
  flex-shrink: 0;
  width: 50px;
}
.uni-calendar-week-header-row .uni-calendar-week-day-header {
  flex: 1;
}
.uni-calendar-week-body {
  display: flex;
  flex: 1;
}
.uni-calendar-hour-labels {
  flex-shrink: 0;
  width: 50px;
  background: var(--background-secondary);
  border-right: 1px solid var(--background-modifier-border);
}
.uni-calendar-hour-label-cell {
  height: 40px;
  padding: 2px 6px;
  font-size: 11px;
  color: var(--text-faint);
  text-align: right;
  border-bottom: 1px solid color-mix(in srgb, var(--background-modifier-border) 50%, transparent);
  box-sizing: border-box;
}
.uni-calendar-day-column {
  flex: 1;
  position: relative;
  border-right: 1px solid color-mix(in srgb, var(--background-modifier-border) 50%, transparent);
}
.uni-calendar-day-column:last-child {
  border-right: none;
}
.uni-calendar-day-column.is-today {
  background: color-mix(in srgb, var(--interactive-accent) 5%, var(--background-primary));
  transition: background 0.3s ease;
}
.uni-calendar-hour-slot {
  height: 40px;
  border-bottom: 1px solid color-mix(in srgb, var(--background-modifier-border) 50%, transparent);
  box-sizing: border-box;
}

/* === Restructured Day Grid === */
.uni-calendar-day-grid-new {
  display: flex;
  flex-direction: column;
  flex: 1;
  border: 1px solid var(--background-modifier-border);
  border-radius: var(--radius-m);
  overflow: auto;
}
.uni-calendar-day-body {
  display: flex;
  flex: 1;
}
.uni-calendar-day-hour-label-cell {
  height: 48px;
  padding: 2px 6px;
  font-size: 11px;
  color: var(--text-faint);
  text-align: right;
  border-bottom: 1px solid color-mix(in srgb, var(--background-modifier-border) 50%, transparent);
  box-sizing: border-box;
}
.uni-calendar-day-single-column {
  flex: 1;
  position: relative;
}
.uni-calendar-day-hour-slot {
  height: 48px;
  border-bottom: 1px solid color-mix(in srgb, var(--background-modifier-border) 50%, transparent);
  box-sizing: border-box;
}

`;

const DAY_NAMES = ['日', '一', '二', '三', '四', '五', '六'];
const DAY_FULL_NAMES = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
const MONTH_NAMES = [
  '1月', '2月', '3月', '4月', '5月', '6月',
  '7月', '8月', '9月', '10月', '11月', '12月',
];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PluginRef = any;

export class CalendarView extends ItemView {
  private plugin: PluginRef;
  private syncStatusEl: HTMLElement | null = null;
  private calendarGridEl: HTMLElement | null = null;
  private monthLabelEl: HTMLElement | null = null;
  private contentContainerEl: HTMLElement | null = null;
  private nowLineInterval: number | null = null;

  private displayYear: number;
  private displayMonth: number;
  private displayDay: number;
  private currentViewMode: 'month' | 'week' | 'day' = 'month';

  constructor(leaf: WorkspaceLeaf, plugin: PluginRef) {
    super(leaf);
    this.plugin = plugin;
    this.navigation = false;
    const now = new Date();
    this.displayYear = now.getFullYear();
    this.displayMonth = now.getMonth();
    this.displayDay = now.getDate();
  }

  getViewType(): string {
    return VIEW_TYPE_CALENDAR;
  }

  getDisplayText(): string {
    return 'UniCalendar';
  }

  getIcon(): string {
    return 'calendar';
  }

  async onOpen(): Promise<void> {
    const container = this.containerEl.children[1] as HTMLElement;
    container.empty();
    container.addClass('uni-calendar-view');
    container.createEl('style', { text: CALENDAR_CSS });

    // === Toolbar ===
    const toolbar = container.createDiv({ cls: 'uni-calendar-toolbar' });

    // Left: month label, nav arrows, today, view tabs
    const left = toolbar.createDiv({ cls: 'uni-calendar-toolbar-left' });

    this.monthLabelEl = left.createEl('span', {
      text: this.getLabel(),
      cls: 'uni-calendar-month-label',
    });

    const prevBtn = left.createEl('button', { cls: 'uni-calendar-nav-btn' });
    setIcon(prevBtn, 'chevron-left');
    prevBtn.addEventListener('click', () => this.navigatePrev());

    const nextBtn = left.createEl('button', { cls: 'uni-calendar-nav-btn' });
    setIcon(nextBtn, 'chevron-right');
    nextBtn.addEventListener('click', () => this.navigateNext());

    const todayBtn = left.createEl('button', { text: '今天', cls: 'uni-calendar-today-btn' });
    todayBtn.addEventListener('click', () => this.navigateToday());

    const viewTabs = left.createDiv({ cls: 'uni-calendar-view-tabs' });
    const modes: Array<{ key: 'month' | 'week' | 'day'; label: string }> = [
      { key: 'month', label: '月' },
      { key: 'week', label: '周' },
      { key: 'day', label: '日' },
    ];
    for (const mode of modes) {
      const tab = viewTabs.createEl('button', {
        text: mode.label,
        cls: 'uni-calendar-view-tab' + (mode.key === this.currentViewMode ? ' active' : ''),
      });
      tab.dataset['mode'] = mode.key;
      tab.addEventListener('click', () => this.switchViewMode(mode.key));
    }

    // Right: sync status, sync button, settings button
    const right = toolbar.createDiv({ cls: 'uni-calendar-toolbar-right' });

    this.syncStatusEl = right.createEl('span', { text: '未配置日历源', cls: 'uni-calendar-sync-info' });

    const syncBtn = right.createEl('button', { cls: 'uni-calendar-sync-btn' });
    setIcon(syncBtn, 'refresh-cw');
    syncBtn.setAttribute('aria-label', '立即同步');
    syncBtn.addEventListener('click', async () => {
      await this.plugin.triggerSync();
    });

    const settingsBtn = right.createEl('button', { cls: 'uni-calendar-settings-btn' });
    setIcon(settingsBtn, 'settings');
    settingsBtn.setAttribute('aria-label', '设置');
    settingsBtn.addEventListener('click', () => {
      this.plugin.openSettings();
    });

    // === Content ===
    this.contentContainerEl = container.createDiv({ cls: 'uni-calendar-content' });
    this.contentContainerEl.setAttribute('tabindex', '0');
    this.contentContainerEl.style.outline = 'none';
    this.contentContainerEl.addEventListener('keydown', (e: KeyboardEvent) => this.handleKeydown(e));
    this.renderCurrentView();
  }

  updateSyncStatus(state: SyncState, sourceCount: number): void {
    if (!this.syncStatusEl) return;

    this.syncStatusEl.removeClass('is-error');
    this.syncStatusEl.removeClass('is-syncing');

    if (sourceCount === 0) {
      this.syncStatusEl.setText('未配置日历源');
      return;
    }

    if (state.status === 'syncing') {
      this.syncStatusEl.setText('同步中...');
      this.syncStatusEl.addClass('is-syncing');
      return;
    }

    if (state.status === 'idle') {
      if (state.lastSyncTime !== null) {
        this.syncStatusEl.setText(this.formatTimeSince(state.lastSyncTime));
      } else {
        this.syncStatusEl.setText('尚未同步');
      }
      return;
    }

    if (state.status === 'error') {
      const MAX_LEN = 30;
      const msg = state.message || '未知错误';
      const short = msg.length > MAX_LEN ? msg.slice(0, MAX_LEN) + '…' : msg;
      this.syncStatusEl.setText(`同步出错: ${short}`);
      this.syncStatusEl.addClass('is-error');
      if (msg.length > MAX_LEN) {
        this.syncStatusEl.setAttribute('title', msg);
      }
    }
  }

  updateEmptyState(_hasSources: boolean): void {
    // Empty state overlay removed per user feedback.
    // Method kept as no-op for compatibility with main.ts calls.
  }

  async onClose(): Promise<void> {
    if (this.nowLineInterval !== null) {
      window.clearInterval(this.nowLineInterval);
      this.nowLineInterval = null;
    }
    this.syncStatusEl = null;
    this.calendarGridEl = null;
    this.monthLabelEl = null;
    this.contentContainerEl = null;
  }

  private navigatePrev(): void {
    if (this.currentViewMode === 'month') {
      this.displayMonth--;
      if (this.displayMonth < 0) { this.displayMonth = 11; this.displayYear--; }
    } else if (this.currentViewMode === 'week') {
      const d = new Date(this.displayYear, this.displayMonth, this.displayDay - 7);
      this.displayYear = d.getFullYear();
      this.displayMonth = d.getMonth();
      this.displayDay = d.getDate();
    } else {
      const d = new Date(this.displayYear, this.displayMonth, this.displayDay - 1);
      this.displayYear = d.getFullYear();
      this.displayMonth = d.getMonth();
      this.displayDay = d.getDate();
    }
    this.refreshView();
  }

  private navigateNext(): void {
    if (this.currentViewMode === 'month') {
      this.displayMonth++;
      if (this.displayMonth > 11) { this.displayMonth = 0; this.displayYear++; }
    } else if (this.currentViewMode === 'week') {
      const d = new Date(this.displayYear, this.displayMonth, this.displayDay + 7);
      this.displayYear = d.getFullYear();
      this.displayMonth = d.getMonth();
      this.displayDay = d.getDate();
    } else {
      const d = new Date(this.displayYear, this.displayMonth, this.displayDay + 1);
      this.displayYear = d.getFullYear();
      this.displayMonth = d.getMonth();
      this.displayDay = d.getDate();
    }
    this.refreshView();
  }

  private navigateToday(): void {
    const now = new Date();
    this.displayYear = now.getFullYear();
    this.displayMonth = now.getMonth();
    this.displayDay = now.getDate();
    this.refreshView();
  }

  private switchViewMode(mode: 'month' | 'week' | 'day'): void {
    this.currentViewMode = mode;
    const container = this.containerEl.children[1] as HTMLElement;
    container.querySelectorAll('.uni-calendar-view-tab').forEach(tab => {
      const el = tab as HTMLElement;
      if (el.dataset['mode'] === mode) { el.addClass('active'); }
      else { el.removeClass('active'); }
    });
    this.refreshView();
  }

  private refreshView(): void {
    if (this.monthLabelEl) {
      this.monthLabelEl.setText(this.getLabel());
    }
    this.renderCurrentView();
  }

  private renderCurrentView(): void {
    if (!this.contentContainerEl) return;
    this.contentContainerEl.empty();
    // Clear previous now-line interval
    if (this.nowLineInterval !== null) {
      window.clearInterval(this.nowLineInterval);
      this.nowLineInterval = null;
    }

    if (this.currentViewMode === 'month') {
      this.calendarGridEl = this.contentContainerEl.createDiv({ cls: 'uni-calendar-grid' });
      this.renderMonthGrid(this.calendarGridEl);
    } else if (this.currentViewMode === 'week') {
      this.calendarGridEl = this.contentContainerEl.createDiv({ cls: 'uni-calendar-week-grid-new' });
      this.renderWeekGrid(this.calendarGridEl);
    } else {
      this.calendarGridEl = this.contentContainerEl.createDiv({ cls: 'uni-calendar-day-grid-new' });
      this.renderDayGrid(this.calendarGridEl);
    }
    this.contentContainerEl.focus();
  }

  private handleKeydown(e: KeyboardEvent): void {
    switch (e.key) {
      case 'ArrowLeft':
        e.preventDefault();
        this.navigatePrev();
        break;
      case 'ArrowRight':
        e.preventDefault();
        this.navigateNext();
        break;
      case 't':
        e.preventDefault();
        this.navigateToday();
        break;
      case '1':
        e.preventDefault();
        this.switchViewMode('month');
        break;
      case '2':
        e.preventDefault();
        this.switchViewMode('week');
        break;
      case '3':
        e.preventDefault();
        this.switchViewMode('day');
        break;
    }
  }

  private getLabel(): string {
    if (this.currentViewMode === 'month') {
      return this.displayYear + '年' + (MONTH_NAMES[this.displayMonth] ?? '');
    } else if (this.currentViewMode === 'week') {
      const weekStart = this.getWeekStart(new Date(this.displayYear, this.displayMonth, this.displayDay));
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 6);
      const startStr = (weekStart.getMonth() + 1) + '月' + weekStart.getDate() + '日';
      const endStr = (weekEnd.getMonth() + 1) + '月' + weekEnd.getDate() + '日';
      return this.displayYear + '年 ' + startStr + ' - ' + endStr;
    } else {
      const d = new Date(this.displayYear, this.displayMonth, this.displayDay);
      const dayName = DAY_FULL_NAMES[d.getDay()] ?? '';
      return this.displayYear + '年' + (this.displayMonth + 1) + '月' + this.displayDay + '日 ' + dayName;
    }
  }

  private getWeekStart(date: Date): Date {
    const d = new Date(date);
    const day = d.getDay(); // 0=Sun
    d.setDate(d.getDate() - day);
    return d;
  }

  private getTodayStr(): string {
    const now = new Date();
    return now.getFullYear() + '-' +
      String(now.getMonth() + 1).padStart(2, '0') + '-' +
      String(now.getDate()).padStart(2, '0');
  }

  private dateToStr(y: number, m: number, d: number): string {
    return y + '-' + String(m + 1).padStart(2, '0') + '-' + String(d).padStart(2, '0');
  }

  // === Month View ===
  private renderMonthGrid(gridEl: HTMLElement): void {
    for (const dayName of DAY_NAMES) {
      gridEl.createDiv({ cls: 'uni-calendar-day-header', text: dayName });
    }

    const year = this.displayYear;
    const month = this.displayMonth;
    const firstOfMonth = new Date(year, month, 1);
    const startDayOfWeek = firstOfMonth.getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrevMonth = new Date(year, month, 0).getDate();
    const todayStr = this.getTodayStr();
    const totalCells = 35;

    for (let i = 0; i < totalCells; i++) {
      const dayNum = i - startDayOfWeek + 1;
      let displayDay: number;
      let isOutside = false;
      let dateStr: string;

      if (dayNum < 1) {
        displayDay = daysInPrevMonth + dayNum;
        isOutside = true;
        const pm = month === 0 ? 11 : month - 1;
        const py = month === 0 ? year - 1 : year;
        dateStr = this.dateToStr(py, pm, displayDay);
      } else if (dayNum > daysInMonth) {
        displayDay = dayNum - daysInMonth;
        isOutside = true;
        const nm = month === 11 ? 0 : month + 1;
        const ny = month === 11 ? year + 1 : year;
        dateStr = this.dateToStr(ny, nm, displayDay);
      } else {
        displayDay = dayNum;
        dateStr = this.dateToStr(year, month, displayDay);
      }

      let cls = 'uni-calendar-day';
      if (isOutside) cls += ' uni-calendar-day-outside';
      const isToday = dateStr === todayStr;
      if (isToday) cls += ' uni-calendar-day-today';

      const cell = gridEl.createDiv({ cls });

      // Day number — clickable to switch to day view
      const dayNumberEl = cell.createEl('span', {
        text: String(displayDay),
        cls: isToday ? 'uni-calendar-day-number uni-calendar-day-number-link' : 'uni-calendar-day-number-link',
      });
      dayNumberEl.addEventListener('click', (e) => {
        e.stopPropagation();
        const d = new Date(dateStr);
        this.displayYear = d.getFullYear();
        this.displayMonth = d.getMonth();
        this.displayDay = d.getDate();
        this.switchViewMode('day');
      });

      // Render events for this day
      const events = this.plugin.eventStore.getEventsForDate(dateStr);
      events.sort((a: CalendarEvent, b: CalendarEvent) => {
        if (a.allDay && !b.allDay) return -1;
        if (!a.allDay && b.allDay) return 1;
        return a.start.localeCompare(b.start);
      });

      if (events.length > 0) {
        const eventsEl = cell.createDiv({ cls: 'uni-calendar-day-events' });
        const overflowMode = this.plugin.settings.monthOverflowMode;
        const maxVisible = (overflowMode === 'collapse' && events.length > 3) ? 3 : events.length;

        for (let ei = 0; ei < maxVisible; ei++) {
          const event = events[ei]!;
          const bar = eventsEl.createDiv({ cls: 'uni-calendar-event-bar' });
          const sourceColor = EventStore.getSourceColor(event.sourceId, this.plugin.settings.sources);
          bar.style.borderLeft = `3px solid ${sourceColor}`;
          bar.style.background = `color-mix(in srgb, ${sourceColor} 25%, var(--background-secondary))`;
          if (!event.allDay) {
            const timeStr = new Date(event.start).toLocaleTimeString('zh-CN', {
              hour: '2-digit',
              minute: '2-digit',
              hour12: false,
            });
            bar.createSpan({ text: timeStr, cls: 'uni-calendar-event-bar-time' });
          }
          bar.createSpan({ text: event.title, cls: 'uni-calendar-event-bar-title' });
          bar.addEventListener('click', (e) => {
            e.stopPropagation();
            this.showEventDetail(event);
          });
        }

        if (overflowMode === 'collapse' && events.length > 3) {
          const overflow = eventsEl.createDiv({ cls: 'uni-calendar-overflow' });
          overflow.setText(`+${events.length - 3} 更多`);
          overflow.addEventListener('click', (e) => {
            e.stopPropagation();
            const d = new Date(dateStr);
            this.displayYear = d.getFullYear();
            this.displayMonth = d.getMonth();
            this.displayDay = d.getDate();
            this.switchViewMode('day');
          });
        }
      }
    }
  }

  // === Week View ===
  private renderWeekGrid(gridEl: HTMLElement): void {
    const HOUR_HEIGHT = 40;
    const weekStart = this.getWeekStart(new Date(this.displayYear, this.displayMonth, this.displayDay));
    const todayStr = this.getTodayStr();

    // Collect all week events to compute dynamic hour range
    const allWeekEvents: CalendarEvent[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(weekStart);
      d.setDate(d.getDate() + i);
      const dateStr = this.dateToStr(d.getFullYear(), d.getMonth(), d.getDate());
      const dayEvents = this.plugin.eventStore.getEventsForDate(dateStr).filter((e: CalendarEvent) => !e.allDay);
      allWeekEvents.push(...dayEvents);
    }
    const { start: firstHour, end: lastHour } = this.getHourRange(allWeekEvents);

    // Header row: corner + 7 day headers
    const headerRow = gridEl.createDiv({ cls: 'uni-calendar-week-header-row' });
    headerRow.createDiv({ cls: 'uni-calendar-week-header-corner' });
    for (let i = 0; i < 7; i++) {
      const d = new Date(weekStart);
      d.setDate(d.getDate() + i);
      const dateStr = this.dateToStr(d.getFullYear(), d.getMonth(), d.getDate());
      const dayName = DAY_FULL_NAMES[d.getDay()] ?? '';
      const label = dayName + ' ' + d.getDate() + '日';
      const header = headerRow.createDiv({ cls: 'uni-calendar-week-day-header', text: label });
      if (dateStr === todayStr) header.addClass('is-today');
    }

    // Body: hour labels + 7 day columns
    const body = gridEl.createDiv({ cls: 'uni-calendar-week-body' });

    // Hour labels
    const hourLabels = body.createDiv({ cls: 'uni-calendar-hour-labels' });
    for (let hour = firstHour; hour <= lastHour; hour++) {
      hourLabels.createDiv({
        cls: 'uni-calendar-hour-label-cell',
        text: String(hour).padStart(2, '0') + ':00',
      });
    }

    // Day columns with events
    let todayColumnEl: HTMLElement | null = null;
    for (let i = 0; i < 7; i++) {
      const d = new Date(weekStart);
      d.setDate(d.getDate() + i);
      const dateStr = this.dateToStr(d.getFullYear(), d.getMonth(), d.getDate());
      const isToday = dateStr === todayStr;

      const columnEl = body.createDiv({ cls: 'uni-calendar-day-column' });
      if (isToday) {
        columnEl.addClass('is-today');
        todayColumnEl = columnEl;
      }

      // Hour slot grid lines
      for (let hour = firstHour; hour <= lastHour; hour++) {
        columnEl.createDiv({ cls: 'uni-calendar-hour-slot' });
      }

      // Render event blocks
      const dayEvents = this.plugin.eventStore.getEventsForDate(dateStr).filter((e: CalendarEvent) => !e.allDay);
      const overlaps = this.detectOverlaps(dayEvents);
      for (const { event, column, totalColumns } of overlaps) {
        this.renderEventBlock(columnEl, event, column, totalColumns, firstHour, HOUR_HEIGHT);
      }
    }

    // Current time indicator
    if (todayColumnEl) {
      this.addNowLine(todayColumnEl, firstHour, HOUR_HEIGHT);
    }
  }

  // === Day View ===
  private renderDayGrid(gridEl: HTMLElement): void {
    const HOUR_HEIGHT = 48;
    const firstHour = 0;
    const lastHour = 23;
    const d = new Date(this.displayYear, this.displayMonth, this.displayDay);
    const dayName = DAY_FULL_NAMES[d.getDay()] ?? '';
    const headerText = (this.displayMonth + 1) + '月' + this.displayDay + '日 ' + dayName;
    gridEl.createDiv({ cls: 'uni-calendar-day-view-header', text: headerText });

    const body = gridEl.createDiv({ cls: 'uni-calendar-day-body' });

    // Hour labels
    const hourLabels = body.createDiv({ cls: 'uni-calendar-hour-labels' });
    for (let hour = firstHour; hour <= lastHour; hour++) {
      hourLabels.createDiv({
        cls: 'uni-calendar-day-hour-label-cell',
        text: String(hour).padStart(2, '0') + ':00',
      });
    }

    // Single day column
    const columnEl = body.createDiv({ cls: 'uni-calendar-day-single-column' });

    // Hour slot grid lines
    for (let hour = firstHour; hour <= lastHour; hour++) {
      columnEl.createDiv({ cls: 'uni-calendar-day-hour-slot' });
    }

    // Render event blocks
    const dateStr = this.dateToStr(this.displayYear, this.displayMonth, this.displayDay);
    const dayEvents = this.plugin.eventStore.getEventsForDate(dateStr).filter((e: CalendarEvent) => !e.allDay);
    const overlaps = this.detectOverlaps(dayEvents);
    for (const { event, column, totalColumns } of overlaps) {
      this.renderEventBlock(columnEl, event, column, totalColumns, firstHour, HOUR_HEIGHT);
    }

    // Current time indicator (only if viewing today)
    const todayStr = this.getTodayStr();
    if (dateStr === todayStr) {
      this.addNowLine(columnEl, firstHour, HOUR_HEIGHT);
    }
  }

  // === Shared Helpers for Week/Day Views ===

  private getHourRange(events: CalendarEvent[]): { start: number; end: number } {
    let start = 7, end = 22;
    for (const e of events) {
      const eStart = new Date(e.start).getHours();
      const eEnd = new Date(e.end).getHours() + (new Date(e.end).getMinutes() > 0 ? 1 : 0);
      if (eStart < start) start = eStart;
      if (eEnd > end) end = eEnd;
    }
    return { start, end };
  }

  private detectOverlaps(events: CalendarEvent[]): Array<{ event: CalendarEvent; column: number; totalColumns: number }> {
    if (events.length === 0) return [];
    const sorted = [...events].sort((a, b) => {
      const cmp = a.start.localeCompare(b.start);
      if (cmp !== 0) return cmp;
      const aDur = new Date(a.end).getTime() - new Date(a.start).getTime();
      const bDur = new Date(b.end).getTime() - new Date(b.start).getTime();
      return bDur - aDur;
    });

    const columns: Array<{ end: number; events: CalendarEvent[] }> = [];
    const assignments = new Map<string, { column: number }>();

    for (const event of sorted) {
      const startMs = new Date(event.start).getTime();
      const endMs = new Date(event.end).getTime();
      let placed = false;
      for (let c = 0; c < columns.length && c < 4; c++) {
        if (startMs >= columns[c]!.end) {
          columns[c]!.end = endMs;
          columns[c]!.events.push(event);
          assignments.set(event.id, { column: c });
          placed = true;
          break;
        }
      }
      if (!placed) {
        const colIdx = Math.min(columns.length, 3);
        if (colIdx === columns.length) {
          columns.push({ end: endMs, events: [event] });
        } else {
          columns[colIdx]!.end = Math.max(columns[colIdx]!.end, endMs);
          columns[colIdx]!.events.push(event);
        }
        assignments.set(event.id, { column: colIdx });
      }
    }

    const totalColumns = columns.length;
    return sorted.map(event => ({
      event,
      column: assignments.get(event.id)!.column,
      totalColumns,
    }));
  }

  private renderEventBlock(
    columnEl: HTMLElement,
    event: CalendarEvent,
    column: number,
    totalColumns: number,
    firstHour: number,
    hourHeight: number,
  ): void {
    const startDate = new Date(event.start);
    const endDate = new Date(event.end);
    const startMinutes = startDate.getHours() * 60 + startDate.getMinutes();
    const endMinutes = endDate.getHours() * 60 + endDate.getMinutes();
    const top = ((startMinutes / 60) - firstHour) * hourHeight;
    const height = Math.max(20, ((endMinutes - startMinutes) / 60) * hourHeight);
    const width = 100 / totalColumns;
    const left = column * width;

    const block = columnEl.createDiv({ cls: 'uni-calendar-event-block' });
    block.style.top = `${top}px`;
    block.style.height = `${height}px`;
    block.style.width = `${width}%`;
    block.style.left = `${left}%`;

    const sourceColor = EventStore.getSourceColor(event.sourceId, this.plugin.settings.sources);
    block.style.borderLeft = `3px solid ${sourceColor}`;
    block.style.background = `color-mix(in srgb, ${sourceColor} 30%, var(--background-primary))`;

    block.createDiv({ cls: 'uni-calendar-event-block-title', text: event.title });
    block.createDiv({ cls: 'uni-calendar-event-block-time', text: this.formatTimeRange(event.start, event.end) });

    block.addEventListener('mouseenter', () => {
      block.style.background = `color-mix(in srgb, ${sourceColor} 40%, var(--background-primary))`;
    });
    block.addEventListener('mouseleave', () => {
      block.style.background = `color-mix(in srgb, ${sourceColor} 30%, var(--background-primary))`;
    });
    block.addEventListener('click', (e) => {
      e.stopPropagation();
      this.showEventDetail(event);
    });
  }

  private formatTimeRange(start: string, end: string): string {
    const s = new Date(start);
    const e = new Date(end);
    const fmt = (d: Date) => d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false });
    return `${fmt(s)}-${fmt(e)}`;
  }

  private addNowLine(columnEl: HTMLElement, firstHour: number, hourHeight: number): void {
    const updatePosition = () => {
      const now = new Date();
      const nowMinutes = now.getHours() * 60 + now.getMinutes();
      const top = ((nowMinutes / 60) - firstHour) * hourHeight;
      nowLine.style.top = `${top}px`;
    };

    const nowLine = columnEl.createDiv({ cls: 'uni-calendar-now-line' });
    nowLine.createDiv({ cls: 'uni-calendar-now-dot' });
    updatePosition();

    this.nowLineInterval = window.setInterval(updatePosition, 60000);
  }

  rerender(): void {
    this.refreshView();
  }

  private showEventDetail(event: CalendarEvent): void {
    new EventDetailModal(this.app, event, this.plugin.settings.sources).open();
  }

  private formatTimeSince(timestamp: number): string {
    const diff = Date.now() - timestamp;
    const seconds = Math.floor(diff / 1000);
    if (seconds < 60) return '刚刚同步';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return minutes + '分钟前同步';
    const hours = Math.floor(minutes / 60);
    return hours + '小时前同步';
  }
}
