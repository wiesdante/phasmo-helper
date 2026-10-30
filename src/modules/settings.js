// Ayarlar: dil, şeffaflık, ses, düzenlenebilir kısayollar, hakkında.
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
  failed: [],     // kaydedilemeyen (başka uygulamanın kullandığı) kısayol eylemleri
  capturing: null, // tuşu yakalanan eylem

  render() {
    const s = this.app.settings;
    const e = v => this.app.esc(v);
    const rows = Object.entries(s.shortcuts)
      .map(([action, key]) => {
        const bad = this.failed.includes(action);
        return `<tr><td data-i18n="shortcuts.${action}"></td>
          <td><button class="key-btn ${key ? '' : 'empty'} ${bad ? 'bad' : ''}" data-edit="${action}"
            ${bad ? `title="${e(this.app.t('shortcutEditor.failedOne'))}"` : ''}>${bad ? '⚠ ' : ''}${e(key ? ShortcutKeys.format(key) : '—')}</button></td></tr>`;
      })
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
${this.info.analytics ? `
      <div class="field">
        <div class="row">
          <label for="set-analytics" data-i18n="settings.analytics"></label>
          <input type="checkbox" id="set-analytics">
        </div>
        <p class="hint" data-i18n="settings.analyticsHint"></p>
      </div>` : ''}

      <div class="field">
        <label data-i18n="settings.shortcuts"></label>
        <p class="hint" data-i18n="shortcutEditor.hint"></p>
        <table class="shortcut-list">${rows}</table>
        <p class="sc-status" id="sc-status"></p>
        <button class="link no-push" id="sc-reset" data-i18n="shortcutEditor.reset"></button>
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
    const analytics = this.panel.querySelector('#set-analytics');
    if (analytics) {
      analytics.checked = s.analytics !== false;
      analytics.onchange = () => this.save({ analytics: analytics.checked });
    }

    this.panel.querySelectorAll('[data-edit]').forEach(b => b.onclick = () => this.startCapture(b.dataset.edit));
    this.panel.querySelector('#sc-reset').onclick = () => this.resetShortcuts();

    this.app.translateDom(this.panel);
    if (this.failed.length) {
      const names = this.failed.map(a => this.app.t(`shortcuts.${a}`)).join(', ');
      this.setStatus(this.app.t('shortcutEditor.failed', { list: names }), 'warn');
    }
  },

  setStatus(msg, kind = '') {
    const el = this.panel.querySelector('#sc-status');
    if (!el) return;
    el.textContent = msg || '';
    el.className = 'sc-status ' + kind;
  },

  // --- Kısayol yakalama ---
  async startCapture(action) {
    if (this.capturing) this.stopCapture();
    this.capturing = action;
    await window.api.pauseShortcuts();   // yoksa basılan kısayol arayüze ulaşmaz
    const btn = this.panel.querySelector(`[data-edit="${action}"]`);
    if (btn) { btn.textContent = this.app.t('shortcutEditor.press'); btn.classList.add('capturing'); }
    this.setStatus('');
    this._onKey = ev => this.onCaptureKey(ev);
    this._onBlur = () => this.finishCapture(null, { cancel: true });
    window.addEventListener('keydown', this._onKey, true);
    window.addEventListener('blur', this._onBlur);
  },

  stopCapture() {
    window.removeEventListener('keydown', this._onKey, true);
    window.removeEventListener('blur', this._onBlur);
    this.capturing = null;
  },

  onCaptureKey(ev) {
    ev.preventDefault();
    ev.stopPropagation();
    if (ev.code === 'Escape') return this.finishCapture(null, { cancel: true });
    if (ev.code === 'Backspace') return this.finishCapture('');
    const r = ShortcutKeys.fromEvent(ev);
    if (r.modifierOnly) return;                       // ana tuşu bekle
    if (r.unsupported) { this.setStatus(this.app.t('shortcutEditor.unsupported'), 'warn'); return; }
    this.finishCapture(r.accel);
  },

  async finishCapture(accel, { cancel = false } = {}) {
    const action = this.capturing;
    if (!action) return;
    this.stopCapture();
    const app = this.app;
    const name = app.t(`shortcuts.${action}`);
    let msg = '', kind = '';

    if (!cancel) {
      const change = { [action]: accel };
      // Aynı tuş başka bir eylemdeyse oradan kaldır.
      const other = accel && Object.keys(app.settings.shortcuts)
        .find(a => a !== action && app.settings.shortcuts[a] === accel);
      if (other) change[other] = '';
      await this.save({ shortcuts: change });

      if (!accel) msg = app.t('shortcutEditor.cleared', { name });
      else {
        msg = app.t('shortcutEditor.saved', { name, key: ShortcutKeys.format(accel) });
        if (other) msg += ' ' + app.t('shortcutEditor.moved', { key: ShortcutKeys.format(accel), other: app.t(`shortcuts.${other}`) });
        if (ShortcutKeys.isRisky(accel)) { msg += ' ' + app.t('shortcutEditor.risky', { key: ShortcutKeys.format(accel) }); kind = 'warn'; }
      }
    }
    this.failed = await window.api.resumeShortcuts() || [];
    this.render();
    this.app.modules.forEach(m => m !== this && m.onLanguageChange && m.onLanguageChange()); // kısayol ipuçlarını güncelle
    if (msg && !this.failed.includes(action)) { this.setStatus(msg, kind); app.toast(msg, kind ? 5000 : 2500); }
  },

  async resetShortcuts() {
    if (this.capturing) this.stopCapture();
    const defaults = await window.api.getDefaultShortcuts();
    await this.save({ shortcuts: defaults });
    this.failed = await window.api.resumeShortcuts() || [];
    this.render();
    this.app.modules.forEach(m => m !== this && m.onLanguageChange && m.onLanguageChange());
    if (!this.failed.length) this.setStatus(this.app.t('shortcutEditor.resetDone'));
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
  onSettingsChanged() { if (!this.capturing) this.render(); } // örn. kısayolla şeffaflık değişince
});
