// Online oturum: Host bir kod alır, arkadaşları bu kodla katılır.
// Ortak olanlar: kanıt sayısı, bulunan/olmayan kanıtlar, elle elenen hayaletler, Kanlı Ay; ve kişi listesi.
// Host merkezdir: herkesin değişikliği host'a gider, host uygular ve güncel durumu herkese yollar.
//
// Mesajlar (veri kanalı, JSON):
//   katılan → host: {t:'hello', name, proto} {t:'op', op} {t:'rename', name}
//   host → katılan: {t:'welcome', state, members, you} {t:'state', state, reset} {t:'members', members}
App.register({
  id: 'session',
  icon: '👥',
  PROTO: 1,
  MAX_NAME: 20,
  MAX_MEMBERS: 8,

  async mount(panel, app) {
    this.panel = panel;
    this.app = app;
    const data = await app.loadGameData();
    this.evIds = new Set(data.evidence.map(e => e.id));
    this.ghostIds = new Set(data.ghosts.map(g => g.id));
    this.mode = 'idle';        // idle | hosting | connecting | joined
    this.link = null;
    this.members = [];         // [{id, name, host}]
    this.error = '';
    this.myId = null;

    // Yerel değişiklik → oturuma
    app.on('shared:local', op => {
      if (this.mode === 'hosting') this.broadcastState(op.k === 'reset');
      else if (this.mode === 'joined') this.link.send({ t: 'op', op });
    });
    app.sessionBanner = () => this.banner();
    this.render();
  },

  // --- Yardımcılar ---
  myName() { return this.cleanName(this.app.settings.playerName); },
  cleanName(s) { return String(s || '').replace(/[\u0000-\u001f]/g, '').trim().slice(0, this.MAX_NAME); },
  ev() { return this.app.evidenceModule; },

  // Karşı taraftan gelen veri güvenilmez: sadece bilinen alanlar ve değerler kabul edilir.
  validOp(op) {
    if (!op || typeof op !== 'object') return null;
    switch (op.k) {
      case 'count': return [0, 1, 2, 3].includes(op.n) ? { k: 'count', n: op.n } : null;
      case 'ev': return this.evIds.has(op.id) && [null, 'found', 'out'].includes(op.v ?? null) ? { k: 'ev', id: op.id, v: op.v ?? null } : null;
      case 'elim': return this.ghostIds.has(op.id) ? { k: 'elim', id: op.id, on: !!op.on } : null;
      case 'reset': return { k: 'reset' };
      case 'blood': return { k: 'blood', on: !!op.on };
      default: return null;
    }
  },
  validState(s) {
    if (!s || typeof s !== 'object' || ![0, 1, 2, 3].includes(s.count)) return null;
    const ev = {};
    for (const [k, v] of Object.entries(s.ev || {})) if (this.evIds.has(k) && (v === 'found' || v === 'out')) ev[k] = v;
    const eliminated = Array.isArray(s.eliminated) ? [...new Set(s.eliminated.filter(id => this.ghostIds.has(id)))] : [];
    return { count: s.count, ev, eliminated, bloodMoon: !!s.bloodMoon };
  },
  validMembers(list) {
    if (!Array.isArray(list)) return [];
    return list.slice(0, this.MAX_MEMBERS).map(m => ({ id: String(m && m.id || ''), name: this.cleanName(m && m.name) || '?', host: !!(m && m.host) }));
  },

  // --- Host ---
  startHost() {
    if (!this.requireName()) return;
    this.mode = 'connecting'; this.error = ''; this.render();
    this.members = [{ id: 'host', name: this.myName(), host: true }];
    this.myId = 'host';
    this.link = PeerLink.host({
      ready: code => { this.code = code; this.mode = 'hosting'; this.render(); this.ev().render(); },
      peerOpen: () => {},
      peerMessage: (pid, m) => this.onHostMessage(pid, m),
      peerClose: pid => {
        const before = this.members.length;
        this.members = this.members.filter(x => x.id !== pid);
        if (this.members.length !== before) {
          this.broadcastMembers();
          this.render();
        }
      },
      error: kind => this.fail(kind)
    });
  },
  onHostMessage(pid, m) {
    if (!m || typeof m !== 'object') return;
    const known = this.members.find(x => x.id === pid);
    if (m.t === 'hello') {
      if (m.proto !== this.PROTO) { this.link.send(pid, { t: 'bye', reason: 'version' }); return this.link.kick(pid); }
      if (!known && this.members.length >= this.MAX_MEMBERS) { this.link.send(pid, { t: 'bye', reason: 'full' }); return this.link.kick(pid); }
      const name = this.cleanName(m.name) || '?';
      if (known) known.name = name; else this.members.push({ id: pid, name, host: false });
      this.link.send(pid, { t: 'welcome', state: this.ev().getShared(), members: this.members, you: pid });
      this.broadcastMembers();
      this.app.toast(this.app.t('session.joinedToast', { name }));
      this.render();
    } else if (!known) {
      return; // selam vermeden mesaj gönderen yok sayılır
    } else if (m.t === 'op') {
      const op = this.validOp(m.op);
      if (!op) return;
      this.ev().applyOp(op);          // host'ta uygula (shared:local tetiklemeden)
      this.broadcastState(op.k === 'reset');
    } else if (m.t === 'rename') {
      known.name = this.cleanName(m.name) || known.name;
      this.broadcastMembers(); this.render();
    }
  },
  broadcastState(reset) { this.link.broadcast({ t: 'state', state: this.ev().getShared(), reset: !!reset }); },
  broadcastMembers() { this.link.broadcast({ t: 'members', members: this.members }); },

  // --- Katılan ---
  startJoin(rawCode) {
    if (!this.requireName()) return;
    const code = PeerLink.normalizeCode(rawCode);
    if (!PeerLink.isValidCode(code)) { this.error = this.app.t('session.err.badCode'); return this.render(); }
    this.mode = 'connecting'; this.error = ''; this.code = code; this.render();
    this.link = PeerLink.join(code, {
      open: () => this.link.send({ t: 'hello', name: this.myName(), proto: this.PROTO }),
      message: m => this.onClientMessage(m),
      closed: () => this.fail('lost'),
      error: kind => this.fail(kind)
    });
  },
  onClientMessage(m) {
    if (!m || typeof m !== 'object') return;
    if (m.t === 'welcome') {
      const st = this.validState(m.state);
      if (st) this.ev().setShared(st, false);
      this.members = this.validMembers(m.members);
      this.myId = String(m.you || '');
      this.mode = 'joined';
      this.render(); this.ev().render();
    } else if (m.t === 'state' && this.mode === 'joined') {
      const st = this.validState(m.state);
      if (st) this.ev().setShared(st, !!m.reset);
    } else if (m.t === 'members') {
      this.members = this.validMembers(m.members);
      this.render(); this.ev().render();
    } else if (m.t === 'bye') {
      this.fail(['full', 'version', 'ended'].includes(m.reason) ? m.reason : 'lost');
    }
  },

  // --- Ortak ---
  leave(silent) {
    if (this.link) {
      const link = this.link;
      if (this.mode === 'hosting') {
        link.broadcast({ t: 'bye', reason: 'ended' }); // katılanlara "host kapattı" de
        setTimeout(() => { try { link.close(); } catch {} }, 300);
      } else { try { link.close(); } catch {} }
    }
    this.link = null; this.mode = 'idle'; this.members = []; this.code = null; this.myId = null;
    if (!silent) this.error = '';
    this.render(); this.ev() && this.ev().render();
  },
  fail(kind) {
    const wasIn = this.mode === 'joined' || this.mode === 'hosting';
    this.leave(true);
    this.error = this.app.t('session.err.' + kind);
    this.render();
    if (wasIn) { this.app.toast(this.error, 4000); this.app.beep(330, 200); }
  },
  requireName() {
    if (this.myName()) return true;
    this.error = this.app.t('session.err.noName');
    this.render();
    const inp = this.panel.querySelector('#ss-name'); if (inp) inp.focus();
    return false;
  },

  // Kanıtlar sekmesinin üstündeki küçük oturum şeridi.
  banner() {
    if (this.mode !== 'hosting' && this.mode !== 'joined') return '';
    const t = (k, p) => this.app.esc(this.app.t(k, p));
    return `<div class="session-bar">👥 ${t('session.banner', { code: this.code, n: this.members.length })}</div>`;
  },

  render() {
    const app = this.app, t = (k, p) => app.esc(app.t(k, p));
    const name = app.esc(app.settings.playerName || '');
    const inSession = this.mode === 'hosting' || this.mode === 'joined';
    const memberList = this.members.map(m =>
      `<li><span>${app.esc(m.name)}</span>${m.host ? `<span class="mini">${t('session.hostTag')}</span>` : ''}${m.id === this.myId ? `<span class="muted">${t('session.you')}</span>` : ''}</li>`).join('');

    let body;
    if (this.mode === 'connecting') {
      body = `<p class="ss-status">${t('session.connecting')}</p>
        <button class="link no-push" id="ss-cancel">${t('session.cancel')}</button>`;
    } else if (inSession) {
      body = `
        <div class="ss-code-box">
          <span class="muted">${t('session.codeLabel')}</span>
          <div class="ss-code">${app.esc(this.code)}</div>
          ${this.mode === 'hosting' ? `<button class="link no-push" id="ss-copy">${t('session.copy')}</button><p class="hint">${t('session.shareHint')}</p>` : ''}
        </div>
        <h3>${t('session.members', { n: this.members.length })}</h3>
        <ul class="ss-members">${memberList}</ul>
        <p class="hint">${t(this.mode === 'hosting' ? 'session.hostNote' : 'session.joinNote')}</p>
        <button class="btn danger" id="ss-leave">${t(this.mode === 'hosting' ? 'session.end' : 'session.leave')}</button>`;
    } else {
      body = `
        <div class="ss-actions">
          <div class="ss-card">
            <b>${t('session.hostTitle')}</b>
            <p class="hint">${t('session.hostDesc')}</p>
            <button class="btn" id="ss-host">${t('session.host')}</button>
          </div>
          <div class="ss-card">
            <b>${t('session.joinTitle')}</b>
            <p class="hint">${t('session.joinDesc')}</p>
            <div class="row ss-join-row">
              <input type="text" id="ss-code" maxlength="8" placeholder="${t('session.codePlaceholder')}" autocomplete="off" spellcheck="false">
              <button class="btn" id="ss-join">${t('session.join')}</button>
            </div>
          </div>
        </div>`;
    }

    this.panel.innerHTML = `
      <div class="field">
        <label for="ss-name">${t('session.name')}</label>
        <input type="text" id="ss-name" maxlength="${this.MAX_NAME}" value="${name}" placeholder="${t('session.namePlaceholder')}" ${this.mode === 'connecting' ? 'disabled' : ''}>
      </div>
      ${this.error ? `<p class="ss-error">${app.esc(this.error)}</p>` : ''}
      ${body}`;
    this.bind();
  },

  bind() {
    const $ = s => this.panel.querySelector(s);
    const nameInp = $('#ss-name');
    nameInp.onchange = async () => {
      const n = this.cleanName(nameInp.value);
      await window.api.setSettings({ playerName: n });
      this.app.settings.playerName = n;
      if (n && this.error === this.app.t('session.err.noName')) { this.error = ''; this.render(); }
      if (this.mode === 'hosting') {
        const me = this.members.find(m => m.id === 'host'); if (me) me.name = n || me.name;
        this.broadcastMembers(); this.render();
      } else if (this.mode === 'joined') this.link.send({ t: 'rename', name: n });
    };
    if ($('#ss-host')) $('#ss-host').onclick = () => this.startHost();
    if ($('#ss-join')) {
      const codeInp = $('#ss-code');
      $('#ss-join').onclick = () => this.startJoin(codeInp.value);
      codeInp.onkeydown = e => { if (e.key === 'Enter') this.startJoin(codeInp.value); };
      codeInp.oninput = () => { const v = PeerLink.normalizeCode(codeInp.value); if (v !== codeInp.value) codeInp.value = v; };
    }
    if ($('#ss-cancel')) $('#ss-cancel').onclick = () => this.leave();
    if ($('#ss-leave')) $('#ss-leave').onclick = () => this.leave();
    if ($('#ss-copy')) $('#ss-copy').onclick = async () => {
      await window.api.copyText(this.code);
      this.app.toast(this.app.t('session.copied'));
    };
  },

  onLanguageChange() { this.render(); }
});
