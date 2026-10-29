// Zamanlayıcılar:
//  1) Tütsü (F9): tütsüden sonra geçen süre; 60 sn Demon, 90 sn normal, 180 sn Spirit eşikleri.
//  2) Av (F10): avın başında bas → av süresi geri sayımı, bitince avlar arası bekleme (25 sn, Demon 20 sn).
//     Av sırasında tekrar basarsan "av bitti" sayılır ve bekleme hemen başlar.
App.register({
  id: 'timers',
  STORAGE_KEY: 'timerOptions',
  // Av süresi (grace hariç), sn: [küçük, orta, büyük]
  HUNT_DURATION: {
    amateur: [15, 30, 40], intermediate: [20, 40, 50],
    professional: [30, 50, 60], nightmare: [30, 50, 60], insanity: [30, 50, 60]
  },
  GRACE: { amateur: 5, intermediate: 4, professional: 3, nightmare: 2, insanity: 2 },
  CURSED_EXTRA: 20,
  COOLDOWN: 25, COOLDOWN_DEMON: 20,
  INCENSE_MARKS: [
    { at: 60, key: 'demon' }, { at: 90, key: 'normal' }, { at: 180, key: 'spirit' }
  ],

  mount(panel, app) {
    this.panel = panel;
    this.app = app;
    this.opts = { difficulty: 'professional', size: 1, cursed: false };
    try { Object.assign(this.opts, JSON.parse(localStorage.getItem(this.STORAGE_KEY)) || {}); } catch {}
    this.incense = null;   // { start }
    this.hunt = null;      // { phase: 'hunt'|'cooldown', start, end }
    this.lastHuntNote = '';
    app.on('timers:setSize', i => { this.opts.size = i; this.saveOpts(); this.render(); });
    this.render();
    this.timer = setInterval(() => this.tick(), 200);
  },

  saveOpts() { try { localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.opts)); } catch {} },

  huntLength() {
    const d = this.opts.difficulty;
    return this.GRACE[d] + this.HUNT_DURATION[d][this.opts.size] + (this.opts.cursed ? this.CURSED_EXTRA : 0);
  },

  // --- Eylemler ---
  startIncense() {
    this.incense = { start: Date.now(), fired: {} };
    this.app.beep(880, 100);
    this.render();
  },
  stopIncense() { this.incense = null; this.render(); },

  huntButton() {
    const now = Date.now();
    if (this.hunt && this.hunt.phase === 'hunt') {
      this.startCooldown(now);          // av erken bitti
      return;
    }
    // Yeni av başladı: tütsü sayacı çalışıyorsa yorumla.
    if (this.incense) {
      const s = Math.floor((now - this.incense.start) / 1000);
      this.lastHuntNote = this.app.t(
        s < 60 ? 'timers.noteUnder60' : s < 90 ? 'timers.noteUnder90' : s < 180 ? 'timers.noteUnder180' : 'timers.noteOver180',
        { s });
      this.incense = null;
    } else {
      this.lastHuntNote = '';
    }
    this.hunt = { phase: 'hunt', start: now, end: now + this.huntLength() * 1000 };
    this.app.beep(660, 150);
    this.render();
  },
  startCooldown(now) {
    this.hunt = { phase: 'cooldown', start: now, end: now + this.COOLDOWN * 1000, demonBeeped: false };
    this.app.beep(520, 120);
    this.render();
  },
  stopHunt() { this.hunt = null; this.render(); },

  // --- Döngü ---
  tick() {
    const now = Date.now();
    if (this.incense) {
      const s = (now - this.incense.start) / 1000;
      for (const m of this.INCENSE_MARKS) {
        if (s >= m.at && !this.incense.fired[m.at]) {
          this.incense.fired[m.at] = true;
          this.app.beep(m.at === 90 ? 990 : 760, 180);
          this.app.toast(this.app.t(`timers.incense.${m.key}`));
        }
      }
    }
    if (this.hunt) {
      if (this.hunt.phase === 'hunt' && now >= this.hunt.end) {
        this.startCooldown(this.hunt.end);
        return;
      }
      if (this.hunt.phase === 'cooldown') {
        const s = (now - this.hunt.start) / 1000;
        if (s >= this.COOLDOWN_DEMON && !this.hunt.demonBeeped) { this.hunt.demonBeeped = true; this.app.beep(760, 120); }
        if (now >= this.hunt.end) {
          this.hunt = null;
          this.app.beep(990, 200);
          this.app.toast(this.app.t('timers.cooldownDone'));
          this.render();
          return;
        }
      }
    }
    this.updateLive();
  },

  fmt(sec) {
    sec = Math.max(0, Math.floor(sec));
    return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
  },

  // --- Görünüm ---
  render() {
    const app = this.app;
    const t = k => app.esc(app.t(k));
    const diffs = Object.keys(this.GRACE).map(d =>
      `<option value="${d}" ${this.opts.difficulty === d ? 'selected' : ''}>${t('timers.diff.' + d)}</option>`).join('');
    const sizes = [0, 1, 2].map(i =>
      `<button data-size="${i}" class="${this.opts.size === i ? 'active' : ''}">${t('timers.size.' + i)}</button>`).join('');
    const marks = this.INCENSE_MARKS.map(m =>
      `<span class="tm-mark" data-at="${m.at}" style-left="${m.at / 180}"><i></i><b>${m.at}</b></span>`).join('');

    this.panel.innerHTML = `
      <section class="tm-card">
        <div class="tm-head"><span>${t('timers.incenseTitle')} <kbd>${app.esc(app.key('smudgeTimer'))}</kbd></span>
          <span class="tm-actions">
            <button class="link no-push" id="tm-inc-start">${t(this.incense ? 'timers.restart' : 'timers.start')}</button>
            ${this.incense ? `<button class="link no-push" id="tm-inc-stop">${t('timers.stop')}</button>` : ''}
          </span></div>
        <div class="tm-big" id="tm-inc-time">${this.incense ? '' : '—'}</div>
        <div class="tm-bar"><div class="tm-fill" id="tm-inc-fill"></div>${marks}</div>
        <div class="tm-legend">
          <span>60: Demon</span><span>90: ${t('timers.normalGhosts')}</span><span>180: Spirit</span>
        </div>
        <p class="hint" id="tm-inc-status"></p>
      </section>

      <section class="tm-card">
        <div class="tm-head"><span>${t('timers.huntTitle')} <kbd>${app.esc(app.key('huntTimer'))}</kbd></span>
          <span class="tm-actions">
            <button class="link no-push" id="tm-hunt-btn">${t(this.hunt && this.hunt.phase === 'hunt' ? 'timers.huntEnded' : 'timers.huntStarted')}</button>
            ${this.hunt ? `<button class="link no-push" id="tm-hunt-stop">${t('timers.stop')}</button>` : ''}
          </span></div>
        <div class="tm-big" id="tm-hunt-time">—</div>
        <div class="tm-bar"><div class="tm-fill" id="tm-hunt-fill"></div></div>
        <p class="hint" id="tm-hunt-status">${app.esc(app.t('timers.huntIdle', { key: app.key('huntTimer') }))}</p>
        ${this.lastHuntNote ? `<p class="tm-note">${app.esc(this.lastHuntNote)}</p>` : ''}
        <div class="tm-opts">
          <select id="tm-diff">${diffs}</select>
          <div class="seg">${sizes}</div>
        </div>
        <label class="check"><input type="checkbox" id="tm-cursed" ${this.opts.cursed ? 'checked' : ''}> ${t('timers.cursed')}</label>
        <p class="hint">${app.esc(app.t('timers.huntLen', { s: this.huntLength() }))}</p>
      </section>`;

    // Konumları JS ile ver (CSP satır içi stile izin vermiyor).
    this.panel.querySelectorAll('.tm-mark').forEach(el => { el.style.left = (Number(el.getAttribute('style-left')) * 100) + '%'; });

    const $ = id => this.panel.querySelector(id);
    $('#tm-inc-start').onclick = () => this.startIncense();
    if ($('#tm-inc-stop')) $('#tm-inc-stop').onclick = () => this.stopIncense();
    $('#tm-hunt-btn').onclick = () => this.huntButton();
    if ($('#tm-hunt-stop')) $('#tm-hunt-stop').onclick = () => this.stopHunt();
    $('#tm-diff').onchange = e => { this.opts.difficulty = e.target.value; this.saveOpts(); this.render(); };
    this.panel.querySelectorAll('[data-size]').forEach(b => b.onclick = () => {
      this.opts.size = Number(b.dataset.size); this.saveOpts(); this.render();
    });
    $('#tm-cursed').onchange = e => { this.opts.cursed = e.target.checked; this.saveOpts(); this.render(); };
    this.updateLive();
  },

  updateLive() {
    const app = this.app;
    const $ = id => this.panel.querySelector(id);
    if (!$('#tm-inc-time')) return;
    const now = Date.now();

    // Tütsü
    if (this.incense) {
      const s = (now - this.incense.start) / 1000;
      $('#tm-inc-time').textContent = this.fmt(s);
      $('#tm-inc-fill').style.width = Math.min(100, s / 180 * 100) + '%';
      const key = s < 60 ? 'safeAll' : s < 90 ? 'demon' : s < 180 ? 'normal' : 'spirit';
      $('#tm-inc-status').textContent = app.t(`timers.incenseStatus.${key}`);
      this.panel.querySelectorAll('.tm-mark').forEach(el => el.classList.toggle('passed', s >= Number(el.dataset.at)));
    } else {
      $('#tm-inc-time').textContent = '—';
      $('#tm-inc-fill').style.width = '0%';
      $('#tm-inc-status').textContent = app.t('timers.incenseIdle', { key: app.key('smudgeTimer') });
    }

    // Av / bekleme
    const fill = $('#tm-hunt-fill');
    if (this.hunt) {
      const total = (this.hunt.end - this.hunt.start) / 1000;
      const left = (this.hunt.end - now) / 1000;
      $('#tm-hunt-time').textContent = this.fmt(Math.ceil(left));
      fill.style.width = Math.max(0, Math.min(100, (1 - left / total) * 100)) + '%';
      fill.classList.toggle('hunt', this.hunt.phase === 'hunt');
      if (this.hunt.phase === 'hunt') {
        $('#tm-hunt-status').textContent = app.t('timers.huntRunning');
      } else {
        const passed = (now - this.hunt.start) / 1000;
        $('#tm-hunt-status').textContent = app.t(passed < this.COOLDOWN_DEMON ? 'timers.cooldownAll' : 'timers.cooldownDemon');
      }
    } else {
      $('#tm-hunt-time').textContent = '—';
      fill.style.width = '0%';
    }
  },

  onShortcut(action) {
    if (action === 'smudgeTimer') {
      this.startIncense();
      this.app.toast(this.app.t('timers.incenseStarted'));
    }
    if (action === 'huntTimer') {
      const wasHunt = this.hunt && this.hunt.phase === 'hunt';
      this.huntButton();
      this.app.toast(this.app.t(wasHunt ? 'timers.toastHuntEnded' : 'timers.toastHuntStarted'));
    }
  },

  onLanguageChange() { this.render(); }
});
