import { ItemView, WorkspaceLeaf, Notice, setIcon } from 'obsidian';
import { SyncState } from '../models/types';

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
  min-width: 100px;
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
  border-right: 1px solid var(--background-modifier-border-variant, var(--background-modifier-border));
  border-bottom: 1px solid var(--background-modifier-border-variant, var(--background-modifier-border));
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
  border-bottom: 1px solid var(--background-modifier-border-variant, var(--background-modifier-border));
  min-height: 40px;
}
.uni-calendar-week-cell {
  min-height: 40px;
  background: var(--background-primary);
  border-right: 1px solid var(--background-modifier-border-variant, var(--background-modifier-border));
  border-bottom: 1px solid var(--background-modifier-border-variant, var(--background-modifier-border));
}
.uni-calendar-week-cell:nth-child(8n) {
  border-right: none;
}
.uni-calendar-week-cell.is-today {
  background: color-mix(in srgb, var(--interactive-accent) 5%, var(--background-primary));
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
  border-bottom: 1px solid var(--background-modifier-border-variant, var(--background-modifier-border));
  min-height: 48px;
}
.uni-calendar-day-hour-cell {
  min-height: 48px;
  background: var(--background-primary);
  border-bottom: 1px solid var(--background-modifier-border-variant, var(--background-modifier-border));
}

/* === Empty state === */
.uni-calendar-empty {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: color-mix(in srgb, var(--background-primary) 90%, transparent);
  z-index: 10;
  gap: var(--size-4-3);
  color: var(--text-muted);
  text-align: center;
}
.uni-calendar-empty .uni-calendar-empty-icon {
  width: 48px;
  height: 48px;
  color: var(--text-faint);
}
.uni-calendar-empty .uni-calendar-empty-icon svg {
  width: 48px;
  height: 48px;
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
  private emptyStateEl: HTMLElement | null = null;
  private monthLabelEl: HTMLElement | null = null;
  private contentContainerEl: HTMLElement | null = null;

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
    this.renderCurrentView();

    this.updateEmptyState(this.plugin.settings.sources.length > 0);
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
      this.syncStatusEl.setText('同步出错');
      this.syncStatusEl.addClass('is-error');
      this.syncStatusEl.addEventListener('click', () => {
        new Notice(state.message);
      }, { once: true });
    }
  }

  updateEmptyState(hasSources: boolean): void {
    if (!this.emptyStateEl) return;
    this.emptyStateEl.style.display = hasSources ? 'none' : '';
  }

  async onClose(): Promise<void> {
    this.syncStatusEl = null;
    this.calendarGridEl = null;
    this.emptyStateEl = null;
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

    if (this.currentViewMode === 'month') {
      this.calendarGridEl = this.contentContainerEl.createDiv({ cls: 'uni-calendar-grid' });
      this.renderMonthGrid(this.calendarGridEl);
    } else if (this.currentViewMode === 'week') {
      this.calendarGridEl = this.contentContainerEl.createDiv({ cls: 'uni-calendar-week-grid' });
      this.renderWeekGrid(this.calendarGridEl);
    } else {
      this.calendarGridEl = this.contentContainerEl.createDiv({ cls: 'uni-calendar-day-grid' });
      this.renderDayGrid(this.calendarGridEl);
    }

    // Empty state overlay
    this.emptyStateEl = this.contentContainerEl.createDiv({ cls: 'uni-calendar-empty' });
    const iconSpan = this.emptyStateEl.createSpan({ cls: 'uni-calendar-empty-icon' });
    setIcon(iconSpan, 'calendar');
    this.emptyStateEl.createEl('div', { text: '未配置日历源' });
    this.emptyStateEl.createEl('div', { text: '在设置中添加日历源以查看事件' });
    const openSettingsBtn = this.emptyStateEl.createEl('button', { text: '打开设置', cls: 'mod-cta' });
    openSettingsBtn.addEventListener('click', () => this.plugin.openSettings());

    this.updateEmptyState(this.plugin.settings.sources.length > 0);
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
    const totalCells = 42;

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
      if (isToday) {
        cell.createEl('span', { text: String(displayDay), cls: 'uni-calendar-day-number' });
      } else {
        cell.setText(String(displayDay));
      }
    }
  }

  // === Week View ===
  private renderWeekGrid(gridEl: HTMLElement): void {
    const weekStart = this.getWeekStart(new Date(this.displayYear, this.displayMonth, this.displayDay));
    const todayStr = this.getTodayStr();

    // Header row: corner + 7 day headers
    gridEl.createDiv({ cls: 'uni-calendar-week-header-corner' });
    for (let i = 0; i < 7; i++) {
      const d = new Date(weekStart);
      d.setDate(d.getDate() + i);
      const dateStr = this.dateToStr(d.getFullYear(), d.getMonth(), d.getDate());
      const dayName = DAY_FULL_NAMES[d.getDay()] ?? '';
      const label = dayName + ' ' + d.getDate() + '日';
      const header = gridEl.createDiv({ cls: 'uni-calendar-week-day-header', text: label });
      if (dateStr === todayStr) header.addClass('is-today');
    }

    // Hour rows: 8:00 - 22:00
    for (let hour = 8; hour <= 22; hour++) {
      const label = String(hour).padStart(2, '0') + ':00';
      gridEl.createDiv({ cls: 'uni-calendar-week-hour-label', text: label });

      for (let i = 0; i < 7; i++) {
        const d = new Date(weekStart);
        d.setDate(d.getDate() + i);
        const dateStr = this.dateToStr(d.getFullYear(), d.getMonth(), d.getDate());
        const cell = gridEl.createDiv({ cls: 'uni-calendar-week-cell' });
        if (dateStr === todayStr) cell.addClass('is-today');
      }
    }
  }

  // === Day View ===
  private renderDayGrid(gridEl: HTMLElement): void {
    const d = new Date(this.displayYear, this.displayMonth, this.displayDay);
    const dayName = DAY_FULL_NAMES[d.getDay()] ?? '';
    const headerText = (this.displayMonth + 1) + '月' + this.displayDay + '日 ' + dayName;
    gridEl.createDiv({ cls: 'uni-calendar-day-view-header', text: headerText });

    for (let hour = 0; hour <= 23; hour++) {
      const label = String(hour).padStart(2, '0') + ':00';
      gridEl.createDiv({ cls: 'uni-calendar-day-hour-label', text: label });
      gridEl.createDiv({ cls: 'uni-calendar-day-hour-cell' });
    }
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
