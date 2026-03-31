import { Plugin } from 'obsidian';
import { UniCalendarSettings, DEFAULT_SETTINGS } from './models/types';
import { UniCalendarSettingsTab } from './settings/SettingsTab';

export default class UniCalendarPlugin extends Plugin {
  settings: UniCalendarSettings = DEFAULT_SETTINGS;

  async onload(): Promise<void> {
    await this.loadSettings();

    // Register settings tab
    this.addSettingTab(new UniCalendarSettingsTab(this.app, this));
  }

  onunload(): void {
    // Cleanup handled by Obsidian
  }

  async loadSettings(): Promise<void> {
    const data = await this.loadData() as Partial<UniCalendarSettings> | null;
    this.settings = Object.assign({}, DEFAULT_SETTINGS, data);
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
  }
}
