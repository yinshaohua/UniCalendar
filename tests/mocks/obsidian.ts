// Minimal mock of Obsidian API for unit testing
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
export function requestUrl() {
  return Promise.resolve({ json: {}, text: '', status: 200 });
}
