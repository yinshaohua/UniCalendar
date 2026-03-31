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
.uni-calendar-nav {
  display: flex;
  align-items: center;
  gap: var(--size-4-2);
}
.uni-calendar-nav button {
  background: none;
  border: none;
  cursor: pointer;
  color: var(--text-normal);
  padding: var(--size-4-2);
  border-radius: var(--radius-m);
}
.uni-calendar-nav button:hover {
  background: var(--background-secondary);
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
  background: color-mix(in srgb, var(--interactive-accent) 10%, var(--background-primary));
  font-weight: 700;
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
  padding: var(--size-4-2) var(--size-4-4);
  font-size: var(--font-ui-small);
  color: var(--text-muted);
  border-top: 1px solid var(--background-modifier-border);
  margin-top: auto;
}
.uni-calendar-sync-error {
  color: var(--text-error);
  cursor: pointer;
}
`;

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PluginRef = any;

export class CalendarView extends ItemView {
  private plugin: PluginRef;
  private syncStatusEl: HTMLElement | null = null;
  private calendarGridEl: HTMLElement | null = null;
  private emptyStateEl: HTMLElement | null = null;

  constructor(leaf: WorkspaceLeaf, plugin: PluginRef) {
    super(leaf);
    this.plugin = plugin;
    this.navigation = false;
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

    // Header
    const header = container.createDiv({ cls: 'uni-calendar-header' });
    header.createEl('h4', { text: 'UniCalendar' });

    const nav = header.createDiv({ cls: 'uni-calendar-nav' });
    nav.createEl('button', { text: '\u2039' }); // left arrow
    nav.createEl('span', { text: this.getCurrentMonthLabel() });
    nav.createEl('button', { text: '\u203A' }); // right arrow

    // Grid wrapper (for positioning empty state overlay)
    const gridWrapper = container.createDiv({ cls: 'uni-calendar-grid-wrapper' });

    // Calendar grid
    this.calendarGridEl = gridWrapper.createDiv({ cls: 'uni-calendar-grid' });
    this.renderMonthGrid(this.calendarGridEl);

    // Empty state overlay
    this.emptyStateEl = gridWrapper.createDiv({ cls: 'uni-calendar-empty' });
    const iconSpan = this.emptyStateEl.createSpan({ cls: 'uni-calendar-empty-icon' });
    setIcon(iconSpan, 'calendar');
    this.emptyStateEl.createEl('div', { text: 'No calendar sources configured' });
    this.emptyStateEl.createEl('div', { text: 'Add a calendar source in settings to see your events here' });
    const openSettingsBtn = this.emptyStateEl.createEl('button', {
      text: 'Open settings',
      cls: 'mod-cta',
    });
    openSettingsBtn.addEventListener('click', () => {
      this.plugin.openSettings();
    });

    // Sync status footer
    const syncFooter = container.createDiv({ cls: 'uni-calendar-sync-status' });
    this.syncStatusEl = syncFooter.createSpan({ text: 'No sources configured' });

    // Manual sync action button in view header
    this.addAction('refresh-cw', 'Sync now', async () => {
      await this.plugin.triggerSync();
    });

    // Initialize empty state based on current sources
    this.updateEmptyState(this.plugin.settings.sources.length > 0);
  }

  updateSyncStatus(state: SyncState, sourceCount: number): void {
    if (!this.syncStatusEl) return;

    // Remove previous error class
    this.syncStatusEl.removeClass('uni-calendar-sync-error');

    if (sourceCount === 0) {
      this.syncStatusEl.setText('No sources configured');
      return;
    }

    if (state.status === 'syncing') {
      this.syncStatusEl.setText('\u21BB Syncing...');
      return;
    }

    if (state.status === 'idle') {
      if (state.lastSyncTime !== null) {
        this.syncStatusEl.setText('Last synced: ' + this.formatTimeSince(state.lastSyncTime));
      } else {
        this.syncStatusEl.setText('Not yet synced');
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
    if (!this.emptyStateEl || !this.calendarGridEl) return;

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
  }

  private getCurrentMonthLabel(): string {
    const now = new Date();
    const months = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December',
    ];
    return (months[now.getMonth()] ?? 'Unknown') + ' ' + String(now.getFullYear());
  }

  private renderMonthGrid(gridEl: HTMLElement): void {
    // Day-of-week headers
    for (const dayName of DAY_NAMES) {
      gridEl.createDiv({ cls: 'uni-calendar-day-header', text: dayName });
    }

    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();

    const firstOfMonth = new Date(year, month, 1);
    const startDayOfWeek = firstOfMonth.getDay(); // 0=Sun
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrevMonth = new Date(year, month, 0).getDate();

    const todayStr = now.getFullYear() + '-' +
      String(now.getMonth() + 1).padStart(2, '0') + '-' +
      String(now.getDate()).padStart(2, '0');

    // Total cells: 6 rows x 7 = 42
    const totalCells = 42;

    for (let i = 0; i < totalCells; i++) {
      const dayNum = i - startDayOfWeek + 1;
      let displayDay: number;
      let isOutside = false;
      let dateStr: string;

      if (dayNum < 1) {
        // Previous month
        displayDay = daysInPrevMonth + dayNum;
        isOutside = true;
        const prevMonth = month === 0 ? 12 : month;
        const prevYear = month === 0 ? year - 1 : year;
        dateStr = prevYear + '-' + String(prevMonth).padStart(2, '0') + '-' + String(displayDay).padStart(2, '0');
      } else if (dayNum > daysInMonth) {
        // Next month
        displayDay = dayNum - daysInMonth;
        isOutside = true;
        const nextMonth = month === 11 ? 1 : month + 2;
        const nextYear = month === 11 ? year + 1 : year;
        dateStr = nextYear + '-' + String(nextMonth).padStart(2, '0') + '-' + String(displayDay).padStart(2, '0');
      } else {
        // Current month
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

    if (seconds < 60) return 'just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return minutes + ' min ago';
    const hours = Math.floor(minutes / 60);
    return hours + ' hours ago';
  }
}
