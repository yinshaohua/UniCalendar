// Minimal mock of Obsidian API for unit testing
import { vi } from 'vitest';

export class Plugin {}
export class ItemView {
  containerEl = { children: [null, { empty: () => {} }] };
}
export class PluginSettingTab {}
export class Setting {
  setName() { return this; }
  setDesc() { return this; }
  addText() { return this; }
  addDropdown() { return this; }
  addButton() { return this; }
  addExtraButton() { return this; }
  addColorPicker() { return this; }
}
export class Modal {}
export class Notice {}
export const requestUrl = vi.fn().mockResolvedValue({ json: {}, text: '', status: 200 });
export const Platform = { isDesktop: true, isMobile: false, isDesktopApp: true, isMobileApp: false };
