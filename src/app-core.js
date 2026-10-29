// Ortak yardımcılar: modül kaydı, çeviri, bildirim, ses.
window.App = {
  modules: [],      // { id, mount(panelEl, ctx), onShortcut?(action), onLanguageChange?() }
  settings: null,
  strings: {},

  register(mod) { this.modules.push(mod); },

  // Modüller arası basit olay sistemi (ör. hız ölçer → kanıt takipçisi).
  _listeners: {},
  on(name, fn) { (this._listeners[name] = this._listeners[name] || []).push(fn); },
  emit(name, payload) { (this._listeners[name] || []).forEach(fn => fn(payload)); },

  // Hız ölçerin paylaşılan sonucu. value: m/s (yoksa null).
  speed: { value: null, modifier: 1, los: false },

  // Oyun verisini bir kez yükler, modüller paylaşır.
  async loadGameData() {
    if (!this._gameData) {
      this._gameData = Promise.all([window.api.getData('evidence'), window.api.getData('ghosts')])
        .then(([ev, gh]) => ({ evidence: ev.evidence, ghosts: gh.ghosts }));
    }
    return this._gameData;
  },

  lang() { return (this.settings && this.settings.language) || 'tr'; },

  // {tr, en} nesnesinden geçerli dildeki değeri seçer.
  pick(obj) { return obj ? (obj[this.lang()] ?? obj.en) : ''; },

  esc(s) {
    return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  },

  // Hayalet detay kartı (kanıt takipçisi ve ansiklopedi ortak kullanır).
  renderGhostDetail(ghost, evidenceList) {
    const evName = id => this.pick(evidenceList.find(e => e.id === id).short);
    const tags = ghost.evidence.map(id =>
      `<span class="tag${ghost.forced === id ? ' forced' : ''}" title="${ghost.forced === id ? this.esc(this.t('ghost.forcedHint')) : ''}">${this.esc(evName(id))}${ghost.forced === id ? ' ★' : ''}</span>`
    ).join('');
    const fake = ghost.fakeEvidence
      ? `<span class="tag fake" title="${this.esc(this.t('ghost.fakeHint'))}">+${this.esc(evName(ghost.fakeEvidence))}</span>` : '';
    const list = (items, cls) => items.length
      ? `<ul class="${cls}">${items.map(i => `<li>${this.esc(i)}</li>`).join('')}</ul>` : '';
    const rulesOut = this.pick(ghost.rulesOut) || [];
    return `
      <div class="ghost-detail">
        <div class="tags">${tags}${fake}</div>
        <dl>
          <dt>${this.esc(this.t('ghost.hunt'))}</dt><dd>${this.esc(this.pick(ghost.hunt))}</dd>
          <dt>${this.esc(this.t('ghost.speed'))}</dt><dd>${this.esc(this.pick(ghost.speed))}</dd>
        </dl>
        ${list(this.pick(ghost.tells) || [], 'tells')}
        ${rulesOut.length ? `<div class="rules-out-title">${this.esc(this.t('ghost.rulesOut'))}</div>${list(rulesOut, 'rules-out')}` : ''}
      </div>`;
  },

  // "a.b.c" anahtarından çeviri; yoksa anahtarın kendisi döner. {x} yer tutucuları desteklenir.
  t(key, vars = {}) {
    const val = key.split('.').reduce((o, k) => (o && o[k] !== undefined ? o[k] : undefined), this.strings);
    const str = typeof val === 'string' ? val : key;
    return str.replace(/\{(\w+)\}/g, (_, k) => (vars[k] !== undefined ? vars[k] : `{${k}}`));
  },

  // data-i18n ve data-i18n-title özniteliklerini çevirir.
  translateDom(root = document) {
    root.querySelectorAll('[data-i18n]').forEach(el => { el.textContent = this.t(el.dataset.i18n); });
    root.querySelectorAll('[data-i18n-title]').forEach(el => { el.title = this.t(el.dataset.i18nTitle); });
  },

  toast(msg, ms = 1500) {
    const el = document.getElementById('toast');
    el.textContent = msg;
    el.hidden = false;
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => { el.hidden = true; }, ms);
  },

  // Kısa bip; ayarlardan ses kapalıysa çalmaz.
  beep(freq = 880, ms = 150) {
    if (!this.settings || !this.settings.sound) return;
    try {
      this._audio = this._audio || new AudioContext();
      const osc = this._audio.createOscillator();
      const gain = this._audio.createGain();
      osc.frequency.value = freq;
      gain.gain.value = 0.15;
      osc.connect(gain).connect(this._audio.destination);
      osc.start();
      osc.stop(this._audio.currentTime + ms / 1000);
    } catch (err) {
      console.warn('Ses çalınamadı', err);
    }
  }
};
