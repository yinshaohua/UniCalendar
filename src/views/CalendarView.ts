import { ItemView, WorkspaceLeaf, Notice, setIcon } from 'obsidian';
import { SyncState } from '../models/types';

export const VIEW_TYPE_CALENDAR = 'uni-calendar-view';

const CALENDAR_CSS = `
.uni-calendar-view {
  padding: var(--size-4-4);
  font-family: var(--font-interface);
  color: var(--text-normal);
  background: var(--background-primary);
  display: flex;
  flex-direction: column;
  height: 100%;
}
.uni-calendar-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--size-4-3);
}
.uni-calendar-header h4 {
  margin: 0;
}
.uni-calendar-toolbar {
  display: flex;
  align-items: center;
  gap: var(--size-4-2);
  margin-bottom: var(--size-4-2);
}
.uni-calendar-nav {
  display: flex;
  align-items: center;
  gap: var(--size-4-2);
}
.uni-calendar-nav button, .uni-calendar-toolbar button {
  background: none;
  border: 1px solid var(--background-modifier-border);
  cursor: pointer;
  color: var(--text-normal);
  padding: var(--size-4-1) var(--size-4-2);
  border-radius: var(--radius-m);
  font-size: var(--font-ui-small);
}
.uni-calendar-nav button:hover, .uni-calendar-toolbar button:hover {
  background: var(--background-secondary);
}
.uni-calendar-month-label {
  min-width: 120px;
  text-align: center;
  font-weight: 600;
}
.uni-calendar-view-tabs {
  display: flex;
  gap: 2px;
  margin-left: auto;
  background: var(--background-modifier-border);
  border-radius: var(--radius-m);
  padding: 2px;
}
.uni-calendar-view-tab {
  padding: var(--size-4-1) var(--size-4-3);
  border: none;
  background: none;
  cursor: pointer;
  color: var(--text-muted);
  font-size: var(--font-ui-small);
  border-radius: var(--radius-s);
}
.uni-calendar-view-tab.active {
  background: var(--background-primary);
  color: var(--text-normal);
  font-weight: 600;
}
.uni-calendar-grid-wrapper {
  position: relative;
  flex: 1;
  display: flex;
  flex-direction: column;
}
.uni-calendar-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 1px;
  flex: 1;
  background: var(--background-modifier-border);
  border-radius: var(--radius-m);
  overflow: hidden;
}
.uni-calendar-day-header {
  padding: var(--size-4-2);
  text-align: center;
  font-size: var(--font-ui-small);
  color: var(--text-muted);
  background: var(--background-secondary);
  font-weight: 600;
}
.uni-calendar-day {
  padding: var(--size-4-2);
  min-height: 60px;
  background: var(--background-primary);
  font-size: var(--font-ui-small);
}
.uni-calendar-day-outside {
  color: var(--text-faint);
  background: var(--background-secondary);
}
.uni-calendar-day-today {
  background: color-mix(in srgb, var(--interactive-accent) 15%, var(--background-primary));
  font-weight: 700;
  position: relative;
}
.uni-calendar-day-today::after {
  content: '';
  position: absolute;
  top: 4px;
  right: 4px;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--interactive-accent);
}
.uni-calendar-empty {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: color-mix(in srgb, var(--background-primary) 85%, transparent);
  z-index: 10;
  gap: var(--size-4-4);
  color: var(--text-muted);
  text-align: center;
}
.uni-calendar-empty .uni-calendar-empty-icon {
  width: 48px;
  height: 48px;
}
.uni-calendar-empty .uni-calendar-empty-icon svg {
  width: 48px;
  height: 48px;
}
.uni-calendar-sync-status {
  display: flex;
  align-items: center;
  gap: var(--size-4-2);
  padding: var(--size-4-2) 0;
  font-size: var(--font-ui-small);
  color: var(--text-muted);
  border-top: 1px solid var(--background-modifier-border);
  margin-top: auto;
}
.uni-calendar-sync-error {
  color: var(--text-error);
  cursor: pointer;
}
.uni-calendar-placeholder {
  display: flex;
  flex: 1;
  align-items: center;
  justify-content: center;
  color: var(--text-muted);
  font-size: var(--font-ui-medium);
}
`;

const DAY_NAMES = ['日', '一', '二', '三', '四', '五', '六'];
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

  // Navigation state
  private displayYear: number;
  private displayMonth: number; // 0-indexed
  private currentViewMode: 'month' | 'week' | 'day' = 'month';

  constructor(leaf: WorkspaceLeaf, plugin: PluginRef) {
    super(leaf);
    this.plugin = plugin;
    this.navigation = false;
    const now = new Date();
    this.displayYear = now.getFullYear();
    this.displayMonth = now.getMonth();
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

    // Inject CSS
    container.createEl('style', { text: CALENDAR_CSS });

    // Toolbar: nav + view tabs
    const toolbar = container.createDiv({ cls: 'uni-calendar-toolbar' });

    // Navigation
    const nav = toolbar.createDiv({ cls: 'uni-calendar-nav' });
    const prevBtn = nav.createEl('button', { text: '\u2039' });
    prevBtn.addEventListener('click', () => this.navigatePrev());

    this.monthLabelEl = nav.createEl('span', {
      text: this.getMonthLabel(),
      cls: 'uni-calendar-month-label',
    });

    const nextBtn = nav.createEl('button', { text: '\u203A' });
    nextBtn.addEventListener('click', () => this.navigateNext());

    const todayBtn = nav.createEl('button', { text: '今天' });
    todayBtn.addEventListener('click', () => this.navigateToday());

    // View mode tabs
    const viewTabs = toolbar.createDiv({ cls: 'uni-calendar-view-tabs' });
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

    // Content area (grid or placeholder)
    this.contentContainerEl = container.createDiv({ cls: 'uni-calendar-grid-wrapper' });
    this.renderCurrentView();

    // Sync status footer
    const syncFooter = container.createDiv({ cls: 'uni-calendar-sync-status' });
    this.syncStatusEl = syncFooter.createSpan({ text: '未配置日历源' });

    // Manual sync action button in view header
    this.addAction('refresh-cw', '立即同步', async () => {
      await this.plugin.triggerSync();
    });

    // Initialize empty state based on current sources
    this.updateEmptyState(this.plugin.settings.sources.length > 0);
  }

  updateSyncStatus(state: SyncState, sourceCount: number): void {
    if (!this.syncStatusEl) return;

    this.syncStatusEl.removeClass('uni-calendar-sync-error');

    if (sourceCount === 0) {
      this.syncStatusEl.setText('未配置日历源');
      return;
    }

    if (state.status === 'syncing') {
      this.syncStatusEl.setText('\u21BB 同步中...');
      return;
    }

    if (state.status === 'idle') {
      if (state.lastSyncTime !== null) {
        this.syncStatusEl.setText('上次同步: ' + this.formatTimeSince(state.lastSyncTime));
      } else {
        this.syncStatusEl.setText('尚未同步');
      }
      return;
    }

    if (state.status === 'error') {
      this.syncStatusEl.setText('\u26A0 ' + state.message);
      this.syncStatusEl.addClass('uni-calendar-sync-error');
      this.syncStatusEl.addEventListener('click', () => {
        new Notice(state.message);
      }, { once: true });
    }
  }

  updateEmptyState(hasSources: boolean): void {
    if (!this.emptyStateEl) return;

    if (hasSources) {
      this.emptyStateEl.style.display = 'none';
    } else {
      this.emptyStateEl.style.display = '';
    }
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
      if (this.displayMonth < 0) {
        this.displayMonth = 11;
        this.displayYear--;
      }
    } else if (this.currentViewMode === 'week') {
      // Move back 7 days — approximate by staying in month nav for now
      this.displayMonth--;
      if (this.displayMonth < 0) {
        this.displayMonth = 11;
        this.displayYear--;
      }
    } else {
      // Day: move back 1 day — approximate with month for now
      this.displayMonth--;
      if (this.displayMonth < 0) {
        this.displayMonth = 11;
        this.displayYear--;
      }
    }
    this.refreshView();
  }

  private navigateNext(): void {
    if (this.currentViewMode === 'month') {
      this.displayMonth++;
      if (this.displayMonth > 11) {
        this.displayMonth = 0;
        this.displayYear++;
      }
    } else if (this.currentViewMode === 'week') {
      this.displayMonth++;
      if (this.displayMonth > 11) {
        this.displayMonth = 0;
        this.displayYear++;
      }
    } else {
      this.displayMonth++;
      if (this.displayMonth > 11) {
        this.displayMonth = 0;
        this.displayYear++;
      }
    }
    this.refreshView();
  }

  private navigateToday(): void {
    const now = new Date();
    this.displayYear = now.getFullYear();
    this.displayMonth = now.getMonth();
    this.refreshView();
  }

  private switchViewMode(mode: 'month' | 'week' | 'day'): void {
    this.currentViewMode = mode;
    // Update tab active states
    const container = this.containerEl.children[1] as HTMLElement;
    const tabs = container.querySelectorAll('.uni-calendar-view-tab');
    tabs.forEach(tab => {
      const el = tab as HTMLElement;
      if (el.dataset['mode'] === mode) {
        el.addClass('active');
      } else {
        el.removeClass('active');
      }
    });
    this.renderCurrentView();
  }

  private refreshView(): void {
    if (this.monthLabelEl) {
      this.monthLabelEl.setText(this.getMonthLabel());
    }
    this.renderCurrentView();
  }

  private renderCurrentView(): void {
    if (!this.contentContainerEl) return;
    this.contentContainerEl.empty();

    if (this.currentViewMode === 'month') {
      this.calendarGridEl = this.contentContainerEl.createDiv({ cls: 'uni-calendar-grid' });
      this.renderMonthGrid(this.calendarGridEl);
    } else {
      // Week and day views are placeholders for Phase 2+
      const label = this.currentViewMode === 'week' ? '周视图' : '日视图';
      this.calendarGridEl = this.contentContainerEl.createDiv({ cls: 'uni-calendar-placeholder' });
      this.calendarGridEl.setText(label + ' — 即将推出');
    }

    // Empty state overlay
    this.emptyStateEl = this.contentContainerEl.createDiv({ cls: 'uni-calendar-empty' });
    const iconSpan = this.emptyStateEl.createSpan({ cls: 'uni-calendar-empty-icon' });
    setIcon(iconSpan, 'calendar');
    this.emptyStateEl.createEl('div', { text: '未配置日历源' });
    this.emptyStateEl.createEl('div', { text: '在设置中添加日历源以查看事件' });
    const openSettingsBtn = this.emptyStateEl.createEl('button', {
      text: '打开设置',
      cls: 'mod-cta',
    });
    openSettingsBtn.addEventListener('click', () => {
      this.plugin.openSettings();
    });

    this.updateEmptyState(this.plugin.settings.sources.length > 0);
  }

  private getMonthLabel(): string {
    const monthName = MONTH_NAMES[this.displayMonth] ?? '';
    return this.displayYear + '年' + monthName;
  }

  private renderMonthGrid(gridEl: HTMLElement): void {
    // Day-of-week headers
    for (const dayName of DAY_NAMES) {
      gridEl.createDiv({ cls: 'uni-calendar-day-header', text: dayName });
    }

    const year = this.displayYear;
    const month = this.displayMonth;

    const firstOfMonth = new Date(year, month, 1);
    const startDayOfWeek = firstOfMonth.getDay(); // 0=Sun
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrevMonth = new Date(year, month, 0).getDate();

    const now = new Date();
    const todayStr = now.getFullYear() + '-' +
      String(now.getMonth() + 1).padStart(2, '0') + '-' +
      String(now.getDate()).padStart(2, '0');

    const totalCells = 42;

    for (let i = 0; i < totalCells; i++) {
      const dayNum = i - startDayOfWeek + 1;
      let displayDay: number;
      let isOutside = false;
      let dateStr: string;

      if (dayNum < 1) {
        displayDay = daysInPrevMonth + dayNum;
        isOutside = true;
        const prevMonth = month === 0 ? 12 : month;
        const prevYear = month === 0 ? year - 1 : year;
        dateStr = prevYear + '-' + String(prevMonth).padStart(2, '0') + '-' + String(displayDay).padStart(2, '0');
      } else if (dayNum > daysInMonth) {
        displayDay = dayNum - daysInMonth;
        isOutside = true;
        const nextMonth = month === 11 ? 1 : month + 2;
        const nextYear = month === 11 ? year + 1 : year;
        dateStr = nextYear + '-' + String(nextMonth).padStart(2, '0') + '-' + String(displayDay).padStart(2, '0');
      } else {
        displayDay = dayNum;
        dateStr = year + '-' + String(month + 1).padStart(2, '0') + '-' + String(displayDay).padStart(2, '0');
      }

      let cls = 'uni-calendar-day';
      if (isOutside) cls += ' uni-calendar-day-outside';
      if (dateStr === todayStr) cls += ' uni-calendar-day-today';

      gridEl.createDiv({ cls, text: String(displayDay) });
    }
  }

  private formatTimeSince(timestamp: number): string {
    const diff = Date.now() - timestamp;
    const seconds = Math.floor(diff / 1000);

    if (seconds < 60) return '刚刚';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return minutes + '分钟前';
    const hours = Math.floor(minutes / 60);
    return hours + '小时前';
  }
}
