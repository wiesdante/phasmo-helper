// İsimsiz kullanım sayacı (Aptabase).
// Uygulama açıldığında ve açık kaldığı her yeni günde tek bir "app_started" / "app_active" olayı gönderir.
// Gönderilenler: uygulama sürümü, işletim sistemi sürümü, dil. Kimlik, IP kaydı, oyun bilgisi gönderilmez.
// Ayarlar > "İsimsiz kullanım sayısı gönder" kapatılırsa hiçbir şey gönderilmez.
const { app, net } = require('electron');
const os = require('os');

// Aptabase'deki uygulamanın anahtarı (gizli değildir). Boşsa sayaç tamamen kapalıdır.
const APP_KEY = 'A-EU-4105065415';

const HOSTS = { EU: 'https://eu.aptabase.com', US: 'https://us.aptabase.com' };
const DAY_CHECK_INTERVAL = 60 * 60 * 1000; // saatte bir: gün değiştiyse bir olay daha

const newSessionId = () =>
  Math.floor(Date.now() / 1000).toString() + Math.floor(Math.random() * 1e8).toString().padStart(8, '0');

function endpoint() {
  const region = APP_KEY.split('-')[1];
  return HOSTS[region] ? `${HOSTS[region]}/api/v0/event` : null;
}

function send(eventName) {
  const url = endpoint();
  if (!url) return;
  const body = {
    timestamp: new Date().toISOString(),
    sessionId: newSessionId(),
    eventName,
    systemProps: {
      isDebug: !app.isPackaged,
      locale: app.getLocale(),
      osName: process.platform === 'win32' ? 'Windows' : process.platform,
      osVersion: os.release(),
      engineName: 'Chromium',
      engineVersion: process.versions.chrome,
      appVersion: app.getVersion(),
      sdkVersion: 'phasmo-helper@1'
    }
  };
  try {
    const req = net.request({ method: 'POST', url, credentials: 'omit' });
    req.setHeader('Content-Type', 'application/json');
    req.setHeader('App-Key', APP_KEY);
    req.on('error', () => {});   // çevrimdışıysa sessizce vazgeç
    req.on('response', () => {});
    req.end(JSON.stringify(body));
  } catch {}
}

// isEnabled: ayarı her seferinde okuyan fonksiyon (kullanıcı kapatırsa hemen etkili olsun).
function start(isEnabled) {
  if (!endpoint() || !app.isPackaged) return; // geliştirme sırasında sayma
  const today = () => new Date().toISOString().slice(0, 10);
  let lastDay = today();
  if (isEnabled()) send('app_started');
  setInterval(() => {
    if (today() === lastDay) return;
    lastDay = today();
    if (isEnabled()) send('app_active');
  }, DAY_CHECK_INTERVAL);
}

module.exports = { start, enabled: () => !!endpoint() };
