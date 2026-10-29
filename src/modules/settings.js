// Ayarlar: dil, şeffaflık, ses, kısayol listesi. (Kısayolları değiştirme ekranı sonra eklenecek.)
App.register({
  id: 'settings',
  icon: '⚙',
  SOURCES: [
    ['Phasmophobia Wiki (Fandom, CC BY-SA 3.0)', 'https://phasmophobia.fandom.com/wiki/Phasmophobia_Wiki'],
    ['Phasmopedia (footstep formula by Zero Network)', 'https://phasmopedia.com/en/footsteps/'],
    ['Steam Community – Ghost Identification Guide', 'https://steamcommunity.com/sharedfiles/filedetails/?id=3635613545'],
    ['KeenGamer – Cursed Possessions Guide', 'https://www.keengamer.com/articles/guides/phasmophobia-all-cursed-possessions-guide-locations-effects-and-downsides/'],
    ['Kinetic Games – Patch notes', 'https://kineticgames.co.uk/']
  ],
  async mount(panel, app) {
    this.panel = panel;
    this.app = app;
    this.info = await window.api.getAppInfo();
    this.render();
  },
  render() {
    const s = this.app.settings;
    const rows = Object.entries(s.shortcuts)
      .map(([action, key]) => `<tr><td data-i18n="shortcuts.${action}"></td><td><kbd>${String(key).replace(/^num(\d)$/, 'Num $1')}</kbd></td></tr>`)
      .join('');

    this.panel.innerHTML = `
      <h2 data-i18n="tabs.settings"></h2>

      <div class="field">
        <label data-i18n="settings.language"></label>
        <select id="set-lang">
          <option value="tr">Türkçe</option>
          <option value="en">English</option>
        </select>
      </div>

      <div class="field">
        <label><span data-i18n="settings.opacity"></span> <span id="opacity-val"></span></label>
        <input type="range" id="set-opacity" min="0.3" max="1" step="0.05">
      </div>

      <div class="field">
        <div class="row">
          <label for="set-sound" data-i18n="settings.sound"></label>
          <input type="checkbox" id="set-sound">
        </div>
      </div>

      <div class="field">
        <label data-i18n="settings.shortcuts"></label>
        <table class="shortcut-list">${rows}</table>
        <p class="muted" data-i18n="settings.shortcutsNote"></p>
      </div>

      <div class="field about">
        <label data-i18n="about.title"></label>
        <p>Phasmo Helper <b>v${this.app.esc(this.info.version)}</b>${this.info.homepage ? ` · <a href="${this.app.esc(this.info.homepage)}" target="_blank" data-i18n="about.project"></a>` : ''}</p>
        <p class="muted" data-i18n="about.disclaimer"></p>
        <p class="muted" data-i18n="about.sources"></p>
        <ul class="about-links">${this.SOURCES.map(([n, u]) => `<li><a href="${u}" target="_blank">${this.app.esc(n)}</a></li>`).join('')}</ul>
        <p class="muted" data-i18n="about.updates"></p>
      </div>`;

    const lang = this.panel.querySelector('#set-lang');
    const opacity = this.panel.querySelector('#set-opacity');
    const sound = this.panel.querySelector('#set-sound');
    lang.value = s.language;
    opacity.value = s.opacity;
    sound.checked = s.sound;
    this.updateOpacityLabel();

    lang.onchange = async () => {
      await this.save({ language: lang.value });
      await this.app.setLanguage(lang.value);
    };
    opacity.oninput = () => this.save({ opacity: Number(opacity.value) });
    sound.onchange = () => this.save({ sound: sound.checked });

    this.app.translateDom(this.panel);
  },
  async save(partial) {
    const res = await window.api.setSettings(partial);
    this.app.settings = res.settings;
    this.updateOpacityLabel();
  },
  updateOpacityLabel() {
    const el = this.panel.querySelector('#opacity-val');
    if (el) el.textContent = Math.round(this.app.settings.opacity * 100) + '%';
  },
  onLanguageChange() { this.render(); },
  onSettingsChanged() { this.render(); } // örn. Ctrl+F8 / Shift+F8 ile şeffaflık değişince
});
