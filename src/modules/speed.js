// Hız ölçer: her ayak sesinde F6'ya bas (ya da alana tıkla) → adım/dk ve m/s.
// Sonuç kanıt takipçisinde vurgulanır (uyan hayaletler ⚡, uymayanlar soluk).
App.register({
  id: 'speed',
  STORAGE_KEY: 'speedOptions',
  MAX_TAPS: 10,        // son 10 vuruş (9 aralık) kullanılır
  RESET_GAP: 3000,     // 3 sn vuruş olmazsa yeni ölçüm başlar
  MODIFIERS: [0.5, 0.75, 1, 1.25, 1.5],
  REFERENCE: [
    [1.0, 'Revenant'], [1.2, 'Dayan'], [1.36, 'Gallu'], [1.45, 'Obambo'], [1.53, 'Aswang, Twins'],
    [1.7, 'standard'], [1.87, 'Twins'], [1.96, 'Gallu, Obambo'], [2.21, 'Kormos'], [2.25, 'Dayan, Moroi'],
    [2.5, 'Jinn, Raiju, Hantu'], [2.75, 'Thaye'], [3.0, 'Revenant, Deogen, Deildegast']
  ],

  async mount(panel, app) {
    this.panel = panel;
    this.app = app;
    const data = await app.loadGameData();
    this.ghosts = data.ghosts;
    this.taps = [];
    try {
      const o = JSON.parse(localStorage.getItem(this.STORAGE_KEY));
      if (o) { app.speed.modifier = o.modifier || 1; app.speed.los = !!o.los; }
    } catch {}
    app.on('speed:clear', () => this.reset());
    this.render();
  },

  saveOptions() {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify({ modifier: this.app.speed.modifier, los: this.app.speed.los }));
    } catch {}
  },

  tap() {
    const now = performance.now();
    const last = this.taps[this.taps.length - 1];
    if (last && now - last > this.RESET_GAP) this.taps = [];
    this.taps.push(now);
    if (this.taps.length > this.MAX_TAPS) this.taps.shift();
    this.update();
  },

  reset() {
    this.taps = [];
    this.update();
  },

  // Aralıkların medyanı: tek bir kaçırılmış/fazla vuruş sonucu bozmasın.
  measure() {
    if (this.taps.length < 3) return null;
    const iv = [];
    for (let i = 1; i < this.taps.length; i++) iv.push((this.taps[i] - this.taps[i - 1]) / 1000);
    iv.sort((a, b) => a - b);
    const mid = Math.floor(iv.length / 2);
    const median = iv.length % 2 ? iv[mid] : (iv[mid - 1] + iv[mid]) / 2;
    return { interval: median, spm: 60 / median, speed: GhostLogic.speedFromInterval(median) };
  },

  update() {
    const m = this.measure();
    this.app.speed.value = m ? m.speed : null;
    this.app.emit('speed', this.app.speed);
    this.renderResult(m);
  },

  fmt(n, d = 2) {
    return n.toLocaleString(this.app.lang() === 'tr' ? 'tr-TR' : 'en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
  },

  render() {
    const app = this.app;
    const t = k => app.esc(app.t(k));
    const mods = this.MODIFIERS.map(v =>
      `<button data-mod="${v}" class="${app.speed.modifier === v ? 'active' : ''}">${v * 100}</button>`).join('');
    const ref = this.REFERENCE.map(([s, who]) =>
      `<tr><td>${this.fmt(s)} m/s</td><td>${Math.round(GhostLogic.stepsPerMinute(s * app.speed.modifier))}</td><td class="muted">${who === 'standard' ? t('speed.standard') : app.esc(who)}</td></tr>`).join('');

    this.panel.innerHTML = `
      <button class="speed-pad" id="sp-pad">
        <span class="sp-value" id="sp-value">— m/s</span>
        <span class="sp-sub" id="sp-sub"></span>
        <span class="sp-hint">${app.esc(app.t('speed.tapHint', { key: app.key('speedTap') }))}</span>
      </button>
      <div class="row sp-actions">
        <button class="link no-push" id="sp-reset">${app.esc(app.t('speed.reset', { key: app.key('speedReset') }))}</button>
      </div>

      <div class="field">
        <label>${t('speed.modifier')}</label>
        <div class="seg seg-wide">${mods}</div>
      </div>
      <label class="check"><input type="checkbox" id="sp-los" ${app.speed.los ? 'checked' : ''}> ${t('speed.los')}</label>
      <p class="hint">${t('speed.losHint')}</p>

      <h3 id="sp-match-title"></h3>
      <div id="sp-matches" class="sp-matches"></div>

      <details class="sp-ref">
        <summary>${t('speed.refTitle')}</summary>
        <table class="ref-table"><tr><th>m/s</th><th>${t('speed.spm')}</th><th></th></tr>${ref}</table>
      </details>`;

    const pad = this.panel.querySelector('#sp-pad');
    pad.onmousedown = e => { e.preventDefault(); this.tap(); };
    this.panel.querySelector('#sp-reset').onclick = () => this.reset();
    this.panel.querySelectorAll('[data-mod]').forEach(b => b.onclick = () => {
      app.speed.modifier = Number(b.dataset.mod);
      this.saveOptions();
      this.render();
      this.update();
    });
    this.panel.querySelector('#sp-los').onchange = e => {
      app.speed.los = e.target.checked;
      this.saveOptions();
      this.update();
    };
    this.renderResult(this.measure());
  },

  renderResult(m) {
    const app = this.app;
    const val = this.panel.querySelector('#sp-value');
    if (!val) return;
    const sub = this.panel.querySelector('#sp-sub');
    const title = this.panel.querySelector('#sp-match-title');
    const list = this.panel.querySelector('#sp-matches');
    const n = this.taps.length;

    if (!m) {
      val.textContent = '— m/s';
      sub.textContent = n ? app.t('speed.needMore', { n: 3 - n }) : '';
      title.textContent = '';
      list.innerHTML = '';
      return;
    }
    val.textContent = `${this.fmt(m.speed)} m/s`;
    sub.textContent = app.t('speed.detail', { spm: Math.round(m.spm), n });

    const opts = { modifier: app.speed.modifier, los: app.speed.los };
    const matches = this.ghosts.filter(g => GhostLogic.speedMatches(g, m.speed, opts));
    title.textContent = app.t('speed.matches', { n: matches.length });
    list.innerHTML = matches
      .sort((a, b) => app.pick(a.name).localeCompare(app.pick(b.name)))
      .map(g => `<div class="sp-ghost"><b>${app.esc(app.pick(g.name))}</b><span class="muted">${app.esc(app.pick(g.speed))}</span></div>`)
      .join('');
  },

  onShortcut(action) {
    if (action === 'speedTap') this.tap();
    if (action === 'speedReset') {
      this.reset();
      this.app.toast(this.app.t('speed.resetToast'));
    }
  },

  onLanguageChange() { this.render(); }
});
