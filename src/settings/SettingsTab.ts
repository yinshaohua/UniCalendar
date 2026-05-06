import { App, Modal, Notice, Platform, Plugin, PluginSettingTab, Setting } from 'obsidian';
import { CalendarSource, GoogleSyncDiagnostic, UniCalendarSettings, getNextColor, RECOMMENDED_PALETTE, formatGoogleTokenFingerprint } from '../models/types';
import { CalDavSyncAdapter, DiscoveredCalendar } from '../sync/CalDavSyncAdapter';
import { IcsSyncAdapter } from '../sync/IcsSyncAdapter';
import { GoogleAuthHelper, GoogleTokenError } from '../sync/GoogleAuthHelper';
import { GoogleSyncAdapter, GoogleCalendarEntry } from '../sync/GoogleSyncAdapter';
import { startOAuthServer } from '../sync/OAuthServer';

/**
 * Minimal plugin interface for SettingsTab consumption.
 * Avoids circular dependency with main.ts which imports this file.
 */
interface UniCalendarPlugin extends Plugin {
  settings: UniCalendarSettings;
  saveSettings(): Promise<void>;
  refreshCalendarViews(): void;
}

export function formatGoogleSelectionSummary(source: CalendarSource): string | null {
  if (source.type !== 'google' || !source.google) {
    return null;
  }

  const selCals = source.google.selectedCalendars;
  if (selCals && selCals.length > 0) {
    const names = selCals.map(c => c.name).join(', ');
    return `已选日历 (${selCals.length}): ${names}`;
  }

  if (source.google.calendarId) {
    const calName = source.google.calendarName || source.google.calendarId;
    return `已选日历: ${calName}`;
  }

  return null;
}

export function formatGoogleErrorPhase(operation: GoogleSyncDiagnostic['operation']): string {
  switch (operation) {
    case 'exchange':
      return '授权换取令牌';
    case 'refresh':
      return '刷新访问令牌';
    case 'calendar-api':
      return '拉取 Google 日历';
    default:
      return operation;
  }
}

export function formatGoogleErrorTime(timestamp: number): string {
  return new Date(timestamp).toLocaleString('zh-CN', {
    hour12: false,
  });
}

export function formatGoogleErrorSummary(source: CalendarSource): string | null {
  if (source.type !== 'google' || !source.google?.lastSyncError) {
    return null;
  }

  const error = source.google.lastSyncError;
  const phase = formatGoogleErrorPhase(error.operation);
  const time = formatGoogleErrorTime(error.timestamp);
  return `上次失败: ${error.message}（阶段：${phase}；时间：${time}）`;
}

export function formatGoogleDiagnosticLines(source: CalendarSource): string[] {
  if (source.type !== 'google' || !source.google?.lastSyncError) {
    return [];
  }

  const error = source.google.lastSyncError;
  return [
    'UniCalendar Google 诊断',
    `- source: ${source.name}`,
    `- operation: ${error.operation}`,
    `- phase: ${formatGoogleErrorPhase(error.operation)}`,
    `- kind: ${error.kind}`,
    `- status: ${error.status ?? ''}`,
    `- apiError: ${error.apiError ?? ''}`,
    `- apiErrorDescription: ${error.apiErrorDescription ?? ''}`,
    `- tokenFingerprint: ${error.tokenFingerprint ?? source.google.refreshTokenFingerprint ?? ''}`,
    `- tokenSavedAt: ${error.tokenSavedAt ? formatGoogleErrorTime(error.tokenSavedAt) : ''}`,
    `- tokenLastRefreshedAt: ${error.tokenLastRefreshedAt ? formatGoogleErrorTime(error.tokenLastRefreshedAt) : ''}`,
    `- message: ${error.message}`,
    `- timestamp: ${formatGoogleErrorTime(error.timestamp)}`,
  ];
}

export function formatGoogleDiagnosticText(source: CalendarSource): string {
  return formatGoogleDiagnosticLines(source).join('\n');
}

const CARD_STYLES = `
.uni-calendar-source-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--size-4-3);
  margin-bottom: var(--size-4-2);
  border: 1px solid var(--background-modifier-border);
  border-radius: var(--radius-m);
  background: var(--background-secondary);
  box-shadow: 0 1px 3px rgba(0,0,0,0.08);
  transition: box-shadow 0.15s ease;
}
.uni-calendar-source-card:hover {
  box-shadow: 0 2px 6px rgba(0,0,0,0.12);
}
.uni-calendar-source-card .setting-item {
  border-top: none;
  padding: 0;
  margin: 0;
}
.uni-calendar-source-info {
  display: flex;
  align-items: center;
  gap: var(--size-4-2);
}
.uni-calendar-color-dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  display: inline-block;
  flex-shrink: 0;
}
.uni-calendar-source-name {
  font-weight: 600;
}
.uni-calendar-source-type {
  font-size: 0.7em;
  color: var(--text-muted);
  margin-left: var(--size-4-2);
  text-transform: uppercase;
  background: var(--background-modifier-border);
  padding: 2px 6px;
  border-radius: var(--radius-s);
}
.uni-calendar-source-status {
  font-size: var(--font-ui-small);
  color: var(--text-muted);
}
.uni-calendar-palette-row {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  margin-bottom: 12px;
  margin-top: 8px;
}
.uni-calendar-palette-swatch {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  cursor: pointer;
  border: 2px solid transparent;
  transition: border-color 0.15s ease, transform 0.15s ease;
  box-sizing: border-box;
}
.uni-calendar-palette-swatch:hover {
  transform: scale(1.15);
  border-color: var(--text-muted);
}
.uni-calendar-palette-swatch.is-selected {
  border-color: var(--interactive-accent);
}
`;

export class UniCalendarSettingsTab extends PluginSettingTab {
  plugin: UniCalendarPlugin;

  constructor(app: App, plugin: UniCalendarPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    // Inject card styles
    containerEl.createEl('style', { text: CARD_STYLES });

    // Section 1: General Settings
    containerEl.createEl('h2', { text: '通用设置' });

    new Setting(containerEl)
      .setName('同步间隔')
      .setDesc('自动同步日历事件的频率')
      .addDropdown(dropdown => dropdown
        .addOptions({ '5': '5 分钟', '15': '15 分钟', '30': '30 分钟', '60': '1 小时' })
        .setValue(String(this.plugin.settings.syncInterval))
        .onChange(async (value) => {
          this.plugin.settings.syncInterval = Number(value);
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName('默认视图')
      .setDesc('打开插件时显示的日历视图')
      .addDropdown(dropdown => dropdown
        .addOptions({ 'month': '月', 'week': '周', 'day': '日' })
        .setValue(this.plugin.settings.defaultView)
        .onChange(async (value) => {
          this.plugin.settings.defaultView = value as 'month' | 'week' | 'day';
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName('月视图事件显示')
      .setDesc('控制月视图中事件过多时的显示方式')
      .addDropdown(dropdown => dropdown
        .addOptions({
          'expand': '显示全部事件 (单元格自动扩展)',
          'collapse': '最多显示3个, 超出折叠',
        })
        .setValue(this.plugin.settings.monthOverflowMode)
        .onChange(async (value) => {
          this.plugin.settings.monthOverflowMode = value as 'expand' | 'collapse';
          await this.plugin.saveSettings();
        }));

    // Section 2: Calendar Sources
    containerEl.createEl('h2', { text: '日历源' });

    if (this.plugin.settings.sources.length === 0) {
      containerEl.createEl('p', {
        text: '未配置日历源，请在下方添加。',
        cls: 'setting-item-description',
      });
    }

    for (const source of this.plugin.settings.sources) {
      const card = containerEl.createDiv({ cls: 'uni-calendar-source-card' });

      // Left side: info
      const info = card.createDiv({ cls: 'uni-calendar-source-info' });
      info.createSpan({
        cls: 'uni-calendar-color-dot',
        attr: { style: `background: ${source.color}` },
      });

      const detailsDiv = info.createDiv();
      detailsDiv.createEl('span', { text: source.name, cls: 'uni-calendar-source-name' });
      detailsDiv.createEl('span', { text: source.type.toUpperCase(), cls: 'uni-calendar-source-type' });
      detailsDiv.createEl('div', {
        text: source.enabled ? '已启用' : '已禁用',
        cls: 'uni-calendar-source-status',
      });

      // Google authorization status
      if (source.type === 'google') {
        if (!source.google?.accessToken) {
          detailsDiv.createEl('div', {
            text: '未授权 - 请点击编辑进行授权',
            cls: 'uni-calendar-source-status',
            attr: { style: 'color: var(--text-error);' },
          });
        } else if (source.google.lastSyncError?.kind === 'invalid_grant') {
          detailsDiv.createEl('div', {
            text: '授权失效 - 请重新授权',
            cls: 'uni-calendar-source-status',
            attr: { style: 'color: var(--text-error); font-weight: 600;' },
          });
        } else {
          detailsDiv.createEl('div', {
            text: '已授权',
            cls: 'uni-calendar-source-status',
          });
        }

        const selectionSummary = formatGoogleSelectionSummary(source);
        if (selectionSummary) {
          detailsDiv.createEl('div', {
            text: selectionSummary,
            cls: 'uni-calendar-source-status',
          });
        } else {
          detailsDiv.createEl('div', {
            text: '未选择日历 - 无法同步',
            cls: 'uni-calendar-source-status',
            attr: { style: 'color: var(--color-orange); font-weight: 600;' },
          });
        }

        const errorSummary = formatGoogleErrorSummary(source);
        if (errorSummary) {
          detailsDiv.createEl('div', {
            text: errorSummary,
            cls: 'uni-calendar-source-status',
            attr: { style: 'color: var(--text-error);' },
          });
        }
      }

      // CalDAV calendar status
      if (source.type === 'caldav') {
        const selCals = source.caldav?.selectedCalendars;
        if (selCals && selCals.length > 0) {
          const names = selCals.map(c => c.displayName).join(', ');
          detailsDiv.createEl('div', {
            text: `已选日历 (${selCals.length}): ${names}`,
            cls: 'uni-calendar-source-status',
          });
        } else if (!source.caldav?.calendarPath) {
          detailsDiv.createEl('div', {
            text: '未选择日历 - 无法同步',
            cls: 'uni-calendar-source-status',
            attr: { style: 'color: var(--color-orange); font-weight: 600;' },
          });
        }
      }

      // Right side: edit/delete buttons
      new Setting(card)
        .addExtraButton(btn => btn
          .setIcon('pencil')
          .setTooltip('编辑')
          .onClick(() => {
            new EditSourceModal(this.app, this.plugin, source, () => this.display()).open();
          }))
        .addExtraButton(btn => btn
          .setIcon('trash')
          .setTooltip('删除')
          .onClick(async () => {
            this.plugin.settings.sources = this.plugin.settings.sources.filter(s => s.id !== source.id);
            await this.plugin.saveSettings();
            this.display();
          }));
    }

    // Add source button
    new Setting(containerEl)
      .addButton(btn => btn
        .setButtonText('添加日历源')
        .setCta()
        .onClick(() => {
          new AddSourceModal(this.app, this.plugin, () => this.display()).open();
        }));

    // Section 3: Lunar Calendar & Holidays
    containerEl.createEl('h2', { text: '农历与节假日' });

    new Setting(containerEl)
      .setName('显示农历')
      .setDesc('在月视图中显示农历日期、节气和传统节日')
      .addToggle(toggle => toggle
        .setValue(this.plugin.settings.showLunarCalendar)
        .onChange(async (value) => {
          this.plugin.settings.showLunarCalendar = value;
          await this.plugin.saveSettings();
          this.plugin.refreshCalendarViews();
        }));

    new Setting(containerEl)
      .setName('显示法定节假日')
      .setDesc('标记中国大陆法定节假日（休）和调休工作日（班）')
      .addToggle(toggle => toggle
        .setValue(this.plugin.settings.showHolidays)
        .onChange(async (value) => {
          this.plugin.settings.showHolidays = value;
          await this.plugin.saveSettings();
          this.plugin.refreshCalendarViews();
        }));
  }
}

class AddSourceModal extends Modal {
  private plugin: UniCalendarPlugin;
  private onDone: () => void;
  private selectedType: 'google' | 'caldav' | 'ics' | null = null;

  constructor(app: App, plugin: UniCalendarPlugin, onDone: () => void) {
    super(app);
    this.plugin = plugin;
    this.onDone = onDone;
  }

  onOpen(): void {
    this.titleEl.setText('添加日历源');
    this.showTypeSelection();
  }

  onClose(): void {
    const { contentEl } = this;
    contentEl.empty();
  }

  private showTypeSelection(): void {
    const { contentEl } = this;
    contentEl.empty();

    contentEl.createEl('p', { text: '选择要添加的日历源类型：' });

    const buttonContainer = contentEl.createDiv({ attr: { style: 'display: flex; gap: var(--size-4-3); flex-wrap: wrap;' } });

    const types: Array<{ type: 'google' | 'caldav' | 'ics'; label: string; desc: string }> = [
      { type: 'google', label: 'Google 日历', desc: '通过 API 同步 Google 日历' },
      { type: 'caldav', label: 'CalDAV 日历', desc: 'CalDAV 服务器（Nextcloud、iCloud 等）' },
      { type: 'ics', label: 'ICS 订阅', desc: '订阅 ICS/iCal 日历链接' },
    ];

    for (const t of types) {
      const btn = buttonContainer.createEl('button', {
        text: t.label,
        cls: 'mod-cta',
        attr: { style: 'flex: 1; min-width: 120px;' },
      });
      btn.addEventListener('click', () => {
        this.selectedType = t.type;
        this.showSourceForm();
      });
    }
  }

  private showSourceForm(): void {
    if (!this.selectedType) return;

    const { contentEl } = this;
    contentEl.empty();
    contentEl.createEl('style', { text: CARD_STYLES });

    const type = this.selectedType;
    const typeLabels = { google: 'Google 日历', caldav: 'CalDAV', ics: 'ICS 订阅' };
    this.titleEl.setText(`添加${typeLabels[type]}源`);

    // Form state
    let name = '';
    let color = getNextColor(this.plugin.settings.sources);
    let enabled = true;

    // Type-specific state
    let clientId = '';
    let clientSecret = '';
    let serverUrl = '';
    let username = '';
    let password = '';
    let calendarPath = '';
    let calendarDisplayName = '';
    let selectedCaldavCals: Array<{ path: string; displayName: string }> = [];
    let feedUrl = '';

    // Common fields
    new Setting(contentEl)
      .setName('名称')
      .setDesc('此日历源的显示名称')
      .addText(text => text
        .setPlaceholder('我的日历')
        .onChange(value => { name = value; }));

    new Setting(contentEl)
      .setName('颜色')
      .setDesc('此日历源事件使用的颜色')
      .addColorPicker(picker => picker
        .setValue(color)
        .onChange(value => { color = value; }));

    const paletteRow = contentEl.createDiv({ cls: 'uni-calendar-palette-row' });
    for (const { name: paletteName, hex } of RECOMMENDED_PALETTE) {
      const swatch = paletteRow.createDiv({ cls: 'uni-calendar-palette-swatch' });
      swatch.style.background = hex;
      swatch.setAttribute('aria-label', paletteName);
      swatch.setAttribute('title', paletteName);
      if (hex === color) swatch.addClass('is-selected');
      swatch.addEventListener('click', () => {
        color = hex;
        const pickerEl = contentEl.querySelector<HTMLInputElement>('input[type="color"]');
        if (pickerEl) {
          pickerEl.value = hex;
          pickerEl.dispatchEvent(new Event('input'));
        }
        paletteRow.querySelectorAll('.uni-calendar-palette-swatch').forEach(s => s.removeClass('is-selected'));
        swatch.addClass('is-selected');
      });
    }

    new Setting(contentEl)
      .setName('启用')
      .setDesc('是否同步此日历源的事件')
      .addToggle(toggle => toggle
        .setValue(enabled)
        .onChange(value => { enabled = value; }));

    // Type-specific fields
    if (type === 'google') {
      new Setting(contentEl)
        .setName('Client ID')
        .setDesc('OAuth2 Client ID from Google Cloud Console')
        .addText(text => text
          .setPlaceholder('xxxx.apps.googleusercontent.com')
          .onChange(value => { clientId = value; }));

      new Setting(contentEl)
        .setName('Client Secret')
        .setDesc('OAuth2 Client Secret from Google Cloud Console')
        .addText(text => {
          text.setPlaceholder('GOCSPX-xxxx')
            .onChange(value => { clientSecret = value; });
          text.inputEl.type = 'password';
        });

    } else if (type === 'caldav') {
      new Setting(contentEl)
        .setName('服务器地址')
        .addText(text => text
          .setPlaceholder('https://example.com/caldav')
          .onChange(value => { serverUrl = value; }));

      new Setting(contentEl)
        .setName('用户名')
        .addText(text => text
          .setPlaceholder('username')
          .onChange(value => { username = value; }));

      new Setting(contentEl)
        .setName('密码')
        .addText(text => {
          text.setPlaceholder('password')
            .onChange(value => { password = value; });
          text.inputEl.type = 'password';
        });

      // Calendar discovery
      const discoveryContainer = contentEl.createDiv();
      new Setting(discoveryContainer)
        .setName('自动发现日历')
        .addButton(btn => btn
          .setButtonText('发现日历')
          .onClick(async () => {
            if (!serverUrl.trim() || !username.trim() || !password.trim()) {
              new Notice('请先填写服务器地址、用户名和密码');
              return;
            }
            btn.setDisabled(true);
            btn.setButtonText('发现中...');
            try {
              const adapter = new CalDavSyncAdapter(new IcsSyncAdapter());
              const calendars = await adapter.discoverCalendars(
                serverUrl.trim(), username.trim(), password,
              );
              if (calendars.length === 0) {
                new Notice('未发现任何日历');
              } else {
                new CalendarPickerModal(this.app, calendars, selectedCaldavCals.map(c => c.path), (cals) => {
                  selectedCaldavCals = cals.map(c => ({ path: c.href, displayName: c.displayName || c.href }));
                  // Backward compat
                  calendarPath = cals[0]?.href ?? '';
                  calendarDisplayName = cals[0]?.displayName || calendarPath;
                  selectedCalLabel.empty();
                  if (selectedCaldavCals.length > 0) {
                    const names = selectedCaldavCals.map(c => c.displayName).join(', ');
                    selectedCalLabel.createEl('span', {
                      text: `已选日历 (${selectedCaldavCals.length}): ${names}`,
                      attr: { style: 'font-size: var(--font-ui-small); color: var(--text-muted);' },
                    });
                  }
                }).open();
              }
            } catch (err) {
              new Notice(`日历发现失败: ${err instanceof Error ? err.message : String(err)}`);
            } finally {
              btn.setDisabled(false);
              btn.setButtonText('发现日历');
            }
          }));

      const selectedCalLabel = discoveryContainer.createDiv({
        cls: 'setting-item',
        attr: { style: 'padding-top: 0;' },
      });
      selectedCalLabel.createEl('span', {
        text: calendarPath ? `已选日历: ${calendarDisplayName || calendarPath}` : '',
        attr: { style: 'font-size: var(--font-ui-small); color: var(--text-muted);' },
      });
    } else if (type === 'ics') {
      new Setting(contentEl)
        .setName('订阅链接')
        .setDesc('ICS/iCal 日历订阅 URL')
        .addText(text => text
          .setPlaceholder('https://example.com/calendar.ics')
          .onChange(value => { feedUrl = value; }));
    }

    // Action buttons
    const buttonContainer = contentEl.createDiv({ attr: { style: 'display: flex; justify-content: flex-end; gap: var(--size-4-2); margin-top: var(--size-4-4);' } });

    const backBtn = buttonContainer.createEl('button', { text: '返回' });
    backBtn.addEventListener('click', () => {
      this.selectedType = null;
      this.titleEl.setText('添加日历源');
      this.showTypeSelection();
    });

    const saveBtn = buttonContainer.createEl('button', { text: '保存', cls: 'mod-cta' });
    saveBtn.addEventListener('click', async () => {
      if (!name.trim()) {
        new Notice('请输入日历源名称');
        return;
      }

      const source: CalendarSource = {
        id: crypto.randomUUID(),
        name: name.trim(),
        type,
        color,
        enabled,
      };

      if (type === 'google') {
        if (!clientId.trim() || !clientSecret.trim()) {
          new Notice('请输入 Client ID 和 Client Secret');
          return;
        }
        source.google = {
          clientId: clientId.trim(),
          clientSecret: clientSecret.trim(),
        };
      } else if (type === 'caldav') {
        if (!serverUrl.trim()) {
          new Notice('请输入 CalDAV 服务器地址');
          return;
        }
        source.caldav = {
          serverUrl: serverUrl.trim(),
          username: username.trim(),
          password,
          calendarPath: calendarPath.trim() || undefined,
          calendarDisplayName: calendarDisplayName.trim() || undefined,
          selectedCalendars: selectedCaldavCals.length > 0 ? selectedCaldavCals : undefined,
        };
      } else if (type === 'ics') {
        if (!feedUrl.trim()) {
          new Notice('请输入 ICS 订阅链接');
          return;
        }
        source.ics = { feedUrl: feedUrl.trim() };
      }

      this.plugin.settings.sources.push(source);
      await this.plugin.saveSettings();
      this.close();
      this.onDone();

      // Post-save reminders
      if (type === 'google') {
        new Notice('已添加 Google 日历源。请编辑此源完成授权并选择日历。');
      } else if (type === 'caldav' && !calendarPath.trim()) {
        new Notice('已添加 CalDAV 日历源。请编辑此源发现并选择日历。');
      }
    });
  }
}

class EditSourceModal extends Modal {
  private plugin: UniCalendarPlugin;
  private source: CalendarSource;
  private onDone: () => void;

  constructor(app: App, plugin: UniCalendarPlugin, source: CalendarSource, onDone: () => void) {
    super(app);
    this.plugin = plugin;
    this.source = source;
    this.onDone = onDone;
  }

  onOpen(): void {
    const typeLabels = { google: 'Google 日历', caldav: 'CalDAV', ics: 'ICS 订阅' };
    this.titleEl.setText(`编辑${typeLabels[this.source.type]}源`);

    const { contentEl } = this;
    contentEl.empty();
    contentEl.createEl('style', { text: CARD_STYLES });

    const source = this.source;

    // Mutable copy of values
    let name = source.name;
    let color = source.color;
    let enabled = source.enabled;

    // Type-specific mutable copies
    let clientId = source.google?.clientId ?? '';
    let clientSecret = source.google?.clientSecret ?? '';
    let serverUrl = source.caldav?.serverUrl ?? '';
    let username = source.caldav?.username ?? '';
    let password = source.caldav?.password ?? '';
    let calendarPath = source.caldav?.calendarPath ?? '';
    let calendarDisplayName = source.caldav?.calendarDisplayName ?? '';
    let selectedCaldavCals: Array<{ path: string; displayName: string }> = source.caldav?.selectedCalendars ? [...source.caldav.selectedCalendars] : [];
    let feedUrl = source.ics?.feedUrl ?? '';

    // Type (read-only)
    new Setting(contentEl)
      .setName('类型')
      .setDesc(typeLabels[source.type])
      .setDisabled(true);

    // Common fields
    new Setting(contentEl)
      .setName('Name')
      .setDesc('Display name for this calendar source')
      .addText(text => text
        .setValue(name)
        .onChange(value => { name = value; }));

    new Setting(contentEl)
      .setName('颜色')
      .setDesc('此日历源事件使用的颜色')
      .addColorPicker(picker => picker
        .setValue(color)
        .onChange(value => { color = value; }));

    const editPaletteRow = contentEl.createDiv({ cls: 'uni-calendar-palette-row' });
    for (const { name: paletteName, hex } of RECOMMENDED_PALETTE) {
      const swatch = editPaletteRow.createDiv({ cls: 'uni-calendar-palette-swatch' });
      swatch.style.background = hex;
      swatch.setAttribute('aria-label', paletteName);
      swatch.setAttribute('title', paletteName);
      if (hex === color) swatch.addClass('is-selected');
      swatch.addEventListener('click', () => {
        color = hex;
        const pickerEl = contentEl.querySelector<HTMLInputElement>('input[type="color"]');
        if (pickerEl) {
          pickerEl.value = hex;
          pickerEl.dispatchEvent(new Event('input'));
        }
        editPaletteRow.querySelectorAll('.uni-calendar-palette-swatch').forEach(s => s.removeClass('is-selected'));
        swatch.addClass('is-selected');
      });
    }

    new Setting(contentEl)
      .setName('启用')
      .setDesc('是否同步此日历源的事件')
      .addToggle(toggle => toggle
        .setValue(enabled)
        .onChange(value => { enabled = value; }));

    // Type-specific fields
    if (source.type === 'google') {
      new Setting(contentEl)
        .setName('Client ID')
        .setDesc('OAuth2 Client ID from Google Cloud Console')
        .addText(text => text
          .setValue(clientId)
          .onChange(value => { clientId = value; }));

      new Setting(contentEl)
        .setName('Client Secret')
        .setDesc('OAuth2 Client Secret from Google Cloud Console')
        .addText(text => {
          text.setValue(clientSecret)
            .onChange(value => { clientSecret = value; });
          text.inputEl.type = 'password';
        });

      // OAuth flow helpers
      const startOAuthFlow = async (): Promise<void> => {
        if (Platform.isMobile) {
          new Notice('Google 授权仅支持桌面端');
          return;
        }
        const cid = clientId.trim() || source.google?.clientId || '';
        const cs = clientSecret.trim() || source.google?.clientSecret || '';
        if (!cid || !cs) {
          new Notice('请先填写 Client ID 和 Client Secret');
          return;
        }

        let oauthServer: Awaited<ReturnType<typeof startOAuthServer>> | null = null;
        try {
          oauthServer = await startOAuthServer(source.id);
          const redirectUri = `http://127.0.0.1:${oauthServer.port}/callback`;

          const authHelper = new GoogleAuthHelper();
          const verifier = authHelper.generateCodeVerifier();
          const { url } = await authHelper.buildAuthUrl(cid, redirectUri, verifier, source.id);
          window.open(url);
          new Notice('请在浏览器中完成 Google 授权...');

          const code = await oauthServer.codePromise;
          const tokens = await authHelper.exchangeCode(code, cid, cs, redirectUri, verifier);

          // Save tokens to the source
          const idx = this.plugin.settings.sources.findIndex(s => s.id === source.id);
          if (idx !== -1 && this.plugin.settings.sources[idx]!.google) {
            const googleConfig = this.plugin.settings.sources[idx]!.google!;
            googleConfig.accessToken = tokens.accessToken;
            googleConfig.refreshToken = tokens.refreshToken;
            googleConfig.tokenExpiry = tokens.tokenExpiry;
            googleConfig.refreshTokenFingerprint = formatGoogleTokenFingerprint(tokens.refreshToken);
            googleConfig.refreshTokenSavedAt = Date.now();
            googleConfig.lastRefreshAttemptAt = undefined;
            googleConfig.lastRefreshTokenFingerprintUsed = undefined;
            delete googleConfig.lastSyncError;
            await this.plugin.saveSettings();
          }
          new Notice('Google 日历授权成功！正在获取日历列表...');
          // Refresh source reference after token save
          const updatedSource = this.plugin.settings.sources.find(s => s.id === source.id);
          if (updatedSource) {
            Object.assign(source, updatedSource);
          }
          await discoverAndPickCalendar();
        } catch (err) {
          if (err instanceof GoogleTokenError) {
            console.error('[UniCalendar] Google OAuth authorization diagnostic', err.toLogObject());
            new Notice(`Google 授权失败: ${err.userMessage}`);
          } else {
            console.error('[UniCalendar] Google OAuth authorization failed', err);
            new Notice('Google 授权失败: ' + (err instanceof Error ? err.message : String(err)));
          }
        } finally {
          oauthServer?.shutdown();
        }
      };

      const discoverAndPickCalendar = async (): Promise<void> => {
        if (!source.google?.accessToken) {
          new Notice('请先完成授权');
          return;
        }
        try {
          const authHelper = new GoogleAuthHelper();
          const token = await authHelper.ensureValidToken(source.google);
          const adapter = new GoogleSyncAdapter(authHelper);
          const calendars = await adapter.discoverCalendars(token);
          if (calendars.length === 0) {
            new Notice('未发现任何 Google 日历');
            return;
          }
          const preSelected = (source.google?.selectedCalendars ?? []).map(c => c.id);
          new GoogleCalendarPickerModal(this.app, calendars, preSelected, async (cals) => {
            const idx = this.plugin.settings.sources.findIndex(s => s.id === source.id);
            if (idx !== -1 && this.plugin.settings.sources[idx]!.google) {
              const g = this.plugin.settings.sources[idx]!.google!;
              g.selectedCalendars = cals.map(c => ({ id: c.id, name: c.summary }));
              // Backward compat: keep first selected as calendarId
              g.calendarId = cals[0]?.id;
              g.calendarName = cals[0]?.summary;
              delete g.lastSyncError;
              await this.plugin.saveSettings();
              this.close();
              this.onDone();
            }
          }).open();
        } catch (err) {
          new Notice('日历发现失败: ' + (err instanceof Error ? err.message : String(err)));
        }
      };

      // Authorization section
      const authSection = contentEl.createDiv();
      if (source.google?.accessToken) {
        const selectionSummary = formatGoogleSelectionSummary(source) ?? '未选择日历';
        const errorSummary = formatGoogleErrorSummary(source);
        const diagnosticText = formatGoogleDiagnosticText(source);
        new Setting(authSection)
          .setName('授权状态')
          .setDesc(errorSummary ? `已授权；${selectionSummary}；${errorSummary}` : `已授权；${selectionSummary}`)
          .addButton(btn => btn
            .setButtonText('重新授权')
            .onClick(async () => { await startOAuthFlow(); }))
          .addButton(btn => btn
            .setButtonText('选择日历')
            .setCta()
            .onClick(async () => { await discoverAndPickCalendar(); }));

        if (diagnosticText) {
          const diagnosticSetting = new Setting(authSection)
            .setName('诊断详情')
            .setDesc('复制这段信息发给我，能更快判断是授权失效、配置错误、网络问题还是 Google 服务异常。')
            .addButton(btn => btn
              .setButtonText('复制诊断信息')
              .onClick(async () => {
                try {
                  if (navigator.clipboard?.writeText) {
                    await navigator.clipboard.writeText(diagnosticText);
                  } else {
                    const textarea = document.createElement('textarea');
                    textarea.value = diagnosticText;
                    textarea.setAttribute('readonly', 'true');
                    textarea.style.position = 'absolute';
                    textarea.style.left = '-9999px';
                    document.body.appendChild(textarea);
                    textarea.select();
                    document.execCommand('copy');
                    document.body.removeChild(textarea);
                  }
                  new Notice('已复制 Google 诊断信息');
                } catch (err) {
                  console.error('[UniCalendar] Failed to copy Google diagnostic text', err);
                  new Notice('复制失败，请手动选择下方诊断文本');
                }
              }));

          const pre = authSection.createEl('pre', {
            text: diagnosticText,
            attr: {
              style: 'white-space: pre-wrap; word-break: break-word; margin: 0 0 12px 0; padding: 12px; border-radius: var(--radius-s); background: var(--background-secondary-alt); border: 1px solid var(--background-modifier-border); font-size: var(--font-ui-small); user-select: text;',
            },
          });
          pre.addClass('uni-calendar-google-diagnostic');
          diagnosticSetting.settingEl.after(pre);
        }
      } else {
        new Setting(authSection)
          .setName('授权 Google 日历')
          .setDesc('点击授权按钮在浏览器中完成 Google 账号授权')
          .addButton(btn => btn
            .setButtonText('授权')
            .setCta()
            .onClick(async () => { await startOAuthFlow(); }));
      }
    } else if (source.type === 'caldav') {
      new Setting(contentEl)
        .setName('服务器地址')
        .addText(text => text
          .setValue(serverUrl)
          .onChange(value => { serverUrl = value; }));

      new Setting(contentEl)
        .setName('用户名')
        .addText(text => text
          .setValue(username)
          .onChange(value => { username = value; }));

      new Setting(contentEl)
        .setName('密码')
        .addText(text => {
          text.setValue(password)
            .onChange(value => { password = value; });
          text.inputEl.type = 'password';
        });

      // Calendar discovery (edit mode)
      const editDiscoveryContainer = contentEl.createDiv();
      new Setting(editDiscoveryContainer)
        .setName('自动发现日历')
        .addButton(btn => btn
          .setButtonText('发现日历')
          .onClick(async () => {
            const sv = serverUrl.trim() || source.caldav?.serverUrl || '';
            const un = username.trim() || source.caldav?.username || '';
            const pw = password || source.caldav?.password || '';
            if (!sv || !un || !pw) {
              new Notice('请先填写服务器地址、用户名和密码');
              return;
            }
            btn.setDisabled(true);
            btn.setButtonText('发现中...');
            try {
              const adapter = new CalDavSyncAdapter(new IcsSyncAdapter());
              const calendars = await adapter.discoverCalendars(sv, un, pw);
              if (calendars.length === 0) {
                new Notice('未发现任何日历');
              } else {
                new CalendarPickerModal(this.app, calendars, selectedCaldavCals.map(c => c.path), (cals) => {
                  selectedCaldavCals = cals.map(c => ({ path: c.href, displayName: c.displayName || c.href }));
                  calendarPath = cals[0]?.href ?? '';
                  calendarDisplayName = cals[0]?.displayName || calendarPath;
                  selectedCalLabel.empty();
                  if (selectedCaldavCals.length > 0) {
                    const names = selectedCaldavCals.map(c => c.displayName).join(', ');
                    selectedCalLabel.createEl('span', {
                      text: `已选日历 (${selectedCaldavCals.length}): ${names}`,
                      attr: { style: 'font-size: var(--font-ui-small); color: var(--text-muted);' },
                    });
                  }
                }).open();
              }
            } catch (err) {
              new Notice(`日历发现失败: ${err instanceof Error ? err.message : String(err)}`);
            } finally {
              btn.setDisabled(false);
              btn.setButtonText('发现日历');
            }
          }));

      const selectedCalLabel = editDiscoveryContainer.createDiv({
        cls: 'setting-item',
        attr: { style: 'padding-top: 0;' },
      });
      if (selectedCaldavCals.length > 0) {
        const names = selectedCaldavCals.map(c => c.displayName).join(', ');
        selectedCalLabel.createEl('span', {
          text: `已选日历 (${selectedCaldavCals.length}): ${names}`,
          attr: { style: 'font-size: var(--font-ui-small); color: var(--text-muted);' },
        });
      } else {
        selectedCalLabel.createEl('span', {
          text: calendarPath ? `已选日历: ${calendarDisplayName || calendarPath}` : '',
          attr: { style: 'font-size: var(--font-ui-small); color: var(--text-muted);' },
        });
      }
    } else if (source.type === 'ics') {
      new Setting(contentEl)
        .setName('订阅链接')
        .setDesc('ICS/iCal 日历订阅 URL')
        .addText(text => text
          .setValue(feedUrl)
          .onChange(value => { feedUrl = value; }));
    }

    // Action buttons
    const buttonContainer = contentEl.createDiv({ attr: { style: 'display: flex; justify-content: flex-end; gap: var(--size-4-2); margin-top: var(--size-4-4);' } });

    const cancelBtn = buttonContainer.createEl('button', { text: '取消' });
    cancelBtn.addEventListener('click', () => {
      this.close();
    });

    const saveBtn = buttonContainer.createEl('button', { text: '保存', cls: 'mod-cta' });
    saveBtn.addEventListener('click', async () => {
      if (!name.trim()) {
        new Notice('请输入日历源名称');
        return;
      }

      // Update source in-place
      const idx = this.plugin.settings.sources.findIndex(s => s.id === source.id);
      if (idx === -1) {
        new Notice('未找到日历源，可能已被删除。');
        this.close();
        return;
      }

      const updated: CalendarSource = {
        id: source.id,
        name: name.trim(),
        type: source.type,
        color,
        enabled,
      };

      if (source.type === 'google') {
        updated.google = {
          clientId: clientId.trim(),
          clientSecret: clientSecret.trim(),
          accessToken: source.google?.accessToken,
          refreshToken: source.google?.refreshToken,
          tokenExpiry: source.google?.tokenExpiry,
          calendarId: source.google?.calendarId,
          calendarName: source.google?.calendarName,
          selectedCalendars: source.google?.selectedCalendars,
          lastSyncError: source.google?.lastSyncError,
        };
      } else if (source.type === 'caldav') {
        updated.caldav = {
          serverUrl: serverUrl.trim(),
          username: username.trim(),
          password,
          calendarPath: calendarPath.trim() || undefined,
          calendarDisplayName: calendarDisplayName.trim() || undefined,
          selectedCalendars: selectedCaldavCals.length > 0 ? selectedCaldavCals : undefined,
        };
      } else if (source.type === 'ics') {
        updated.ics = { feedUrl: feedUrl.trim() };
      }

      this.plugin.settings.sources[idx] = updated;
      await this.plugin.saveSettings();
      this.close();
      this.onDone();
    });
  }

  onClose(): void {
    const { contentEl } = this;
    contentEl.empty();
  }
}

class CalendarPickerModal extends Modal {
  private calendars: DiscoveredCalendar[];
  private onSelect: (cals: DiscoveredCalendar[]) => void;
  private selected: Set<string>;

  constructor(app: App, calendars: DiscoveredCalendar[], preSelected: string[], onSelect: (cals: DiscoveredCalendar[]) => void) {
    super(app);
    this.calendars = calendars;
    this.onSelect = onSelect;
    this.selected = new Set(preSelected);
  }

  onOpen(): void {
    this.titleEl.setText(`选择日历 (${this.calendars.length})`);
    const { contentEl } = this;
    contentEl.empty();

    for (const cal of this.calendars) {
      const item = contentEl.createDiv({
        cls: 'uni-calendar-picker-item',
        attr: {
          style: 'display: flex; align-items: center; padding: 8px 12px; cursor: pointer; border-radius: var(--radius-s); margin-bottom: 4px;',
        },
      });
      const checkbox = item.createEl('input', { type: 'checkbox', attr: { style: 'margin-right: 8px;' } });
      checkbox.checked = this.selected.has(cal.href);
      item.createEl('span', { text: cal.displayName || cal.href });
      item.addEventListener('click', (evt) => {
        if (evt.target !== checkbox) checkbox.checked = !checkbox.checked;
        if (checkbox.checked) {
          this.selected.add(cal.href);
        } else {
          this.selected.delete(cal.href);
        }
      });
      item.addEventListener('mouseenter', () => {
        item.style.background = 'var(--background-modifier-hover)';
      });
      item.addEventListener('mouseleave', () => {
        item.style.background = '';
      });
    }

    // Confirm button
    const btnContainer = contentEl.createDiv({ attr: { style: 'display: flex; justify-content: flex-end; margin-top: var(--size-4-3);' } });
    const confirmBtn = btnContainer.createEl('button', { text: '确认选择', cls: 'mod-cta' });
    confirmBtn.addEventListener('click', () => {
      const result = this.calendars.filter(c => this.selected.has(c.href));
      this.onSelect(result);
      this.close();
    });
  }

  onClose(): void {
    this.contentEl.empty();
  }
}

class GoogleCalendarPickerModal extends Modal {
  private calendars: GoogleCalendarEntry[];
  private onSelect: (cals: GoogleCalendarEntry[]) => void;
  private selected: Set<string>;

  constructor(app: App, calendars: GoogleCalendarEntry[], preSelected: string[], onSelect: (cals: GoogleCalendarEntry[]) => void) {
    super(app);
    this.calendars = calendars;
    this.onSelect = onSelect;
    this.selected = new Set(preSelected);
  }

  onOpen(): void {
    this.titleEl.setText(`选择 Google 日历 (${this.calendars.length})`);
    const { contentEl } = this;
    contentEl.empty();

    for (const cal of this.calendars) {
      const item = contentEl.createDiv({
        cls: 'uni-calendar-picker-item',
        attr: {
          style: 'display: flex; align-items: center; padding: 8px 12px; cursor: pointer; border-radius: var(--radius-s); margin-bottom: 4px;',
        },
      });
      const checkbox = item.createEl('input', { type: 'checkbox', attr: { style: 'margin-right: 8px;' } });
      checkbox.checked = this.selected.has(cal.id);
      const label = cal.primary ? `${cal.summary} (主日历)` : cal.summary;
      item.createEl('span', { text: label });
      if (cal.backgroundColor) {
        item.createSpan({
          cls: 'uni-calendar-color-dot',
          attr: { style: `background: ${cal.backgroundColor}; margin-left: 8px;` },
        });
      }
      item.addEventListener('click', (evt) => {
        if (evt.target !== checkbox) checkbox.checked = !checkbox.checked;
        if (checkbox.checked) {
          this.selected.add(cal.id);
        } else {
          this.selected.delete(cal.id);
        }
      });
      item.addEventListener('mouseenter', () => { item.style.background = 'var(--background-modifier-hover)'; });
      item.addEventListener('mouseleave', () => { item.style.background = ''; });
    }

    // Confirm button
    const btnContainer = contentEl.createDiv({ attr: { style: 'display: flex; justify-content: flex-end; margin-top: var(--size-4-3);' } });
    const confirmBtn = btnContainer.createEl('button', { text: '确认选择', cls: 'mod-cta' });
    confirmBtn.addEventListener('click', () => {
      const result = this.calendars.filter(c => this.selected.has(c.id));
      this.onSelect(result);
      this.close();
    });
  }

  onClose(): void {
    this.contentEl.empty();
  }
}
