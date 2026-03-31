import { App, Modal, Notice, Plugin, PluginSettingTab, Setting } from 'obsidian';
import { CalendarSource, UniCalendarSettings, SOURCE_COLORS, getNextColor } from '../models/types';

/**
 * Minimal plugin interface for SettingsTab consumption.
 * Avoids circular dependency with main.ts which imports this file.
 */
interface UniCalendarPlugin extends Plugin {
  settings: UniCalendarSettings;
  saveSettings(): Promise<void>;
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
      { type: 'caldav', label: 'CalDAV', desc: 'CalDAV 服务器（钉钉、iCloud 等）' },
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
        .setDesc('CalDAV 服务器 URL')
        .addText(text => text
          .setPlaceholder('https://caldav.example.com')
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

      new Setting(contentEl)
        .setName('日历路径')
        .setDesc('可选 — 留空则自动发现')
        .addText(text => text
          .setPlaceholder('/calendars/default/')
          .onChange(value => { calendarPath = value; }));
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
        source.google = { clientId: clientId.trim(), clientSecret: clientSecret.trim() };
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
    } else if (source.type === 'caldav') {
      new Setting(contentEl)
        .setName('服务器地址')
        .setDesc('CalDAV 服务器 URL')
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

      new Setting(contentEl)
        .setName('日历路径')
        .setDesc('可选 — 留空则自动发现')
        .addText(text => text
          .setValue(calendarPath)
          .onChange(value => { calendarPath = value; }));
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
        updated.google = { clientId: clientId.trim(), clientSecret: clientSecret.trim() };
      } else if (source.type === 'caldav') {
        updated.caldav = {
          serverUrl: serverUrl.trim(),
          username: username.trim(),
          password,
          calendarPath: calendarPath.trim() || undefined,
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
