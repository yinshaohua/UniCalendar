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
    return `已选日历（${selCals.length}）: ${names}`;
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

function addSettingHeading(containerEl: HTMLElement, title: string): void {
  new Setting(containerEl)
    .setName(title)
    .setHeading();
}

function createStatusLine(
  containerEl: HTMLElement,
  text: string,
  classNames?: string[],
): void {
  const el = containerEl.createEl('div', {
    text,
    cls: 'uni-calendar-source-status',
  });

  classNames?.forEach(className => el.addClass(className));
}

function createLabelRow(containerEl: HTMLElement): HTMLElement {
  return containerEl.createDiv({
    cls: 'setting-item uni-calendar-selection-label',
  });
}

function renderSelectionLabel(
  containerEl: HTMLElement,
  text: string,
): void {
  containerEl.empty();
  if (!text) {
    return;
  }

  containerEl.createEl('span', {
    text,
    cls: 'uni-calendar-selection-label-text',
  });
}

async function copyTextToClipboard(text: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  throw new Error('当前环境不支持剪贴板写入');
}

export class UniCalendarSettingsTab extends PluginSettingTab {
  plugin: UniCalendarPlugin;

  constructor(app: App, plugin: UniCalendarPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    addSettingHeading(containerEl, '通用设置');

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
          expand: '显示全部事件（单元格自动扩展）',
          collapse: '最多显示 3 个，超出折叠',
        })
        .setValue(this.plugin.settings.monthOverflowMode)
        .onChange(async (value) => {
          this.plugin.settings.monthOverflowMode = value as 'expand' | 'collapse';
          await this.plugin.saveSettings();
        }));

    addSettingHeading(containerEl, '日历源');

    if (this.plugin.settings.sources.length === 0) {
      containerEl.createEl('p', {
        text: '尚未配置日历源，请在下方添加。',
        cls: 'setting-item-description',
      });
    }

    for (const source of this.plugin.settings.sources) {
      const card = containerEl.createDiv({ cls: 'uni-calendar-source-card' });

      const info = card.createDiv({ cls: 'uni-calendar-source-info' });
      info.createSpan({
        cls: 'uni-calendar-color-dot',
        attr: { style: `background: ${source.color}` },
      });

      const detailsDiv = info.createDiv();
      detailsDiv.createEl('span', { text: source.name, cls: 'uni-calendar-source-name' });
      detailsDiv.createEl('span', { text: source.type.toUpperCase(), cls: 'uni-calendar-source-type' });
      createStatusLine(detailsDiv, source.enabled ? '已启用' : '已禁用');

      if (source.type === 'google') {
        if (!source.google?.accessToken) {
          createStatusLine(detailsDiv, '未授权，请点击编辑完成授权', ['is-error']);
        } else if (source.google.lastSyncError?.kind === 'invalid_grant') {
          createStatusLine(detailsDiv, '授权已失效，请重新授权', ['is-error', 'is-strong']);
        } else {
          createStatusLine(detailsDiv, '已授权');
        }

        const selectionSummary = formatGoogleSelectionSummary(source);
        if (selectionSummary) {
          createStatusLine(detailsDiv, selectionSummary);
        } else {
          createStatusLine(detailsDiv, '未选择日历，无法同步', ['is-warning', 'is-strong']);
        }

        const errorSummary = formatGoogleErrorSummary(source);
        if (errorSummary) {
          createStatusLine(detailsDiv, errorSummary, ['is-error']);
        }
      }

      if (source.type === 'caldav') {
        const selCals = source.caldav?.selectedCalendars;
        if (selCals && selCals.length > 0) {
          const names = selCals.map(c => c.displayName).join(', ');
          createStatusLine(detailsDiv, `已选日历（${selCals.length}）: ${names}`);
        } else if (!source.caldav?.calendarPath) {
          createStatusLine(detailsDiv, '未选择日历，无法同步', ['is-warning', 'is-strong']);
        }
      }

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
          .onClick(() => {
            void (async () => {
              this.plugin.settings.sources = this.plugin.settings.sources.filter(s => s.id !== source.id);
              await this.plugin.saveSettings();
              this.display();
            })();
          }));
    }

    new Setting(containerEl)
      .addButton(btn => btn
        .setButtonText('添加日历源')
        .setCta()
        .onClick(() => {
          new AddSourceModal(this.app, this.plugin, () => this.display()).open();
        }));

    addSettingHeading(containerEl, '农历与节假日');

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

    const buttonContainer = contentEl.createDiv({ cls: 'uni-calendar-modal-button-grid' });

    const types: Array<{ type: 'google' | 'caldav' | 'ics'; label: string }> = [
      { type: 'google', label: 'Google 日历' },
      { type: 'caldav', label: 'CalDAV 日历' },
      { type: 'ics', label: 'ICS 订阅' },
    ];

    for (const t of types) {
      const btn = buttonContainer.createEl('button', {
        text: t.label,
        cls: 'mod-cta uni-calendar-modal-button',
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

    const type = this.selectedType;
    const typeLabels = { google: 'Google 日历', caldav: 'CalDAV', ics: 'ICS 订阅' };
    this.titleEl.setText(`添加${typeLabels[type]}源`);

    let name = '';
    let color = getNextColor(this.plugin.settings.sources);
    let enabled = true;

    let clientId = '';
    let clientSecret = '';
    let serverUrl = '';
    let username = '';
    let password = '';
    let calendarPath = '';
    let calendarDisplayName = '';
    let selectedCaldavCals: Array<{ path: string; displayName: string }> = [];
    let feedUrl = '';

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
      swatch.setCssProps({ background: hex });
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

    if (type === 'google') {
      new Setting(contentEl)
        .setName('Client ID')
        .setDesc('Google Cloud Console 中的 OAuth2 Client ID')
        .addText(text => text
          .setPlaceholder('xxxx.apps.googleusercontent.com')
          .onChange(value => { clientId = value; }));

      new Setting(contentEl)
        .setName('Client secret')
        .setDesc('Google Cloud Console 中的 OAuth2 Client Secret')
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

      const discoveryContainer = contentEl.createDiv();
      new Setting(discoveryContainer)
        .setName('自动发现日历')
        .addButton(btn => btn
          .setButtonText('发现日历')
          .onClick(() => {
            void (async () => {
              if (!serverUrl.trim() || !username.trim() || !password.trim()) {
                new Notice('请先填写服务器地址、用户名和密码');
                return;
              }
              btn.setDisabled(true);
              btn.setButtonText('发现中…');
              try {
                const adapter = new CalDavSyncAdapter(new IcsSyncAdapter());
                const calendars = await adapter.discoverCalendars(serverUrl.trim(), username.trim(), password);
                if (calendars.length === 0) {
                  new Notice('未发现任何日历');
                } else {
                  new CalendarPickerModal(this.app, calendars, selectedCaldavCals.map(c => c.path), (cals) => {
                    selectedCaldavCals = cals.map(c => ({ path: c.href, displayName: c.displayName || c.href }));
                    calendarPath = cals[0]?.href ?? '';
                    calendarDisplayName = cals[0]?.displayName || calendarPath;
                    renderSelectionLabel(
                      selectedCalLabel,
                      selectedCaldavCals.length > 0
                        ? `已选日历（${selectedCaldavCals.length}）: ${selectedCaldavCals.map(c => c.displayName).join(', ')}`
                        : '',
                    );
                  }).open();
                }
              } catch (err) {
                new Notice(`日历发现失败: ${err instanceof Error ? err.message : String(err)}`);
              } finally {
                btn.setDisabled(false);
                btn.setButtonText('发现日历');
              }
            })();
          }));

      const selectedCalLabel = createLabelRow(discoveryContainer);
      renderSelectionLabel(selectedCalLabel, calendarPath ? `已选日历: ${calendarDisplayName || calendarPath}` : '');
    } else if (type === 'ics') {
      new Setting(contentEl)
        .setName('订阅链接')
        .setDesc('ICS 或 iCal 日历订阅地址')
        .addText(text => text
          .setPlaceholder('https://example.com/calendar.ics')
          .onChange(value => { feedUrl = value; }));
    }

    const buttonContainer = contentEl.createDiv({ cls: 'uni-calendar-modal-actions' });

    const backBtn = buttonContainer.createEl('button', { text: '返回' });
    backBtn.addEventListener('click', () => {
      this.selectedType = null;
      this.titleEl.setText('添加日历源');
      this.showTypeSelection();
    });

    const saveBtn = buttonContainer.createEl('button', { text: '保存', cls: 'mod-cta' });
    saveBtn.addEventListener('click', () => {
      void (async () => {
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

        if (type === 'google') {
          new Notice('已添加 Google 日历源。请编辑此源，完成授权并选择日历。');
        } else if (type === 'caldav' && !calendarPath.trim()) {
          new Notice('已添加 CalDAV 日历源。请编辑此源，发现并选择日历。');
        }
      })();
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

    const source = this.source;

    let name = source.name;
    let color = source.color;
    let enabled = source.enabled;

    let clientId = source.google?.clientId ?? '';
    let clientSecret = source.google?.clientSecret ?? '';
    let serverUrl = source.caldav?.serverUrl ?? '';
    let username = source.caldav?.username ?? '';
    let password = source.caldav?.password ?? '';
    let calendarPath = source.caldav?.calendarPath ?? '';
    let calendarDisplayName = source.caldav?.calendarDisplayName ?? '';
    let selectedCaldavCals: Array<{ path: string; displayName: string }> = source.caldav?.selectedCalendars ? [...source.caldav.selectedCalendars] : [];
    let feedUrl = source.ics?.feedUrl ?? '';

    new Setting(contentEl)
      .setName('类型')
      .setDesc(typeLabels[source.type])
      .setDisabled(true);

    new Setting(contentEl)
      .setName('名称')
      .setDesc('此日历源的显示名称')
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
      swatch.setCssProps({ background: hex });
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

    if (source.type === 'google') {
      new Setting(contentEl)
        .setName('Google 客户端 ID')
        .setDesc('Google Cloud Console 中的 OAuth2 客户端 ID')
        .addText(text => text
          .setValue(clientId)
          .onChange(value => { clientId = value; }));

      new Setting(contentEl)
        .setName('Google 客户端密钥')
        .setDesc('Google Cloud Console 中的 OAuth2 客户端密钥')
        .addText(text => {
          text.setValue(clientSecret)
            .onChange(value => { clientSecret = value; });
          text.inputEl.type = 'password';
        });

      const startOAuthFlow = async (): Promise<void> => {
        if (Platform.isMobile) {
          new Notice('Google 授权仅支持桌面端');
          return;
        }
        const cid = clientId.trim() || source.google?.clientId || '';
        const cs = clientSecret.trim() || source.google?.clientSecret || '';
        if (!cid || !cs) {
          new Notice('请先填写 Google 客户端 ID 和客户端密钥');
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
          new Notice('请在浏览器中完成 Google 授权…');

          const code = await oauthServer.codePromise;
          const tokens = await authHelper.exchangeCode(code, cid, cs, redirectUri, verifier);

          const idx = this.plugin.settings.sources.findIndex(s => s.id === source.id);
          if (idx !== -1 && this.plugin.settings.sources[idx]?.google) {
            const googleConfig = this.plugin.settings.sources[idx].google;
            if (googleConfig) {
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
          }
          new Notice('Google 日历授权成功，正在获取日历列表…');
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
            new Notice(`Google 授权失败: ${err instanceof Error ? err.message : String(err)}`);
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
          const preSelected = (source.google.selectedCalendars ?? []).map(c => c.id);
          new GoogleCalendarPickerModal(this.app, calendars, preSelected, (cals) => {
            void (async () => {
              const idx = this.plugin.settings.sources.findIndex(s => s.id === source.id);
              if (idx !== -1 && this.plugin.settings.sources[idx]?.google) {
                const g = this.plugin.settings.sources[idx].google;
                if (g) {
                  g.selectedCalendars = cals.map(c => ({ id: c.id, name: c.summary }));
                  g.calendarId = cals[0]?.id;
                  g.calendarName = cals[0]?.summary;
                  delete g.lastSyncError;
                  await this.plugin.saveSettings();
                  this.close();
                  this.onDone();
                }
              }
            })();
          }).open();
        } catch (err) {
          new Notice(`日历发现失败: ${err instanceof Error ? err.message : String(err)}`);
        }
      };

      const authSection = contentEl.createDiv();
      if (source.google?.accessToken) {
        const selectionSummary = formatGoogleSelectionSummary(source) ?? '未选择日历';
        const errorSummary = formatGoogleErrorSummary(source);
        const diagnosticText = formatGoogleDiagnosticText(source);
        const diagnosticVisible = diagnosticText.length > 0;

        new Setting(authSection)
          .setName('授权状态')
          .setDesc(errorSummary ? `已授权；${selectionSummary}；${errorSummary}` : `已授权；${selectionSummary}`)
          .addButton(btn => btn
            .setButtonText('重新授权')
            .onClick(() => {
              void startOAuthFlow();
            }))
          .addButton(btn => btn
            .setButtonText('选择日历')
            .setCta()
            .onClick(() => {
              void discoverAndPickCalendar();
            }));

        if (diagnosticVisible) {
          const diagnosticSetting = new Setting(authSection)
            .setName('Google 日历诊断详情')
            .setDesc('复制这段信息发给我，可以更快判断是授权失效、配置错误、网络问题，还是 Google 服务异常。')
            .addButton(btn => btn
              .setButtonText('复制诊断信息')
              .onClick(() => {
                void (async () => {
                  try {
                    await copyTextToClipboard(diagnosticText);
                    new Notice('已复制 Google 诊断信息');
                  } catch (err) {
                    console.error('[UniCalendar] Failed to copy Google diagnostic text', err);
                    new Notice('复制失败，请手动选择下方诊断文本');
                  }
                })();
              }));

          const pre = authSection.createEl('pre', {
            text: diagnosticText,
            cls: 'uni-calendar-google-diagnostic',
          });
          diagnosticSetting.settingEl.after(pre);
        }
      } else {
        new Setting(authSection)
          .setName('Google 日历授权')
          .setDesc('点击授权按钮，在浏览器中完成 Google 账号授权')
          .addButton(btn => btn
            .setButtonText('授权')
            .setCta()
            .onClick(() => {
              void startOAuthFlow();
            }));
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

      const editDiscoveryContainer = contentEl.createDiv();
      new Setting(editDiscoveryContainer)
        .setName('自动发现 CalDAV 日历')
        .addButton(btn => btn
          .setButtonText('发现日历')
          .onClick(() => {
            void (async () => {
              const sv = serverUrl.trim() || source.caldav?.serverUrl || '';
              const un = username.trim() || source.caldav?.username || '';
              const pw = password || source.caldav?.password || '';
              if (!sv || !un || !pw) {
                new Notice('请先填写服务器地址、用户名和密码');
                return;
              }
              btn.setDisabled(true);
              btn.setButtonText('发现中…');
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
                    renderSelectionLabel(
                      selectedCalLabel,
                      selectedCaldavCals.length > 0
                        ? `已选日历（${selectedCaldavCals.length}）: ${selectedCaldavCals.map(c => c.displayName).join(', ')}`
                        : calendarPath
                          ? `已选日历: ${calendarDisplayName || calendarPath}`
                          : '',
                    );
                  }).open();
                }
              } catch (err) {
                new Notice(`日历发现失败: ${err instanceof Error ? err.message : String(err)}`);
              } finally {
                btn.setDisabled(false);
                btn.setButtonText('发现日历');
              }
            })();
          }));

      const selectedCalLabel = createLabelRow(editDiscoveryContainer);
      if (selectedCaldavCals.length > 0) {
        renderSelectionLabel(selectedCalLabel, `已选日历（${selectedCaldavCals.length}）: ${selectedCaldavCals.map(c => c.displayName).join(', ')}`);
      } else {
        renderSelectionLabel(selectedCalLabel, calendarPath ? `已选日历: ${calendarDisplayName || calendarPath}` : '');
      }
    } else if (source.type === 'ics') {
      new Setting(contentEl)
        .setName('订阅链接')
        .setDesc('ICS 或 iCal 日历订阅地址')
        .addText(text => text
          .setValue(feedUrl)
          .onChange(value => { feedUrl = value; }));
    }

    const buttonContainer = contentEl.createDiv({ cls: 'uni-calendar-modal-actions' });

    const cancelBtn = buttonContainer.createEl('button', { text: '取消' });
    cancelBtn.addEventListener('click', () => {
      this.close();
    });

    const saveBtn = buttonContainer.createEl('button', { text: '保存', cls: 'mod-cta' });
    saveBtn.addEventListener('click', () => {
      void (async () => {
        if (!name.trim()) {
          new Notice('请输入日历源名称');
          return;
        }

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
            refreshTokenFingerprint: source.google?.refreshTokenFingerprint,
            refreshTokenSavedAt: source.google?.refreshTokenSavedAt,
            lastRefreshAttemptAt: source.google?.lastRefreshAttemptAt,
            lastRefreshTokenFingerprintUsed: source.google?.lastRefreshTokenFingerprintUsed,
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
      })();
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
    this.titleEl.setText(`选择日历（${this.calendars.length}）`);
    const { contentEl } = this;
    contentEl.empty();

    for (const cal of this.calendars) {
      const item = contentEl.createDiv({ cls: 'uni-calendar-picker-item' });
      const checkbox = item.createEl('input', {
        type: 'checkbox',
        cls: 'uni-calendar-picker-checkbox',
      });
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
    }

    const btnContainer = contentEl.createDiv({ cls: 'uni-calendar-picker-actions' });
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
    this.titleEl.setText(`选择 Google 日历（${this.calendars.length}）`);
    const { contentEl } = this;
    contentEl.empty();

    for (const cal of this.calendars) {
      const item = contentEl.createDiv({ cls: 'uni-calendar-picker-item' });
      const checkbox = item.createEl('input', {
        type: 'checkbox',
        cls: 'uni-calendar-picker-checkbox',
      });
      checkbox.checked = this.selected.has(cal.id);
      const label = cal.primary ? `${cal.summary}（主日历）` : cal.summary;
      item.createEl('span', { text: label });
      if (cal.backgroundColor) {
        const dot = item.createSpan({
          cls: 'uni-calendar-color-dot uni-calendar-picker-color-dot',
        });
        dot.setCssProps({ background: cal.backgroundColor });
      }
      item.addEventListener('click', (evt) => {
        if (evt.target !== checkbox) checkbox.checked = !checkbox.checked;
        if (checkbox.checked) {
          this.selected.add(cal.id);
        } else {
          this.selected.delete(cal.id);
        }
      });
    }

    const btnContainer = contentEl.createDiv({ cls: 'uni-calendar-picker-actions' });
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
