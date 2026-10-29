// Kanıt takipçisi: kanıtları işaretle (bulundu / elendi), zorluğa göre kanıt sayısı seç,
// olası hayaletleri filtrele, hayaletleri elle ele, detaylarını aç.
App.register({
  id: 'evidence',
  STORAGE_KEY: 'evidenceState',

  async mount(panel, app) {
    this.panel = panel;
    this.app = app;
    const data = await app.loadGameData();
    this.evidence = data.evidence;
    this.ghosts = data.ghosts;
    this.state = this.loadState();
    this.expanded = null;
    app.on('speed', () => this.render());
    this.render();
  },

  defaultState() {
    return { count: 3, ev: {}, eliminated: [] }; // ev: { id: 'found' | 'out' }
  },
  loadState() {
    try {
      const s = JSON.parse(localStorage.getItem(this.STORAGE_KEY));
      if (s && typeof s.count === 'number') return { ...this.defaultState(), ...s };
    } catch {}
    return this.defaultState();
  },
  saveState() {
    try { localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.state)); } catch {}
  },
  // Yeni kontrat: kanıtlar, elenenler ve hız ölçümü birlikte sıfırlanır
  // (eski ölçüm yeni oyundaki hayaletleri yanlışlıkla soluk göstermesin).
  reset() {
    this.state = { ...this.defaultState(), count: this.state.count };
    this.expanded = null;
    this.saveState();
    this.app.emit('speed:clear');
    this.render();
  },

  // Tıklama: boş → bulundu → elendi → boş. Sağ tık: doğrudan elendi/boş.
  cycle(id, rightClick) {
    const cur = this.state.ev[id];
    let next;
    if (rightClick) next = cur === 'out' ? undefined : 'out';
    else next = !cur ? 'found' : cur === 'found' ? 'out' : undefined;
    if (next) this.state.ev[id] = next; else delete this.state.ev[id];
    this.saveState();
    this.render();
    return next;
  },

  toggleEliminated(id) {
    const list = this.state.eliminated;
    const i = list.indexOf(id);
    if (i >= 0) list.splice(i, 1); else list.push(id);
    this.saveState();
    this.render();
  },

  compute() {
    const found = Object.keys(this.state.ev).filter(k => this.state.ev[k] === 'found');
    const out = Object.keys(this.state.ev).filter(k => this.state.ev[k] === 'out');
    const possible = [], impossible = [];
    for (const g of this.ghosts) {
      const ok = GhostLogic.isPossible(g, found, out, this.state.count);
      if (ok && !this.state.eliminated.includes(g.id)) possible.push(g);
      else impossible.push({ ghost: g, manual: ok });
    }
    const remaining = GhostLogic.remainingEvidence(possible, found, this.state.count);
    const foundReal = found.length;
    return { found, out, possible, impossible, remaining, foundReal };
  },

  render() {
    const app = this.app;
    const t = k => app.esc(app.t(k));
    const { found, possible, impossible, remaining } = this.compute();

    const countBtns = [0, 1, 2, 3].map(n =>
      `<button data-count="${n}" class="${this.state.count === n ? 'active' : ''}">${n}</button>`).join('');

    const evRows = this.evidence.map(e => {
      const st = this.state.ev[e.id] || '';
      const dim = !st && !remaining.has(e.id) ? ' dim' : '';
      const icon = st === 'found' ? '✓' : st === 'out' ? '✕' : '';
      return `<button class="ev ${st}${dim}" data-ev="${e.id}">
        <span class="ev-icon">${icon}</span><span class="ev-name">${app.esc(app.pick(e.name))}</span></button>`;
    }).join('');

    const sp = app.speed;
    const fmt2 = n => n.toLocaleString(app.lang() === 'tr' ? 'tr-TR' : 'en-US', { maximumFractionDigits: 2, minimumFractionDigits: 2 });
    const speedOpts = { modifier: sp.modifier, bloodMoon: sp.bloodMoon };
    const ghostRow = (g, isOut, manual) => {
      const open = this.expanded === g.id;
      const spClass = sp.meas ? GhostLogic.classifySpeed(g, sp.meas, speedOpts) : null; // steady | reach | none
      const tags = g.evidence.map(id => {
        const ev = this.evidence.find(x => x.id === id);
        const cls = found.includes(id) ? 'hit' : this.state.ev[id] === 'out' ? 'miss' : '';
        return `<span class="mini ${cls}">${app.esc(app.pick(ev.short))}</span>`;
      }).join('');
      return `
        <li class="ghost ${isOut ? 'out' : ''} ${open ? 'open' : ''} ${spClass === 'none' ? 'speed-miss' : ''}">
          <div class="ghost-row">
            <button class="ghost-name" data-expand="${g.id}">${open ? '▾' : '▸'} ${app.esc(app.pick(g.name))}${spClass === 'steady' ? ' <span class="bolt" title="' + t('evidence.speedMatch') + '">⚡</span>' : ''}</button>
            <span class="ghost-tags">${tags}</span>
            ${(!isOut || manual) ? `<button class="elim" data-elim="${g.id}" title="${t(isOut ? 'evidence.restore' : 'evidence.eliminate')}">${isOut ? '↺' : '✕'}</button>` : '<span class="elim-placeholder"></span>'}
          </div>
          ${open ? app.renderGhostDetail(g, this.evidence) : ''}
        </li>`;
    };

    const note = this.state.count < 3
      ? `<p class="hint">${app.esc(app.t('evidence.reducedNote', { n: this.state.count }))}</p>` : '';

    this.panel.innerHTML = `
      <div class="ev-toolbar">
        <span class="muted">${t('evidence.count')}</span>
        <div class="seg">${countBtns}</div>
        <button class="link" id="ev-reset">${t('evidence.reset')}</button>
      </div>
      ${note}
      <div class="ev-grid">${evRows}</div>
      <p class="hint">${t('evidence.howTo')}</p>
      ${sp.value ? `<div class="speed-bar">⚡ ${app.esc(app.t('evidence.speedBar', { v: fmt2(sp.meas.speed), lo: fmt2(sp.meas.lo), hi: fmt2(sp.meas.hi) }))}
        <button class="link" id="ev-speed-clear">${t('evidence.speedClear')}</button></div>` : ''}
      <h3>${app.esc(app.t('evidence.possible', { n: possible.length }))}</h3>
      <ul class="ghost-list">${possible.map(g => ghostRow(g, false)).join('') || `<li class="muted">${t('evidence.none')}</li>`}</ul>
      ${impossible.length ? `
        <details class="out-list" ${this.outOpen ? 'open' : ''}>
          <summary>${app.esc(app.t('evidence.excluded', { n: impossible.length }))}</summary>
          <ul class="ghost-list">${impossible.map(x => ghostRow(x.ghost, true, x.manual)).join('')}</ul>
        </details>` : ''}`;

    this.bind();
  },

  bind() {
    const p = this.panel;
    p.querySelectorAll('[data-count]').forEach(b => b.onclick = () => {
      this.state.count = Number(b.dataset.count);
      this.saveState();
      this.render();
    });
    p.querySelectorAll('[data-ev]').forEach(b => {
      b.onclick = () => this.cycle(b.dataset.ev, false);
      b.oncontextmenu = e => { e.preventDefault(); this.cycle(b.dataset.ev, true); };
    });
    p.querySelectorAll('[data-expand]').forEach(b => b.onclick = () => {
      this.expanded = this.expanded === b.dataset.expand ? null : b.dataset.expand;
      this.render();
    });
    p.querySelectorAll('[data-elim]').forEach(b => b.onclick = () => this.toggleEliminated(b.dataset.elim));
    p.querySelector('#ev-reset').onclick = () => this.reset();
    const spClear = p.querySelector('#ev-speed-clear');
    if (spClear) spClear.onclick = () => this.app.emit('speed:clear');
    const det = p.querySelector('.out-list');
    if (det) det.ontoggle = () => { this.outOpen = det.open; };
  },

  // Numpad kısayolları: ev_<id> kanıtı döndürür, evReset kanıtları sıfırlar.
  onShortcut(action) {
    const app = this.app;
    if (action === 'evReset') {
      this.reset();
      app.beep(520, 120);
      app.toast(app.t('evidence.resetToast'));
      return;
    }
    if (!action.startsWith('ev_')) return;
    const id = action.slice(3);
    const ev = this.evidence.find(e => e.id === id);
    if (!ev) return;
    const next = this.cycle(id, false);
    app.beep(next === 'found' ? 990 : next === 'out' ? 440 : 660, 110);
    const mark = next === 'found' ? '✓' : next === 'out' ? '✕' : '—';
    app.toast(`${app.pick(ev.short)}: ${mark}`);
  },

  onLanguageChange() { this.render(); }
});
