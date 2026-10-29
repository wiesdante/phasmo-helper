// Uygulamayı başlatır: ayarlar → dil → sekmeler → modüller → kısayollar.
(async function init() {
  const App = window.App;
  App.settings = await window.api.getSettings();
  App.strings = await window.api.getLocale(App.settings.language);

  const tabsEl = document.getElementById('tabs');
  const panelsEl = document.getElementById('panels');

  // Her modül için bir sekme ve panel oluştur.
  for (const mod of App.modules) {
    const btn = document.createElement('button');
    btn.dataset.tab = mod.id;
    if (mod.icon) {                       // simgeli sekme (ör. Ayarlar ⚙): metin ipucu olarak
      btn.textContent = mod.icon;
      btn.classList.add('icon-tab');
      btn.dataset.i18nTitle = `tabs.${mod.id}`;
    } else {
      btn.dataset.i18n = `tabs.${mod.id}`;
    }
    tabsEl.appendChild(btn);

    const panel = document.createElement('section');
    panel.className = 'panel';
    panel.id = `panel-${mod.id}`;
    panel.hidden = true;
    panelsEl.appendChild(panel);
    mod.mount(panel, App);
  }

  function showTab(id) {
    tabsEl.querySelectorAll('button').forEach(b => b.classList.toggle('active', b.dataset.tab === id));
    panelsEl.querySelectorAll('.panel').forEach(p => { p.hidden = p.id !== `panel-${id}`; });
    try { localStorage.setItem('lastTab', id); } catch {}
  }
  tabsEl.addEventListener('click', e => { if (e.target.dataset.tab) showTab(e.target.dataset.tab); });

  let lastTab = null;
  try { lastTab = localStorage.getItem('lastTab'); } catch {}
  showTab(App.modules.some(m => m.id === lastTab) ? lastTab : App.modules[0].id);

  App.translateDom();

  // Dil değişince tüm arayüzü yeniden çevir.
  App.setLanguage = async (lang) => {
    App.strings = await window.api.getLocale(lang);
    document.documentElement.lang = lang;
    App.translateDom();
    App.modules.forEach(m => m.onLanguageChange && m.onLanguageChange());
  };

  // Pencere düğmeleri
  document.getElementById('btn-min').onclick = () => window.api.minimize();
  document.getElementById('btn-hide').onclick = () => window.api.hide();
  document.getElementById('btn-quit').onclick = () => window.api.quit();

  // Global kısayollar ana süreçten gelir; ilgili modüle iletilir.
  window.api.onShortcut(action => {
    App.modules.forEach(m => m.onShortcut && m.onShortcut(action));
  });

  // Otomatik güncelleme bildirimleri
  window.api.onUpdateReady(v => App.toast(App.t('update.ready', { v }), 6000));
  window.api.onUpdateInstalled(v => App.toast(App.t('update.installed', { v }), 6000));

  window.api.onSettingsChanged(s => {
    App.settings = s;
    App.modules.forEach(m => m.onSettingsChanged && m.onSettingsChanged(s));
  });
})();
