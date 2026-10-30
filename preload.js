// Arayüze sadece izin verilen işlevleri açar (güvenli köprü).
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  getSettings: () => ipcRenderer.invoke('settings:get'),
  setSettings: (partial) => ipcRenderer.invoke('settings:set', partial),
  getData: (name) => ipcRenderer.invoke('data:get', name),
  getLocale: (lang) => ipcRenderer.invoke('i18n:get', lang),
  hide: () => ipcRenderer.send('window:hide'),
  minimize: () => ipcRenderer.send('window:minimize'),
  quit: () => ipcRenderer.send('app:quit'),
  onShortcut: (cb) => ipcRenderer.on('shortcut', (_e, action) => cb(action)),
  onSettingsChanged: (cb) => ipcRenderer.on('settings:changed', (_e, s) => cb(s)),
  getAppInfo: () => ipcRenderer.invoke('app:info'),
  getDefaultShortcuts: () => ipcRenderer.invoke('shortcuts:defaults'),
  pauseShortcuts: () => ipcRenderer.invoke('shortcuts:pause'),
  resumeShortcuts: () => ipcRenderer.invoke('shortcuts:resume'),
  getUpdateState: () => ipcRenderer.invoke('update:get-state'),
  installUpdate: () => ipcRenderer.invoke('update:install'),
  onUpdateState: (cb) => ipcRenderer.on('update:state', (_e, s) => cb(s)),
  onUpdateInstalled: (cb) => ipcRenderer.on('update:installed', (_e, v) => cb(v)),
  copyText: (text) => ipcRenderer.invoke('clipboard:write', text)
});
