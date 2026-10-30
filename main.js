// Ana süreç: pencere, her zaman üstte, şeffaflık, global kısayollar, ayarlar ve veri dosyaları.
const { app, BrowserWindow, globalShortcut, ipcMain, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const analytics = require('./analytics');

// F tuşları varsayılan: oyun bunları kullanmıyor. Global kısayol, tuşu oyundan "çalar",
// bu yüzden oyunda kullandığın tuşları buraya koyma.
const DEFAULT_SETTINGS = {
  language: null,            // ilk açılışta bilgisayarın diline göre seçilir (tr / en)
  opacity: 0.9,
  sound: true,
  analytics: true,           // isimsiz kullanım sayısı (Ayarlar'dan kapatılabilir)
  bounds: { width: 360, height: 600 },
  shortcuts: {
    toggleWindow: 'F8',
    opacityDown: 'Ctrl+F8',
    opacityUp: 'Shift+F8',
    speedTap: 'F6',
    speedReset: 'F7',
    smudgeTimer: 'F9',
    huntTimer: 'F10',
    // Kanıt kısayolları (NumLock açık olmalı)
    ev_emf: 'num1',
    ev_spiritbox: 'num2',
    ev_uv: 'num3',
    ev_orb: 'num4',
    ev_writing: 'num5',
    ev_freezing: 'num6',
    ev_dots: 'num7',
    evReset: 'num0'
  }
};

const ALLOWED_DATA = ['ghosts', 'evidence', 'cursed', 'equipment', 'maps'];
const ALLOWED_LOCALES = ['tr', 'en'];

let win = null;
let settings = null;
const settingsPath = () => path.join(app.getPath('userData'), 'settings.json');

function systemLanguage() {
  return (app.getLocale() || '').toLowerCase().startsWith('tr') ? 'tr' : 'en';
}

function loadSettings() {
  let s;
  try {
    const saved = JSON.parse(fs.readFileSync(settingsPath(), 'utf8'));
    s = {
      ...DEFAULT_SETTINGS,
      ...saved,
      shortcuts: { ...DEFAULT_SETTINGS.shortcuts, ...(saved.shortcuts || {}) }
    };
  } catch {
    s = structuredClone(DEFAULT_SETTINGS);
  }
  if (!ALLOWED_LOCALES.includes(s.language)) s.language = systemLanguage();
  return s;
}

function saveSettings() {
  try {
    fs.mkdirSync(path.dirname(settingsPath()), { recursive: true });
    fs.writeFileSync(settingsPath(), JSON.stringify(settings, null, 2));
  } catch (err) {
    console.error('Ayarlar kaydedilemedi:', err);
  }
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(path.join(__dirname, file), 'utf8'));
}

function clampOpacity(v) {
  return Math.min(1, Math.max(0.3, Math.round(v * 100) / 100));
}

function applyOpacity() {
  if (win) win.setOpacity(settings.opacity);
}

function sendToRenderer(channel, payload) {
  if (win && !win.isDestroyed()) win.webContents.send(channel, payload);
}

function toggleWindow() {
  if (!win) return;
  if (win.isVisible()) {
    win.hide();
  } else {
    win.showInactive(); // oyundan odağı çalmadan göster
    win.setAlwaysOnTop(true, 'screen-saver');
  }
}

function changeOpacity(delta) {
  settings.opacity = clampOpacity(settings.opacity + delta);
  applyOpacity();
  saveSettings();
  sendToRenderer('settings:changed', settings);
}

function registerShortcuts() {
  globalShortcut.unregisterAll();
  const actions = {
    toggleWindow: () => toggleWindow(),
    opacityDown: () => changeOpacity(-0.1),
    opacityUp: () => changeOpacity(0.1)
  };
  const failed = [];
  for (const [action, accel] of Object.entries(settings.shortcuts)) {
    if (!accel) continue;
    const handler = actions[action] || (() => sendToRenderer('shortcut', action));
    try {
      if (!globalShortcut.register(accel, handler)) failed.push(action);
    } catch {
      failed.push(action);
    }
  }
  if (failed.length) console.warn('Kaydedilemeyen kısayollar:', failed.join(', '));
  return failed;
}

function createWindow() {
  const { width, height, x, y } = settings.bounds;
  win = new BrowserWindow({
    width, height, x, y,
    minWidth: 280,
    minHeight: 360,
    frame: false,
    alwaysOnTop: true,
    backgroundColor: '#14161a',
    title: 'Phasmo Helper',
    icon: path.join(__dirname, 'assets', 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });
  // 'screen-saver' seviyesi, kenarlıksız pencere modundaki oyunun da üstünde kalır.
  win.setAlwaysOnTop(true, 'screen-saver');
  applyOpacity();
  win.loadFile(path.join(__dirname, 'src', 'index.html'));

  // Dış bağlantılar (Hakkında / Kaynaklar) varsayılan tarayıcıda açılsın, uygulama içinde değil.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https:\/\//.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (e, url) => {
    if (!url.startsWith('file://')) { e.preventDefault(); if (/^https:\/\//.test(url)) shell.openExternal(url); }
  });

  win.on('close', () => {
    settings.bounds = win.getBounds();
    saveSettings();
  });
  win.on('closed', () => { win = null; });
}

// --- IPC ---
ipcMain.handle('settings:get', () => settings);

ipcMain.handle('settings:set', (_e, partial) => {
  const prevShortcuts = JSON.stringify(settings.shortcuts);
  settings = {
    ...settings,
    ...partial,
    shortcuts: { ...settings.shortcuts, ...(partial.shortcuts || {}) }
  };
  settings.opacity = clampOpacity(settings.opacity);
  applyOpacity();
  let failed = [];
  if (JSON.stringify(settings.shortcuts) !== prevShortcuts) failed = registerShortcuts();
  saveSettings();
  return { settings, failedShortcuts: failed };
});

// Kısayol düzenleme: tuş yakalanırken global kısayollar geçici olarak kapatılır,
// yoksa basılan tuş (ör. F8) arayüze ulaşmadan kısayolu tetikler.
ipcMain.handle('shortcuts:defaults', () => DEFAULT_SETTINGS.shortcuts);
ipcMain.handle('shortcuts:pause', () => { globalShortcut.unregisterAll(); return true; });
ipcMain.handle('shortcuts:resume', () => registerShortcuts());

ipcMain.handle('data:get', (_e, name) => {
  if (!ALLOWED_DATA.includes(name)) throw new Error('Bilinmeyen veri: ' + name);
  return readJson(path.join('data', name + '.json'));
});

ipcMain.handle('i18n:get', (_e, lang) => {
  if (!ALLOWED_LOCALES.includes(lang)) lang = 'tr';
  return readJson(path.join('i18n', lang + '.json'));
});

const PKG = readJson('package.json');
ipcMain.handle('app:info', () => ({ version: app.getVersion(), packaged: app.isPackaged, homepage: PKG.homepage || '', analytics: analytics.enabled() }));

ipcMain.on('window:hide', () => win && win.hide());
ipcMain.on('window:minimize', () => win && win.minimize());
ipcMain.on('app:quit', () => app.quit());

// --- Otomatik güncelleme (sessiz) ---
// GitHub Releases'teki en son sürümü kontrol eder, arka planda indirir,
// uygulama kapatılınca kurar. Bir sonraki açılışta "güncellendi" bildirimi gösterilir.
const UPDATE_CHECK_INTERVAL = 15 * 60 * 1000; // 15 dakika

// Arayüzün gösterdiği güncelleme durumu: idle | downloading | ready | installing
let updateState = { status: 'idle', version: null, percent: 0 };
let autoUpdaterRef = null;
function setUpdateState(patch) {
  updateState = { ...updateState, ...patch };
  sendToRenderer('update:state', updateState);
}
ipcMain.handle('update:get-state', () => updateState);
// "Şimdi güncelle": uygulamayı kapatır, sessizce kurar ve yeni sürümü kendiliğinden açar.
ipcMain.handle('update:install', () => {
  if (!autoUpdaterRef || updateState.status !== 'ready') return false;
  setUpdateState({ status: 'installing' });
  globalShortcut.unregisterAll();
  setImmediate(() => autoUpdaterRef.quitAndInstall(true, true));
  return true;
});

function setupAutoUpdate() {
  // Sürüm değiştiyse (güncelleme kurulduysa) arayüze bildir.
  const current = app.getVersion();
  if (settings.lastVersion && settings.lastVersion !== current) {
    win.webContents.once('did-finish-load', () => sendToRenderer('update:installed', current));
  }
  if (settings.lastVersion !== current) { settings.lastVersion = current; saveSettings(); }

  if (!app.isPackaged) return; // geliştirme sırasında güncelleme yok
  let autoUpdater;
  try {
    ({ autoUpdater } = require('electron-updater'));
  } catch (err) {
    console.warn('electron-updater yüklenemedi:', err.message);
    return;
  }
  autoUpdaterRef = autoUpdater;
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true; // düğmeye basılmazsa: uygulama kapanınca sessizce kurulur
  autoUpdater.on('update-available', info => setUpdateState({ status: 'downloading', version: info.version, percent: 0 }));
  autoUpdater.on('download-progress', p => setUpdateState({ status: 'downloading', percent: Math.round(p.percent || 0) }));
  autoUpdater.on('update-downloaded', info => setUpdateState({ status: 'ready', version: info.version, percent: 100 }));
  autoUpdater.on('error', err => {
    console.warn('Güncelleme hatası:', err && err.message);
    if (updateState.status === 'downloading') setUpdateState({ status: 'idle' }); // bir sonraki kontrolde yeniden denenir
  });
  const check = () => {
    if (updateState.status === 'ready' || updateState.status === 'installing') return; // zaten indirildi
    autoUpdater.checkForUpdates().catch(err => console.warn('Güncelleme kontrolü başarısız:', err.message));
  };
  check();
  setInterval(check, UPDATE_CHECK_INTERVAL);
}

// --- Uygulama yaşam döngüsü ---
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (win) { win.show(); win.focus(); }
  });

  app.whenReady().then(() => {
    settings = loadSettings();
    createWindow();
    registerShortcuts();
    setupAutoUpdate();
    analytics.start(() => settings.analytics !== false);
  });

  app.on('will-quit', () => globalShortcut.unregisterAll());
  app.on('window-all-closed', () => app.quit());
}
