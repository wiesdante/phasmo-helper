// Hız ölçer: her ayak sesinde kısayola bas (ya da alana tıkla) → adım/dk ve m/s (belirsizlik aralığıyla).
// Sonuç üç seviyede yorumlanır: sabit hızıyla uyuyor / sadece kovalama-geçiş sırasında çıkabilir / hiç çıkamaz.
// Kanıt takipçisinde: ⚡ sabit hızla uyanlar, soluk olanlar bu hıza hiç çıkamayanlar.
App.register({
  id: 'speed',
  STORAGE_KEY: 'speedOptions',
  MAX_TAPS: 10,        // son 10 vuruş (9 aralık) kullanılır
  RESET_GAP: 3000,     // 3 sn vuruş olmazsa yeni ölçüm başlar
  MODIFIERS: [0.5, 0.75, 1, 1.25, 1.5],
  REFERENCE: [
    [1.0, 'Revenant'], [1.2, 'Dayan'], [1.36, 'Gallu'], [1.45, 'Obambo'], [1.53, 'Aswang, Twins'],
    [1.7, 'standard'], [1.87, 'Twins'], [1.96, 'Gallu, Obambo'], [2.21, 'Kormos'], [2.25, 'Dayan, Moroi'],
    [2.5, 'Jinn, Raiju, Hantu'], [2.75, 'Thaye'], [2.8, 'chase'], [3.0, 'Revenant, Deogen, Deildegast']
  ],

  async mount(panel, app) {
    this.panel = panel;
    this.app = app;
    const data = await app.loadGameData();
    this.ghosts = data.ghosts;
    this.taps = [];
    try {
      const o = JSON.parse(localStorage.getItem(this.STORAGE_KEY));
      if (o) { app.speed.modifier = o.modifier || 1; app.speed.bloodMoon = !!o.bloodMoon; }
    } catch {}
    app.on('speed:clear', () => this.reset());
    this.render();
  },

  saveOptions() {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify({ modifier: this.app.speed.modifier, bloodMoon: this.app.speed.bloodMoon }));
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

  update() {
    const m = GhostLogic.measureTaps(this.taps);
    this.app.speed.value = m ? m.speed : null;
    this.app.speed.meas = m;
    this.app.emit('speed', this.app.speed);
    this.renderResult(m);
  },

  fmt(n, d = 2) {
    return n.toLocaleString(this.app.lang() === 'tr' ? 'tr-TR' : 'en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
  },

  opts() { return { modifier: this.app.speed.modifier, bloodMoon: this.app.speed.bloodMoon }; },

  render() {
    const app = this.app;
    const t = k => app.esc(app.t(k));
    const k = app.speed.modifier * (app.speed.bloodMoon ? GhostLogic.BLOOD_MOON : 1);
    const mods = this.MODIFIERS.map(v =>
      `<button data-mod="${v}" class="${app.speed.modifier === v ? 'active' : ''}">${v * 100}</button>`).join('');
    const who = w => w === 'standard' ? t('speed.standard') : w === 'chase' ? t('speed.chaseMax') : app.esc(w);
    const ref = this.REFERENCE.map(([s, w]) =>
      `<tr><td>${this.fmt(s * k)} m/s</td><td>${Math.round(GhostLogic.stepsPerMinute(s * k))}</td><td class="muted">${who(w)}</td></tr>`).join('');

    this.panel.innerHTML = `
      <button class="speed-pad" id="sp-pad">
        <span class="sp-value" id="sp-value">— m/s</span>
        <span class="sp-sub" id="sp-sub"></span>
        <span class="sp-hint">${app.esc(app.t('speed.tapHint', { key: app.key('speedTap') }))}</span>
      </button>
      <div class="row sp-actions">
        <button class="link no-push" id="sp-reset">${app.esc(app.t('speed.reset', { key: app.key('speedReset') }))}</button>
      </div>
      <p class="sp-warn" id="sp-warn" hidden></p>

      <div id="sp-results"></div>

      <details class="sp-ref" ${this.howOpen ? 'open' : ''} id="sp-how">
        <summary>${t('speed.howTitle')}</summary>
        <ul class="sp-how">
          <li>${t('speed.how1')}</li>
          <li>${t('speed.how2')}</li>
          <li>${t('speed.how3')}</li>
          <li>${t('speed.how4')}</li>
        </ul>
      </details>

      <div class="field sp-settings">
        <label>${t('speed.modifier')}</label>
        <div class="seg seg-wide">${mods}</div>
      </div>
      <label class="check"><input type="checkbox" id="sp-blood" ${app.speed.bloodMoon ? 'checked' : ''}> ${t('speed.bloodMoon')}</label>

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
    this.panel.querySelector('#sp-blood').onchange = e => {
      app.speed.bloodMoon = e.target.checked;
      this.saveOptions();
      this.render();
      this.update();
    };
    const how = this.panel.querySelector('#sp-how');
    how.ontoggle = () => { this.howOpen = how.open; };
    this.renderResult(GhostLogic.measureTaps(this.taps));
  },

  renderResult(m) {
    const app = this.app;
    const val = this.panel.querySelector('#sp-value');
    if (!val) return;
    const sub = this.panel.querySelector('#sp-sub');
    const warn = this.panel.querySelector('#sp-warn');
    const results = this.panel.querySelector('#sp-results');
    const n = this.taps.length;

    if (!m) {
      val.textContent = '— m/s';
      sub.textContent = n ? app.t('speed.needMore', { n: 3 - n }) : '';
      warn.hidden = true;
      results.innerHTML = '';
      return;
    }
    val.textContent = `${this.fmt(m.speed)} m/s`;
    sub.textContent = app.t('speed.detail', {
      spm: Math.round(m.spm), n, lo: this.fmt(m.lo), hi: this.fmt(m.hi)
    });
    warn.hidden = !m.irregular;
    warn.textContent = m.irregular ? app.t('speed.irregular') : '';

    const groups = { steady: [], reach: [], none: [] };
    for (const g of this.ghosts) groups[GhostLogic.classifySpeed(g, m, this.opts())].push(g);
    const byName = (a, b) => app.pick(a.name).localeCompare(app.pick(b.name));
    const list = (arr, withSpeed) => arr.sort(byName).map(g => withSpeed
      ? `<div class="sp-ghost"><b>${app.esc(app.pick(g.name))}</b><span class="muted">${app.esc(app.pick(g.speed))}</span></div>`
      : app.esc(app.pick(g.name))).join(withSpeed ? '' : ', ');

    results.innerHTML = `
      <h3>⚡ ${app.esc(app.t('speed.steadyTitle', { n: groups.steady.length }))}</h3>
      <p class="hint">${app.esc(app.t('speed.steadyHint'))}</p>
      <div class="sp-matches">${list(groups.steady, true) || `<span class="muted">—</span>`}</div>
      <h3>${app.esc(app.t('speed.reachTitle', { n: groups.reach.length }))}</h3>
      <p class="hint">${app.esc(app.t('speed.reachHint'))}</p>
      <p class="sp-names">${list(groups.reach, false) || '—'}</p>
      <h3 class="muted">${app.esc(app.t('speed.noneTitle', { n: groups.none.length }))}</h3>
      <p class="sp-names muted">${list(groups.none, false) || '—'}</p>`;
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
